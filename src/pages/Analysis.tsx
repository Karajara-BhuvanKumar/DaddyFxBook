import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTrades, useAllJournals, type Trade, type Journal } from "@/hooks/useTrades";
import { parseStrategySetup, buildSetupKey, buildBroadSetupKey } from "@/lib/strategySetup";
import { type BreakdownItem } from "@/components/BreakdownList";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { 
  Activity, TrendingUp, TrendingDown, Calendar, Globe, CheckCircle2, Trophy,
  Sunrise, Landmark, Building2, ChevronLeft, ChevronRight, ClipboardList, X, Layers, ArrowLeftRight, Flame
} from "lucide-react";
import "@/styles/analysis.css";

const periods = ['Today', '7 Days', '30 Days', '3 Months', '1 Year', 'All Time'] as const;
const outcomes = ['All Trades', 'Winners', 'Losers'] as const;

interface AnalysisViewProps {
  trades: Trade[];
  allJournals: Journal[];
  isLoading?: boolean;
  initialDate?: Date;
}

export default function Analysis() {
  const { data: trades = [], isLoading } = useTrades();
  const { data: allJournals = [] } = useAllJournals();
  return <AnalysisView trades={trades} allJournals={allJournals} isLoading={isLoading} />;
}

export function AnalysisView({ trades, allJournals, isLoading = false, initialDate }: AnalysisViewProps) {
  const [currentDate, setCurrentDate] = useState(() => initialDate ?? new Date());
  const [chartMode, setChartMode] = useState<'Equity' | 'Drawdown'>('Equity');
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const [timePeriod, setTimePeriod] = useState<'Today' | '7 Days' | '30 Days' | '3 Months' | '1 Year' | 'All Time'>('30 Days');
  const [filterBy, setFilterBy] = useState<'All Trades' | 'Winners' | 'Losers'>('All Trades');
  const now = new Date();

  // Filter trades based on active selectors
  const filteredTrades = useMemo(() => {
    let result = [...trades];
    const nowMs = new Date().getTime();
    
    // Apply time period filter
    if (timePeriod !== 'All Time') {
      let durationMs = 0;
      if (timePeriod === 'Today') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        result = result.filter(t => new Date(t.close_time).getTime() >= startOfToday.getTime());
      } else {
        if (timePeriod === '7 Days') {
          durationMs = 7 * 24 * 60 * 60 * 1000;
        } else if (timePeriod === '30 Days') {
          durationMs = 30 * 24 * 60 * 60 * 1000;
        } else if (timePeriod === '3 Months') {
          durationMs = 90 * 24 * 60 * 60 * 1000;
        } else if (timePeriod === '1 Year') {
          durationMs = 365 * 24 * 60 * 60 * 1000;
        }
        result = result.filter(t => {
          const closeMs = new Date(t.close_time).getTime();
          return nowMs - closeMs <= durationMs;
        });
      }
    }
    
    // Apply outcomes filter
    if (filterBy === 'Winners') {
      result = result.filter(t => Number(t.pnl) > 0);
    } else if (filterBy === 'Losers') {
      result = result.filter(t => Number(t.pnl) < 0);
    }
    
    return result;
  }, [trades, timePeriod, filterBy]);

  // 1. Core trade metrics
  const totalPnl = filteredTrades.reduce((s, t) => s + Number(t.pnl), 0);
  const winners = filteredTrades.filter(t => Number(t.pnl) > 0);
  const losers = filteredTrades.filter(t => Number(t.pnl) < 0);
  
  const grossProfit = winners.reduce((s, t) => s + Number(t.pnl), 0);
  const grossLoss = losers.reduce((s, t) => s + Number(t.pnl), 0);
  
  const winRate = filteredTrades.length ? (winners.length / filteredTrades.length) * 100 : 0;
  const profitFactor = Math.abs(grossLoss) > 0 ? grossProfit / Math.abs(grossLoss) : grossProfit > 0 ? Infinity : 0;
  const expectancy = filteredTrades.length ? totalPnl / filteredTrades.length : 0;
  
  const avgWin = winners.length ? grossProfit / winners.length : 0;
  const avgLoss = losers.length ? grossLoss / losers.length : 0;
  const bestTrade = filteredTrades.length ? Math.max(...filteredTrades.map(t => Number(t.pnl))) : 0;
  const worstTrade = filteredTrades.length ? Math.min(...filteredTrades.map(t => Number(t.pnl))) : 0;

  // 2. Streaks
  const { winStreak, lossStreak } = useMemo(() => {
    let maxWin = 0;
    let maxLoss = 0;
    let currentWin = 0;
    let currentLoss = 0;
    const sorted = [...filteredTrades].sort((a, b) => a.close_time.localeCompare(b.close_time));
    sorted.forEach(t => {
      const pnlVal = Number(t.pnl);
      if (pnlVal > 0) {
        currentWin++;
        currentLoss = 0;
        if (currentWin > maxWin) maxWin = currentWin;
      } else if (pnlVal < 0) {
        currentLoss++;
        currentWin = 0;
        if (currentLoss > maxLoss) maxLoss = currentLoss;
      } else {
        currentWin = 0;
        currentLoss = 0;
      }
    });
    return { winStreak: maxWin, lossStreak: maxLoss };
  }, [filteredTrades]);

  // 3. Durations / Hold times
  const { avgHoldAll, avgHoldWinners, avgHoldLosers } = useMemo(() => {
    const durations = filteredTrades.map(t => new Date(t.close_time).getTime() - new Date(t.open_time).getTime());
    const winnerDurations = winners.map(t => new Date(t.close_time).getTime() - new Date(t.open_time).getTime());
    const loserDurations = losers.map(t => new Date(t.close_time).getTime() - new Date(t.open_time).getTime());
    
    return {
      avgHoldAll: durations.length ? durations.reduce((s, v) => s + v, 0) / durations.length : 0,
      avgHoldWinners: winnerDurations.length ? winnerDurations.reduce((s, v) => s + v, 0) / winnerDurations.length : 0,
      avgHoldLosers: loserDurations.length ? loserDurations.reduce((s, v) => s + v, 0) / loserDurations.length : 0,
    };
  }, [filteredTrades, winners, losers]);

  const formatDuration = (ms: number) => {
    if (ms <= 0 || isNaN(ms)) return "0h 0m";
    const secs = ms / 1000;
    const mins = secs / 60;
    const hours = mins / 60;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    const remainingMins = Math.floor(mins % 60);
    if (days > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${remainingHours}h ${remainingMins}m`;
  };

  // 4. Direction stats
  const longTrades = filteredTrades.filter(t => t.direction === 'Long');
  const shortTrades = filteredTrades.filter(t => t.direction === 'Short');
  const longPnl = longTrades.reduce((s, t) => s + Number(t.pnl), 0);
  const shortPnl = shortTrades.reduce((s, t) => s + Number(t.pnl), 0);
  const longWinRate = longTrades.length ? (longTrades.filter(t => Number(t.pnl) > 0).length / longTrades.length * 100) : 0;
  const shortWinRate = shortTrades.length ? (shortTrades.filter(t => Number(t.pnl) > 0).length / shortTrades.length * 100) : 0;

  // 5. Daily grouping
  const dailyPnl = useMemo(() => {
    const daily: Record<string, number> = {};
    filteredTrades.forEach(t => { const day = t.close_time.split('T')[0]; daily[day] = (daily[day] || 0) + Number(t.pnl); });
    return Object.entries(daily).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTrades]);

  const winningDays = dailyPnl.filter(([, v]) => v > 0).length;
  const losingDays = dailyPnl.filter(([, v]) => v < 0).length;
  const avgDailyPnl = dailyPnl.length ? dailyPnl.reduce((s, [, v]) => s + v, 0) / dailyPnl.length : 0;
  
  const largestProfitableDay = dailyPnl.length ? Math.max(...dailyPnl.map(([, v]) => v), 0) : 0;
  const largestLosingDay = dailyPnl.length ? Math.min(...dailyPnl.map(([, v]) => v), 0) : 0;
  
  const avgWinningDayPnl = winningDays > 0 ? dailyPnl.filter(([, v]) => v > 0).reduce((s, [, v]) => s + v, 0) / winningDays : 0;
  const avgLosingDayPnl = losingDays > 0 ? dailyPnl.filter(([, v]) => v < 0).reduce((s, [, v]) => s + v, 0) / losingDays : 0;

  const { winDayStreak, lossDayStreak } = useMemo(() => {
    let maxWin = 0;
    let maxLoss = 0;
    let currentWin = 0;
    let currentLoss = 0;
    dailyPnl.forEach(([, v]) => {
      if (v > 0) {
        currentWin++;
        currentLoss = 0;
        if (currentWin > maxWin) maxWin = currentWin;
      } else if (v < 0) {
        currentLoss++;
        currentWin = 0;
        if (currentLoss > maxLoss) maxLoss = currentLoss;
      } else {
        currentWin = 0;
        currentLoss = 0;
      }
    });
    return { winDayStreak: maxWin, lossDayStreak: maxLoss };
  }, [dailyPnl]);

  let peak = 0, maxDD = 0, cum = 0;
  dailyPnl.forEach(([, v]) => { cum += v; if (cum > peak) peak = cum; const dd = peak - cum; if (dd > maxDD) maxDD = dd; });

  // 6. Chart & Calendar layouts
  const equityData = useMemo(() => {
    const sorted = [...filteredTrades].sort((a, b) => a.close_time.localeCompare(b.close_time));
    let c = 0;
    const points = sorted.map(t => { c += Number(t.pnl); return { date: new Date(t.close_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cumulative: c }; });
    if (points.length === 1) return [{ date: "Start", cumulative: 0 }, points[0]];
    return points;
  }, [filteredTrades]);

  const dayPerf = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = days.map(d => ({ day: d, pnl: 0, count: 0 }));
    filteredTrades.forEach(t => { const dow = (new Date(t.close_time).getDay() + 6) % 7; data[dow].pnl += Number(t.pnl); data[dow].count++; });
    return data;
  }, [filteredTrades]);

  const sessionPerf = useMemo(() => {
    const buckets: Record<string, { name: string; pnl: number; count: number; wins: number }> = {
      Asian: { name: 'Asian', pnl: 0, count: 0, wins: 0 },
      London: { name: 'London', pnl: 0, count: 0, wins: 0 },
      'New York': { name: 'New York', pnl: 0, count: 0, wins: 0 },
    };
    const journalMap = new Map(allJournals.map(j => [j.trade_id, j]));
    filteredTrades.forEach(t => {
      // Prefer trade.session, fall back to journal market_session
      let raw = t.session;
      if (!raw) {
        const j = journalMap.get(t.id);
        if (j?.strategy_setup) {
          try { raw = JSON.parse(j.strategy_setup).market_session || null; } catch { /* ignore */ }
        }
      }
      if (!raw) return; // no session data — skip
      // Fold killzones and off-session variants into parent session
      if (raw === 'London Killzone' || raw === 'Off Session London') raw = 'London';
      else if (raw === 'New York Killzone' || raw === 'Off Session New York') raw = 'New York';
      else if (raw === 'Off Session Asian') raw = 'Asian';
      const bucket = buckets[raw];
      if (!bucket) return; // unknown session value — skip
      bucket.pnl += Number(t.pnl);
      bucket.count++;
      if (Number(t.pnl) > 0) bucket.wins++;
    });
    return [buckets['Asian'], buckets['London'], buckets['New York']];
  }, [filteredTrades, allJournals]);

  const calendarData = useMemo(() => {
    const daily: Record<string, { pnl: number; count: number }> = {};
    filteredTrades.forEach(t => { const day = t.close_time.split('T')[0]; if (!daily[day]) daily[day] = { pnl: 0, count: 0 }; daily[day].pnl += Number(t.pnl); daily[day].count++; });
    return daily;
  }, [filteredTrades]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDow = (firstDay.getDay() + 6) % 7;
  const totalCells = startDow + daysInMonth;
  const weeks = Math.ceil(totalCells / 7);

  const weeklyTotals = useMemo(() => {
    const totals: { pnl: number; trades: number }[] = Array.from({ length: weeks }, () => ({ pnl: 0, trades: 0 }));
    for (let d = 1; d <= daysInMonth; d++) {
      const cellIdx = startDow + (d - 1);
      const w = Math.floor(cellIdx / 7);
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const data = calendarData[dateStr];
      if (data) {
        totals[w].pnl += data.pnl;
        totals[w].trades += data.count;
      }
    }
    return totals;
  }, [calendarData, weeks, startDow, daysInMonth, year, month]);

  // 7. Month-based statistics
  const monthlyPnlData = useMemo(() => {
    const monthly: Record<string, number> = {};
    filteredTrades.forEach(t => {
      const monthStr = t.close_time.substring(0, 7); // "YYYY-MM"
      monthly[monthStr] = (monthly[monthStr] || 0) + Number(t.pnl);
    });
    return Object.entries(monthly);
  }, [filteredTrades]);

  const bestMonthStr = useMemo(() => {
    if (monthlyPnlData.length === 0) return { label: '—', value: 0 };
    const sorted = [...monthlyPnlData].sort((a, b) => b[1] - a[1]);
    const d = new Date(sorted[0][0] + "-02");
    return {
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      value: sorted[0][1]
    };
  }, [monthlyPnlData]);

  const worstMonthStr = useMemo(() => {
    if (monthlyPnlData.length === 0) return { label: '—', value: 0 };
    const sorted = [...monthlyPnlData].sort((a, b) => a[1] - b[1]);
    const d = new Date(sorted[0][0] + "-02");
    return {
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      value: sorted[0][1]
    };
  }, [monthlyPnlData]);

  const avgMonthPnl = useMemo(() => {
    if (monthlyPnlData.length === 0) return 0;
    return monthlyPnlData.reduce((s, [, v]) => s + v, 0) / monthlyPnlData.length;
  }, [monthlyPnlData]);

  // Helper values
  const winCount = winners.length;
  const lossCount = losers.length;
  const totalCount = winCount + lossCount;

  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);
  const selectedDayTrades = useMemo(() => {
    if (!selectedCalendarDay) return [];
    return filteredTrades.filter(t => t.close_time.split('T')[0] === selectedCalendarDay);
  }, [filteredTrades, selectedCalendarDay]);

  const formatCompactVal = (val: number) => {
    const isNeg = val < 0;
    const abs = Math.abs(val);
    if (abs >= 1000) {
      return `${isNeg ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
    }
    return `${isNeg ? '-' : ''}$${abs.toFixed(2)}`;
  };


  const setupRows: BreakdownItem[] = useMemo(() => {
        // Build a map of trade_id -> journal for quick lookup
        const journalMap = new Map(allJournals.map(j => [j.trade_id, j]));

        // Aggregate filtered trades hierarchically: broad -> granular
        type Metrics = { trades: number; wins: number; pnl: number };
        const setupMap = new Map<string, { metrics: Metrics; children: Map<string, Metrics> }>();

        for (const trade of filteredTrades) {
          const journal = journalMap.get(trade.id);
          if (!journal?.strategy_setup) continue;
          
          const parsed = parseStrategySetup(journal.strategy_setup);
          const broadKey = buildBroadSetupKey(parsed);
          const granularKey = buildSetupKey(parsed);

          // Skip if both are Unspecified
          if (broadKey === "Unspecified" && granularKey === "Unspecified") continue;
          
          // Use broadKey as top-level, or fallback to granularKey if broad is empty
          const topKey = broadKey !== "Unspecified" ? broadKey : granularKey;

          if (!setupMap.has(topKey)) {
            setupMap.set(topKey, {
              metrics: { trades: 0, wins: 0, pnl: 0 },
              children: new Map(),
            });
          }
          
          const parent = setupMap.get(topKey)!;
          parent.metrics.trades += 1;
          if (Number(trade.pnl) > 0) parent.metrics.wins += 1;
          parent.metrics.pnl += Number(trade.pnl);

          // If we have a distinct granular key, track it as a child
          if (granularKey !== "Unspecified" && granularKey !== topKey) {
            const child = parent.children.get(granularKey) ?? { trades: 0, wins: 0, pnl: 0 };
            child.trades += 1;
            if (Number(trade.pnl) > 0) child.wins += 1;
            child.pnl += Number(trade.pnl);
            parent.children.set(granularKey, child);
          }
        }

        return Array.from(setupMap.entries())
          .map(([key, data]) => {
            const children: BreakdownItem[] = Array.from(data.children.entries())
              .map(([childKey, childMetrics]) => ({
                key: childKey,
                trades: childMetrics.trades,
                wins: childMetrics.wins,
                winRate: childMetrics.trades ? childMetrics.wins / childMetrics.trades : 0,
                netValue: Number(childMetrics.pnl.toFixed(2)),
                unit: "$" as const,
              }))
              .sort((a, b) => b.netValue - a.netValue);

            return {
              key,
              trades: data.metrics.trades,
              wins: data.metrics.wins,
              winRate: data.metrics.trades ? data.metrics.wins / data.metrics.trades : 0,
              netValue: Number(data.metrics.pnl.toFixed(2)),
              unit: "$" as const,
              children: children.length > 0 ? children : undefined,
            };
          })
          .sort((a, b) => b.netValue - a.netValue);


  }, [filteredTrades, allJournals]);
  const chartData = useMemo(() => {
    let high = 0;
    return equityData.map(point => {
      high = Math.max(high, point.cumulative);
      return { ...point, drawdown: point.cumulative - high };
    });
  }, [equityData]);
  const tone = (value: number) => value > 0 ? "an-profit" : value < 0 ? "an-loss" : "";
  const money = (value: number) => `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const maxDayPnl = Math.max(...dayPerf.map(day => Math.abs(day.pnl)), 1);
  const symbols = Object.entries(filteredTrades.reduce((groups, trade) => {
    const group = groups[trade.symbol] ??= { pnl: 0, count: 0, wins: 0 };
    group.pnl += Number(trade.pnl);
    group.count++;
    if (Number(trade.pnl) > 0) group.wins++;
    return groups;
  }, {} as Record<string, { pnl: number; count: number; wins: number }>)).sort(([, a], [, b]) => b.pnl - a.pnl).slice(0, 3);
  const utcProgress = (clock.getUTCHours() * 60 + clock.getUTCMinutes()) / 1440 * 100;
  const quickStats = [
    { label: "Avg Winner", value: money(avgWin), color: tone(avgWin) },
    { label: "Avg Loser", value: money(avgLoss), color: tone(avgLoss) },
    { label: "Best Trade", value: money(bestTrade), color: tone(bestTrade) },
    { label: "Worst Trade", value: money(worstTrade), color: tone(worstTrade) },
    { label: "Win Streak", value: winStreak },
    { label: "Loss Streak", value: lossStreak },
    { label: "Risk:Reward", value: avgLoss ? `1:${Math.abs(avgWin / avgLoss).toFixed(2)}` : "—", color: "an-profit" },
    { label: "Open Trades", value: 0 },
  ];
  const statsColumns = [[
              { l: 'Total P&L', v: formatCompactVal(totalPnl), c: totalPnl >= 0 ? 'an-profit' : 'an-loss' },
              { l: 'Average daily volume', v: dailyPnl.length ? (filteredTrades.length / dailyPnl.length).toFixed(2) : '0.00' },
              { l: 'Average winning trade', v: formatCompactVal(avgWin), c: 'an-profit' },
              { l: 'Average losing trade', v: avgLoss < 0 ? `-${formatCompactVal(Math.abs(avgLoss))}` : '$0.00', c: 'an-loss' },
              { l: 'Total number of trades', v: `${filteredTrades.length}` },
              { l: 'Number of winning trades', v: `${winners.length}`, c: 'an-profit' },
              { l: 'Number of losing trades', v: `${losers.length}`, c: 'an-loss' },
              { l: 'Number of break even trades', v: `${filteredTrades.length - winners.length - losers.length}` },
              { l: 'Max consecutive wins', v: `${winStreak}` },
              { l: 'Max consecutive losses', v: `${lossStreak}` },
              { l: 'Total commissions', v: '$0.00' },
              { l: 'Total swap', v: '$0.00' },
              { l: 'Largest profit', v: formatCompactVal(bestTrade), c: 'an-profit' },
              { l: 'Largest loss', v: worstTrade < 0 ? `-${formatCompactVal(Math.abs(worstTrade))}` : '$0.00', c: 'an-loss' },
              { l: 'Avg hold time (All)', v: formatDuration(avgHoldAll) },
              { l: 'Avg hold time (Winners)', v: formatDuration(avgHoldWinners) },
              { l: 'Avg hold time (Losers)', v: formatDuration(avgHoldLosers) },
            ], [
              { l: 'Open trades', v: '0' },
              { l: 'Total trading days', v: `${dailyPnl.length}` },
              { l: 'Winning days', v: `${winningDays}`, c: 'an-profit' },
              { l: 'Losing days', v: `${losingDays}`, c: 'an-loss' },
              { l: 'Breakeven days', v: `${dailyPnl.length - winningDays - losingDays}` },
              { l: 'Max consecutive winning days', v: `${winDayStreak}` },
              { l: 'Max consecutive losing days', v: `${lossDayStreak}` },
              { l: 'Average daily P&L', v: formatCompactVal(avgDailyPnl), c: avgDailyPnl >= 0 ? 'an-profit' : 'an-loss' },
              { l: 'Average winning day P&L', v: formatCompactVal(avgWinningDayPnl), c: 'an-profit' },
              { l: 'Average losing day P&L', v: avgLosingDayPnl < 0 ? `-${formatCompactVal(Math.abs(avgLosingDayPnl))}` : '$0.00', c: 'an-loss' },
              { l: 'Largest profitable day', v: formatCompactVal(largestProfitableDay), c: 'an-profit' },
              { l: 'Largest losing day', v: largestLosingDay < 0 ? `-${formatCompactVal(Math.abs(largestLosingDay))}` : '$0.00', c: 'an-loss' },
              { l: 'Trade expectancy', v: formatCompactVal(expectancy), c: expectancy >= 0 ? 'an-profit' : 'an-loss' },
              { l: 'Max drawdown', v: maxDD > 0 ? `-${formatCompactVal(Math.abs(maxDD))}` : '$0.00', c: 'an-loss' },
              { l: 'Max drawdown %', v: peak > 0 ? `-${(maxDD / peak * 100).toFixed(2)}%` : '0%', c: 'an-loss' },
            ]];
  const setupMetrics = (row: BreakdownItem) => <>
    <span className="an-setup-count"><span className="an-mobile-label">Trades </span>{row.trades}</span>
    <span className="an-setup-rate"><span className="an-mobile-label">Win </span>{(row.winRate * 100).toFixed(0)}%<i><b style={{ width: `${row.winRate * 100}%` }} /></i></span>
    <strong className={tone(row.netValue)}>{money(row.netValue)}</strong>
  </>;

  if (isLoading) return <div className="analysis-page an-loading" role="status"><Activity className="animate-pulse" />Loading analysis...</div>;

  return (
    <div className="analysis-page">
      <header className="an-toolbar">
        <h1><Activity />Performance Analytics</h1>
        <div className="an-filter"><span>Time Period</span><div className="an-segments" role="group" aria-label="Time period">
          {periods.map(period => <button key={period} aria-pressed={timePeriod === period} onClick={() => { setTimePeriod(period); setSelectedCalendarDay(null); }}>{period}</button>)}
        </div></div>
        <div className="an-filter"><span>Filter By</span><div className="an-segments" role="group" aria-label="Trade outcome">
          {outcomes.map(outcome => <button key={outcome} aria-pressed={filterBy === outcome} onClick={() => { setFilterBy(outcome); setSelectedCalendarDay(null); }}>{outcome === "Winners" && <CheckCircle2 />}{outcome === "Losers" && <X />}{outcome}</button>)}
        </div></div>
      </header>

      <section className="an-surface an-kpis" aria-label="Performance summary">
        <div className="an-kpi an-kpi-total">
          <span className="an-label">Total P&amp;L</span><strong className={tone(totalPnl)}>{formatCompactVal(totalPnl)}</strong>
          <p>From {filteredTrades.length} closed trades</p>
          <div className="an-sparkline" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><Area type="linear" dataKey="cumulative" stroke="var(--an-blue)" fill="var(--an-blue)" fillOpacity={0.06} strokeOpacity={0.4} dot={false} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>
        </div>
        <div className="an-kpi"><span className="an-label">Win Rate</span><strong className="an-profit">{winRate.toFixed(1)}%</strong><div className="an-ratio" aria-hidden="true"><i style={{ width: `${winRate}%` }} /><i style={{ width: `${filteredTrades.length ? losers.length / filteredTrades.length * 100 : 0}%` }} /></div><p>{winCount} wins · {lossCount} losses</p></div>
        <div className="an-kpi"><span className="an-label">Profit Factor</span><strong className="an-profit">{Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : "∞"}</strong><p><Flame size={13} />{!filteredTrades.length ? "No trades" : profitFactor >= 2 ? "Excellent" : profitFactor >= 1 ? "Profitable" : "Below breakeven"}</p></div>
        <div className="an-kpi"><span className="an-label">Expectancy</span><strong className={tone(expectancy)}>{money(expectancy)}</strong><p>Expected profit per trade</p></div>
      </section>

      <section className="an-surface" aria-label="Equity and drawdown">
        <div className="an-section-heading"><div><h2><Activity />{chartMode === "Equity" ? "Equity Curve" : "Drawdown"}</h2><p>{chartMode === "Equity" ? "Cumulative P&L progression" : "Decline from the cumulative P&L peak"}</p></div><div className="an-segments" role="group" aria-label="Chart mode">{(["Equity", "Drawdown"] as const).map(mode => <button key={mode} aria-pressed={chartMode === mode} onClick={() => setChartMode(mode)}>{mode}</button>)}</div></div>
        <div className="an-equity-chart" role="img" aria-label={`${chartMode} chart, ${filteredTrades.length} trades`}>
          {chartData.length ? <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 0, bottom: 8, left: 0 }}>
              <defs><linearGradient id="analysisEquityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartMode === "Equity" ? "var(--an-blue)" : "var(--an-red)"} stopOpacity={0.22} /><stop offset="100%" stopColor={chartMode === "Equity" ? "var(--an-blue)" : "var(--an-red)"} stopOpacity={0.015} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="var(--an-line)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--an-muted)", fontSize: 10 }} minTickGap={40} tickMargin={12} interval="preserveStartEnd" />
              <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fill: "var(--an-muted)", fontSize: 10 }} width={65} tickFormatter={formatCompactVal} />
              <ReferenceLine y={0} stroke="var(--an-muted)" strokeOpacity={0.4} strokeDasharray="4 4" />
              <Tooltip contentStyle={{ background: "var(--an-surface)", border: "1px solid var(--an-line)", borderRadius: 8, color: "var(--an-text)", fontSize: 12 }} formatter={(value: number) => [money(value), chartMode]} />
              <Area type="linear" dataKey={chartMode === "Equity" ? "cumulative" : "drawdown"} stroke={chartMode === "Equity" ? "var(--an-blue)" : "var(--an-red)"} fill="url(#analysisEquityFill)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer> : <div className="an-empty"><Activity /><p>No trades in this period</p></div>}
        </div>
        <div className="an-quick-stats">{quickStats.map(stat => <div key={stat.label}><span className="an-label">{stat.label}</span><strong className={stat.color}>{stat.value}</strong></div>)}</div>
      </section>

      <section className="an-surface an-distribution" aria-label="Win / Loss Distribution">
        <div className="an-section-heading"><h2><CheckCircle2 />Win / Loss Distribution</h2><p>{winCount} winners · {lossCount} losers</p></div>
        <div className="an-distribution-bar" aria-label={`${winCount} winners, ${lossCount} losers`}>
          {winCount > 0 && <span style={{ flex: winCount }}>{winCount}W</span>}
          {lossCount > 0 && <span className="an-loss-fill" style={{ flex: lossCount }}>{lossCount}L</span>}
          {totalCount === 0 && <span className="an-no-results">No wins or losses</span>}
        </div>
        <div className="an-distribution-totals">{[{ label: "Gross Profit", value: grossProfit }, { label: "Gross Loss", value: grossLoss }, { label: "Net Result", value: totalPnl }].map(item => <div key={item.label}><span className="an-label">{item.label}</span><strong className={tone(item.value)}>{formatCompactVal(item.value)}</strong></div>)}</div>
      </section>

      <section className="an-surface an-comparisons" aria-label="Trade breakdowns">
        <div><div className="an-section-heading"><div><h2><ArrowLeftRight />Long vs Short</h2><p>Performance by trade direction</p></div></div>
          <div className="an-direction-bar" aria-hidden="true"><i style={{ flex: longTrades.length }} /><i style={{ flex: shortTrades.length }} /></div>
          <div className="an-direction-list">{[{ name: "Long", count: longTrades.length, pnl: longPnl, rate: longWinRate, Icon: TrendingUp }, { name: "Short", count: shortTrades.length, pnl: shortPnl, rate: shortWinRate, Icon: TrendingDown }].map(item => <div key={item.name}><span><i className={item.name === "Short" ? "an-red-dot" : ""} /><item.Icon size={14} /><b>{item.name}</b></span><small>{item.count} trades · {item.rate.toFixed(1)}%</small><strong className={tone(item.pnl)}>{money(item.pnl)}</strong></div>)}</div>
        </div>
        <div><div className="an-section-heading"><div><h2><Calendar />Day Performance</h2><p>Results by weekday</p></div></div>
          <div className="an-weekdays">{dayPerf.map(day => <div key={day.day}><span>{day.day}</span><div className="an-diverging"><i className={day.pnl < 0 ? "an-negative-bar" : ""} style={{ width: `${Math.abs(day.pnl) / maxDayPnl * 50}%` }} /></div><strong className={tone(day.pnl)}>{day.count ? money(day.pnl) : "—"}</strong></div>)}</div>
        </div>
        <div><div className="an-section-heading"><div><h2><Trophy />Top Symbols</h2><p>Best performing assets</p></div></div>
          <div className="an-symbols">{symbols.length ? symbols.map(([symbol, data], index) => <div key={symbol}><span>{index + 1}</span><div><b>{symbol}</b><small><i><b style={{ width: `${data.wins / data.count * 100}%` }} /></i>{data.count} trades · {(data.wins / data.count * 100).toFixed(0)}% win</small></div><strong className={tone(data.pnl)}>{formatCompactVal(data.pnl)}</strong></div>) : <p className="an-inline-empty">No symbol data</p>}</div>
        </div>
      </section>

      <section className="an-surface" aria-label="Session Performance">
        <div className="an-section-heading"><div><h2><Globe />Session Performance</h2><p>Asian, London &amp; New York · UTC</p></div></div>
        <div className="an-session-timeline">
          <div className="an-session-track"><span>Asian</span><span>London</span><span>New York</span><span aria-label="Asian session continues" /></div>
          <div className="an-now" style={{ left: `${utcProgress}%` }} title={`${clock.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })} UTC`}><span style={{ transform: utcProgress < 5 ? "none" : utcProgress > 95 ? "translateX(-100%)" : "translateX(-50%)" }}>NOW</span></div>
          <div className="an-session-times"><span>00:00</span><span>08:00</span><span>13:00</span><span>22:00</span><span>24:00</span></div>
        </div>
        <div className="an-session-grid">{sessionPerf.map((session, index) => {
          const Icon = [Sunrise, Landmark, Building2][index];
          const sessionRate = session.count ? session.wins / session.count * 100 : 0;
          return <div key={session.name}><div className={`an-session-name an-session-${index}`}><span><Icon /></span><div><h3>{session.name}</h3><p>{["22:00 – 08:00", "08:00 – 13:00", "13:00 – 22:00"][index]} UTC</p></div></div>
            <strong className={cn("an-session-pnl", tone(session.pnl))}>{money(session.pnl)}</strong>
            <div className="an-session-meter" aria-hidden="true"><i className={session.pnl < 0 ? "an-loss-fill" : ""} style={{ width: `${Math.abs(session.pnl) / Math.max(...sessionPerf.map(s => Math.abs(s.pnl)), 1) * 100}%` }} /></div>
            <dl>{[{ label: "Trades", value: session.count }, { label: "Win Rate", value: `${sessionRate.toFixed(1)}%`, color: sessionRate ? "an-profit" : "" }, { label: "Avg Trade", value: money(session.count ? session.pnl / session.count : 0), color: tone(session.pnl) }, { label: "Volume", value: `${filteredTrades.length ? Math.round(session.count / filteredTrades.length * 100) : 0}%` }].map(stat => <div key={stat.label}><dt className="an-label">{stat.label}</dt><dd className={stat.color}>{stat.value}</dd></div>)}</dl>
          </div>;
        })}</div>
      </section>

      <section className="an-surface an-setups" aria-label="Performance by Setup">
        <div className="an-section-heading"><div><h2><Layers />Performance by Setup</h2><p>Strategy setups from journal entries</p></div><span className="an-period-badge">{setupRows.length} setups</span></div>
        <div className="an-setup-columns" aria-hidden="true"><span>Strategy setup</span><span>Trades</span><span>Win rate</span><span>Net P&amp;L</span></div>
        {setupRows.length ? setupRows.map(row => row.children?.length ? <details className="an-setup-group" key={row.key}>
          <summary className="an-setup-row"><span className="an-setup-name"><ChevronRight size={15} /><b>{row.key}</b></span>{setupMetrics(row)}</summary>
          <div className="an-setup-children">{row.children.map(child => <div className="an-setup-row" key={child.key}><span className="an-setup-name">{child.key}</span>{setupMetrics(child)}</div>)}</div>
        </details> : <div className="an-setup-row" key={row.key}><span className="an-setup-name"><Layers size={15} /><b>{row.key}</b></span>{setupMetrics(row)}</div>) : <div className="an-empty"><Layers /><p>No journal setups in this period</p></div>}
      </section>

      <section className="an-surface an-calendar-section" aria-label="Trading Calendar">
        <div className="an-section-heading"><div><h2><Calendar />Trading Calendar</h2><p>Daily P&amp;L</p></div><div className="an-month-nav"><button aria-label="Previous month" onClick={() => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedCalendarDay(null); }}><ChevronLeft /></button><span aria-live="polite">{currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span><button aria-label="Next month" onClick={() => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedCalendarDay(null); }}><ChevronRight /></button></div></div>
        <div className="an-calendar-body"><div className="an-calendar-main">
          <div className="an-calendar-scroll"><div className="an-calendar-grid">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Weekly"].map(day => <span className={cn("an-calendar-dow", day === "Weekly" && "an-profit")} key={day}>{day}</span>)}
            {Array.from({ length: weeks }, (_, week) => <div className="an-calendar-week" key={week}>
              {Array.from({ length: 7 }, (_, column) => {
                const day = week * 7 + column - startDow + 1;
                if (day < 1 || day > daysInMonth) return <div key={column} />;
                const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const data = calendarData[key];
                return <button key={column} className={cn("an-calendar-day", data && (data.pnl > 0 ? "an-day-profit" : data.pnl < 0 ? "an-day-loss" : "an-day-flat"), selectedCalendarDay === key && "is-selected")} aria-label={`${currentDate.toLocaleDateString("en-US", { month: "long" })} ${day}, ${data ? `${data.count} trades, ${money(data.pnl)}` : "no trades"}`} aria-pressed={selectedCalendarDay === key} aria-current={day === now.getDate() && month === now.getMonth() && year === now.getFullYear() ? "date" : undefined} onClick={() => setSelectedCalendarDay(key)}><span>{day}</span>{data && <><strong className={tone(data.pnl)} title={money(data.pnl)}>{formatCompactVal(data.pnl)}</strong><small>{data.count} trade{data.count !== 1 ? "s" : ""}</small></>}</button>;
              })}
              <div className={cn("an-calendar-week-total", tone(weeklyTotals[week].pnl))}><span>Weekly</span><strong title={money(weeklyTotals[week].pnl)}>{formatCompactVal(weeklyTotals[week].pnl)}</strong><small>{weeklyTotals[week].trades} trades</small></div>
            </div>)}
          </div></div>
          <div className="an-calendar-legend"><span><i />Profitable Day</span><span><i />Losing Day</span><span><i />No Trades</span></div>
        </div><aside className="an-day-details" aria-label="Day Trades"><h2><ClipboardList />Day Trades</h2>
          {selectedCalendarDay && <p className="an-selected-date">{new Date(selectedCalendarDay + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
          <div aria-live="polite">{selectedDayTrades.length ? selectedDayTrades.map(trade => <div className="an-day-trade" key={trade.id}><div><b>{trade.symbol}</b><small>{trade.direction} · {trade.lot_size} lots</small></div><strong className={tone(Number(trade.pnl))}>{money(Number(trade.pnl))}</strong></div>) : <div className="an-empty"><Calendar /><p>{selectedCalendarDay ? "No trades on this day" : "No day selected"}</p></div>}</div>
        </aside></div>
      </section>

      <section className="an-surface" aria-label="Your Stats">
        <div className="an-section-heading"><h2><ClipboardList />Your Stats</h2><span className="an-period-badge">{timePeriod}</span></div>
        <div className="an-month-stats">{[{ label: "Best Month", value: bestMonthStr.value, detail: bestMonthStr.label }, { label: "Worst Month", value: worstMonthStr.value, detail: worstMonthStr.label }, { label: "Average", value: avgMonthPnl, detail: "per Month" }].map(stat => <div key={stat.label}><span className="an-label">{stat.label}</span><strong className={tone(stat.value)}>{money(stat.value)}</strong><p>{stat.detail}</p></div>)}</div>
        <div className="an-detailed-stats">{statsColumns.map((column, index) => <dl key={index}>{column.map(stat => <div key={stat.l}><dt>{stat.l}</dt><dd className={stat.c}>{stat.v}</dd></div>)}</dl>)}</div>
      </section>
    </div>
  );
}
