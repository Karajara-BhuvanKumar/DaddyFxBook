// ============================================================
// Prompt Builder
// Constructs the elite AI Report prompt from all available data.
// ALL numeric metrics are pre-computed client-side.
// The LLM receives structured context, not raw rows for math.
// ============================================================

import type { Trade, Journal, Checklist } from "@/hooks/useTrades";
import type { ScorecardSnapshot } from "@/lib/scoring";
import { buildPeriodStats } from "@/lib/periodStats";
import {
  MAX_JOURNAL_TEXT_CHARS,
  MAX_STRATEGY_TEXT_CHARS,
  MAX_EMOTIONS_TEXT_CHARS,
  MAX_LESSONS_TEXT_CHARS,
  MAX_TRADES_PER_PROMPT,
} from "./constants";

// ── Include Flags ─────────────────────────────────────────────
export interface IncludeFlags {
  trades: boolean;
  journalEntries: boolean;
  strategySetup: boolean;
  emotions: boolean;
  tags: boolean;
  lessonsLearned: boolean;
  screenshots: boolean;
  executionChecklist: boolean;
}

export interface PromptBuilderInput {
  trades: Trade[];
  journals: Journal[];
  checklists: Checklist[];
  screenshots: any[];
  scorecard: ScorecardSnapshot;
  reportType: "Daily" | "Weekly" | "Monthly" | "Custom" | "Full";
  include: IncludeFlags;
  customInstructions?: string;
  backtestSummary?: string;
  tradeReviewGrades?: Array<"A+" | "A" | "B" | "C" | "F">;
}

// ── Utilities ─────────────────────────────────────────────────

function tr(text: string | null | undefined, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function fmt(n: number, dec = 2): string {
  return n.toFixed(dec);
}

// ── Pre-compute all metrics client-side ───────────────────────

function computeAdvancedMetrics(trades: Trade[], journals: Journal[]) {
  const sorted = [...trades].sort((a, b) => +new Date(a.close_time) - +new Date(b.close_time));

  // Direction analysis
  const longs = sorted.filter((t) => t.direction?.toLowerCase() === "long");
  const shorts = sorted.filter((t) => t.direction?.toLowerCase() === "short");
  const longWins = longs.filter((t) => Number(t.pnl) > 0);
  const shortWins = shorts.filter((t) => Number(t.pnl) > 0);

  // Day-of-week
  const byDow: Record<string, { count: number; pnl: number; wins: number }> = {};
  sorted.forEach((t) => {
    const dow = new Date(t.close_time).toLocaleDateString("en-US", { weekday: "long" });
    byDow[dow] ??= { count: 0, pnl: 0, wins: 0 };
    byDow[dow].count++;
    byDow[dow].pnl += Number(t.pnl);
    if (Number(t.pnl) > 0) byDow[dow].wins++;
  });

  // Time-of-day (UTC hour)
  const byHour: Record<number, { count: number; pnl: number; wins: number }> = {};
  sorted.forEach((t) => {
    const h = new Date(t.open_time).getUTCHours();
    byHour[h] ??= { count: 0, pnl: 0, wins: 0 };
    byHour[h].count++;
    byHour[h].pnl += Number(t.pnl);
    if (Number(t.pnl) > 0) byHour[h].wins++;
  });

  // Lot size stats
  const lots = sorted.map((t) => Number(t.lot_size));
  const avgLot = lots.length ? lots.reduce((a, b) => a + b, 0) / lots.length : 0;
  const maxLot = lots.length ? Math.max(...lots) : 0;
  const minLot = lots.length ? Math.min(...lots) : 0;

  // Revenge trade detection (loss → <30 min gap → bigger lot)
  const revengeTrades: Array<{ symbol: string; date: string; lotRatio: number }> = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gapMin = (+new Date(curr.open_time) - +new Date(prev.close_time)) / 60_000;
    if (Number(prev.pnl) < 0 && gapMin < 30 && Number(curr.lot_size) > Number(prev.lot_size) * 1.4) {
      revengeTrades.push({
        symbol: curr.symbol,
        date: curr.open_time,
        lotRatio: Number(curr.lot_size) / Number(prev.lot_size),
      });
    }
  }

  // FOMO proxy: >3 trades opened within 15-minute window
  const fomoEvents: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const window = sorted.filter(
      (t) => Math.abs(+new Date(t.open_time) - +new Date(sorted[i].open_time)) < 15 * 60_000,
    );
    if (window.length > 3 && !fomoEvents.includes(sorted[i].open_time.slice(0, 16))) {
      fomoEvents.push(sorted[i].open_time.slice(0, 16));
    }
  }

  // Loss streaks
  const lossStreaks: Array<{ length: number; startDate: string }> = [];
  let curL = 0;
  let streakStart = "";
  for (const t of sorted) {
    if (Number(t.pnl) < 0) {
      if (curL === 0) streakStart = t.close_time;
      curL++;
    } else {
      if (curL >= 3) lossStreaks.push({ length: curL, startDate: streakStart.slice(0, 10) });
      curL = 0;
    }
  }
  if (curL >= 3) lossStreaks.push({ length: curL, startDate: streakStart.slice(0, 10) });

  // Win streaks
  const winStreaks: Array<{ length: number; startDate: string }> = [];
  let curW = 0;
  let wStart = "";
  for (const t of sorted) {
    if (Number(t.pnl) > 0) {
      if (curW === 0) wStart = t.close_time;
      curW++;
    } else {
      if (curW >= 3) winStreaks.push({ length: curW, startDate: wStart.slice(0, 10) });
      curW = 0;
    }
  }
  if (curW >= 3) winStreaks.push({ length: curW, startDate: wStart.slice(0, 10) });

  // Drawdown calculation
  let peak = 0;
  let cum = 0;
  let maxDrawdown = 0;
  let drawdownStart = "";
  for (const t of sorted) {
    cum += Number(t.pnl);
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      drawdownStart = t.close_time.slice(0, 10);
    }
  }

  // Emotion aggregation
  const emotionFreq: Record<string, number> = {};
  journals.forEach((j) => {
    if (!j.emotions) return;
    j.emotions
      .toLowerCase()
      .split(/[\s,;.!?]+/)
      .filter((w) => w.length > 3)
      .forEach((w) => { emotionFreq[w] = (emotionFreq[w] ?? 0) + 1; });
  });
  const topEmotions = Object.entries(emotionFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => `${word}(${count})`);

  // Strategy setup frequency
  const setupFreq: Record<string, { count: number; wins: number; pnl: number }> = {};
  journals.forEach((j) => {
    if (!j.strategy_setup) return;
    const key = j.strategy_setup.slice(0, 40);
    const trade = sorted.find((t) => t.id === j.trade_id);
    if (!trade) return;
    setupFreq[key] ??= { count: 0, wins: 0, pnl: 0 };
    setupFreq[key].count++;
    setupFreq[key].pnl += Number(trade.pnl);
    if (Number(trade.pnl) > 0) setupFreq[key].wins++;
  });

  // Overtrading detection: days with >5 trades
  const byDay: Record<string, number> = {};
  sorted.forEach((t) => {
    const d = t.open_time.slice(0, 10);
    byDay[d] = (byDay[d] ?? 0) + 1;
  });
  const overtradingDays = Object.entries(byDay)
    .filter(([, c]) => c > 5)
    .map(([date, count]) => `${date} (${count} trades)`);

  // Profit factor
  const grossProfit = sorted.filter((t) => Number(t.pnl) > 0).reduce((s, t) => s + Number(t.pnl), 0);
  const grossLoss = Math.abs(sorted.filter((t) => Number(t.pnl) < 0).reduce((s, t) => s + Number(t.pnl), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  // Expectancy
  const winRate = sorted.length ? sorted.filter((t) => Number(t.pnl) > 0).length / sorted.length : 0;
  const avgWin = longWins.length + shortWins.length > 0
    ? sorted.filter((t) => Number(t.pnl) > 0).reduce((s, t) => s + Number(t.pnl), 0) / (sorted.filter((t) => Number(t.pnl) > 0).length || 1)
    : 0;
  const avgLoss = sorted.filter((t) => Number(t.pnl) < 0).length
    ? Math.abs(sorted.filter((t) => Number(t.pnl) < 0).reduce((s, t) => s + Number(t.pnl), 0)) / sorted.filter((t) => Number(t.pnl) < 0).length
    : 0;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;

  return {
    sorted,
    longs,
    shorts,
    longWins,
    shortWins,
    byDow,
    byHour,
    avgLot,
    maxLot,
    minLot,
    revengeTrades,
    fomoEvents,
    lossStreaks,
    winStreaks,
    maxDrawdown,
    drawdownStart,
    topEmotions,
    setupFreq,
    overtradingDays,
    profitFactor,
    grossProfit,
    grossLoss,
    winRate,
    avgWin,
    avgLoss,
    expectancy,
  };
}

// ── Trade Row Serializer ──────────────────────────────────────

function buildTradeRow(
  trade: Trade,
  journal: Journal | undefined,
  checklist: Checklist | undefined,
  screenshotCount: number,
  include: IncludeFlags,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (include.trades) {
    row.sym = trade.symbol;
    row.dir = trade.direction;
    row.open = trade.open_time;
    row.close = trade.close_time;
    row.entry = trade.entry_price;
    row.exit = trade.exit_price;
    row.lot = trade.lot_size;
    row.pnl = trade.pnl;
    row.session = trade.session ?? "?";
    row.sl = trade.stop_loss ?? null;
    row.tp = trade.take_profit ?? null;
  }

  if (journal) {
    if (include.journalEntries) {
      row.pre = tr(journal.pre_trade_notes, MAX_JOURNAL_TEXT_CHARS);
      row.post = tr(journal.post_trade_notes, MAX_JOURNAL_TEXT_CHARS);
      row.rr = journal.risk_reward ?? null;
      row.rating = journal.rating ?? null;
    }
    if (include.strategySetup) row.setup = tr(journal.strategy_setup, MAX_STRATEGY_TEXT_CHARS);
    if (include.emotions) row.emotion = tr(journal.emotions, MAX_EMOTIONS_TEXT_CHARS);
    if (include.tags) row.tags = journal.tags ?? null;
    if (include.lessonsLearned) row.lessons = tr(journal.lessons, MAX_LESSONS_TEXT_CHARS);
  }

  if (checklist && include.executionChecklist) {
    row.check = {
      htf: checklist.checked_higher_tf,
      risk: checklist.risk_within_limits,
      plan: checklist.fits_plan,
      levels: checklist.key_levels,
      news: checklist.news_checked,
    };
  }

  if (include.screenshots && screenshotCount > 0) row.shots = screenshotCount;

  return row;
}

// ── System Instruction ────────────────────────────────────────

export const AI_SYSTEM_INSTRUCTION = `You are a world-class trading performance coach with 20+ years of prop firm, hedge fund, and retail trading coaching experience.

Your analysis must be:
- 100% data-driven. If data is not available, state that clearly. Never invent insights.
- Brutally honest, but always constructive and growth-oriented.
- Written in professional trading terminology.
- Specific: cite actual symbols, dates, percentages, and P&L figures from the data provided.
- Structured exactly as requested in numbered Markdown sections.
- Action-oriented: every weakness must include a concrete, measurable fix.

Do NOT use filler phrases like "Great job!" or "Keep it up!". Be a prop firm mentor, not a cheerleader.`;

// ── Main Prompt Builder ───────────────────────────────────────

export function buildPrompt(input: PromptBuilderInput): string {
  const { trades, journals, checklists, screenshots, scorecard, include, customInstructions, backtestSummary, reportType } = input;

  const cappedTrades = trades.slice(0, MAX_TRADES_PER_PROMPT);
  const periodStats = buildPeriodStats(cappedTrades);
  const adv = computeAdvancedMetrics(cappedTrades, journals);

  const journalMap = new Map(journals.map((j) => [j.trade_id, j]));
  const checklistMap = new Map(checklists.map((c) => [c.trade_id, c]));
  const screenshotCountMap: Record<string, number> = {};
  screenshots.forEach((s) => { screenshotCountMap[s.trade_id] = (screenshotCountMap[s.trade_id] ?? 0) + 1; });

  const tradeRows = cappedTrades.map((t) =>
    buildTradeRow(t, journalMap.get(t.id), checklistMap.get(t.id), screenshotCountMap[t.id] ?? 0, include),
  );

  // Top 5 UTC hours
  const top5Hours = Object.entries(adv.byHour)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([h, v]) => `UTC ${h.padStart(2, "0")}:00 → ${v.count} trades | P&L $${fmt(v.pnl)} | WR ${v.count ? pct(v.wins / v.count) : "N/A"}`);

  const prompt = `
## REPORT TYPE: ${reportType} Trading Performance Review

## ════ AGGREGATE METRICS (pre-computed — treat as ground truth) ════

### Core Stats
| Metric | Value |
|---|---|
| Period | ${cappedTrades.length > 0 ? `${cappedTrades[cappedTrades.length - 1]?.open_time?.slice(0, 10)} → ${cappedTrades[0]?.open_time?.slice(0, 10)}` : "N/A"} |
| Trades Analyzed | ${cappedTrades.length}${trades.length > MAX_TRADES_PER_PROMPT ? ` (capped from ${trades.length})` : ""} |
| Win Rate | ${pct(periodStats.win_rate)} |
| Net P&L | $${fmt(periodStats.net_pnl)} |
| Gross Profit | $${fmt(periodStats.gross_profit)} |
| Gross Loss | $${fmt(periodStats.gross_loss)} |
| Profit Factor | ${fmt(adv.profitFactor)} |
| Expectancy | $${fmt(adv.expectancy)} per trade |
| Average R:R | ${fmt(periodStats.avg_rr)}R |
| Best Trade | ${periodStats.best_trade ? `+$${fmt(periodStats.best_trade.pnl)} on ${periodStats.best_trade.symbol}` : "N/A"} |
| Worst Trade | ${periodStats.worst_trade ? `$${fmt(periodStats.worst_trade.pnl)} on ${periodStats.worst_trade.symbol}` : "N/A"} |
| Max Win Streak | ${periodStats.longest_streak.wins} |
| Max Loss Streak | ${periodStats.longest_streak.losses} |
| Avg Lot Size | ${fmt(adv.avgLot)} |
| Min / Max Lot | ${fmt(adv.minLot)} / ${fmt(adv.maxLot)} |
| Journals Filed | ${journals.length} / ${trades.length} |

### Scorecard (Deterministic)
| Pillar | Score |
|---|---|
| Overall | ${scorecard.overall}/100 (${scorecard.classification}) |
| Discipline | ${scorecard.discipline.score}/100 |
| Risk Management | ${scorecard.risk.score}/100 |
| Execution | ${scorecard.execution.score}/100 |
| Psychology | ${scorecard.psychology.score}/100 |
| Consistency | ${scorecard.consistency.score}/100 |

### Direction Analysis
| Direction | Trades | Wins | Win Rate | Net P&L |
|---|---|---|---|---|
| Long | ${adv.longs.length} | ${adv.longWins.length} | ${adv.longs.length ? pct(adv.longWins.length / adv.longs.length) : "N/A"} | $${fmt(adv.longs.reduce((s, t) => s + Number(t.pnl), 0))} |
| Short | ${adv.shorts.length} | ${adv.shortWins.length} | ${adv.shorts.length ? pct(adv.shortWins.length / adv.shorts.length) : "N/A"} | $${fmt(adv.shorts.reduce((s, t) => s + Number(t.pnl), 0))} |

### Session Performance
${JSON.stringify(periodStats.by_session, null, 2)}

### Symbol Performance
${JSON.stringify(periodStats.by_symbol, null, 2)}

### Day-of-Week Performance
${JSON.stringify(adv.byDow, null, 2)}

### Time-of-Day (Top 5 Hours, UTC)
${top5Hours.join("\n")}

### Drawdown
- Max Drawdown: $${fmt(adv.maxDrawdown)} (started ~${adv.drawdownStart || "N/A"})

### Behavioral Signals
- Suspected Revenge Trades: ${adv.revengeTrades.length}
${adv.revengeTrades.length ? JSON.stringify(adv.revengeTrades, null, 2) : "  (none detected)"}

- FOMO Cluster Events: ${adv.fomoEvents.length}
${adv.fomoEvents.length ? adv.fomoEvents.slice(0, 5).join(", ") : "  (none detected)"}

- Overtrading Days (>5 trades): ${adv.overtradingDays.length}
${adv.overtradingDays.join(", ") || "  (none)"}

- Loss Streaks (≥3): ${adv.lossStreaks.length}
${adv.lossStreaks.length ? JSON.stringify(adv.lossStreaks) : "  (none)"}

- Win Streaks (≥3): ${adv.winStreaks.length}
${adv.winStreaks.length ? JSON.stringify(adv.winStreaks) : "  (none)"}

${include.emotions && adv.topEmotions.length ? `### Top Emotion Keywords\n${adv.topEmotions.join(" | ")}` : ""}

${include.strategySetup && Object.keys(adv.setupFreq).length ? `### Strategy Setup Performance\n${JSON.stringify(adv.setupFreq, null, 2)}` : ""}

${backtestSummary ? `### Backtesting Comparison\n${backtestSummary}` : ""}

${customInstructions ? `### TRADER'S SPECIFIC INSTRUCTIONS TO COACH\n${customInstructions}` : ""}

## ════ DETAILED TRADE DATA ════
${JSON.stringify(tradeRows, null, 2)}

---

## ════ YOUR TASK ════

Using ALL the data above, generate a comprehensive, elite-level trading performance report.

Every claim must be backed by specific data. Reference actual numbers, symbols, dates, and patterns.

IMPORTANT: Structure your response EXACTLY as follows. Do not add extra sections or skip any.

# TRADING PERFORMANCE REPORT

## 1. Executive Summary
Write 3 paragraphs: (1) What was the overall performance? (2) What is the single most impactful finding? (3) What is the #1 priority change?

## 2. Overall Performance Score
Create a table showing each pillar score. Below the table, explain WHY each score was given, referencing specific data.

## 3. Risk Management Analysis
Analyze: stop-loss usage rate, average risk per trade, position sizing consistency, lot variance, profit factor, expected value, drawdown depth and recovery.

## 4. Win Rate Analysis
Break down win rate by: session, symbol, direction, day of week, time of day. State when and WHERE the trader wins vs loses.

## 5. Reward-to-Risk Analysis
Is the trader achieving their planned R:R? Are they cutting winners early or holding losers? Reference specific trades or patterns.

## 6. Session Analysis
Which session generates the most profit? Most losses? WHY might this be? Give a specific recommendation.

## 7. Time-of-Day Analysis
Reference the UTC hour data. At what hours is the trader profitable? At what hours do they lose? What does this suggest about their trading environment?

## 8. Symbol Analysis
Rank symbols by: trade count, win rate, total P&L. Identify which symbols are costing money and why.

## 9. Long vs Short Analysis
Is there a directional bias? Which direction is more profitable? Is the trader better at reading one direction?

## 10. Best Performing Setup
What specific setup type, session, time, and symbol combination generates the most consistent alpha? Be very specific.

## 11. Worst Performing Setup
What setup, session, or symbol combination is draining the account? Be specific with examples from the data.

## 12. Emotional Analysis
What emotion keywords appear most often? What market conditions tend to trigger negative emotions? What is the P&L correlation with emotional states?

## 13. Psychology Review
Deep analysis of: FOMO evidence, revenge trading evidence, overconfidence signals, fear signals, tilt behavior, loss aversion. Reference actual dates and trade patterns.

## 14. Journal Review
How consistently is the trader journaling? Are their pre-trade plans being followed? What gaps exist between plan and execution?

## 15. Rule Violations
Based on checklist compliance data, which rules are being broken most? What is the P&L cost of rule violations?

## 16. Checklist Compliance
What percentage of trades had a complete checklist? Which checklist items are most skipped? What is the win rate with vs without full checklist?

## 17. Strengths
List exactly 5 specific strengths, each with supporting data.
- Strength 1
- Strength 2
- Strength 3
- Strength 4
- Strength 5

## 18. Weaknesses
List exactly 5 specific weaknesses, each with supporting data.
- Weakness 1
- Weakness 2
- Weakness 3
- Weakness 4
- Weakness 5

## 19. Recurring Mistakes
What mistakes happen repeatedly? Include frequency, P&L impact, and specific examples.

## 20. Hidden Patterns
Non-obvious patterns only visible through statistical aggregation (e.g., "loses every Monday", "overperforms in first 2 hours of NY session").

## 21. Behavioral Biases
Identify specific cognitive biases from the data: loss aversion, recency bias, confirmation bias, anchoring, gambler's fallacy.

## 22. Overtrading Detection
Evidence of overtrading? Which dates had excessive trade frequency? What triggered it?

## 23. Revenge Trading Detection
Specific evidence of revenge trading (with dates and symbols if available). What is the P&L impact?

## 24. FOMO Detection
Evidence of FOMO trades? Clustered entries, chasing moves, poor entry timing after missed setups?

## 25. Tilt Detection
Did the trader go on tilt at any point? Signs: losing streaks followed by lot increases, erratic trade frequency, degrading entry quality.

## 26. Confidence Analysis
Does the trader size up correctly? Do they risk more when their edge is higher? Or do they bet big on poor setups?

## 27. Drawdown Analysis
How does the trader behave during drawdowns? Do they stop trading, overtrade, or trade the same? How long do drawdowns last?

## 28. Streak Analysis
During win streaks: does risk increase dangerously? During loss streaks: does discipline break down? Reference specific streak dates.

## 29. Consistency Analysis
Is performance stable across months/weeks? Is there improvement, decline, or high variance? What is causing variance?

## 30. Strategy Quality
Are the strategies generating a real statistical edge? Which strategies have positive expectancy? Which should be retired?

## 31. Execution Quality
How is entry timing? How is exit timing? Are trades hitting their planned targets? What percentage of entries match the pre-trade plan?

## 32. Action Plan
List exactly 5 specific, measurable, time-bound action items:
- 1. 
- 2.
- 3.
- 4.
- 5.

## 33. Weekly Goals
List exactly 3 goals for next week:
- 1.
- 2.
- 3.

## 34. Daily Focus
Write one single sentence (the #1 daily focus rule for this trader):

## 35. Final Coach Message
Write a direct, personal, 2-3 paragraph closing message. Be honest. Be specific. Reference their actual numbers. Do not be generic. This should feel like a world-class coach speaking directly to this trader.
`;

  return prompt;
}
