import type { Trade, Journal } from "@/hooks/useTrades";
import type { BreakdownItem } from "@/components/BreakdownList";
import { parseStrategySetup, buildSetupKey, buildBroadSetupKey } from "@/lib/strategySetup";

export type AnalysisPeriod = 'Today' | '7 Days' | '30 Days' | '3 Months' | '1 Year' | 'All Time';
export type AnalysisOutcome = 'All Trades' | 'Winners' | 'Losers';

// Sum decimal representations exactly, rounding only when converting the final result
// to a JS number for charts. No per-trade cent rounding or invented cost deductions.
export function sum(values: number[]): number {
  const parts = values.map(value => {
    const [mantissa, exponent = '0'] = value.toString().split('e');
    const fraction = mantissa.split('.')[1]?.length ?? 0;
    return { digits: BigInt(mantissa.replace('.', '')), scale: fraction - Number(exponent) };
  });
  const scale = parts.reduce((max, part) => Math.max(max, part.scale), 0);
  const digits = parts.reduce((total, part) => total + part.digits * 10n ** BigInt(scale - part.scale), 0n);
  return Number(`${digits}e-${scale}`) || 0;
}

const numeric = (value: unknown): number | null => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))) return null;
  const result = Number(value);
  return Number.isFinite(result) && Math.abs(result) <= Number.MAX_SAFE_INTEGER / 100 ? result || 0 : null;
};
const timestamp = (value: unknown): number => {
  if (typeof value !== 'string') return NaN;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i.exec(value);
  if (!match) return NaN;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > last || hour > 23 || minute > 59 || second > 59) return NaN;
  return Date.parse(value);
};

export function utcSession(date: Date) {
  const seconds = date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds() + date.getUTCMilliseconds() / 1000;
  const segment = seconds < 28800 ? 0 : seconds < 46800 ? 1 : seconds < 79200 ? 2 : 3;
  return { progress: seconds / 86400 * 100, segment, name: ['Asian', 'London', 'New York', 'Asian'][segment] };
}

export function includedTrades(trades: Trade[], period: AnalysisPeriod, outcome: AnalysisOutcome, now: number) {
  const seen = new Set<string>();
  let rejected = 0;
  let start = -Infinity;
  const date = new Date(now);
  if (period === 'Today') start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  if (period === '7 Days' || period === '30 Days') start = now - (period === '7 Days' ? 7 : 30) * 86400000;
  if (period === '3 Months' || period === '1 Year') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - (period === '3 Months' ? 3 : 12));
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, last));
    start = date.getTime();
  }
  const includedClosedTrades: Trade[] = [];
  for (const trade of trades) {
    // The current schema is closed-only. Guard future/legacy status-bearing rows too.
    const raw = trade as Trade & { status?: string; deleted_at?: string; deleted?: boolean };
    const closed = raw.status === undefined || (typeof raw.status === 'string' && ['closed', 'realized'].includes(raw.status.toLowerCase()));
    const pnl = numeric(trade.pnl), lots = numeric(trade.lot_size);
    const entry = numeric(trade.entry_price), exit = numeric(trade.exit_price);
    const openMs = timestamp(trade.open_time), closeMs = timestamp(trade.close_time);
    if (!closed || raw.deleted_at || raw.deleted || !trade.id || seen.has(trade.id) || pnl === null || lots === null || lots <= 0 || entry === null || exit === null || !Number.isFinite(openMs) || !Number.isFinite(closeMs) || closeMs < openMs || closeMs > now || !['Long', 'Short'].includes(trade.direction) || !trade.symbol?.trim()) {
      rejected++;
      continue;
    }
    seen.add(trade.id);
    if (closeMs < start || (outcome === 'Winners' && pnl <= 0) || (outcome === 'Losers' && pnl >= 0)) continue;
    includedClosedTrades.push({ ...trade, pnl, lot_size: lots, entry_price: entry, exit_price: exit, open_time: new Date(openMs).toISOString(), close_time: new Date(closeMs).toISOString() });
  }
  includedClosedTrades.sort((a, b) => Date.parse(a.close_time) - Date.parse(b.close_time) || a.id.localeCompare(b.id));
  return { includedClosedTrades, rejected };
}

export function metrics(trades: Trade[]) {
  const winners = trades.filter(t => t.pnl > 0), losers = trades.filter(t => t.pnl < 0);
  const grossProfit = sum(winners.map(t => t.pnl)), grossLoss = sum(losers.map(t => t.pnl));
  const totalPnl = sum([grossProfit, grossLoss]);
  const decided = winners.length + losers.length;
  return { winners, losers, totalPnl, grossProfit, grossLoss,
    winRate: decided ? winners.length / decided * 100 : 0,
    profitFactor: grossLoss ? grossProfit / Math.abs(grossLoss) : grossProfit ? Infinity : 0,
    expectancy: trades.length ? totalPnl / trades.length : 0,
    avgWin: winners.length ? grossProfit / winners.length : 0,
    avgLoss: losers.length ? grossLoss / losers.length : 0,
    bestTrade: trades.length ? trades.reduce((max, t) => Math.max(max, t.pnl), -Infinity) : 0,
    worstTrade: trades.length ? trades.reduce((min, t) => Math.min(min, t.pnl), Infinity) : 0,
  };
}

function streaks(values: number[]) {
  let wins = 0, losses = 0, winStreak = 0, lossStreak = 0;
  for (const value of values) {
    wins = value > 0 ? wins + 1 : 0;
    losses = value < 0 ? losses + 1 : 0;
    winStreak = Math.max(winStreak, wins); lossStreak = Math.max(lossStreak, losses);
  }
  return { winStreak, lossStreak };
}

function journalSession(journal?: Journal): 'Asian' | 'London' | 'New York' | null {
  const value = parseStrategySetup(journal?.strategy_setup).market_session;
  if (typeof value !== 'string') return null;
  const name = value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/^off session /, '');
  if (['asian', 'sydney', 'tokyo'].includes(name)) return 'Asian';
  if (name === 'london') return 'London';
  if (name === 'new york') return 'New York';
  return null;
}

export function analyzeTrades(trades: Trade[], journals: Journal[], period: AnalysisPeriod, outcome: AnalysisOutcome, now: number) {
  const { includedClosedTrades, rejected } = includedTrades(trades, period, outcome, now);
  const core = metrics(includedClosedTrades);
  const hold = (rows: Trade[]) => rows.length ? sum(rows.map(t => Date.parse(t.close_time) - Date.parse(t.open_time))) / rows.length : 0;
  const longTrades = includedClosedTrades.filter(t => t.direction === 'Long'), shortTrades = includedClosedTrades.filter(t => t.direction === 'Short');
  const long = metrics(longTrades), short = metrics(shortTrades);
  const calendarData: Record<string, { pnl: number; count: number }> = {};
  const monthly: Record<string, number> = {};
  const dayPerf = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({ day, pnl: 0, count: 0 }));
  const sessionPerf = ['Asian', 'London', 'New York'].map(name => ({ name, pnl: 0, count: 0, wins: 0, losses: 0 }));
  const unassignedSession = { pnl: 0, count: 0, wins: 0, losses: 0 };
  const journalMap = new Map(journals.map(j => [j.trade_id, j]));
  const symbolGroups: Record<string, { pnl: number; count: number; wins: number; losses: number }> = {};
  let cumulative = 0, peak = 0, maxDD = 0;
  const chartData: { date: string; cumulative: number; drawdown: number }[] = includedClosedTrades.length ? [{ date: 'Start', cumulative: 0, drawdown: 0 }] : [];
  for (const t of includedClosedTrades) {
    const date = new Date(t.close_time), day = t.close_time.slice(0, 10), month = day.slice(0, 7);
    const bucket = calendarData[day] ??= { pnl: 0, count: 0 };
    bucket.pnl = sum([bucket.pnl, t.pnl]); bucket.count++;
    monthly[month] = sum([monthly[month] ?? 0, t.pnl]);
    const weekday = dayPerf[(date.getUTCDay() + 6) % 7];
    weekday.pnl = sum([weekday.pnl, t.pnl]); weekday.count++;
    // Only the saved journal assigns performance to a session. Never infer it from time
    // or a possibly stale trade.session value when a journal session is missing.
    const session = sessionPerf.find(s => s.name === journalSession(journalMap.get(t.id))) ?? unassignedSession;
    const symbol = symbolGroups[t.symbol] ??= { pnl: 0, count: 0, wins: 0, losses: 0 };
    for (const group of [session, symbol]) {
      group.pnl = sum([group.pnl, t.pnl]); group.count++;
      if (t.pnl > 0) group.wins++;
      if (t.pnl < 0) group.losses++;
    }
    cumulative = sum([cumulative, t.pnl]); peak = Math.max(peak, cumulative);
    const drawdown = sum([cumulative, -peak]); maxDD = Math.max(maxDD, -drawdown);
    chartData.push({ date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }), cumulative, drawdown });
  }
  const dailyPnl = Object.entries(calendarData).map(([day, value]): [string, number] => [day, value.pnl]);
  const winningDays = dailyPnl.filter(([, v]) => v > 0), losingDays = dailyPnl.filter(([, v]) => v < 0);
  const dayStreaks = streaks(dailyPnl.map(([, v]) => v));
  const months = Object.entries(monthly).sort((a, b) => b[1] - a[1]);
  const monthValue = (value?: [string, number]) => value ? { label: new Date(value[0] + '-01T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }), value: value[1] } : { label: '—', value: 0 };
  const setupMap = new Map<string, { trades: Trade[]; children: Map<string, Trade[]> }>();
  for (const trade of includedClosedTrades) {
    const journal = journalMap.get(trade.id);
    if (!journal?.strategy_setup) continue;
    const parsed = parseStrategySetup(journal.strategy_setup);
    const broad = buildBroadSetupKey(parsed), granular = buildSetupKey(parsed);
    const key = broad !== 'Unspecified' ? broad : granular;
    if (key === 'Unspecified') continue;
    const group = setupMap.get(key) ?? { trades: [], children: new Map<string, Trade[]>() };
    group.trades.push(trade);
    if (granular !== 'Unspecified' && granular !== key) group.children.set(granular, [...(group.children.get(granular) ?? []), trade]);
    setupMap.set(key, group);
  }
  const row = (key: string, rows: Trade[]): BreakdownItem => {
    const m = metrics(rows);
    return { key, trades: rows.length, wins: m.winners.length, winRate: m.winRate / 100, netValue: m.totalPnl, unit: '$' };
  };
  const setupRows = Array.from(setupMap, ([key, group]) => ({ ...row(key, group.trades), children: Array.from(group.children, ([k, ts]) => row(k, ts)).sort((a, b) => b.netValue - a.netValue) })).sort((a, b) => b.netValue - a.netValue);
  return { ...core, ...streaks(includedClosedTrades.map(t => t.pnl)), includedClosedTrades, rejected,
    avgHoldAll: hold(includedClosedTrades), avgHoldWinners: hold(core.winners), avgHoldLosers: hold(core.losers),
    longTrades, shortTrades, longPnl: long.totalPnl, shortPnl: short.totalPnl, longWinRate: long.winRate, shortWinRate: short.winRate,
    calendarData, dailyPnl, dayPerf, sessionPerf, unassignedSession, chartData, setupRows,
    symbols: Object.entries(symbolGroups).sort(([, a], [, b]) => b.pnl - a.pnl).slice(0, 3),
    winningDays: winningDays.length, losingDays: losingDays.length,
    winDayStreak: dayStreaks.winStreak, lossDayStreak: dayStreaks.lossStreak,
    avgDailyPnl: dailyPnl.length ? core.totalPnl / dailyPnl.length : 0,
    avgDailyVolume: dailyPnl.length ? sum(includedClosedTrades.map(t => t.lot_size)) / dailyPnl.length : 0,
    avgWinningDayPnl: winningDays.length ? sum(winningDays.map(([, v]) => v)) / winningDays.length : 0,
    avgLosingDayPnl: losingDays.length ? sum(losingDays.map(([, v]) => v)) / losingDays.length : 0,
    largestProfitableDay: dailyPnl.reduce((max, [, v]) => Math.max(max, v), 0), largestLosingDay: dailyPnl.reduce((min, [, v]) => Math.min(min, v), 0),
    maxDD, bestMonthStr: monthValue(months[0]), worstMonthStr: monthValue(months[months.length - 1]),
    avgMonthPnl: months.length ? core.totalPnl / months.length : 0,
  };
}
