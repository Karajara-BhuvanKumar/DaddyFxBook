import { useMemo, useState } from "react";
import { useTrades } from "@/hooks/useTrades";
import { DollarSign, Clock, CheckCircle2, Target, Activity, BarChart3, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { DayTradesPopup } from "@/components/DayTradesPopup";

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
      return {
        date: new Date(t.close_time).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        cumulative: Number(cumulative.toFixed(2)),
      };
    });
    if (points.length === 1) {
      return [{ date: "Start", cumulative: 0 }, points[0]];
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
    <div className="space-y-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col justify-between rounded-[20px] transition-colors"
            style={{
              height: 190,
              padding: 32,
              background: "#0B0B0B",
            }}
          >
            <div className="flex items-start justify-between">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center ${stat.iconBg}`}>
                <stat.icon className="w-[18px] h-[18px]" />
              </div>
              {stat.pill && (
                <span className={stat.pill.tone}>{stat.pill.label}</span>
              )}
            </div>
            <div>
              <p className="text-[11px] font-bold text-zinc-500 tracking-wider mb-2 uppercase">{stat.label}</p>
              <p
                className={`${stat.tone} font-black tracking-tight leading-none`}
                style={{ fontSize: 36, letterSpacing: "-0.03em" }}
              >
                {stat.value >= 0 ? "+" : "-"}${Math.abs(stat.value).toFixed(2)}
              </p>
              <p className="text-[12px] text-zinc-600 mt-3 font-medium flex items-center gap-1">
                {stat.sub}
              </p>
            </div>
          </div>
        ))}

        {/* Win Rate card */}
        <div
          className="flex flex-col justify-between rounded-[20px] transition-colors"
          style={{
            height: 190,
            padding: 32,
            background: "#0B0B0B",
          }}
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-full bg-[#051020] text-[#3b82f6] flex items-center justify-center">
              <Target className="w-[18px] h-[18px]" />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-zinc-500 tracking-wider mb-2 uppercase">WIN RATE</p>
            <p
              className="text-white font-black tracking-tight leading-none"
              style={{ fontSize: 36, letterSpacing: "-0.03em" }}
            >
              {winRate.toFixed(0)}%
            </p>
            <div className="mt-4 h-1.5 rounded-full bg-[#1A1A1A] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#3b82f6] transition-all duration-700"
                style={{ width: `${Math.min(100, winRate)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Performance + Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Performance */}
        <div
          className="lg:col-span-3 rounded-[20px] flex flex-col transition-colors"
          style={{
            height: 430,
            padding: 32,
            background: "#0B0B0B",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase">PERFORMANCE</span>
              </div>
              <div className="flex items-center gap-3">
                <p className={`font-black leading-none ${totalPnl >= 0 ? "text-profit" : "text-loss"}`} style={{ fontSize: 32 }}>
                  {totalPnl >= 0 ? "+" : "-"}${Math.abs(totalPnl).toFixed(2)}
                </p>
                <span className="flex items-center gap-1 bg-blue-500/10 text-blue-500 px-2.5 py-1 rounded-full text-[13px] font-bold border border-blue-500/20">
                  <TrendingUp className="w-3.5 h-3.5" />
                  200.0%
                </span>
              </div>
            </div>
            <div className="flex gap-1">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all duration-200 ${timeframe === tf
                      ? "bg-[#2A2A2A] text-white"
                      : "text-zinc-500 hover:text-white"
                    }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={gradientOffset} stopColor="var(--chart-profit)" stopOpacity={1} />
                    <stop offset={gradientOffset} stopColor="var(--chart-loss)" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="splitFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={gradientOffset} stopColor="var(--chart-profit)" stopOpacity={gradientOffset > 0 ? 0.15 : 0} />
                    <stop offset={gradientOffset} stopColor="var(--chart-loss)" stopOpacity={gradientOffset < 1 ? 0.15 : 0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--text-secondary)", fontSize: 11, fontFamily: "Inter" }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  orientation="right"
                  tick={{ fill: "var(--text-secondary)", fontSize: 11, fontFamily: "Inter" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                  dx={4}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card-bg)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "12px",
                    color: "var(--text-primary)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    padding: "10px 14px",
                    fontFamily: "Inter",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "P&L"]}
                  labelStyle={{ color: "var(--text-secondary)", fontSize: "11px", marginBottom: "4px" }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="url(#splitColor)"
                  fill="url(#splitFill)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: "var(--chart-profit)", stroke: "var(--card-bg)", strokeWidth: 2 }}
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Add trades to see your performance</p>
              </div>
            </div>
          )}
        </div>

        {/* Monthly P&L */}
        <div
          className="lg:col-span-2 rounded-[20px] flex flex-col justify-between transition-colors"
          style={{
            height: 430,
            padding: 20,
            background: "#0B0B0B",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-foreground text-xl font-bold tracking-tight">Monthly P&L</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-muted-foreground">Monthly:</span>
                <span className={`text-[13px] font-bold ${monthlyPnl >= 0 ? "text-profit" : "text-loss"}`}>
                  {monthlyPnl >= 0 ? "+" : "-"}${Math.abs(monthlyPnl).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                  className="w-7 h-7 rounded-full bg-secondary hover:bg-muted border border-white/[0.08] flex items-center justify-center transition-colors text-foreground"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <span className="text-foreground font-bold text-[13px] min-w-[90px] text-center">
                  {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </span>
                <button
                  onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                  className="w-7 h-7 rounded-full bg-secondary hover:bg-muted border border-white/[0.08] flex items-center justify-center transition-colors text-foreground"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          {/* Header row: M T W T F S S + Weekly */}
          <div className="grid grid-cols-8 gap-1.5 text-center mb-2">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div
                key={i}
                className="py-1 font-medium text-xs text-muted-foreground uppercase"
              >
                {d}
              </div>
            ))}
            <div
              className="py-1 font-medium text-xs text-muted-foreground uppercase"
            >
              Weekly
            </div>
          </div>

          {/* Week rows */}
          <div className="space-y-1.5 flex-1 flex flex-col justify-between">
            {Array.from({ length: weeks }).map((_, w) => {
              const wt = weeklyTotals[w];
              const wPositive = wt.pnl >= 0;
              const weeklyColorClass = wt.trades === 0
                ? "text-muted-foreground"
                : wPositive
                  ? "text-emerald-600 dark:text-blue-500"
                  : "text-red-600 dark:text-red-500";
              return (
                <div key={w} className="grid grid-cols-8 gap-1.5">
                  {Array.from({ length: 7 }).map((__, d) => {
                    const cellIdx = w * 7 + d;
                    const dayNum = cellIdx - startDow + 1;
                    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
                    if (!inMonth) {
                      return (
                        <div
                          key={d}
                          className="bg-transparent border border-transparent opacity-0"
                          style={{ aspectRatio: "1/1", borderRadius: 14 }}
                        />
                      );
                    }
                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                    const data = calendarData[dateStr];
                    const hasData = !!data;
                    const isProfit = hasData && data.pnl >= 0;
                    const isToday = dayNum === now.getDate() && month === now.getMonth() && year === now.getFullYear();

                    let cellClasses = "relative flex flex-col items-center justify-center cursor-pointer group transition-all duration-200 rounded-xl ";
                    if (hasData) {
                      if (isProfit) {
                        cellClasses += "bg-[#051020] text-[#3b82f6] hover:bg-[#081830]";
                      } else {
                        cellClasses += "bg-[#1a0505] text-[#ef4444] hover:bg-[#240a0a]";
                      }
                    } else {
                      cellClasses += "bg-[#121212] hover:bg-[#1A1A1A]";
                    }
                    if (isToday) {
                      cellClasses += " ring-2 ring-blue-500/50";
                    }

                    return (
                      <div
                        key={d}
                        className={cellClasses}
                        style={{ aspectRatio: "1/1" }}
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setSelectedDay({ date: dateStr, rect });
                        }}
                      >
                        <span className={`absolute top-2.5 left-3 text-[11px] font-medium ${isToday ? "text-blue-600 dark:text-blue-500 font-bold" : "text-muted-foreground"} flex flex-col items-center gap-0.5`}>
                          {dayNum}
                          {isToday && (
                            <span className="w-1 h-1 rounded-full bg-blue-500" />
                          )}
                        </span>
                        {hasData && (
                          <span
                            className={`font-bold text-[13px] ${isProfit ? "text-emerald-600 dark:text-blue-500" : "text-red-600 dark:text-red-500"}`}
                          >
                            {isProfit ? "+" : "-"}${Math.abs(data.pnl).toFixed(2).replace(/\.00$/, '')}{!isProfit && Number.isInteger(data.pnl) ? ".00" : ""}
                          </span>
                        )}
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
                  {/* Weekly column — mini card */}
                  <div
                    className={`relative flex flex-col items-center justify-center rounded-xl p-2 transition-all duration-200 ${wt.trades > 0
                        ? wPositive
                          ? "bg-[#051020] text-[#3b82f6]"
                          : "bg-[#1a0505] text-[#ef4444]"
                        : "bg-[#121212] text-zinc-600"
                      }`}
                    style={{
                      aspectRatio: "1/1",
                    }}
                  >
                    <span
                      className={`absolute top-2.5 uppercase font-bold text-[9px] tracking-wider ${weeklyColorClass}`}
                    >
                      Weekly
                    </span>
                    <span
                      className={`font-bold text-num leading-none text-base ${weeklyColorClass}`}
                    >
                      {wt.trades === 0 ? "$0" : `${wPositive ? "+" : "-"}$${Math.abs(wt.pnl).toFixed(2).replace(/\.00$/, '')}${!wPositive && Number.isInteger(wt.pnl) ? ".00" : ""}`}
                    </span>
                    <span className={`absolute bottom-2.5 font-medium text-[10px] ${weeklyColorClass}`}>
                      Traded D...
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-6 justify-center mt-4 text-[12px] font-medium text-muted-foreground">
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
