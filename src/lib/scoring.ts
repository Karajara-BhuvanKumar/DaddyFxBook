// Reusable, deterministic AI scoring engine.
// All score functions return 0..100 and a structured breakdown JSON
// suitable for storage and UI explanations.

import type { Trade, Journal, Checklist } from "@/hooks/useTrades";

export type Classification = "Elite" | "Advanced" | "Developing" | "Beginner";

export interface ScoreFactor {
  label: string;
  value: number; // 0..1
  weight: number; // 0..1, sums to 1 within a score
  detail: string;
}

export interface ScoreResult {
  score: number; // 0..100
  factors: ScoreFactor[];
  summary: string;
}

export interface ScorecardSnapshot {
  discipline: ScoreResult;
  risk: ScoreResult;
  execution: ScoreResult;
  psychology: ScoreResult;
  consistency: ScoreResult;
  overall: number;
  classification: Classification;
  trade_count: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

function pct(n: number) {
  return round2(clamp01(n) * 100);
}

function weightedScore(factors: ScoreFactor[]): number {
  const total = factors.reduce((s, f) => s + f.value * f.weight, 0);
  return pct(total);
}

function classify(overall: number): Classification {
  if (overall >= 85) return "Elite";
  if (overall >= 70) return "Advanced";
  if (overall >= 50) return "Developing";
  return "Beginner";
}

// ============================================================
// Discipline: rule violations, overtrading, session adherence, frequency
// ============================================================
export function calculateDisciplineScore(
  trades: Trade[],
  checklists: Checklist[],
): ScoreResult {
  if (trades.length === 0) {
    return { score: 0, summary: "No trades.", factors: [] };
  }

  const checkAvg = checklists.length
    ? checklists.reduce((s, c) => {
        const keys = ["checked_higher_tf", "risk_within_limits", "fits_plan", "key_levels", "news_checked"] as const;
        const done = keys.filter((k) => (c as unknown as Record<string, boolean>)[k]).length;
        return s + done / keys.length;
      }, 0) / checklists.length
    : 0;

  // Session adherence: % of trades in trader's most common session
  const sessionCount: Record<string, number> = {};
  trades.forEach((t) => {
    const k = t.session ?? "Unknown";
    sessionCount[k] = (sessionCount[k] ?? 0) + 1;
  });
  const dominant = Math.max(...Object.values(sessionCount));
  const sessionAdherence = dominant / trades.length;

  // Overtrading: penalize if avg trades/day > 5
  const days = new Set(trades.map((t) => t.close_time.slice(0, 10))).size || 1;
  const perDay = trades.length / days;
  const overtradingPenalty = clamp01((perDay - 5) / 10); // 0 below 5/day, 1 at 15/day
  const frequencyHealth = 1 - overtradingPenalty;

  // Rule-violation proxy: low checklist completion => more violations
  const ruleAdherence = checkAvg;

  const factors: ScoreFactor[] = [
    { label: "Rule adherence", value: ruleAdherence, weight: 0.35, detail: `${pct(ruleAdherence)}% checklist completion` },
    { label: "Session discipline", value: sessionAdherence, weight: 0.25, detail: `${pct(sessionAdherence)}% trades in primary session` },
    { label: "Trade frequency", value: frequencyHealth, weight: 0.2, detail: `${round2(perDay)} trades/day` },
    { label: "Overtrading control", value: 1 - overtradingPenalty, weight: 0.2, detail: overtradingPenalty > 0 ? "Above 5 trades/day on average" : "Healthy frequency" },
  ];
  return { score: weightedScore(factors), factors, summary: "Discipline measures how strictly you follow your trading plan." };
}

// ============================================================
// Risk management: avg risk, risk consistency, drawdown, position sizing
// ============================================================
export function calculateRiskManagementScore(trades: Trade[]): ScoreResult {
  if (trades.length === 0) return { score: 0, summary: "No trades.", factors: [] };

  // Risk per trade in $ = |entry - sl| * lot * 100 (XAUUSD pip-value approximation)
  const risks = trades
    .filter((t) => t.stop_loss != null)
    .map((t) => Math.abs(Number(t.entry_price) - Number(t.stop_loss)) * Number(t.lot_size) * 100);

  const avgRisk = risks.length ? risks.reduce((a, b) => a + b, 0) / risks.length : 0;
  const riskStd = risks.length
    ? Math.sqrt(risks.reduce((s, r) => s + (r - avgRisk) ** 2, 0) / risks.length)
    : 0;
  const riskConsistency = avgRisk > 0 ? clamp01(1 - riskStd / avgRisk) : 0.4;

  // Stop-loss usage rate
  const slUsage = trades.filter((t) => t.stop_loss != null).length / trades.length;

  // Drawdown from equity curve
  const equity: number[] = [];
  let cum = 0;
  for (let i = trades.length - 1; i >= 0; i--) {
    cum += Number(trades[i].pnl);
    equity.push(cum);
  }
  let peak = -Infinity;
  let maxDD = 0;
  for (const e of equity) {
    if (e > peak) peak = e;
    const dd = peak - e;
    if (dd > maxDD) maxDD = dd;
  }
  const finalEquity = equity[equity.length - 1] ?? 0;
  const drawdownRatio = finalEquity > 0 ? clamp01(maxDD / finalEquity) : 1;
  const drawdownHealth = 1 - drawdownRatio;

  // Position sizing health: lot variance
  const lots = trades.map((t) => Number(t.lot_size));
  const avgLot = lots.reduce((a, b) => a + b, 0) / lots.length;
  const lotStd = Math.sqrt(lots.reduce((s, l) => s + (l - avgLot) ** 2, 0) / lots.length);
  const sizingConsistency = avgLot > 0 ? clamp01(1 - lotStd / avgLot) : 0.5;

  const factors: ScoreFactor[] = [
    { label: "Stop-loss usage", value: slUsage, weight: 0.3, detail: `${pct(slUsage)}% of trades have a stop loss` },
    { label: "Risk consistency", value: riskConsistency, weight: 0.25, detail: `Avg $${round2(avgRisk)} risk, ±$${round2(riskStd)}` },
    { label: "Drawdown control", value: drawdownHealth, weight: 0.25, detail: `Max drawdown $${round2(maxDD)}` },
    { label: "Position sizing", value: sizingConsistency, weight: 0.2, detail: `Avg ${round2(avgLot)} lots, ±${round2(lotStd)}` },
  ];
  return { score: weightedScore(factors), factors, summary: "Risk management captures how well you protect capital." };
}

// ============================================================
// Execution: entry/exit quality, trade reviews, checklist completion
// ============================================================
export function calculateExecutionScore(
  trades: Trade[],
  checklists: Checklist[],
  tradeReviewGrades: Array<"A+" | "A" | "B" | "C" | "F">,
): ScoreResult {
  if (trades.length === 0) return { score: 0, summary: "No trades.", factors: [] };

  const wins = trades.filter((t) => Number(t.pnl) > 0);
  const winRate = wins.length / trades.length;

  // Exit efficiency: avg win / avg loss
  const losses = trades.filter((t) => Number(t.pnl) < 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + Number(t.pnl), 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0)) / losses.length : 0;
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 3 : 0;
  const exitQuality = clamp01(payoffRatio / 3); // 100% at 3:1

  const gradeMap: Record<string, number> = { "A+": 1, A: 0.85, B: 0.7, C: 0.5, F: 0.2 };
  const reviewQuality = tradeReviewGrades.length
    ? tradeReviewGrades.reduce((s, g) => s + (gradeMap[g] ?? 0.5), 0) / tradeReviewGrades.length
    : 0.5;

  const checklistRate = checklists.length
    ? checklists.reduce((s, c) => {
        const keys = ["checked_higher_tf", "risk_within_limits", "fits_plan", "key_levels", "news_checked"] as const;
        return s + keys.filter((k) => (c as unknown as Record<string, boolean>)[k]).length / keys.length;
      }, 0) / checklists.length
    : 0;

  const factors: ScoreFactor[] = [
    { label: "Entry quality (win rate)", value: winRate, weight: 0.3, detail: `${pct(winRate)}% win rate` },
    { label: "Exit quality (payoff)", value: exitQuality, weight: 0.25, detail: `${round2(payoffRatio)}:1 avg payoff` },
    { label: "AI trade-review grades", value: reviewQuality, weight: 0.25, detail: `${tradeReviewGrades.length} reviews graded` },
    { label: "Checklist completion", value: checklistRate, weight: 0.2, detail: `${pct(checklistRate)}% pre-trade checklist completion` },
  ];
  return { score: weightedScore(factors), factors, summary: "Execution measures the quality of your entries and exits." };
}

// ============================================================
// Psychology: emotional patterns, journal notes, revenge, FOMO
// ============================================================
export function calculatePsychologyScore(trades: Trade[], journals: Journal[]): ScoreResult {
  if (trades.length === 0) return { score: 0, summary: "No trades.", factors: [] };

  const sorted = [...trades].sort((a, b) => +new Date(a.close_time) - +new Date(b.close_time));

  // Revenge trading: a losing trade followed within 30 min by another trade with 2x lot size
  let revenge = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gapMin = (+new Date(curr.open_time) - +new Date(prev.close_time)) / 60000;
    if (Number(prev.pnl) < 0 && gapMin < 30 && Number(curr.lot_size) > Number(prev.lot_size) * 1.5) {
      revenge++;
    }
  }
  const revengeRate = revenge / sorted.length;
  const revengeHealth = 1 - clamp01(revengeRate * 5);

  // FOMO: trades opened in clusters (>3 trades in 15 min)
  let fomo = 0;
  for (let i = 0; i < sorted.length; i++) {
    const window = sorted.filter(
      (t) => Math.abs(+new Date(t.open_time) - +new Date(sorted[i].open_time)) < 15 * 60000,
    );
    if (window.length > 3) fomo++;
  }
  const fomoRate = fomo / sorted.length;
  const fomoHealth = 1 - clamp01(fomoRate);

  // Journaling rate
  const journalRate = clamp01(journals.length / trades.length);

  // Emotion tone (very rough): penalize words "fear", "fomo", "anger", "revenge", "anxious"
  const negativeWords = ["fear", "fomo", "anger", "revenge", "anxious", "panic", "tilt"];
  const negativeCount = journals.reduce((s, j) => {
    const text = `${j.emotions ?? ""} ${j.lessons ?? ""}`.toLowerCase();
    return s + negativeWords.filter((w) => text.includes(w)).length;
  }, 0);
  const emotionalHealth = journals.length ? 1 - clamp01(negativeCount / (journals.length * 2)) : 0.6;

  const factors: ScoreFactor[] = [
    { label: "Revenge-trading control", value: revengeHealth, weight: 0.3, detail: `${revenge} suspected revenge trades` },
    { label: "FOMO control", value: fomoHealth, weight: 0.25, detail: `${fomo} clustered entries` },
    { label: "Journaling habit", value: journalRate, weight: 0.2, detail: `${journals.length}/${trades.length} trades journaled` },
    { label: "Emotional tone", value: emotionalHealth, weight: 0.25, detail: `${negativeCount} negative emotion mentions` },
  ];
  return { score: weightedScore(factors), factors, summary: "Psychology measures emotional control and discipline." };
}

// ============================================================
// Consistency: monthly performance, win-rate stability, risk consistency, drawdown stability
// ============================================================
export function calculateConsistencyScore(trades: Trade[]): ScoreResult {
  if (trades.length === 0) return { score: 0, summary: "No trades.", factors: [] };

  const byMonth: Record<string, Trade[]> = {};
  trades.forEach((t) => {
    const k = t.close_time.slice(0, 7);
    (byMonth[k] ??= []).push(t);
  });
  const months = Object.values(byMonth);

  // Profitable months ratio
  const profitable = months.filter((m) => m.reduce((s, t) => s + Number(t.pnl), 0) > 0).length;
  const monthlyHealth = months.length ? profitable / months.length : 0;

  // Win-rate stability (1 - stddev of monthly win rates)
  const winRates = months.map((m) => m.filter((t) => Number(t.pnl) > 0).length / m.length);
  const avgWR = winRates.reduce((a, b) => a + b, 0) / (winRates.length || 1);
  const wrStd = winRates.length
    ? Math.sqrt(winRates.reduce((s, w) => s + (w - avgWR) ** 2, 0) / winRates.length)
    : 0;
  const wrStability = clamp01(1 - wrStd * 2);

  // Risk consistency across months (lot variance)
  const monthlyAvgLot = months.map((m) => m.reduce((s, t) => s + Number(t.lot_size), 0) / m.length);
  const lotMean = monthlyAvgLot.reduce((a, b) => a + b, 0) / (monthlyAvgLot.length || 1);
  const lotStd = monthlyAvgLot.length
    ? Math.sqrt(monthlyAvgLot.reduce((s, l) => s + (l - lotMean) ** 2, 0) / monthlyAvgLot.length)
    : 0;
  const riskStability = lotMean > 0 ? clamp01(1 - lotStd / lotMean) : 0.5;

  // Drawdown stability: max monthly drawdown / total profit
  const monthlyPnls = months.map((m) => m.reduce((s, t) => s + Number(t.pnl), 0));
  const worstMonth = Math.min(...monthlyPnls, 0);
  const totalPnl = monthlyPnls.reduce((a, b) => a + b, 0);
  const ddStability = totalPnl > 0 ? clamp01(1 - Math.abs(worstMonth) / Math.max(totalPnl, 1)) : 0.3;

  const factors: ScoreFactor[] = [
    { label: "Profitable months", value: monthlyHealth, weight: 0.3, detail: `${profitable}/${months.length} months profitable` },
    { label: "Win-rate stability", value: wrStability, weight: 0.25, detail: `±${pct(wrStd)}% monthly swing` },
    { label: "Risk consistency", value: riskStability, weight: 0.2, detail: `Avg ${round2(lotMean)} lots/month` },
    { label: "Drawdown stability", value: ddStability, weight: 0.25, detail: `Worst month $${round2(worstMonth)}` },
  ];
  return { score: weightedScore(factors), factors, summary: "Consistency measures stability of performance over time." };
}

// ============================================================
// Overall + classification
// ============================================================
export function calculateOverallTraderScore(opts: {
  discipline: ScoreResult;
  risk: ScoreResult;
  execution: ScoreResult;
  psychology: ScoreResult;
  consistency: ScoreResult;
}): { score: number; classification: Classification } {
  // Weighted: execution 25%, risk 25%, discipline 20%, psychology 15%, consistency 15%
  const score = round2(
    opts.execution.score * 0.25 +
      opts.risk.score * 0.25 +
      opts.discipline.score * 0.2 +
      opts.psychology.score * 0.15 +
      opts.consistency.score * 0.15,
  );
  return { score, classification: classify(score) };
}

export function buildScorecard(
  trades: Trade[],
  journals: Journal[],
  checklists: Checklist[],
  tradeReviewGrades: Array<"A+" | "A" | "B" | "C" | "F">,
): ScorecardSnapshot {
  const discipline = calculateDisciplineScore(trades, checklists);
  const risk = calculateRiskManagementScore(trades);
  const execution = calculateExecutionScore(trades, checklists, tradeReviewGrades);
  const psychology = calculatePsychologyScore(trades, journals);
  const consistency = calculateConsistencyScore(trades);
  const { score: overall, classification } = calculateOverallTraderScore({
    discipline, risk, execution, psychology, consistency,
  });
  return { discipline, risk, execution, psychology, consistency, overall, classification, trade_count: trades.length };
}
