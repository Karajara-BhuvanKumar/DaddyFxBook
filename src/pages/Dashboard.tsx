import { useMemo, useState } from "react";
import { useTrades } from "@/hooks/useTrades";
import { DollarSign, Clock, CheckCircle2, Target, Activity, BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { DayTradesPopup } from "@/components/DayTradesPopup";

const timeframes = ["1D", "1W", "1M", "3M", "ALL"] as const;
type TF = typeof timeframes[number];

export default function Dashboard() {
  const { data: trades = [], isLoading } = useTrades();
  const [timeframe, setTimeframe] = useState<TF>("1W");
  const [selectedDay, setSelectedDay] = useState<{ date: string; rect: DOMRect } | null>(null);

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
  const year = now.getFullYear();
  const month = now.getMonth();
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
      label: "Total P&L",
      value: totalPnl,
      icon: DollarSign,
      iconBg: "bg-primary/15 text-primary",
      pill: { label: "Total", tone: "bg-primary/15 text-primary" },
      sub: `${closedCount} trade${closedCount === 1 ? "" : "s"}`,
      tone: totalPnl >= 0 ? "text-profit" : "text-loss",
    },
    {
      label: "Unrealized",
      value: unrealized,
      icon: Clock,
      iconBg: "bg-warning/15 text-warning",
      sub: "0 open positions",
      tone: "text-foreground",
    },
    {
      label: "Realized",
      value: realized,
      icon: CheckCircle2,
      iconBg: "bg-primary/15 text-primary",
      sub: `${closedCount} closed trades`,
      tone: realized >= 0 ? "text-profit" : "text-loss",
    },
  ];

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
            className="hover-lift flex flex-col justify-between"
            style={{
              height: 190,
              borderRadius: 28,
              padding: 32,
              background: "var(--card-gradient)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <div className="flex items-start justify-between">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${stat.iconBg}`}>
                <stat.icon className="w-[18px] h-[18px]" />
              </div>
              {stat.pill && (
                <span className={`badge-pill ${stat.pill.tone}`}>{stat.pill.label}</span>
              )}
            </div>
            <div>
              <p className="text-label mb-2">{stat.label}</p>
              <p
                className={`${stat.tone} font-bold tracking-tight leading-none`}
                style={{ fontSize: 36, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}
              >
                {stat.value >= 0 ? "+" : "-"}${Math.abs(stat.value).toFixed(2)}
              </p>
              <p className="text-[12px] text-muted-foreground mt-2 font-medium">{stat.sub}</p>
            </div>
          </div>
        ))}

        {/* Win Rate card */}
        <div
          className="hover-lift flex flex-col justify-between"
          style={{
            height: 190,
            borderRadius: 28,
            padding: 32,
            background: "var(--card-gradient)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
              <Target className="w-[18px] h-[18px]" />
            </div>
          </div>
          <div>
            <p className="text-label mb-2">Win Rate</p>
            <p
              className="text-foreground font-bold tracking-tight leading-none"
              style={{ fontSize: 36, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}
            >
              {winRate.toFixed(0)}%
            </p>
            <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
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
          className="lg:col-span-3"
          style={{
            height: 430,
            borderRadius: 30,
            padding: 32,
            background: "var(--card-gradient)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-label">Performance</span>
              </div>
              <p className={`text-metric ${totalPnl >= 0 ? "text-profit" : "text-loss"}`}>
                {totalPnl >= 0 ? "+" : "-"}${Math.abs(totalPnl).toFixed(2)}
              </p>
            </div>
            <div className="flex gap-1 bg-secondary/60 rounded-lg p-1 border border-border/40">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-all duration-200 ${
                    timeframe === tf
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
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
                  <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 25%, 16%)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 11, fontFamily: "Plus Jakarta Sans" }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  orientation="right"
                  tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 11, fontFamily: "Plus Jakarta Sans" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                  dx={4}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(222, 25%, 11%)",
                    border: "1px solid hsl(222, 25%, 16%)",
                    borderRadius: "10px",
                    color: "hsl(210, 20%, 98%)",
                    boxShadow: "0 8px 30px -8px rgba(0,0,0,0.5)",
                    padding: "10px 14px",
                    fontFamily: "Plus Jakarta Sans",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "P&L"]}
                  labelStyle={{ color: "hsl(220, 9%, 46%)", fontSize: "11px", marginBottom: "4px" }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="hsl(217, 91%, 60%)"
                  fill="url(#perfFill)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: "hsl(217, 91%, 60%)", stroke: "hsl(222, 25%, 11%)", strokeWidth: 2 }}
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Add trades to see your performance</p>
              </div>
            </div>
          )}
        </div>

        {/* Monthly P&L */}
        <div
          className="lg:col-span-2"
          style={{
            height: 430,
            padding: 24,
            background: "var(--card-gradient)",
            border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: 30,
          }}
        >
          <div className="flex items-start justify-between mb-7">
            <h2 className="text-[26px] font-bold tracking-tight" style={{ color: "#F8FAFC" }}>Monthly P&L</h2>
            <div className="text-right">
              <p className="text-[18px] font-bold leading-tight" style={{ color: monthlyPnl >= 0 ? "#3B82F6" : "#EF4444" }}>
                {monthlyPnl >= 0 ? "+" : "-"}${Math.abs(monthlyPnl).toFixed(2)}
              </p>
              <p className="text-[14px] font-medium mt-1" style={{ color: "#94A3B8" }}>
                {now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Header row: M T W T F S S + Weekly */}
          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_90px] gap-3.5 text-center mb-3">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div
                key={i}
                className="py-1.5 font-semibold uppercase"
                style={{ fontSize: 12, letterSpacing: "0.15em", color: "#94A3B8", opacity: 0.5 }}
              >
                {d}
              </div>
            ))}
            <div
              className="py-1.5 font-semibold uppercase"
              style={{ fontSize: 12, letterSpacing: "0.15em", color: "#94A3B8", opacity: 0.5 }}
            >
              Weekly
            </div>
          </div>

          {/* Week rows */}
          <div className="space-y-3.5">
            {Array.from({ length: weeks }).map((_, w) => {
              const wt = weeklyTotals[w];
              const wPositive = wt.pnl >= 0;
              return (
                <div key={w} className="grid grid-cols-[repeat(7,minmax(0,1fr))_90px] gap-3.5">
                  {Array.from({ length: 7 }).map((__, d) => {
                    const cellIdx = w * 7 + d;
                    const dayNum = cellIdx - startDow + 1;
                    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
                    if (!inMonth) {
                      return (
                        <div
                          key={d}
                          style={{ height: 72, borderRadius: 22, border: "1px solid rgba(255,255,255,0.02)" }}
                        />
                      );
                    }
                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                    const data = calendarData[dateStr];
                    const hasData = !!data;
                    const isProfit = hasData && data.pnl >= 0;
                    const isToday = dayNum === now.getDate();
                    const cellStyle: React.CSSProperties = {
                      height: 72,
                      borderRadius: 22,
                      background: "linear-gradient(180deg, rgba(12,19,36,0.95), rgba(8,14,28,0.95))",
                      border: hasData
                        ? isProfit
                          ? "1.5px solid rgba(59,130,246,0.65)"
                          : "1.5px solid rgba(239,68,68,0.65)"
                        : "1px solid rgba(255,255,255,0.03)",
                      boxShadow: hasData
                        ? isProfit
                          ? "inset 0 0 20px rgba(59,130,246,0.08)"
                          : "inset 0 0 20px rgba(239,68,68,0.06)"
                        : "none",
                      outline: isToday ? "1px solid rgba(59,130,246,0.4)" : "none",
                      outlineOffset: isToday ? 2 : 0,
                    };
                    return (
                      <div
                        key={d}
                        className="p-2.5 flex flex-col justify-between text-left cursor-pointer group relative transition-all duration-200 hover:-translate-y-0.5"
                        style={cellStyle}
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setSelectedDay({ date: dateStr, rect });
                        }}
                        onMouseEnter={(e) => {
                          if (!hasData) e.currentTarget.style.background = "rgba(17,27,49,0.95)";
                        }}
                        onMouseLeave={(e) => {
                          if (!hasData)
                            e.currentTarget.style.background =
                              "linear-gradient(180deg, rgba(12,19,36,0.95), rgba(8,14,28,0.95))";
                        }}
                      >
                        <span
                          className="font-semibold"
                          style={{
                            fontSize: 12,
                            color: hasData ? (isProfit ? "#3B82F6" : "#EF4444") : "#94A3B8",
                          }}
                        >
                          {dayNum}
                        </span>
                        {hasData && (
                          <span
                            className="font-bold leading-none text-num"
                            style={{ fontSize: 15, color: isProfit ? "#3B82F6" : "#EF4444" }}
                          >
                            {isProfit ? "+" : "-"}${Math.abs(data.pnl).toFixed(0)}
                          </span>
                        )}
                        {hasData && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                            <div
                              className="px-3 py-2 text-[11px] whitespace-nowrap"
                              style={{
                                background: "#0B1120",
                                border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: 12,
                              }}
                            >
                              <p
                                className="font-bold text-num"
                                style={{ color: isProfit ? "#3B82F6" : "#EF4444" }}
                              >
                                {isProfit ? "+" : "-"}${Math.abs(data.pnl).toFixed(2)}
                              </p>
                              <p style={{ color: "#94A3B8" }}>
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
                    className="flex flex-col justify-between"
                    style={{
                      height: 72,
                      width: 90,
                      borderRadius: 18,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.04)",
                      padding: 14,
                    }}
                  >
                    <span
                      className="uppercase font-semibold leading-none"
                      style={{ fontSize: 11, letterSpacing: "0.15em", color: "#94A3B8", opacity: 0.5 }}
                    >
                      Weekly
                    </span>
                    <div>
                      <p
                        className="font-bold text-num leading-none"
                        style={{
                          fontSize: 18,
                          color: wt.trades === 0 ? "#94A3B8" : wPositive ? "#3B82F6" : "#EF4444",
                        }}
                      >
                        {wPositive ? "" : "-"}${Math.abs(wt.pnl).toFixed(0)}
                      </p>
                      <p className="mt-1 leading-none" style={{ fontSize: 12, color: "#94A3B8" }}>
                        {wt.trades} trades
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-8 justify-center mt-8" style={{ fontSize: 13, color: "#94A3B8" }}>
            <span className="flex items-center gap-2.5">
              <span
                style={{
                  display: "inline-block",
                  width: 22,
                  height: 8,
                  borderRadius: 999,
                  background: "#3B82F6",
                }}
              />
              Profit
            </span>
            <span className="flex items-center gap-2.5">
              <span
                style={{
                  display: "inline-block",
                  width: 22,
                  height: 8,
                  borderRadius: 999,
                  background: "#EF4444",
                }}
              />
              Loss
            </span>
          </div>
        </div>

      </div>

      {/* Open Positions */}
      <div className="rounded-2xl bg-card border border-border/60 p-6">
        <h2 className="text-[15px] font-bold text-foreground mb-5">Open Positions</h2>
        {trades.length > 0 ? (
          <div className="space-y-1">
            {trades.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-secondary/40 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center text-base">🥇</div>
                  <div>
                    <p className="font-bold text-foreground text-[14px]">{t.symbol}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      {new Date(t.close_time).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <span className={`badge-pill ${t.direction === "Long" ? "bg-primary/15 text-primary" : "bg-loss/15 text-loss"}`}>
                  {t.direction}
                </span>
                <p className={`font-extrabold text-num text-[15px] ${Number(t.pnl) >= 0 ? "text-profit" : "text-loss"}`}>
                  {Number(t.pnl) >= 0 ? "+" : ""}${Number(t.pnl).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-muted-foreground text-sm font-medium">No trades yet. Go to Trades to add your first trade.</p>
          </div>
        )}
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
