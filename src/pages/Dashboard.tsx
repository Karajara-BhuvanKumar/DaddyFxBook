import { useMemo, useState } from "react";
import { useTrades } from "@/hooks/useTrades";
import { DollarSign, Clock, CheckCircle2, Target, Activity, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { DayTradesPopup } from "@/components/DayTradesPopup";
import { cn } from "@/lib/utils";

const timeframes = ["1D", "1W", "1M", "3M", "ALL"] as const;
type TF = typeof timeframes[number];

export default function Dashboard() {
  const { data: trades = [], isLoading } = useTrades();
  const [timeframe, setTimeframe] = useState<TF>("1W");
  const [selectedDay, setSelectedDay] = useState<{ date: string; rect: DOMRect } | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const filteredTrades = useMemo(() => {
    if (timeframe === "ALL") return trades;
    const cutoff = new Date();
    if (timeframe === "1D") cutoff.setDate(cutoff.getDate() - 1);
    else if (timeframe === "1W") cutoff.setDate(cutoff.getDate() - 7);
    else if (timeframe === "1M") cutoff.setMonth(cutoff.getMonth() - 1);
    else if (timeframe === "3M") cutoff.setMonth(cutoff.getMonth() - 3);
    return trades.filter((t) => new Date(t.close_time) >= cutoff);
  }, [trades, timeframe]);

  // Treat all trades as realized for now (no "open position" flag in schema)
  const realized = filteredTrades.reduce((s, t) => s + Number(t.pnl), 0);
  const unrealized = 0;
  const totalPnl = realized + unrealized;
  const closedCount = filteredTrades.length;
  const winningTrades = filteredTrades.filter((t) => Number(t.pnl) > 0);
  const losingTrades = filteredTrades.filter((t) => Number(t.pnl) < 0);
  const winRate = closedCount > 0 ? (winningTrades.length / closedCount) * 100 : 0;

  const chartData = useMemo(() => {
    const sorted = [...filteredTrades].sort((a, b) => a.close_time.localeCompare(b.close_time));
    let cumulative = 0;
    const points = sorted.map((t) => {
      cumulative += Number(t.pnl);
      const dateObj = new Date(t.close_time);
      return {
        date: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        fullDate: dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
        cumulative: Number(cumulative.toFixed(2)),
      };
    });
    if (points.length === 1) {
      return [{ date: "Start", fullDate: "Start", cumulative: 0 }, points[0]];
    }
    return points;
  }, [filteredTrades]);

  const calendarData = useMemo(() => {
    const daily: Record<string, { pnl: number; count: number }> = {};
    trades.forEach((t) => {
      const day = t.close_time.split("T")[0];
      if (!daily[day]) daily[day] = { pnl: 0, count: 0 };
      daily[day].pnl += Number(t.pnl);
      daily[day].count++;
    });
    return daily;
  }, [trades]);

  const now = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
  const totalCells = startDow + daysInMonth;
  const weeks = Math.ceil(totalCells / 7);

  // Monthly aggregate (current month)
  const monthlyPnl = Object.entries(calendarData)
    .filter(([d]) => d.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .reduce((s, [, v]) => s + v.pnl, 0);

  // Weekly aggregates for the right column
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

  const stats = [
    {
      label: "TOTAL P&L",
      value: totalPnl,
      icon: DollarSign,
      iconBg: "bg-[#051020] text-[#3b82f6]",
      pill: { label: "TOTAL", tone: "bg-[#051020] text-[#3b82f6] text-[10px] px-3 py-1 rounded-full font-bold" },
      sub: `-> ${closedCount} trades`,
      tone: "text-[#3b82f6]",
    },
    {
      label: "UNREALIZED",
      value: unrealized,
      icon: Clock,
      iconBg: "bg-[#1a1505] text-[#d8a400]",
      sub: "0 open positions",
      tone: "text-white",
    },
    {
      label: "REALIZED",
      value: realized,
      icon: CheckCircle2,
      iconBg: "bg-[#051020] text-[#3b82f6]",
      sub: `${closedCount} closed trades`,
      tone: "text-[#3b82f6]",
    },
  ];

  const dataMax = Math.max(...chartData.map((i) => i.cumulative), 0);
  const dataMin = Math.min(...chartData.map((i) => i.cumulative), 0);
  const gradientOffset = dataMax <= 0 ? 0 : dataMin >= 0 ? 1 : dataMax / (dataMax - dataMin);

  /** Format a P&L value for calendar display — compact, no trailing .00 */
  const formatCalPnl = (pnl: number) => {
    const abs = Math.abs(pnl);
    const sign = pnl >= 0 ? "+" : "-";
    // For values >= 1000 show 1 decimal, otherwise show 2
    const formatted = abs >= 1000
      ? abs.toFixed(1).replace(/\.0$/, "")
      : abs.toFixed(2).replace(/\.00$/, "");
    return `${sign}$${formatted}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Activity className="w-5 h-5 animate-pulse" />
          <span className="text-sm font-medium">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 overflow-guard">
      {/* Stat Cards — auto-fit grid that wraps naturally */}
      <div
        className="grid gap-3 md:gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-start justify-between">
              <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 ${stat.iconBg}`}>
                <stat.icon className="w-[16px] h-[16px] md:w-[18px] md:h-[18px]" />
              </div>
              {stat.pill && (
                <span className={stat.pill.tone}>{stat.pill.label}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-zinc-500 tracking-wider mb-1.5 uppercase">{stat.label}</p>
              <p className={cn("stat-value truncate", stat.tone)}>
                {stat.value >= 0 ? "+" : "-"}${Math.abs(stat.value).toFixed(2)}
              </p>
              <p className="text-[12px] text-zinc-600 mt-2 font-medium flex items-center gap-1 truncate">
                {stat.sub}
              </p>
            </div>
          </div>
        ))}

        {/* Win Rate card */}
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#051020] text-[#3b82f6] flex items-center justify-center shrink-0">
              <Target className="w-[16px] h-[16px] md:w-[18px] md:h-[18px]" />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-zinc-500 tracking-wider mb-1.5 uppercase">WIN RATE</p>
            <p className="stat-value text-white">
              {winRate.toFixed(0)}%
            </p>
            <div className="mt-3 h-1.5 rounded-full bg-[#1A1A1A] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#3b82f6] transition-all duration-700"
                style={{ width: `${Math.min(100, winRate)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Performance + Calendar — stacks below xl, side-by-side at xl+ */}
      <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-4 md:gap-5">
        {/* Performance Chart */}
        <div
          className="rounded-2xl flex flex-col transition-colors border border-white/[0.05] relative overflow-hidden p-4 sm:p-5 lg:p-6 pb-4"
          style={{ background: "#080808", minHeight: "clamp(280px, 30vw, 480px)" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 md:mb-6 z-10">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-zinc-500 shrink-0" />
                <span className="text-[11px] md:text-[12px] font-bold text-zinc-500 tracking-widest uppercase">PERFORMANCE</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <p className={cn("font-black leading-none tracking-tight text-2xl sm:text-3xl lg:text-4xl xl:text-[40px]", totalPnl >= 0 ? "text-[#3b82f6]" : "text-[#ef4444]")}>
                  {totalPnl >= 0 ? "+" : "-"}${Math.abs(totalPnl).toFixed(2)}
                </p>
                <span className={`flex items-center gap-1 px-2 md:px-2.5 py-1 md:py-1.5 rounded-full text-xs md:text-[13px] font-bold border ${totalPnl >= 0 ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}>
                  <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  200.0%
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 bg-[#121212] p-1 rounded-xl border border-white/[0.05] shrink-0 self-start">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-[13px] font-bold transition-all duration-200 min-h-[36px] ${timeframe === tf
                      ? "bg-[#2A2A2A] text-white shadow-sm"
                      : "text-zinc-500 hover:text-white"
                    }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          {chartData.length > 0 ? (
            <div className="flex-1 min-h-[180px] md:min-h-[220px] -mx-2 sm:-mx-3 -mb-2 relative z-10">
              <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                <AreaChart data={chartData} margin={{ top: 16, right: 36, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset={gradientOffset} stopColor="#3b82f6" stopOpacity={1} />
                      <stop offset={gradientOffset} stopColor="#ef4444" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="splitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset={gradientOffset} stopColor="#3b82f6" stopOpacity={0} />
                      <stop offset={gradientOffset} stopColor="#ef4444" stopOpacity={0} />
                      <stop offset="1" stopColor="#ef4444" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={true} horizontal={true} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#64748B", fontSize: 10, fontFamily: "Inter", fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    dy={16}
                    minTickGap={20}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={({ x, y, payload }: any) => {
                      const isProfit = payload.value >= 0;
                      return (
                        <text
                          x={x}
                          y={y}
                          dx={12}
                          dy={4}
                          textAnchor="start"
                          fill={isProfit ? "#3b82f6" : "#ef4444"}
                          fontSize={10}
                          fontFamily="Inter"
                          fontWeight="600"
                        >
                          {payload.value >= 0 ? "" : "-"}${Math.abs(payload.value).toFixed(0)}
                        </text>
                      );
                    }}
                    width={36}
                  />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const isProfit = data.cumulative >= 0;
                        const color = isProfit ? "#3b82f6" : "#ef4444";
                        const sign = isProfit ? "+" : "-";
                        return (
                          <div
                            className="rounded-2xl px-4 py-3"
                            style={{
                              background: "#080808",
                              border: `1px solid ${isProfit ? "rgba(59, 130, 246, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                              boxShadow: `0 8px 32px ${isProfit ? "rgba(59, 130, 246, 0.15)" : "rgba(239, 68, 68, 0.15)"}`,
                            }}
                          >
                            <p className="text-[#94A3B8] text-[11px] font-semibold mb-1.5 tracking-wide">
                              {data.fullDate}
                            </p>
                            <p className="font-black text-[26px] tracking-tight leading-none mb-1" style={{ color }}>
                              {sign}${Math.abs(data.cumulative).toFixed(2)}
                            </p>
                            <p className="text-[#64748B] text-[9px] font-bold tracking-widest uppercase">
                              Cumulative P&L
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, strokeDasharray: "4 4" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="url(#splitColor)"
                    fill="url(#splitFill)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={({ cx, cy, payload }: any) => {
                      const isProfit = payload.cumulative >= 0;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill={isProfit ? "#3b82f6" : "#ef4444"}
                          stroke="#080808"
                          strokeWidth={3}
                        />
                      );
                    }}
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 relative z-10">
              <div className="text-center">
                <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Add trades to see your performance</p>
              </div>
            </div>
          )}
        </div>

        {/* Monthly P&L Calendar */}
        <div
          className="rounded-[20px] flex flex-col transition-colors p-3 sm:p-4 lg:p-5 min-w-0"
          style={{ background: "#0B0B0B" }}
        >
          {/* Calendar Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-foreground text-base md:text-lg font-bold tracking-tight">Monthly P&L</h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Monthly:</span>
                <span className={`text-xs font-bold ${monthlyPnl >= 0 ? "text-profit" : "text-loss"}`}>
                  {monthlyPnl >= 0 ? "+" : "-"}${Math.abs(monthlyPnl).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                  className="w-6 h-6 rounded-full bg-secondary hover:bg-muted border border-white/[0.08] flex items-center justify-center transition-colors text-foreground"
                >
                  <ChevronLeft className="w-3 h-3 text-muted-foreground" />
                </button>
                <span className="text-foreground font-bold text-xs min-w-[80px] text-center">
                  {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </span>
                <button
                  onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                  className="w-6 h-6 rounded-full bg-secondary hover:bg-muted border border-white/[0.08] flex items-center justify-center transition-colors text-foreground"
                >
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          {/* Day-of-week headers — 7 columns only */}
          <div className="grid grid-cols-7 gap-1 xl:gap-1.5 text-center mb-1.5">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div
                key={i}
                className="py-1 font-medium text-[10px] xl:text-xs text-muted-foreground uppercase"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid — week rows with weekly summary below each */}
          <div className="flex-1 flex flex-col gap-1 xl:gap-1.5 min-h-0">
            {Array.from({ length: weeks }).map((_, w) => {
              const wt = weeklyTotals[w];
              const wPositive = wt.pnl >= 0;
              const weeklyColorClass = wt.trades === 0
                ? "text-muted-foreground"
                : wPositive
                  ? "text-emerald-600 dark:text-blue-500"
                  : "text-red-600 dark:text-red-500";
              return (
                <div key={w} className="flex flex-col gap-1 xl:gap-1.5">
                  {/* 7-column day grid */}
                  <div className="grid grid-cols-7 gap-1 xl:gap-1.5">
                    {Array.from({ length: 7 }).map((__, d) => {
                      const cellIdx = w * 7 + d;
                      const dayNum = cellIdx - startDow + 1;
                      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
                      if (!inMonth) {
                        return (
                          <div
                            key={d}
                            className="min-h-[36px] xl:min-h-[44px] 2xl:min-h-[52px] rounded-xl"
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
                            "relative flex flex-col items-center justify-center cursor-pointer group transition-all duration-200 rounded-xl min-h-[36px] xl:min-h-[44px] 2xl:min-h-[52px] p-1",
                            hasData
                              ? isProfit
                                ? "bg-[#051020] text-[#3b82f6] hover:bg-[#081830]"
                                : "bg-[#1a0505] text-[#ef4444] hover:bg-[#240a0a]"
                              : "bg-[#121212] hover:bg-[#1A1A1A]",
                            isToday && "ring-2 ring-blue-500/50"
                          )}
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setSelectedDay({ date: dateStr, rect });
                          }}
                        >
                          {/* Day number */}
                          <span className={cn(
                            "absolute top-0.5 left-1 xl:top-1 xl:left-1.5 font-medium leading-none",
                            "text-[8px] xl:text-[9px] 2xl:text-[10px]",
                            isToday ? "text-blue-600 dark:text-blue-500 font-bold" : "text-muted-foreground"
                          )}>
                            {dayNum}
                            {isToday && (
                              <span className="block w-1 h-1 rounded-full bg-blue-500 mx-auto mt-0.5" />
                            )}
                          </span>
                          {/* P&L value */}
                          {hasData && (
                            <span
                              className={cn(
                                "font-bold leading-none mt-1.5 truncate max-w-full px-0.5",
                                "text-[8px] xl:text-[10px] 2xl:text-[12px]",
                                isProfit ? "text-emerald-600 dark:text-blue-500" : "text-red-600 dark:text-red-500"
                              )}
                            >
                              {formatCalPnl(data.pnl)}
                            </span>
                          )}
                          {/* Hover tooltip */}
                          {hasData && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                              <div
                                className="px-3 py-2 text-[11px] whitespace-nowrap"
                                style={{
                                  background: "var(--card-bg)",
                                  border: "1px solid var(--border-color)",
                                  borderRadius: 12,
                                  color: "var(--text-primary)"
                                }}
                              >
                                <p
                                  className="font-bold text-num"
                                  style={{ color: isProfit ? "#10B981" : "#EF4444" }}
                                >
                                  {isProfit ? "+" : "-"}${Math.abs(data.pnl).toFixed(2)}
                                </p>
                                <p className="text-muted-foreground">
                                  {data.count} trade{data.count > 1 ? "s" : ""}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Weekly summary — always below the week row */}
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-xl px-3 py-1.5 transition-all duration-200",
                      wt.trades > 0
                        ? wPositive ? "bg-[#051020]/60" : "bg-[#1a0505]/60"
                        : "bg-[#0a0a0a]",
                    )}
                  >
                    <span className={cn("font-bold uppercase tracking-wider", weeklyColorClass, "text-[9px] xl:text-[10px]")}>
                      Week {w + 1}
                    </span>
                    <span className={cn("font-bold text-num", weeklyColorClass, "text-xs xl:text-sm")}>
                      {wt.trades === 0 ? "$0" : formatCalPnl(wt.pnl)}
                    </span>
                    <span className={cn("font-medium opacity-60", weeklyColorClass, "text-[9px] xl:text-[10px]")}>
                      {wt.trades} trade{wt.trades !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-5 justify-center mt-3 text-[11px] font-medium text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 dark:bg-blue-500" />
              Profit
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              Loss
            </span>
          </div>
        </div>
      </div>

      {selectedDay && (
        <DayTradesPopup
          anchorRect={selectedDay.rect}
          dateStr={selectedDay.date}
          trades={trades.filter((t) => t.close_time.split("T")[0] === selectedDay.date)}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
