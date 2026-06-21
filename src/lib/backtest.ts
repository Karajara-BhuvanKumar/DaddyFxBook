// Backtest types + deterministic analytics. Pure functions, fully typed,
// shared by the Backtesting pages and the backtest-ai edge function consumers.

export type BacktestOutcome = "win" | "loss" | "breakeven";
export type BacktestDirection = "long" | "short";

export interface BacktestSession {
  id: string;
  user_id: string;
  name: string;
  pair: string | null;
  strategy: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface BacktestTrade {
  id: string;
  user_id: string;
  session_id: string;
  trade_number: number | null;
  pair: string;
  direction: BacktestDirection;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  exit_price: number | null;
  rr: number | null;
  r_gained: number | null;
  pnl: number | null;
  outcome: BacktestOutcome;
  setup: string | null;
  session: string | null;
  market_condition: string | null;
  emotion: string | null;
  notes: string | null;
  screenshot_url: string | null;
  trade_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface BacktestAnalytics {
  total: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  lossRate: number;
  totalRGained: number;
  totalRLost: number;
  netR: number;
  totalPnl: number;
  profitFactor: number;
  expectancy: number;
  avgRR: number;
  largestWinner: number;
  largestLoser: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  equityCurve: { idx: number; equity: number; r: number }[];
  drawdownCurve: { idx: number; drawdown: number }[];
  distribution: { name: string; value: number }[];
  byPair: BreakdownRow[];
  bySetup: BreakdownRow[];
  bySession: BreakdownRow[];
  byCondition: BreakdownRow[];
  byDirection: BreakdownRow[];
}

export interface BreakdownRow {
  key: string;
  trades: number;
  wins: number;
  winRate: number;
  netR: number;
  pnl: number;
}

function groupBy(
  trades: BacktestTrade[],
  keyFn: (t: BacktestTrade) => string | null | undefined,
): BreakdownRow[] {
  const map = new Map<string, BreakdownRow>();
  for (const t of trades) {
    const k = (keyFn(t) ?? "Unspecified").toString();
    const row = map.get(k) ?? { key: k, trades: 0, wins: 0, winRate: 0, netR: 0, pnl: 0 };
    row.trades += 1;
    if (t.outcome === "win") row.wins += 1;
    row.netR += Number(t.r_gained ?? 0);
    row.pnl += Number(t.pnl ?? 0);
    map.set(k, row);
  }
  return Array.from(map.values())
    .map((r) => ({ ...r, winRate: r.trades ? r.wins / r.trades : 0 }))
    .sort((a, b) => b.netR - a.netR);
}

export function computeAnalytics(trades: BacktestTrade[]): BacktestAnalytics {
  const sorted = [...trades].sort((a, b) => {
    const ad = a.trade_date ?? a.created_at;
    const bd = b.trade_date ?? b.created_at;
    return ad.localeCompare(bd);
  });

  const wins = sorted.filter((t) => t.outcome === "win");
  const losses = sorted.filter((t) => t.outcome === "loss");
  const breakeven = sorted.filter((t) => t.outcome === "breakeven");

  const totalRGained = wins.reduce((s, t) => s + Math.max(0, Number(t.r_gained ?? 0)), 0);
  const totalRLost = Math.abs(
    losses.reduce((s, t) => s + Math.min(0, Number(t.r_gained ?? 0)), 0),
  );
  const netR = sorted.reduce((s, t) => s + Number(t.r_gained ?? 0), 0);
  const totalPnl = sorted.reduce((s, t) => s + Number(t.pnl ?? 0), 0);

  const profitFactor = totalRLost > 0 ? totalRGained / totalRLost : totalRGained > 0 ? Infinity : 0;
  const winRate = sorted.length ? wins.length / sorted.length : 0;
  const lossRate = sorted.length ? losses.length / sorted.length : 0;
  const avgWin = wins.length ? totalRGained / wins.length : 0;
  const avgLoss = losses.length ? totalRLost / losses.length : 0;
  const expectancy = winRate * avgWin - lossRate * avgLoss;
  const avgRR = sorted.length
    ? sorted.reduce((s, t) => s + Number(t.rr ?? 0), 0) / sorted.length
    : 0;

  const rValues = sorted.map((t) => Number(t.r_gained ?? 0));
  const largestWinner = rValues.length ? Math.max(0, ...rValues) : 0;
  const largestLoser = rValues.length ? Math.min(0, ...rValues) : 0;

  let curW = 0, curL = 0, maxW = 0, maxL = 0;
  for (const t of sorted) {
    if (t.outcome === "win") {
      curW += 1; curL = 0; maxW = Math.max(maxW, curW);
    } else if (t.outcome === "loss") {
      curL += 1; curW = 0; maxL = Math.max(maxL, curL);
    } else {
      curW = 0; curL = 0;
    }
  }

  let running = 0;
  let peak = 0;
  const equityCurve = sorted.map((t, idx) => {
    running += Number(t.r_gained ?? 0);
    return { idx: idx + 1, equity: Number(running.toFixed(4)), r: Number(t.r_gained ?? 0) };
  });
  const drawdownCurve = equityCurve.map((p) => {
    peak = Math.max(peak, p.equity);
    return { idx: p.idx, drawdown: Number((p.equity - peak).toFixed(4)) };
  });

  return {
    total: sorted.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate,
    lossRate,
    totalRGained: Number(totalRGained.toFixed(2)),
    totalRLost: Number(totalRLost.toFixed(2)),
    netR: Number(netR.toFixed(2)),
    totalPnl: Number(totalPnl.toFixed(2)),
    profitFactor: Number.isFinite(profitFactor) ? Number(profitFactor.toFixed(2)) : 0,
    expectancy: Number(expectancy.toFixed(2)),
    avgRR: Number(avgRR.toFixed(2)),
    largestWinner: Number(largestWinner.toFixed(2)),
    largestLoser: Number(largestLoser.toFixed(2)),
    maxConsecutiveWins: maxW,
    maxConsecutiveLosses: maxL,
    equityCurve,
    drawdownCurve,
    distribution: [
      { name: "Wins", value: wins.length },
      { name: "Losses", value: losses.length },
      { name: "Break-even", value: breakeven.length },
    ],
    byPair: groupBy(sorted, (t) => t.pair),
    bySetup: groupBy(sorted, (t) => t.setup),
    bySession: groupBy(sorted, (t) => t.session),
    byCondition: groupBy(sorted, (t) => t.market_condition),
    byDirection: groupBy(sorted, (t) => t.direction),
  };
}

export function computeRR(entry: number, sl: number, tp: number, direction: BacktestDirection) {
  const risk = direction === "long" ? entry - sl : sl - entry;
  const reward = direction === "long" ? tp - entry : entry - tp;
  if (!risk || risk <= 0) return 0;
  return Number((reward / risk).toFixed(2));
}

export function computeRGained(
  entry: number,
  sl: number,
  exit: number,
  direction: BacktestDirection,
) {
  const risk = direction === "long" ? entry - sl : sl - entry;
  const move = direction === "long" ? exit - entry : entry - exit;
  if (!risk || risk <= 0) return 0;
  return Number((move / risk).toFixed(2));
}

export function computePnL(
  entry: number,
  exit: number,
  direction: BacktestDirection,
) {
  const pnl = direction === "long" ? exit - entry : entry - exit;
  return Number(pnl.toFixed(2));
}

export const SESSIONS = [
  "Asian",
  "Asian Off Session",
  "London",
  "London Off Session",
  "New York",
  "New York Off Session",
] as const;
export const MARKET_CONDITIONS = ["Trending", "Ranging", "High volatility", "Low volatility"] as const;
export const EMOTIONS = ["Confident", "Fear", "FOMO", "Greed"] as const;
