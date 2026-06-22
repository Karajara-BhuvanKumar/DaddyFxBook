import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTrades } from "@/hooks/useTrades";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { 
  Activity, TrendingUp, TrendingDown, BarChart3, Calendar, Globe, 
  DollarSign, CheckCircle2, Star, SlidersHorizontal, Moon, Coffee, 
  Building2, ChevronLeft, ChevronRight, FileText, X 
} from "lucide-react";

export default function Analysis() {
  const { data: trades = [], isLoading } = useTrades();
  const [currentDate, setCurrentDate] = useState(new Date());
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
  const profitFactor = Math.abs(grossLoss) > 0 ? grossProfit / Math.abs(grossLoss) : grossProfit;
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
    const sessions = [
      { name: 'Asian', start: 22, end: 8, pnl: 0, count: 0, wins: 0 },
      { name: 'London', start: 8, end: 13, pnl: 0, count: 0, wins: 0 },
      { name: 'New York', start: 13, end: 22, pnl: 0, count: 0, wins: 0 },
    ];
    filteredTrades.forEach(t => {
      const hour = new Date(t.open_time).getUTCHours();
      let s = sessions[2];
      if ((hour >= 22 || hour < 8)) s = sessions[0];
      else if (hour >= 8 && hour < 13) s = sessions[1];
      s.pnl += Number(t.pnl); s.count++;
      if (Number(t.pnl) > 0) s.wins++;
    });
    return sessions;
  }, [filteredTrades]);

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
  const winPct = totalCount ? (winCount / totalCount) * 100 : 50;
  const lossPct = totalCount ? (lossCount / totalCount) * 100 : 50;

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

  const formatK = (val: number) => {
    const isNeg = val < 0;
    const abs = Math.abs(val);
    if (abs >= 1000) {
      return `${isNeg ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
    }
    return `${isNeg ? '+' : ''}$${abs.toFixed(2)}`;
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex items-center gap-3 text-muted-foreground"><Activity className="w-5 h-5 animate-pulse" /><span className="text-base font-medium">Loading analysis...</span></div>
    </div>
  );

  return (
    <div className="space-y-6 md:space-y-8 overflow-guard">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-white/[0.05] pb-4 md:pb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-[20px] bg-blue-500/10 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Performance Analytics</h1>
            <p className="text-[12px] text-zinc-500 font-semibold mt-0.5">Analyze your trading patterns and improve your strategy</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-4 sm:gap-6">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Time Period</span>
            <div className="flex flex-wrap items-center gap-1">
              {['Today', '7 Days', '30 Days', '3 Months', '1 Year', 'All Time'].map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimePeriod(tf as any)}
                  className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold transition-all duration-200 ${
                    tf === timePeriod ? 'bg-[#3B82F6] text-white shadow-sm' : 'bg-[#121212] text-zinc-500 hover:text-white hover:bg-[#1A1A1A]'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Filter By</span>
            <div className="flex flex-wrap items-center gap-1">
              {['All Trades', 'Winners', 'Losers'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilterBy(f as any)}
                  className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold transition-all duration-200 ${
                    f === filterBy ? 'bg-[#3B82F6] text-white shadow-sm' : 'bg-[#121212] text-zinc-500 hover:text-white hover:bg-[#1A1A1A]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total P&L */}
        <div className="bg-[#0B0B0B] border-t border-t-[#3B82F6]/30 rounded-[20px] p-4 sm:p-5 flex flex-col justify-between min-h-[140px] sm:min-h-[160px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total P&L</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-[#3B82F6]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className={`text-2xl font-black tracking-tight leading-none ${totalPnl >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>{formatCompactVal(totalPnl)}</h3>
            <p className="text-[11px] text-zinc-500 font-semibold mt-2">From {filteredTrades.length} closed trades</p>
          </div>
          <span className="text-[9px] text-zinc-600 font-bold uppercase mt-2">Your net profit/loss for the selected period</span>
        </div>

        {/* Win Rate */}
        <div className="bg-[#0B0B0B] rounded-[20px] p-4 sm:p-5 flex flex-col justify-between min-h-[140px] sm:min-h-[160px] hover:bg-[#0F0F0F] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Win Rate</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-[#3B82F6]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#3B82F6] tracking-tight leading-none">{winRate.toFixed(1)}%</h3>
            <p className="text-[11px] text-zinc-500 font-semibold mt-2">{winners.length} wins · {losers.length} losses</p>
            <div className="mt-2.5 h-1 rounded-full bg-zinc-800 overflow-hidden max-w-[150px]">
              <div className="h-full bg-[#3B82F6] transition-all" style={{ width: `${winRate}%` }} />
            </div>
          </div>
          <span className="text-[9px] text-zinc-600 font-bold uppercase mt-2">Percentage of profitable trades</span>
        </div>

        {/* Profit Factor */}
        <div className="bg-[#0B0B0B] rounded-[20px] p-4 sm:p-5 flex flex-col justify-between min-h-[140px] sm:min-h-[160px] hover:bg-[#0F0F0F] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Profit Factor</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-[#A855F7]">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#3B82F6] tracking-tight leading-none">{profitFactor.toFixed(2)}</h3>
            <p className="text-[11px] text-zinc-500 font-semibold mt-2">{profitFactor >= 2 ? 'Excellent' : profitFactor >= 1.5 ? 'Good' : 'Needs Work'}</p>
          </div>
          <span className="text-[9px] text-zinc-600 font-bold uppercase mt-2">Gross profit · Gross loss (above 1.5 is good)</span>
        </div>

        {/* Expectancy */}
        <div className="bg-[#0B0B0B] rounded-[20px] p-4 sm:p-5 flex flex-col justify-between min-h-[140px] sm:min-h-[160px] hover:bg-[#0F0F0F] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Expectancy</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Star className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className={`text-2xl font-black tracking-tight leading-none ${expectancy >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>{formatCompactVal(expectancy)}</h3>
            <p className="text-[11px] text-zinc-500 font-semibold mt-2">Average per trade</p>
          </div>
          <span className="text-[9px] text-zinc-600 font-bold uppercase mt-2">Expected profit per trade based on stats</span>
        </div>
      </div>

      {/* Quick Stats + Equity Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Stats */}
        <div className="bg-[#0B0B0B] rounded-[20px] p-4 sm:p-5 flex flex-col justify-between min-h-[280px] sm:min-h-[420px]">
          <h3 className="text-xs font-bold text-white mb-4 flex items-center gap-1.5 uppercase tracking-wider">
            <SlidersHorizontal className="w-4 h-4 text-[#3B82F6]" /> Quick Stats
          </h3>
          <div className="grid grid-cols-2 gap-2.5 flex-1">
            {[
              { label: 'Avg Winner', value: formatCompactVal(avgWin), color: 'text-[#3B82F6]' },
              { label: 'Avg Loser', value: `-$${Math.abs(avgLoss).toFixed(2)}`, color: 'text-[#EF4444]' },
              { label: 'Best Trade', value: formatCompactVal(bestTrade), color: bestTrade >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]' },
              { label: 'Worst Trade', value: worstTrade < 0 ? `-$${Math.abs(worstTrade).toFixed(2)}` : '$0.00', color: worstTrade < 0 ? 'text-[#EF4444]' : 'text-[#3B82F6]' },
              { label: 'Win Streak', value: `${winStreak} trades`, color: 'text-white' },
              { label: 'Loss Streak', value: `${lossStreak} trades`, color: 'text-white' },
              { label: 'Risk:Reward', value: `1:${avgLoss !== 0 ? Math.abs(avgWin / avgLoss).toFixed(2) : '∞'}`, color: 'text-[#3B82F6]' },
              { label: 'Open Trades', value: '0', color: 'text-white' },
            ].map(s => (
              <div key={s.label} className="bg-[#0B0B0B] rounded-[20px] p-3.5 flex flex-col justify-between hover:bg-[#0F0F0F] transition-colors">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{s.label}</span>
                <span className={`text-[14px] font-black mt-1.5 ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Equity Curve */}
        <div className="lg:col-span-2 bg-[#0B0B0B] rounded-[20px] p-4 sm:p-5 flex flex-col justify-between min-h-[280px] sm:min-h-[420px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                <TrendingUp className="w-4 h-4 text-[#3B82F6]" /> Equity Curve
              </h3>
              <p className="text-[11px] text-zinc-500 font-semibold mt-1">Cumulative P&L progression</p>
            </div>
            <div className="flex items-center gap-1">
              {['Equity', 'Drawdown'].map(b => (
                <button
                  key={b}
                  className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold transition-all duration-200 ${
                    b === 'Equity' ? 'bg-[#3B82F6] text-white shadow-sm' : 'bg-[#121212] text-zinc-500 hover:text-white hover:bg-[#1A1A1A]'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 flex items-end">
            {equityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={equityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#71717a", fontSize: 10, fontFamily: "Inter" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 10, fontFamily: "Inter" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#080808",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "white",
                      fontSize: "12px",
                    }}
                    formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "P&L"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#3B82F6"
                    fill="none"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs font-semibold">
                Add trades to see equity curve
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Long vs Short + Day Perf + Top Symbols */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Long vs Short */}
        <div className="bg-[#0B0B0B] rounded-[20px] p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-white mb-1 flex items-center gap-1.5 uppercase tracking-wider">
              <SlidersHorizontal className="w-4 h-4 text-[#3B82F6]" /> Long vs Short
            </h3>
            <p className="text-[11px] text-zinc-500 font-semibold mb-4">Performance by trade direction</p>
          </div>
          <div className="space-y-3">
            {/* Long Card */}
            <div className="bg-[#0B0B0B] border-l-2 border-l-[#3B82F6] rounded-[20px] p-4 bg-gradient-to-r from-[#3B82F6]/5 to-transparent">
              <span className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Long
              </span>
              <div className="grid grid-cols-3 gap-2 text-center mt-3">
                <div>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase">Trades</p>
                  <p className="text-[14px] font-bold text-white mt-1">{longTrades.length}</p>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase">P&L</p>
                  <p className={`text-[14px] font-bold mt-1 ${longPnl >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>
                    ${longPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase">Win %</p>
                  <p className={`text-[14px] font-bold mt-1 ${longWinRate > 0 ? 'text-[#3B82F6]' : 'text-white'}`}>{longWinRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
            {/* Short Card */}
            <div className="bg-[#0B0B0B] border-l-2 border-l-[#EF4444] rounded-[20px] p-4 bg-gradient-to-r from-[#EF4444]/5 to-transparent">
              <span className="text-[10px] font-bold text-[#EF4444] uppercase tracking-wider flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" /> Short
              </span>
              <div className="grid grid-cols-3 gap-2 text-center mt-3">
                <div>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase">Trades</p>
                  <p className="text-[14px] font-bold text-white mt-1">{shortTrades.length}</p>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase">P&L</p>
                  <p className={`text-[14px] font-bold mt-1 ${shortPnl >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>
                    ${shortPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase">Win %</p>
                  <p className={`text-[14px] font-bold mt-1 ${shortWinRate > 0 ? 'text-[#3B82F6]' : 'text-white'}`}>{shortWinRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Day Performance */}
        <div className="bg-[#0B0B0B] rounded-[20px] p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-white mb-1 flex items-center gap-1.5 uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-[#3B82F6]" /> Day Performance
            </h3>
            <p className="text-[11px] text-zinc-500 font-semibold mb-4">Find your best trading days</p>
          </div>
          <div className="space-y-3">
            {dayPerf.map(d => {
              const maxPnl = Math.max(...dayPerf.map(x => Math.abs(x.pnl)), 1);
              const percentage = Math.min((Math.abs(d.pnl) / maxPnl) * 100, 100);
              return (
                <div key={d.day} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 font-semibold w-8">{d.day}</span>
                  <div className="flex-1 h-[22px] bg-[#121212] rounded-md overflow-hidden relative border border-white/[0.02]">
                    {d.count > 0 && (
                      <div 
                        className={`h-full transition-all duration-500 rounded-md ${d.pnl >= 0 ? 'bg-[#3B82F6]' : 'bg-[#EF4444]'}`}
                        style={{ width: `${percentage}%` }} 
                      />
                    )}
                  </div>
                  <span className={`text-[12px] font-bold w-16 text-right ${d.count > 0 ? (d.pnl >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]') : 'text-zinc-600'}`}>
                    {d.count > 0 ? `${d.pnl >= 0 ? '' : '-'}$${Math.abs(d.pnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Symbols */}
        <div className="bg-[#0B0B0B] rounded-[20px] p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-white mb-1 flex items-center gap-1.5 uppercase tracking-wider">
              <Star className="w-4 h-4 text-[#3B82F6]" /> Top Symbols
            </h3>
            <p className="text-[11px] text-zinc-500 font-semibold mb-4">Best performing assets</p>
          </div>
          <div className="space-y-2.5">
            {Object.entries(
              filteredTrades.reduce((acc, t) => {
                if (!acc[t.symbol]) acc[t.symbol] = { pnl: 0, count: 0, wins: 0 };
                acc[t.symbol].pnl += Number(t.pnl);
                acc[t.symbol].count++;
                if (Number(t.pnl) > 0) acc[t.symbol].wins++;
                return acc;
              }, {} as Record<string, { pnl: number; count: number; wins: number }>)
            )
              .sort(([, a], [, b]) => b.pnl - a.pnl)
              .slice(0, 3)
              .map(([sym, data], idx) => (
                <div key={sym} className="bg-[#0B0B0B] rounded-[20px] p-3.5 flex items-center justify-between hover:bg-[#0F0F0F] transition-colors group">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-blue-500/10 text-[#3B82F6] text-[10px] font-black flex items-center justify-center">{idx + 1}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4.5 h-4.5 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center scale-90">
                          <DollarSign className="w-2.5 h-2.5 text-black stroke-[3]" />
                        </div>
                        <span className="font-bold text-white text-xs">{sym}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-semibold mt-1">
                        {data.count} trades · {((data.wins / data.count) * 100).toFixed(0)}% win
                      </p>
                    </div>
                  </div>
                  <span className={`text-[13px] font-black ${data.pnl >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>
                    ${data.pnl.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Session Performance */}
      <div className="bg-[#0B0B0B] rounded-[20px] p-5">
        <h3 className="text-xs font-bold text-white mb-1 flex items-center gap-1.5 uppercase tracking-wider">
          <Globe className="w-4 h-4 text-[#3B82F6]" /> Session Performance
        </h3>
        <p className="text-[11px] text-zinc-500 font-semibold">Breakdown by trading session - Asian, London & New York</p>

        {/* Timeline */}
        <div className="w-full h-7 rounded-lg overflow-hidden flex text-[9px] font-black text-white select-none mt-5">
          <div className="bg-[#5c4004] border-r border-[#0B0B0B] flex items-center justify-center tracking-wider" style={{ width: '41.6%' }}>ASIAN</div>
          <div className="bg-[#102a5c] border-r border-[#0B0B0B] flex items-center justify-center tracking-wider" style={{ width: '20.8%' }}>LONDON</div>
          <div className="bg-[#064e3b] flex items-center justify-center tracking-wider" style={{ width: '37.6%' }}>NEW YORK</div>
        </div>
        <div className="relative w-full text-[9px] text-zinc-600 font-bold select-none h-4 mt-1.5">
          <span className="absolute left-0">00:00</span>
          <span className="absolute" style={{ left: '41.6%' }}>08:30</span>
          <span className="absolute" style={{ left: '62.4%' }}>13:30</span>
          <span className="absolute right-0">22:00</span>
        </div>

        {/* Session cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
          {sessionPerf.map(s => {
            const hasData = s.count > 0;
            const volumePct = filteredTrades.length ? Math.round((s.count / filteredTrades.length) * 100) : 0;
            const winRate = s.count ? (s.wins / s.count * 100) : 0;
            const avgTradeVal = s.count ? s.pnl / s.count : 0;
            
            let iconColor = "text-amber-500 bg-amber-500/10";
            let Icon = Moon;
            if (s.name === 'London') {
              iconColor = "text-[#3B82F6] bg-blue-500/10";
              Icon = Coffee;
            } else if (s.name === 'New York') {
              iconColor = "text-emerald-500 bg-[#064e3b]/20";
              Icon = Building2;
            }

            return (
              <div key={s.name} className="bg-[#0B0B0B] rounded-[20px] p-5 flex flex-col justify-between hover:bg-[#0F0F0F] transition-colors">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{s.name}</h4>
                      <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">{s.start}:00 - {s.end}:00 UTC</p>
                    </div>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColor}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  {hasData && (
                    <div className="mt-4">
                      <span className={`text-base font-black ${s.pnl >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>
                        {s.pnl >= 0 ? '+' : '-'}${Math.abs(s.pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <div className="mt-2.5 h-1 rounded-full bg-zinc-800 overflow-hidden w-full">
                        <div className={`h-full transition-all ${s.pnl >= 0 ? 'bg-[#3B82F6]' : 'bg-[#EF4444]'}`} style={{ width: `${winRate}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-2 mt-6 border-t border-white/[0.05] pt-4 text-left">
                  <div>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Trades</span>
                    <p className="text-xs font-bold text-white mt-1">{s.count}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Win Rate</span>
                    <p className={`text-xs font-bold mt-1 ${winRate > 0 ? 'text-[#3B82F6]' : 'text-white'}`}>{hasData ? `${winRate.toFixed(1)}%` : '—'}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Avg Trade</span>
                    <p className={`text-xs font-bold mt-1 ${hasData ? (avgTradeVal >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]') : 'text-white'}`}>
                      {hasData ? `${avgTradeVal >= 0 ? '+' : '-'}$${Math.abs(avgTradeVal).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Volume</span>
                    <p className="text-xs font-bold text-white mt-1">{volumePct}%</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trading Calendar + Day Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 md:gap-6">
        {/* Trading Calendar */}
        <div className="lg:col-span-7 bg-[#0B0B0B] rounded-[20px] p-3 sm:p-4 md:p-6 flex flex-col min-w-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 md:mb-4">
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-[#3B82F6]" /> Trading Calendar
              </h3>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 font-semibold mt-1">Daily P&L heatmap - Click on days to see trades</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="w-7 h-7 rounded-full bg-[#121212] hover:bg-[#1A1A1A] flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-zinc-400" />
              </button>
              <span className="text-white font-bold text-[11px] sm:text-[12px] min-w-[80px] sm:min-w-[90px] text-center">
                {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="w-7 h-7 rounded-full bg-[#121212] hover:bg-[#1A1A1A] flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Day-of-week headers — 7 columns only */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center mb-1.5">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div key={i} className="py-1 font-bold text-[9px] sm:text-[10px] text-zinc-500 uppercase">
                <span className="hidden sm:inline">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][i]}</span>
                <span className="sm:hidden">{d}</span>
              </div>
            ))}
          </div>

          {/* Calendar grid — week rows with weekly summary below each */}
          <div className="flex-1 flex flex-col gap-1 sm:gap-1.5 min-h-0">
            {Array.from({ length: weeks }).map((_, w) => {
              const wt = weeklyTotals[w];
              const wPositive = wt.pnl >= 0;
              const weeklyColor = wt.trades === 0
                ? "text-zinc-500"
                : wPositive ? "text-[#3B82F6]" : "text-[#EF4444]";
              return (
                <div key={w} className="flex flex-col gap-1 sm:gap-1.5">
                  {/* 7-column day grid */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                    {Array.from({ length: 7 }).map((__, d) => {
                      const cellIdx = w * 7 + d;
                      const dayNum = cellIdx - startDow + 1;
                      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
                      if (!inMonth) {
                        return (
                          <div
                            key={d}
                            className="min-h-[48px] sm:min-h-[56px] md:min-h-[64px] lg:min-h-[72px] rounded-[8px] sm:rounded-[10px]"
                          />
                        );
                      }
                      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                      const data = calendarData[dateStr];
                      const hasData = !!data;
                      const isProfit = hasData && data.pnl >= 0;
                      const isToday = dayNum === now.getDate() && month === now.getMonth() && year === now.getFullYear();

                      return (
                        <div
                          key={d}
                          className={cn(
                            "flex flex-col items-center justify-between cursor-pointer group transition-all duration-200 rounded-[8px] sm:rounded-[10px] border overflow-hidden",
                            "min-h-[48px] sm:min-h-[56px] md:min-h-[64px] lg:min-h-[72px] py-1 px-0.5 sm:p-1.5",
                            hasData
                              ? isProfit
                                ? "bg-[#0A1224] border-[#3B82F6]/20 hover:bg-[#0F1A3A] hover:border-[#3B82F6]/40"
                                : "bg-[#240A0A] border-[#EF4444]/20 hover:bg-[#330F0F] hover:border-[#EF4444]/40"
                              : "bg-[#0B0B0B] border-white/[0.05] hover:bg-[#0F0F0F] hover:border-white/[0.1]",
                            isToday && !hasData && "ring-1 ring-white/10"
                          )}
                          onClick={() => setSelectedCalendarDay(dateStr)}
                        >
                          {/* Day number */}
                          <span className={cn(
                            "w-full text-left font-bold leading-none pl-0.5",
                            "text-[9px] sm:text-[10px] md:text-[11px]",
                            isToday ? "text-[#3B82F6]" : "text-zinc-500"
                          )}>
                            {dayNum}
                          </span>
                          
                          {/* P&L value */}
                          <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
                            {hasData && (
                              <span
                                className={cn(
                                  "font-bold leading-none truncate max-w-full px-0.5",
                                  "text-[10px] sm:text-[12px] md:text-[14px] lg:text-[16px]",
                                  isProfit ? "text-[#3B82F6]" : "text-[#EF4444]"
                                )}
                              >
                                {isProfit ? "+" : "-"}${Math.abs(data.pnl).toFixed(0)}
                              </span>
                            )}
                          </div>

                          {/* Trade count */}
                          <div className="w-full h-3 flex items-end justify-center">
                            {hasData && (
                              <span className="hidden sm:block text-[8px] md:text-[9px] text-zinc-500 font-bold leading-none truncate max-w-full pb-0.5">
                                {data.count} trade{data.count > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Weekly summary — always below the week row */}
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-lg sm:rounded-[10px] px-2.5 sm:px-3 py-1 sm:py-1.5 transition-all duration-200",
                      wt.trades > 0
                        ? wPositive ? "bg-[#0A1224]/60" : "bg-[#240A0A]/60"
                        : "bg-[#080808]",
                    )}
                  >
                    <span className={cn("font-bold uppercase tracking-wider", weeklyColor, "text-[8px] sm:text-[9px] md:text-[10px]")}>
                      Week {w + 1}
                    </span>
                    <span className={cn("font-bold text-num", weeklyColor, "text-[10px] sm:text-xs md:text-sm")}>
                      {wt.trades === 0 ? "$0" : `${wPositive ? "+" : "-"}$${Math.abs(wt.pnl).toFixed(0)}`}
                    </span>
                    <span className={cn("font-medium opacity-60", weeklyColor, "text-[8px] sm:text-[9px] md:text-[10px]")}>
                      {wt.trades} trade{wt.trades !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 sm:gap-6 justify-center mt-3 sm:mt-5 text-[10px] sm:text-[11px] font-bold text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#3B82F6]" /> Profitable Day
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#EF4444]" /> Losing Day
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-zinc-700" /> No Trades
            </span>
          </div>
        </div>

        {/* Day Trades (Right Panel) */}
        <div className="lg:col-span-3 bg-[#0B0B0B] rounded-[20px] p-6 flex flex-col">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <FileText className="w-4 h-4 text-[#3B82F6]" /> Day Trades
          </h3>
          <div className="flex-1 overflow-auto mt-4 space-y-2" style={{ maxHeight: "340px" }}>
            {selectedDayTrades.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center p-4">
                <Calendar className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-[11px] font-semibold leading-relaxed">Click on a day with trades to view details</p>
              </div>
            ) : (
              selectedDayTrades.map(t => (
                <div key={t.id} className="bg-[#0B0B0B] border border-white/[0.05] rounded-[20px] p-3.5 flex items-center justify-between hover:bg-[#0F0F0F] transition-colors">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4.5 h-4.5 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center scale-90">
                        <DollarSign className="w-2.5 h-2.5 text-black stroke-[3]" />
                      </div>
                      <span className="font-bold text-white text-xs">{t.symbol}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        t.direction === 'Long' ? 'bg-[#0A1224] text-[#3B82F6]' : 'bg-[#240A0A] text-[#EF4444]'
                      }`}>{t.direction}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-semibold mt-1">
                      Size: {t.lot_size} · Entry: ${Number(t.entry_price).toFixed(2)}
                    </p>
                  </div>
                  <span className={`text-[13px] font-black ${Number(t.pnl) >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>
                    {Number(t.pnl) >= 0 ? '+' : '-'}${Math.abs(Number(t.pnl)).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Win/Loss Distribution & Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Win/Loss Distribution */}
        <div className="lg:col-span-4 bg-[#0B0B0B] rounded-[20px] p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <BarChart3 className="w-4 h-4 text-[#3B82F6]" /> Win/Loss Distribution
            </h3>
            {/* Dual Bar */}
            <div className="w-full h-8 rounded-lg overflow-hidden flex text-[10px] font-black text-white select-none mt-5">
              {winCount > 0 && (
                <div className="bg-[#3B82F6] flex items-center justify-center transition-all" style={{ width: `${winPct}%` }}>
                  {winCount}W
                </div>
              )}
              {lossCount > 0 && (
                <div className="bg-[#EF4444] flex items-center justify-center transition-all" style={{ width: `${lossPct}%` }}>
                  {lossCount}L
                </div>
              )}
            </div>
            
            <div className="space-y-4 mt-6">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2 text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6]" /> Gross Profit
                </span>
                <span className="text-[#3B82F6] font-bold">{formatK(grossProfit)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2 text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-[#EF4444]" /> Gross Loss
                </span>
                <span className="text-[#EF4444] font-bold">-${Math.abs(grossLoss).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold border-t border-white/[0.05] pt-4">
                <span className="flex items-center gap-2 text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6]" /> Net Result
                </span>
                <span className={`font-bold ${totalPnl >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>{formatK(totalPnl)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Trades */}
        <div className="lg:col-span-6 bg-[#0B0B0B] rounded-[20px] p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Activity className="w-4 h-4 text-[#3B82F6]" /> Recent Trades
            </h3>
            <p className="text-[11px] text-zinc-500 font-semibold mt-0.5">Your last 10 trades</p>
            <div className="space-y-2 mt-4">
              {filteredTrades.slice(0, 10).map(t => (
                <div key={t.id} className="bg-[#0B0B0B] rounded-[20px] p-3 flex items-center justify-between hover:bg-[#0F0F0F] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-[#3B82F6] flex items-center justify-center">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white text-sm">{t.symbol}</span>
                      <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
                        {new Date(t.close_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <span className={`font-black text-sm ${Number(t.pnl) >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>
                    {Number(t.pnl) >= 0 ? '+' : '-'}${Math.abs(Number(t.pnl)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="bg-[#0B0B0B] rounded-[20px] p-5">
        <div className="flex items-center gap-2 mb-6">
          <h3 className="text-[15px] font-bold text-white tracking-tight uppercase">Your Stats</h3>
          <span className="text-[10px] font-extrabold text-[#3B82F6] bg-[#3B82F6]/10 px-2 py-0.5 rounded uppercase tracking-wider">{timePeriod}</span>
        </div>

        {/* Large Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0B0B0B] rounded-[20px] p-5 hover:bg-[#0F0F0F] transition-colors">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Best Month</span>
            <h4 className="text-xl font-black text-[#3B82F6] mt-2">{formatCompactVal(bestMonthStr.value)}</h4>
            <p className="text-[11px] text-zinc-500 font-semibold mt-1">{bestMonthStr.label}</p>
          </div>
          <div className="bg-[#0B0B0B] rounded-[20px] p-5 hover:bg-[#0F0F0F] transition-colors">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Worst Month</span>
            <h4 className={`text-xl font-black mt-2 ${worstMonthStr.value >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>{formatCompactVal(worstMonthStr.value)}</h4>
            <p className="text-[11px] text-zinc-500 font-semibold mt-1">{worstMonthStr.label}</p>
          </div>
          <div className="bg-[#0B0B0B] rounded-[20px] p-5 hover:bg-[#0F0F0F] transition-colors">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Average</span>
            <h4 className={`text-xl font-black mt-2 ${avgMonthPnl >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>{formatCompactVal(avgMonthPnl)}</h4>
            <p className="text-[11px] text-zinc-500 font-semibold mt-1">per Month</p>
          </div>
        </div>

        {/* Two-Column Stats List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 border-t border-white/[0.05] pt-6">
          <div className="space-y-3.5">
            {[
              { l: 'Total P&L', v: formatCompactVal(totalPnl), c: totalPnl >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]' },
              { l: 'Average daily volume', v: dailyPnl.length ? (filteredTrades.length / dailyPnl.length).toFixed(2) : '0.00' },
              { l: 'Average winning trade', v: formatCompactVal(avgWin), c: 'text-[#3B82F6]' },
              { l: 'Average losing trade', v: avgLoss < 0 ? `-${formatCompactVal(Math.abs(avgLoss))}` : '$0.00', c: 'text-[#EF4444]' },
              { l: 'Total number of trades', v: `${filteredTrades.length}` },
              { l: 'Number of winning trades', v: `${winners.length}`, c: 'text-[#3B82F6]' },
              { l: 'Number of losing trades', v: `${losers.length}`, c: 'text-[#EF4444]' },
              { l: 'Number of break even trades', v: `${filteredTrades.length - winners.length - losers.length}` },
              { l: 'Max consecutive wins', v: `${winStreak}` },
              { l: 'Max consecutive losses', v: `${lossStreak}` },
              { l: 'Total commissions', v: '$0.00' },
              { l: 'Total swap', v: '$0.00' },
              { l: 'Largest profit', v: formatCompactVal(bestTrade), c: 'text-[#3B82F6]' },
              { l: 'Largest loss', v: worstTrade < 0 ? `-${formatCompactVal(Math.abs(worstTrade))}` : '$0.00', c: 'text-[#EF4444]' },
              { l: 'Avg hold time (All)', v: formatDuration(avgHoldAll) },
              { l: 'Avg hold time (Winners)', v: formatDuration(avgHoldWinners) },
              { l: 'Avg hold time (Losers)', v: formatDuration(avgHoldLosers) },
            ].map(s => (
              <div key={s.l} className="flex justify-between py-1.5 border-b border-white/[0.02] last:border-0 text-xs font-semibold">
                <span className="text-zinc-500">{s.l}</span>
                <span className={s.c || 'text-white'}>{s.v}</span>
              </div>
            ))}
          </div>
          <div className="space-y-3.5">
            {[
              { l: 'Open trades', v: '0' },
              { l: 'Total trading days', v: `${dailyPnl.length}` },
              { l: 'Winning days', v: `${winningDays}`, c: 'text-[#3B82F6]' },
              { l: 'Losing days', v: `${losingDays}`, c: 'text-[#EF4444]' },
              { l: 'Breakeven days', v: `${dailyPnl.length - winningDays - losingDays}` },
              { l: 'Max consecutive winning days', v: `${winDayStreak}` },
              { l: 'Max consecutive losing days', v: `${lossDayStreak}` },
              { l: 'Average daily P&L', v: formatCompactVal(avgDailyPnl), c: avgDailyPnl >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]' },
              { l: 'Average winning day P&L', v: formatCompactVal(avgWinningDayPnl), c: 'text-[#3B82F6]' },
              { l: 'Average losing day P&L', v: avgLosingDayPnl < 0 ? `-${formatCompactVal(Math.abs(avgLosingDayPnl))}` : '$0.00', c: 'text-[#EF4444]' },
              { l: 'Largest profitable day', v: formatCompactVal(largestProfitableDay), c: 'text-[#3B82F6]' },
              { l: 'Largest losing day', v: largestLosingDay < 0 ? `-${formatCompactVal(Math.abs(largestLosingDay))}` : '$0.00', c: 'text-[#EF4444]' },
              { l: 'Trade expectancy', v: formatCompactVal(expectancy), c: expectancy >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]' },
              { l: 'Max drawdown', v: maxDD < 0 ? `-${formatCompactVal(Math.abs(maxDD))}` : '$0.00', c: 'text-[#EF4444]' },
              { l: 'Max drawdown %', v: peak > 0 ? `-${(maxDD / peak * 100).toFixed(2)}%` : '0%', c: 'text-[#EF4444]' },
            ].map(s => (
              <div key={s.l} className="flex justify-between py-1.5 border-b border-white/[0.02] last:border-0 text-xs font-semibold">
                <span className="text-zinc-500">{s.l}</span>
                <span className={s.c || 'text-white'}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
