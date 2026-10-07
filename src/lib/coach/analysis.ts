import type { Trade, Journal, Checklist } from "@/hooks/useTrades";
import { parseStrategySetup, buildBroadSetupKey } from "@/lib/strategySetup";
import type { IncludeFlags } from "@/lib/ai";
import type { CoachAnalysis, CoachData, WindowRange, Evidence, Measure, Comparison } from "./types";

const CHECKS = ["checked_higher_tf", "risk_within_limits", "fits_plan", "key_levels", "news_checked"] as const;
const round = (value: number) => Math.round(value * 100) / 100;
const sum = (trades: Trade[]) => round(trades.reduce((total, t) => total + Number(t.pnl), 0));
const rate = (yes: number, total: number) => total ? round(yes / total * 100) : null;
const money = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const present = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const inWindow = (trade: Trade, start: string | null, end: string) => Number.isFinite(Date.parse(trade.open_time)) && (!start || Date.parse(trade.open_time) >= Date.parse(start)) && Date.parse(trade.open_time) < Date.parse(end);
const hasStop = (t: Trade) => Number.isFinite(Number(t.stop_loss)) && Number(t.stop_loss) > 0;
const cut = (text: string | null, size = 600) => text ? text.slice(0, size) : null;
function evenlySample<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  return Array.from({ length: limit }, (_, i) => items[Math.floor(i * (items.length - 1) / (limit - 1))]);
}
function recordedChecks(checklists: Checklist[]) {
  const answers = checklists.flatMap(c => CHECKS.map(key => c[key])).filter(answer => typeof answer === "boolean");
  return { total: answers.length, yes: answers.filter(Boolean).length };
}
function sessionOf(trade: Trade, journal: Journal | undefined, include: IncludeFlags) {
  const setupSession = include.strategySetup ? parseStrategySetup(journal?.strategy_setup).market_session : "";
  return setupSession || trade.session || "Unspecified";
}
/** Sanitize first: neither summaries nor samples may reveal excluded sources. */
export function analyzeCoachData(data: CoachData, window: WindowRange, include: IncludeFlags): CoachAnalysis {
  const trades = data.trades.filter(t => inWindow(t, window.start, window.end)).sort((a, b) => Date.parse(a.open_time) - Date.parse(b.open_time) || a.id.localeCompare(b.id));
  const previous = window.previousStart && window.start ? data.trades.filter(t => inWindow(t, window.previousStart, window.start)) : [];
  const ids = new Set(trades.map(t => t.id));
  const journals = data.journals.filter(j => ids.has(j.trade_id)).map(j => ({
    ...j,
    pre_trade_notes: include.journalEntries ? j.pre_trade_notes : null,
    post_trade_notes: include.journalEntries ? j.post_trade_notes : null,
    rating: include.journalEntries ? j.rating : null,
    risk_reward: include.journalEntries ? j.risk_reward : null,
    strategy_setup: include.strategySetup ? j.strategy_setup : null,
    emotions: include.emotions ? j.emotions : null,
    tags: include.tags ? j.tags : null,
    lessons: include.lessonsLearned ? j.lessons : null,
  }));
  const journalMap = new Map(journals.map(j => [j.trade_id, j]));
  const checklists = include.executionChecklist ? data.checklists.filter(c => ids.has(c.trade_id)) : [];
  const checklistMap = new Map(checklists.map(c => [c.trade_id, c]));
  const notes = journals.filter(j => present(j.pre_trade_notes) || present(j.post_trade_notes));
  const emotional = journals.filter(j => present(j.emotions));
  const evidence: Evidence[] = [];
  const limitations = [...data.warnings];
  const unavailable = (source: string) => data.warnings.some(w => w.startsWith(`${source} could not be loaded`));
  const add = (id: string, title: string, observation: string, linked: string[] = []) => {
    const unique = [...new Set(linked)];
    evidence.push({ id, title, observation, tradeIds: evenlySample(unique, 12), totalRecords: unique.length });
  };
  add("coverage", "Review coverage", `${trades.length} trades opened in this window. ${unavailable("journals") ? "Journal context is unavailable." : `${notes.length} linked journal notes included.`} ${unavailable("checklists") ? "Checklist context is unavailable." : `${checklists.length} checklist records included.`}`, trades.map(t => t.id));
  if (trades.length < 20) limitations.push("Fewer than 20 trades: patterns are exploratory, not proof of a repeatable edge.");
  if (!include.trades) limitations.push("Trade performance is excluded. Outcomes, sessions, prices, sizing and trade-derived measures are not sent to the coach.");
  if (include.journalEntries && !unavailable("journals") && notes.length < trades.length) limitations.push(`Journal context is missing for ${trades.length - notes.length} trades. Missing notes are not evidence of poor discipline.`);
  const numericTrades = trades.filter(t => t.pnl != null && Number.isFinite(Number(t.pnl)));
  if (include.trades && numericTrades.length < trades.length) limitations.push("Some trades have no valid P&L; those trades are excluded from outcome calculations.");
  if (include.trades && trades.length) {
    const stops = trades.filter(hasStop);
    add("stops", "Recorded stop losses", `${stops.length}/${trades.length} trades (${rate(stops.length, trades.length)}%) have a positive stop-loss value recorded. Missing values do not prove the trade was executed without a stop. Stop modifications and actual money at risk are unavailable.`, trades.filter(t => !hasStop(t)).map(t => t.id));
  }
  if (include.trades && numericTrades.length) {
    const wins = numericTrades.filter(t => Number(t.pnl) > 0), losses = numericTrades.filter(t => Number(t.pnl) < 0);
    const avgWin = wins.length ? sum(wins) / wins.length : null;
    const avgLoss = losses.length ? Math.abs(sum(losses)) / losses.length : null;
    add("outcomes", "Payoff & outcomes", `${numericTrades.length} trades with recorded P&L: ${wins.length} wins, ${losses.length} losses, ${numericTrades.length - wins.length - losses.length} breakeven. Net P&L ${money(sum(numericTrades))} in recorded account units; win rate ${rate(wins.length, numericTrades.length)}%. Average winner ${avgWin === null ? "unavailable" : money(avgWin)}, average loss ${avgLoss === null ? "unavailable" : money(avgLoss)}; realized payoff ${avgWin !== null && avgLoss ? `${round(avgWin / avgLoss)}:1` : "unavailable"}. Payoff is not planned or realized R-multiple.`, numericTrades.map(t => t.id));
    let equity = 0, peak = 0, maxDrawdown = 0;
    [...numericTrades].sort((a, b) => Date.parse(a.close_time) - Date.parse(b.close_time)).forEach(t => { equity += Number(t.pnl); peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, peak - equity); });
    add("drawdown", "Closed-trade drawdown", `Maximum peak-to-trough cumulative closed P&L drawdown: ${money(maxDrawdown)} account units, starting from zero. This is not equity drawdown and excludes deposits, withdrawals and floating P&L.`, numericTrades.map(t => t.id));
    const groups = new Map<string, Trade[]>();
    numericTrades.forEach(t => { const name = sessionOf(t, journalMap.get(t.id), include); groups.set(name, [...(groups.get(name) || []), t]); });
    let index = 0;
    for (const [name, group] of [...groups].sort((a, b) => b[1].length - a[1].length).slice(0, 20)) add(`session-${index++}`, `Session: ${cut(name, 120)}`, `${group.length} trades labeled ${cut(name, 120)}; net P&L ${money(sum(group))}, win rate ${rate(group.filter(t => Number(t.pnl) > 0).length, group.length)}%. Session labels are recorded data, not a time-window inference.`, group.map(t => t.id));
    if (groups.size > 20) limitations.push("Only the 20 most frequent session labels are summarized.");
    const offSession = numericTrades.filter(t => /^off[ -]?session\b/i.test(sessionOf(t, journalMap.get(t.id), include)));
    const onSession = numericTrades.filter(t => !/^off[ -]?session\b/i.test(sessionOf(t, journalMap.get(t.id), include)) && sessionOf(t, journalMap.get(t.id), include) !== "Unspecified");
    if (offSession.length) add("off-session", "Explicit off-session entries", `${offSession.length} trades explicitly marked off-session: net P&L ${money(sum(offSession))}; ${onSession.length} other session-labeled trades: net P&L ${money(sum(onSession))}. Compare sample sizes; a label alone does not prove a rule violation.`, offSession.map(t => t.id));
    const rapid: string[] = [];
    const closed = [...numericTrades].sort((a, b) => Date.parse(a.close_time) - Date.parse(b.close_time));
    // Find only trades that actually closed before this entry. Overlapping positions are not loss responses.
    let cursor = 0; let prior: Trade | undefined;
    for (const current of trades) {
      while (cursor < closed.length && Date.parse(closed[cursor].close_time) <= Date.parse(current.open_time)) { prior = closed[cursor++]; }
      if (prior && prior.id !== current.id && prior.symbol === current.symbol && Number(prior.pnl) < 0 && Date.parse(current.open_time) - Date.parse(prior.close_time) <= 30 * 60000 && Number(prior.lot_size) > 0 && Number(current.lot_size) > Number(prior.lot_size) * 1.5) rapid.push(current.id);
    }
    add("loss-response", "Larger entries after a loss", `${rapid.length} entries in the same symbol within 30 minutes after the most recent closed losing trade, with lot size >1.5× that trade. This is a review flag, not proof of revenge trading or higher monetary risk.`, rapid);
    const symbolGroups = new Map<string, Trade[]>();
    trades.forEach(t => { symbolGroups.set(t.symbol, [...(symbolGroups.get(t.symbol) || []), t]); });
    index = 0;
    for (const [symbol, group] of [...symbolGroups].sort((a, b) => b[1].length - a[1].length).slice(0, 20)) {
      const lots = group.map(t => Number(t.lot_size)).filter(n => Number.isFinite(n) && n > 0);
      if (lots.length < 2) continue;
      const mean = lots.reduce((s, n) => s + n, 0) / lots.length;
      const deviation = Math.sqrt(lots.reduce((s, n) => s + (n - mean) ** 2, 0) / lots.length);
      add(`size-${index++}`, `Position size: ${symbol}`, `${lots.length} recorded sizes; mean ${round(mean)} lots; coefficient of variation ${round(deviation / mean * 100)}%. Lot variation is not risk variation: stop distances and contract specifications matter.`, group.map(t => t.id));
    }
  }
  if (include.strategySetup) {
    const groups = new Map<string, Journal[]>();
    journals.filter(j => present(j.strategy_setup)).forEach(j => {
      const parsed = parseStrategySetup(j.strategy_setup);
      const name = buildBroadSetupKey(parsed);
      const key = name === "Unspecified" ? cut(j.strategy_setup, 160)! : name;
      groups.set(key, [...(groups.get(key) || []), j]);
    });
    [...groups].sort((a, b) => b[1].length - a[1].length).slice(0, 12).forEach(([name, group], i) => {
      const linked = new Set(group.map(j => j.trade_id));
      const matching = numericTrades.filter(t => linked.has(t.id));
      add(`setup-${i}`, `Setup: ${name}`, `${linked.size} trades with this recorded setup.${include.trades ? ` Recorded net P&L ${money(sum(matching))} across ${matching.length} valid outcomes.` : ""}`, [...linked]);
    });
    if (groups.size > 12) limitations.push("The 12 most frequent setups are summarized; less frequent setups remain in sampled records when available.");
  }
  if (include.tags) {
    const groups = new Map<string, Set<string>>();
    journals.forEach(j => (j.tags || "").split(/[,;|]/).map(s => s.trim()).filter(Boolean).forEach(tag => { if (!groups.has(tag)) groups.set(tag, new Set()); groups.get(tag)!.add(j.trade_id); }));
    [...groups].sort((a, b) => b[1].size - a[1].size).slice(0, 12).forEach(([tag, linked], i) => add(`tag-${i}`, `Tag: ${cut(tag, 120)}`, `${linked.size} trades carry the tag “${cut(tag, 120)}”.${include.trades ? ` Net P&L ${money(sum(numericTrades.filter(t => linked.has(t.id))))}.` : ""}`, [...linked]));
  }
  if (include.journalEntries || include.emotions || include.lessonsLearned) {
    const texts = journals.map(j => ({ j, text: [j.pre_trade_notes, j.post_trade_notes, j.emotions, j.lessons].filter(Boolean).join(" | ") }));
    for (const keyword of ["fomo", "revenge", "fear", "hesitation", "greed", "patience"]) {
      const matching = texts.filter(({ text }) => new RegExp(`\\b${keyword}\\b`, "i").test(text));
      if (matching.length) add(`mention-${keyword}`, `Journal mentions: ${keyword}`, `${matching.length} journal records mention “${keyword}”. A mention can describe resisting, avoiding or experiencing it; read the context before interpreting.`, matching.map(({ j }) => j.trade_id));
    }
    // Quote exact excerpts from evenly spread records, rather than inventing paraphrased observations.
    evenlySample(texts.filter(t => t.text), 24).forEach(({ j }, i) => {
      const fields = [["Pre-trade", j.pre_trade_notes], ["Post-trade", j.post_trade_notes], ["Emotion", j.emotions], ["Lesson", j.lessons]].filter(([, text]) => text);
      add(`journal-${i}`, "Journal excerpt", fields.map(([name, text]) => `${name}: “${cut(text!, 350)}”`).join("\n"), [j.trade_id]);
    });
  }
  const checks = recordedChecks(checklists);
  if (include.executionChecklist) {
    add("checklists", "Recorded checklist answers", unavailable("checklists") ? "Checklist records could not be loaded. Adherence and coverage are unknown." : `${checks.yes}/${checks.total} recorded answers are checked (${rate(checks.yes, checks.total) ?? "unavailable"}%). ${checklists.length}/${trades.length} trades have a checklist record. Null or absent answers are unknown, not failed.`, checklists.map(c => c.trade_id));
    const violations = data.violations.filter(v => (!window.start || v.violation_date >= window.start.slice(0, 10)) && v.violation_date <= window.end.slice(0, 10));
    const active = data.rules.filter(rule => rule.active);
    add("rules", "Rules & logged violations", `${unavailable("trading rules") ? "Rule definitions are unavailable." : `${active.length} currently active rules.`} ${unavailable("rule violations") ? "Logged violations are unavailable; their count is unknown." : `${violations.length} manually logged violations on dates overlapping this window.`} Rules may have changed since these trades; boundary dates can include events outside the exact time window.\n${active.slice(0, 15).map(r => `Rule: ${cut(r.rule, 200)}`).join("\n")}\n${violations.slice(0, 15).map(v => `${v.violation_date}: ${cut(data.rules.find(r => r.id === v.rule_id)?.rule || "Historical rule", 150)} — ${cut(v.note, 200) || "No note"}`).join("\n")}`);
  }
  if (include.screenshots) {
    const shots = data.screenshots.filter(s => ids.has(s.trade_id));
    add("screenshots", "Screenshot coverage", unavailable("screenshots") ? "Screenshot metadata could not be loaded. Attachment coverage is unknown." : `${shots.length} screenshots are attached across ${new Set(shots.map(s => s.trade_id)).size} trades. Images are not sent or visually analyzed by this text-only report.`, shots.map(s => s.trade_id));
    limitations.push("Screenshot coverage only: no image contents or chart-quality conclusions are available.");
  }
  const executionAnswers = checklists.flatMap(c => [c.fits_plan, c.checked_higher_tf, c.key_levels]).filter(v => typeof v === "boolean");
  const weeks = new Map<string, Trade[]>();
  numericTrades.forEach(t => { const d = new Date(t.close_time); if (!Number.isFinite(+d)) return; const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); utc.setUTCDate(utc.getUTCDate() - (utc.getUTCDay() + 6) % 7); const key = utc.toISOString().slice(0, 10); weeks.set(key, [...(weeks.get(key) || []), t]); });
  const weekGroups = [...weeks.values()].filter(group => group.length >= 3);
  const weekRates = weekGroups.map(group => group.filter(t => Number(t.pnl) > 0).length / group.length);
  const mean = weekRates.reduce((s, n) => s + n, 0) / (weekRates.length || 1);
  const std = Math.sqrt(weekRates.reduce((s, n) => s + (n - mean) ** 2, 0) / (weekRates.length || 1));
  if (include.trades && weekGroups.length >= 3) add("stability", "Weekly outcome variation", `${weekGroups.length} UTC weeks with at least 3 trades each. Win-rate standard deviation ${round(std * 100)} percentage points. Partial weeks are included. Stable losses can also produce a high stability measure.`, weekGroups.flatMap(group => group.map(t => t.id)));
  const measures: Measure[] = [
    { dimension: "discipline", label: "Checklist follow-through", score: checklists.length >= 3 ? rate(checks.yes, checks.total) : null, formula: "Checked answers ÷ recorded boolean answers × 100", detail: `${checks.yes} of ${checks.total} recorded checklist answers checked.`, limitation: "Self-reported checklist adherence, not verified rule compliance. Requires 3 checklist records.", evidenceIds: include.executionChecklist ? ["checklists"] : [] },
    { dimension: "risk", label: "Stop-loss documentation", score: include.trades && trades.length >= 3 ? rate(trades.filter(hasStop).length, trades.length) : null, formula: "Trades with a positive recorded stop ÷ all selected trades × 100", detail: include.trades ? `${trades.filter(hasStop).length} of ${trades.length} trades have a recorded stop.` : "Trade data is excluded.", limitation: "Documentation only. It cannot establish stop quality, money at risk, or whether a stop was moved. Requires 3 trades.", evidenceIds: evidence.some(e => e.id === "stops") ? ["stops"] : [] },
    { dimension: "execution", label: "Preparation adherence", score: checklists.length >= 3 ? rate(executionAnswers.filter(Boolean).length, executionAnswers.length) : null, formula: "Checked plan-fit, higher-timeframe and key-level answers ÷ recorded answers × 100", detail: `${executionAnswers.filter(Boolean).length} of ${executionAnswers.length} recorded preparation answers checked.`, limitation: "Preparation is a proxy. Entry/exit quality needs planned-vs-actual fills and chart context. Requires 3 checklists.", evidenceIds: include.executionChecklist ? ["checklists"] : [] },
    { dimension: "psychology", label: "Emotion reflection coverage", score: include.emotions && trades.length >= 3 && !data.warnings.some(w => w.startsWith("journals")) ? rate(emotional.length, trades.length) : null, formula: "Trades with recorded emotions ÷ all selected trades × 100", detail: include.emotions ? `${emotional.length} of ${trades.length} trades have emotion notes.` : "Emotion notes are excluded.", limitation: "Measures reflection, not mental health or emotional control. Honest negative emotions are not penalized. Requires 3 trades.", evidenceIds: ["coverage"] },
    { dimension: "consistency", label: "Outcome stability", score: include.trades && weekGroups.length >= 3 ? round(Math.max(0, 1 - std * 2) * 100) : null, formula: "max(0, 1 − 2 × weekly win-rate standard deviation) × 100", detail: include.trades ? `${weekGroups.length} weeks have at least 3 trades.` : "Trade data is excluded.", limitation: "Requires 3 qualifying UTC weeks. Stability alone says nothing about profitability or process quality.", evidenceIds: evidence.some(e => e.id === "stability") ? ["stability"] : [] },
  ];
  const comparisons: Comparison[] = [];
  for (const measure of measures) {
    if ((measure.dimension === "discipline" || measure.dimension === "execution") && (!include.executionChecklist || unavailable("checklists"))) measure.detail = include.executionChecklist ? "Checklist data is unavailable." : "Checklists are excluded.";
    if (measure.dimension === "psychology" && include.emotions && unavailable("journals")) measure.detail = "Emotion notes could not be loaded. Reflection coverage is unknown.";
  }
  const previousIds = new Set(previous.map(t => t.id));
  const previousJournals = data.journals.filter(j => previousIds.has(j.trade_id));
  const previousChecklists = data.checklists.filter(c => previousIds.has(c.trade_id));
  const comparable = !!window.start && trades.length >= 5 && previous.length >= 5;
  if (comparable) {
    const compare = (key: string, label: string, current: number | null, prior: number | null, lowerBetter = false) => {
      if (current === null || prior === null) return;
      const direction = current === prior ? "neutral" : (current > prior) !== lowerBetter ? "up" : "down";
      add(`change-${key}`, `${label}: previous period`, `${label}: ${prior}% in preceding equal-duration window (${window.previousStart} to ${window.start}), ${current}% now. Previous sample ${previous.length} trades; current ${trades.length}. Change ${round(current - prior)} percentage points. Different market conditions and missing records can affect comparison.`);
      comparisons.push({ label, current, previous: prior, unit: "%", direction, evidenceId: `change-${key}` });
    };
    if (include.trades) {
      const priorValid = previous.filter(t => t.pnl != null && Number.isFinite(Number(t.pnl)));
      if (numericTrades.length >= 5 && priorValid.length >= 5) compare("winrate", "Win rate", rate(numericTrades.filter(t => Number(t.pnl) > 0).length, numericTrades.length), rate(priorValid.filter(t => Number(t.pnl) > 0).length, priorValid.length));
      compare("stops", "Stop documentation", rate(trades.filter(hasStop).length, trades.length), rate(previous.filter(hasStop).length, previous.length));
    }
    if (include.executionChecklist && checklists.length >= 3 && previousChecklists.length >= 3) { const prior = recordedChecks(previousChecklists); compare("checklists", "Checklist follow-through", rate(checks.yes, checks.total), rate(prior.yes, prior.total)); }
    if (include.journalEntries && !unavailable("journals")) compare("journals", "Journal coverage", rate(notes.length, trades.length), rate(previousJournals.filter(j => present(j.pre_trade_notes) || present(j.post_trade_notes)).length, previous.length));
  }
  const sampled = evenlySample(trades, 160);
  if (sampled.length < trades.length) limitations.push(`Aggregates cover all ${trades.length} selected trades. Detailed records are evenly sampled across the period (${sampled.length} trades); rare events can be missed in narrative analysis.`);
  limitations.push("Journal excerpts and sampled text fields are length-limited. Correlation and recorded mentions do not establish causation; root causes remain hypotheses.");
  let samples = sampled.map((t, index) => {
    const j = journalMap.get(t.id), c = checklistMap.get(t.id);
    const row: Record<string, unknown> = { record: t.id, sample: index + 1 };
    if (include.trades) Object.assign(row, { symbol: t.symbol, open: t.open_time, close: t.close_time, direction: t.direction, entry: t.entry_price, exit: t.exit_price, pnl: t.pnl, lot: t.lot_size, sl: t.stop_loss, tp: t.take_profit, session: t.session });
    if (j) {
      if (include.journalEntries) Object.assign(row, { pre: cut(j.pre_trade_notes), post: cut(j.post_trade_notes), recordedRR: cut(j.risk_reward, 50), rating: j.rating });
      if (include.strategySetup) row.setup = cut(j.strategy_setup, 1200);
      if (include.emotions) row.emotions = cut(j.emotions, 300);
      if (include.tags) row.tags = cut(j.tags, 200);
      if (include.lessonsLearned) row.lessons = cut(j.lessons);
    }
    if (c) row.checklist = Object.fromEntries(CHECKS.map(key => [key, c[key]]));
    return row;
  });
  while (JSON.stringify(samples).length > 120000 && samples.length > 10) samples = evenlySample(samples, Math.floor(samples.length * 0.75));
  if (samples.length < sampled.length) limitations.push(`Long journal text reduced detailed samples to ${samples.length} records to fit the review context. Full-period aggregates are unchanged.`);
  // Keep only cited/example records for rendering saved reviews. No unselected text or financial fields.
  const visibleIds = new Set(evidence.flatMap(e => e.tradeIds));
  return { window, include: { ...include }, evidence, measures, comparisons, comparisonNote: !window.start ? "Full-history reviews have no preceding comparable period." : comparable ? "Compared with the immediately preceding window of equal duration. Changes are descriptive, not causal." : "Comparison needs at least 5 trades in both this and the preceding equal-duration window.", tradeCount: trades.length, journalCount: notes.length, checklistCount: checklists.length, sampleCount: samples.length, samples, limitations, records: trades.filter(t => visibleIds.has(t.id)).map(t => ({ id: t.id, date: t.open_time, ...(include.trades ? { symbol: t.symbol, pnl: t.pnl } : {}) })) };
}
