// Reusable period-based stat builders for Daily/Weekly/Monthly AI reports.
// Returns structured JSON consumed by both UI and the AI edge function.

import type { Trade } from "@/hooks/useTrades";

export type PeriodType = "daily" | "weekly" | "monthly";

export interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

export function getPeriodRange(period: PeriodType, anchor: Date = new Date()): PeriodRange {
  const d = new Date(anchor);
  if (period === "daily") {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end, label: start.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" }) };
  }
  if (period === "weekly") {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()); // Sunday start
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const endLabel = new Date(end);
    endLabel.setDate(endLabel.getDate() - 1);
    return {
      start, end,
      label: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endLabel.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    };
  }
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end, label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
}

export interface PeriodStats {
  trade_count: number;
  wins: number;
  losses: number;
  win_rate: number; // 0..1
  net_pnl: number;
  gross_profit: number;
  gross_loss: number;
  total_r: number; // sum of R multiples (pnl / risk)
  avg_rr: number; // average reward/risk per trade
  best_trade: { id: string; pnl: number; symbol: string; date: string } | null;
  worst_trade: { id: string; pnl: number; symbol: string; date: string } | null;
  by_session: Record<string, { count: number; pnl: number; wins: number }>;
  by_symbol: Record<string, { count: number; pnl: number; wins: number }>;
  by_day: Record<string, { count: number; pnl: number; wins: number }>;
  longest_streak: { wins: number; losses: number };
}

function tradeRisk(t: Trade): number {
  if (t.stop_loss == null) return 0;
  return Math.abs(Number(t.entry_price) - Number(t.stop_loss)) * Number(t.lot_size) * 100;
}

export function buildPeriodStats(trades: Trade[]): PeriodStats {
  const wins = trades.filter((t) => Number(t.pnl) > 0);
  const losses = trades.filter((t) => Number(t.pnl) < 0);
  const grossProfit = wins.reduce((s, t) => s + Number(t.pnl), 0);
  const grossLoss = losses.reduce((s, t) => s + Number(t.pnl), 0);

  const rValues = trades
    .map((t) => {
      const risk = tradeRisk(t);
      return risk > 0 ? Number(t.pnl) / risk : null;
    })
    .filter((r): r is number => r !== null);
  const totalR = rValues.reduce((a, b) => a + b, 0);
  const avgRR = rValues.length ? totalR / rValues.length : 0;

  const best = trades.reduce<Trade | null>((b, t) => (b == null || Number(t.pnl) > Number(b.pnl) ? t : b), null);
  const worst = trades.reduce<Trade | null>((w, t) => (w == null || Number(t.pnl) < Number(w.pnl) ? t : w), null);

  const bySession: PeriodStats["by_session"] = {};
  const bySymbol: PeriodStats["by_symbol"] = {};
  const byDay: PeriodStats["by_day"] = {};
  trades.forEach((t) => {
    const s = t.session ?? "Unknown";
    bySession[s] ??= { count: 0, pnl: 0, wins: 0 };
    bySession[s].count++;
    bySession[s].pnl += Number(t.pnl);
    if (Number(t.pnl) > 0) bySession[s].wins++;

    bySymbol[t.symbol] ??= { count: 0, pnl: 0, wins: 0 };
    bySymbol[t.symbol].count++;
    bySymbol[t.symbol].pnl += Number(t.pnl);
    if (Number(t.pnl) > 0) bySymbol[t.symbol].wins++;

    const day = new Date(t.close_time).toLocaleDateString("en-US", { weekday: "long" });
    byDay[day] ??= { count: 0, pnl: 0, wins: 0 };
    byDay[day].count++;
    byDay[day].pnl += Number(t.pnl);
    if (Number(t.pnl) > 0) byDay[day].wins++;
  });

  // streaks (chronological)
  const sorted = [...trades].sort((a, b) => +new Date(a.close_time) - +new Date(b.close_time));
  let curW = 0, curL = 0, maxW = 0, maxL = 0;
  for (const t of sorted) {
    if (Number(t.pnl) > 0) { curW++; curL = 0; if (curW > maxW) maxW = curW; }
    else if (Number(t.pnl) < 0) { curL++; curW = 0; if (curL > maxL) maxL = curL; }
  }

  return {
    trade_count: trades.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: trades.length ? wins.length / trades.length : 0,
    net_pnl: Number((grossProfit + grossLoss).toFixed(2)),
    gross_profit: Number(grossProfit.toFixed(2)),
    gross_loss: Number(grossLoss.toFixed(2)),
    total_r: Number(totalR.toFixed(2)),
    avg_rr: Number(avgRR.toFixed(2)),
    best_trade: best && Number(best.pnl) !== 0 ? { id: best.id, pnl: Number(best.pnl), symbol: best.symbol, date: best.close_time } : null,
    worst_trade: worst && Number(worst.pnl) !== 0 ? { id: worst.id, pnl: Number(worst.pnl), symbol: worst.symbol, date: worst.close_time } : null,
    by_session: bySession,
    by_symbol: bySymbol,
    by_day: byDay,
    longest_streak: { wins: maxW, losses: maxL },
  };
}

export function filterTradesInRange(trades: Trade[], range: PeriodRange): Trade[] {
  return trades.filter((t) => {
    const ts = new Date(t.close_time).getTime();
    return ts >= range.start.getTime() && ts < range.end.getTime();
  });
}
