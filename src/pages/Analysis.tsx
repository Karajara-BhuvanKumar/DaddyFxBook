import { useMemo } from "react";
import { useTrades } from "@/hooks/useTrades";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Activity, TrendingUp, TrendingDown, BarChart3, Calendar, Globe } from "lucide-react";

export default function Analysis() {
  const { data: trades = [], isLoading } = useTrades();

  const totalPnl = trades.reduce((s, t) => s + Number(t.pnl), 0);
  const winners = trades.filter(t => Number(t.pnl) > 0);
  const losers = trades.filter(t => Number(t.pnl) < 0);
  const avgWin = winners.length ? winners.reduce((s, t) => s + Number(t.pnl), 0) / winners.length : 0;
  const avgLoss = losers.length ? losers.reduce((s, t) => s + Number(t.pnl), 0) / losers.length : 0;
  const bestTrade = trades.length ? Math.max(...trades.map(t => Number(t.pnl))) : 0;
  const worstTrade = trades.length ? Math.min(...trades.map(t => Number(t.pnl))) : 0;

  const longTrades = trades.filter(t => t.direction === 'Long');
  const shortTrades = trades.filter(t => t.direction === 'Short');
  const longPnl = longTrades.reduce((s, t) => s + Number(t.pnl), 0);
  const shortPnl = shortTrades.reduce((s, t) => s + Number(t.pnl), 0);
  const longWinRate = longTrades.length ? (longTrades.filter(t => Number(t.pnl) > 0).length / longTrades.length * 100) : 0;
  const shortWinRate = shortTrades.length ? (shortTrades.filter(t => Number(t.pnl) > 0).length / shortTrades.length * 100) : 0;

  const dailyPnl = useMemo(() => {
    const daily: Record<string, number> = {};
    trades.forEach(t => { const day = t.close_time.split('T')[0]; daily[day] = (daily[day] || 0) + Number(t.pnl); });
    return Object.entries(daily).sort(([a], [b]) => a.localeCompare(b));
  }, [trades]);

  const winDays = dailyPnl.filter(([, v]) => v > 0).length;
  const loseDays = dailyPnl.filter(([, v]) => v < 0).length;
  const avgDailyPnl = dailyPnl.length ? dailyPnl.reduce((s, [, v]) => s + v, 0) / dailyPnl.length : 0;

  let peak = 0, maxDD = 0, cum = 0;
  dailyPnl.forEach(([, v]) => { cum += v; if (cum > peak) peak = cum; const dd = peak - cum; if (dd > maxDD) maxDD = dd; });

  const equityData = useMemo(() => {
    const sorted = [...trades].sort((a, b) => a.close_time.localeCompare(b.close_time));
    let c = 0;
    return sorted.map(t => { c += Number(t.pnl); return { date: new Date(t.close_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cumulative: c }; });
  }, [trades]);

  const dayPerf = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = days.map(d => ({ day: d, pnl: 0, count: 0 }));
    trades.forEach(t => { const dow = (new Date(t.close_time).getDay() + 6) % 7; data[dow].pnl += Number(t.pnl); data[dow].count++; });
    return data;
  }, [trades]);

  const sessionPerf = useMemo(() => {
    const sessions = [
      { name: 'Asian', start: 22, end: 8, pnl: 0, count: 0, wins: 0 },
      { name: 'London', start: 8, end: 13, pnl: 0, count: 0, wins: 0 },
      { name: 'New York', start: 13, end: 22, pnl: 0, count: 0, wins: 0 },
    ];
    trades.forEach(t => {
      const hour = new Date(t.open_time).getUTCHours();
      let s = sessions[2];
      if ((hour >= 22 || hour < 8)) s = sessions[0];
      else if (hour >= 8 && hour < 13) s = sessions[1];
      s.pnl += Number(t.pnl); s.count++;
      if (Number(t.pnl) > 0) s.wins++;
    });
    return sessions;
  }, [trades]);

  const distData = useMemo(() => [
    { name: 'Wins', value: winners.length, fill: 'hsl(152, 69%, 53%)' },
    { name: 'Losses', value: losers.length, fill: 'hsl(0, 84%, 60%)' },
  ], [winners, losers]);

  const calendarData = useMemo(() => {
    const daily: Record<string, { pnl: number; count: number }> = {};
    trades.forEach(t => { const day = t.close_time.split('T')[0]; if (!daily[day]) daily[day] = { pnl: 0, count: 0 }; daily[day].pnl += Number(t.pnl); daily[day].count++; });
    return daily;
  }, [trades]);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDow = (firstDay.getDay() + 6) % 7;

  const tooltipStyle = {
    background: 'hsl(225, 14%, 9%)', border: '1px solid hsl(225, 12%, 18%)', borderRadius: '12px',
    color: 'hsl(210, 20%, 95%)', boxShadow: '0 8px 30px -8px rgba(0,0,0,0.4)', padding: '10px 14px', fontFamily: 'Inter', fontSize: '13px',
  };

  const quickStats = [
    { label: 'Avg Winner', value: `$${avgWin.toFixed(2)}`, color: avgWin >= 0, icon: TrendingUp },
    { label: 'Avg Loser', value: `-$${Math.abs(avgLoss).toFixed(2)}`, color: false, icon: TrendingDown },
    { label: 'Best Trade', value: `$${bestTrade.toFixed(2)}`, color: true, icon: TrendingUp },
    { label: 'Worst Trade', value: `-$${Math.abs(worstTrade).toFixed(2)}`, color: false, icon: TrendingDown },
    { label: 'Risk:Reward', value: `1:${avgLoss !== 0 ? Math.abs(avgWin / avgLoss).toFixed(2) : '∞'}`, color: true, icon: Activity },
    { label: 'Expectancy', value: `$${trades.length ? (totalPnl / trades.length).toFixed(2) : '0.00'}`, color: totalPnl >= 0, icon: BarChart3 },
  ];

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex items-center gap-3 text-muted-foreground"><Activity className="w-5 h-5 animate-pulse" /><span className="text-base font-medium">Loading analysis...</span></div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-extrabold text-foreground tracking-tight">Analysis</h1>
        <p className="text-base text-muted-foreground mt-1 font-medium">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Quick Stats + Equity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><BarChart3 className="w-3.5 h-3.5 text-primary" /></div>
            Quick Stats
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {quickStats.map(s => (
              <div key={s.label} className="bg-secondary/30 rounded-xl p-3.5 border border-border/30 hover:border-border/60 transition-all duration-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon className={`w-3.5 h-3.5 ${s.color ? 'text-profit' : 'text-loss'}`} />
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{s.label}</p>
                </div>
                <p className={`font-bold text-base font-mono-num ${s.color === undefined ? 'text-foreground' : s.color ? 'text-profit' : 'text-loss'}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 glass-card rounded-2xl p-6">
          <h3 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><TrendingUp className="w-3.5 h-3.5 text-primary" /></div>
            Equity Curve
          </h3>
          {equityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: 'hsl(220, 10%, 46%)', fontSize: 12, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(220, 10%, 46%)', fontSize: 12, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="cumulative" stroke="hsl(221, 83%, 53%)" fill="url(#eqGrad)" strokeWidth={2.5} dot={false} animationDuration={1200} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-base font-medium">Add trades to see equity curve</div>
          )}
        </div>
      </div>

      {/* Long vs Short + Day Perf + Session */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Activity className="w-3.5 h-3.5 text-primary" /></div>
            Long vs Short
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Long', trades: longTrades, pnl: longPnl, winRate: longWinRate, isLong: true },
              { label: 'Short', trades: shortTrades, pnl: shortPnl, winRate: shortWinRate, isLong: false },
            ].map(d => (
              <div key={d.label} className="bg-secondary/30 rounded-xl p-4 border border-border/30">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-md ${d.isLong ? 'bg-primary/10 text-primary' : 'bg-loss/10 text-loss'}`}>{d.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-xs text-muted-foreground font-medium mb-0.5">Trades</p><p className="text-base font-bold text-foreground font-mono-num">{d.trades.length}</p></div>
                  <div><p className="text-xs text-muted-foreground font-medium mb-0.5">P&L</p><p className={`text-base font-bold font-mono-num ${d.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>${d.pnl.toFixed(2)}</p></div>
                  <div><p className="text-xs text-muted-foreground font-medium mb-0.5">Win %</p><p className="text-base font-bold text-foreground font-mono-num">{d.winRate.toFixed(0)}%</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Calendar className="w-3.5 h-3.5 text-primary" /></div>
            Day Performance
          </h3>
          <div className="space-y-2.5">
            {dayPerf.map(d => (
              <div key={d.day} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-semibold w-8">{d.day}</span>
                <div className="flex-1 h-6 bg-secondary/30 rounded-lg overflow-hidden relative border border-border/20">
                  {d.count > 0 && (
                    <div className={`h-full rounded-lg transition-all duration-500 ${d.pnl >= 0 ? 'bg-gradient-to-r from-primary/60 to-primary/30' : 'bg-gradient-to-r from-loss/60 to-loss/30'}`}
                      style={{ width: `${Math.min(Math.abs(d.pnl) / (Math.max(...dayPerf.map(x => Math.abs(x.pnl))) || 1) * 100, 100)}%` }} />
                  )}
                </div>
                <span className={`text-sm font-bold w-16 text-right font-mono-num ${d.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {d.count > 0 ? `$${d.pnl.toFixed(0)}` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Globe className="w-3.5 h-3.5 text-primary" /></div>
            Session Performance
          </h3>
          <div className="space-y-3">
            {sessionPerf.map(s => (
              <div key={s.name} className="bg-secondary/30 rounded-xl p-4 border border-border/30">
                <p className="font-semibold text-foreground text-base mb-2">{s.name}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-xs text-muted-foreground font-medium mb-0.5">P&L</p><p className={`text-sm font-bold font-mono-num ${s.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>${s.pnl.toFixed(0)}</p></div>
                  <div><p className="text-xs text-muted-foreground font-medium mb-0.5">Trades</p><p className="text-sm font-bold text-foreground font-mono-num">{s.count}</p></div>
                  <div><p className="text-xs text-muted-foreground font-medium mb-0.5">Win %</p><p className="text-sm font-bold text-foreground font-mono-num">{s.count ? (s.wins / s.count * 100).toFixed(0) : 0}%</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Calendar className="w-3.5 h-3.5 text-primary" /></div>
            Trading Calendar · {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
              <div key={d} className="text-[10px] text-muted-foreground/50 py-1 font-bold tracking-wider">{d}</div>
            ))}
            {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const data = calendarData[dateStr];
              const hasData = data !== undefined;
              const isProfit = hasData && data.pnl > 0;
              const isToday = day === now.getDate();
              return (
                <div key={day} className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center transition-all duration-200 cursor-default group relative
                  ${hasData ? isProfit ? 'bg-profit/12 border border-profit/20 glow-profit' : 'bg-loss/12 border border-loss/20 glow-loss' : 'bg-secondary/20 border border-transparent hover:border-border/40'}
                  ${isToday ? 'ring-1 ring-primary/40' : ''}`}>
                  <span className={`font-medium ${hasData ? (isProfit ? 'text-profit/80' : 'text-loss/80') : 'text-muted-foreground/50'}`}>{day}</span>
                  {hasData && (
                    <>
                      <span className={`text-[9px] font-bold ${isProfit ? 'text-profit' : 'text-loss'}`}>${Math.abs(data.pnl).toFixed(0)}</span>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                        <div className="glass-card rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                          <p className={`font-bold ${isProfit ? 'text-profit' : 'text-loss'}`}>{isProfit ? '+' : '-'}${Math.abs(data.pnl).toFixed(2)}</p>
                          <p className="text-muted-foreground">{data.count} trade{data.count > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 justify-center mt-4 text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-profit" /> Profit</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-loss" /> Loss</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-base font-bold text-foreground mb-5">Win/Loss Distribution</h3>
          {trades.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distData}>
                <XAxis dataKey="name" tick={{ fill: 'hsl(220, 10%, 46%)', fontSize: 13, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(220, 10%, 46%)', fontSize: 13, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-base font-medium">Add trades to see distribution</div>
          )}
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-lg font-bold text-foreground mb-6">Detailed Statistics</h3>
        <div className="grid grid-cols-2 gap-x-12">
          {[
            [
              { l: 'Total P&L', v: `$${totalPnl.toFixed(2)}`, c: totalPnl >= 0 },
              { l: 'Average winning trade', v: `$${avgWin.toFixed(2)}`, c: true },
              { l: 'Average losing trade', v: `-$${Math.abs(avgLoss).toFixed(2)}`, c: false },
              { l: 'Total trades', v: `${trades.length}` },
              { l: 'Winning trades', v: `${winners.length}`, c: true },
              { l: 'Losing trades', v: `${losers.length}`, c: false },
              { l: 'Largest profit', v: `$${bestTrade.toFixed(2)}`, c: true },
              { l: 'Largest loss', v: `-$${Math.abs(worstTrade).toFixed(2)}`, c: false },
            ],
            [
              { l: 'Trading days', v: `${dailyPnl.length}` },
              { l: 'Winning days', v: `${winDays}`, c: true },
              { l: 'Losing days', v: `${loseDays}`, c: false },
              { l: 'Avg daily P&L', v: `$${avgDailyPnl.toFixed(2)}`, c: avgDailyPnl >= 0 },
              { l: 'Max drawdown', v: `-$${maxDD.toFixed(2)}`, c: false },
              { l: 'Max drawdown %', v: peak > 0 ? `-${(maxDD / peak * 100).toFixed(2)}%` : '0%', c: false },
              { l: 'Expectancy', v: `$${trades.length ? (totalPnl / trades.length).toFixed(2) : '0.00'}`, c: totalPnl >= 0 },
            ],
          ].map((col, ci) => (
            <div key={ci} className="space-y-0">
              {col.map(s => (
                <div key={s.l} className="flex justify-between py-2.5 border-b border-border/30 last:border-0">
                  <span className="text-sm text-muted-foreground">{s.l}</span>
                  <span className={`text-sm font-bold font-mono-num ${s.c === undefined ? 'text-foreground' : s.c ? 'text-profit' : 'text-loss'}`}>{s.v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
