import { useMemo, useState } from "react";
import { useTrades } from "@/hooks/useTrades";
import {
  WalletCards, Activity, CheckCircle2, Trophy, TrendingUp,
  ChevronLeft, ChevronRight
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine
} from "recharts";
import { DayTradesPopup } from "@/components/DayTradesPopup";

const timeframes = ["1D", "1W", "1M", "3M", "ALL"] as const;
type TF = typeof timeframes[number];

const money = (n: number, decimals = 2) => {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toFixed(decimals)}`;
};

export default function Dashboard() {
  const { data: trades = [], isLoading } = useTrades();
  const [timeframe, setTimeframe] = useState<TF>("1M");
  const [selectedDay, setSelectedDay] = useState<{ date: string; rect: DOMRect } | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const { filteredTrades, prevPnl } = useMemo(() => {
    if (timeframe === "ALL") return { filteredTrades: trades, prevPnl: null as number | null };
    const cutoff = new Date();
    const previous = new Date();
    if (timeframe === "1D") { cutoff.setDate(cutoff.getDate() - 1); previous.setDate(previous.getDate() - 2); }
    if (timeframe === "1W") { cutoff.setDate(cutoff.getDate() - 7); previous.setDate(previous.getDate() - 14); }
    if (timeframe === "1M") { cutoff.setMonth(cutoff.getMonth() - 1); previous.setMonth(previous.getMonth() - 2); }
    if (timeframe === "3M") { cutoff.setMonth(cutoff.getMonth() - 3); previous.setMonth(previous.getMonth() - 6); }
    const current = trades.filter(t => new Date(t.close_time) >= cutoff);
    const old = trades.filter(t => {
      const d = new Date(t.close_time);
      return d >= previous && d < cutoff;
    });
    return { filteredTrades: current, prevPnl: old.reduce((s, t) => s + Number(t.pnl), 0) };
  }, [trades, timeframe]);

  const realized = filteredTrades.reduce((s, t) => s + Number(t.pnl), 0);
  const totalPnl = realized;
  const closedCount = filteredTrades.length;
  const wins = filteredTrades.filter(t => Number(t.pnl) > 0).length;
  const winRate = closedCount ? (wins / closedCount) * 100 : 0;
  const perfPct = prevPnl === null || prevPnl === 0 ? null : ((totalPnl - prevPnl) / Math.abs(prevPnl)) * 100;

  const chartData = useMemo(() => {
    const sorted = [...filteredTrades].sort((a, b) => a.close_time.localeCompare(b.close_time));
    let cumulative = 0;
    const points = sorted.map(t => {
      cumulative += Number(t.pnl);
      const d = new Date(t.close_time);
      return {
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        fullDate: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
        cumulative: Number(cumulative.toFixed(2))
      };
    });
    return points.length === 1
      ? [{ date: "Start", fullDate: "Start", cumulative: 0 }, points[0]]
      : points;
  }, [filteredTrades]);

  const calendarData = useMemo(() => {
    const daily: Record<string, { pnl: number; count: number }> = {};
    for (const t of trades) {
      const day = t.close_time.split("T")[0];
      daily[day] ??= { pnl: 0, count: 0 };
      daily[day].pnl += Number(t.pnl);
      daily[day].count++;
    }
    return daily;
  }, [trades]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = (firstDay.getDay() + 6) % 7;
  const weeks = Math.ceil((startDow + daysInMonth) / 7);
  const now = new Date();

  const monthlyPnl = Object.entries(calendarData)
    .filter(([d]) => d.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .reduce((s, [, v]) => s + v.pnl, 0);

  const weeklyTotals = useMemo(() => {
    const totals = Array.from({ length: weeks }, () => ({ pnl: 0, trades: 0 }));
    for (let d = 1; d <= daysInMonth; d++) {
      const idx = startDow + d - 1;
      const w = Math.floor(idx / 7);
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const value = calendarData[key];
      if (value) {
        totals[w].pnl += value.pnl;
        totals[w].trades += value.count;
      }
    }
    return totals;
  }, [calendarData, weeks, startDow, daysInMonth, year, month]);

  const dataMax = Math.max(...chartData.map(x => x.cumulative), 0);
  const dataMin = Math.min(...chartData.map(x => x.cumulative), 0);
  const gradientOffset = dataMax === dataMin ? 1 : dataMax / (dataMax - dataMin);

  if (isLoading) {
    return <div className="dashboard-exact-loading"><Activity size={20} /> Loading dashboard...</div>;
  }

  return (
    <div className="dashboard-exact-content">
      <section className="dashboard-exact-stats">
        <div className="dashboard-exact-stat">
          <div className="dashboard-exact-stat-icon blue"><WalletCards size={25} /></div>
          <div className="dashboard-exact-stat-body">
            <div className="dashboard-exact-stat-label">TOTAL P&amp;L</div>
            <div className="dashboard-exact-stat-value blue">{money(totalPnl)}</div>
            <div className="dashboard-exact-stat-sub blue">→ {closedCount} trades</div>
          </div>
        </div>

        <div className="dashboard-exact-stat">
          <div className="dashboard-exact-stat-icon gold"><Activity size={25} /></div>
          <div className="dashboard-exact-stat-body">
            <div className="dashboard-exact-stat-label">UNREALIZED</div>
            <div className="dashboard-exact-stat-value">+$0.00</div>
            <div className="dashboard-exact-stat-sub">0 open positions</div>
          </div>
        </div>

        <div className="dashboard-exact-stat">
          <div className="dashboard-exact-stat-icon blue"><CheckCircle2 size={25} /></div>
          <div className="dashboard-exact-stat-body">
            <div className="dashboard-exact-stat-label">REALIZED</div>
            <div className="dashboard-exact-stat-value blue">{money(realized)}</div>
            <div className="dashboard-exact-stat-sub blue">{closedCount} closed trades</div>
          </div>
        </div>

        <div className="dashboard-exact-stat dashboard-exact-win">
          <div className="dashboard-exact-stat-icon blue"><Trophy size={25} /></div>
          <div className="dashboard-exact-win-body">
            <div className="dashboard-exact-stat-label">WIN RATE</div>
            <div className="dashboard-exact-win-value">{winRate.toFixed(0)}%</div>
            <div className="dashboard-exact-progress"><span style={{ width: `${Math.min(100, winRate)}%` }} /></div>
          </div>
        </div>
      </section>

      <section className="dashboard-exact-grid">
        <div className="dashboard-exact-panel dashboard-exact-performance">
          <div className="dashboard-exact-performance-head">
            <div>
              <div className="dashboard-exact-performance-kicker"><TrendingUp size={17} /> PERFORMANCE</div>
              <div className="dashboard-exact-performance-metric">
                <div className="dashboard-exact-performance-value">{money(totalPnl)}</div>
                <div className="dashboard-exact-performance-change">
                  <TrendingUp size={15} />
                  {perfPct === null ? "—" : `${perfPct >= 0 ? "+" : ""}${perfPct.toFixed(1)}%`}
                </div>
              </div>
            </div>
            <div className="dashboard-exact-range">
              {timeframes.map(tf => (
                <button key={tf} className={timeframe === tf ? "active" : ""} onClick={() => setTimeframe(tf)}>{tf}</button>
              ))}
            </div>
          </div>

          {chartData.length ? (
            <div className="dashboard-exact-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 40, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboardExactLine" x1="0" y1="0" x2="0" y2="1">
                      <stop offset={gradientOffset} stopColor="#2388ff" />
                      <stop offset={gradientOffset} stopColor="#fb4755" />
                    </linearGradient>
                    <linearGradient id="dashboardExactFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#2388ff" stopOpacity={0.25} />
                      <stop offset={gradientOffset} stopColor="#2388ff" stopOpacity={0} />
                      <stop offset={gradientOffset} stopColor="#fb4755" stopOpacity={0} />
                      <stop offset="1" stopColor="#fb4755" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.035)" strokeDasharray="3 3" />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.14)" strokeDasharray="4 4" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#60656d", fontSize: 12, fontWeight: 600 }} dy={17} />
                  <YAxis orientation="right" axisLine={false} tickLine={false} width={48}
                    tick={({ x, y, payload }: any) => (
                      <text x={x} y={y} dx={10} dy={4} fill={payload.value >= 0 ? "#258bff" : "#fb4755"} fontSize={11} fontWeight={600}>
                        {payload.value >= 0 ? "" : "-"}${Math.abs(payload.value).toFixed(1).replace(".0", "")}
                      </text>
                    )}
                  />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      const positive = p.cumulative >= 0;
                      return (
                        <div className="dashboard-exact-tooltip">
                          <div>{p.fullDate}</div>
                          <strong className={positive ? "profit" : "loss"}>{money(p.cumulative)}</strong>
                          <small>Cumulative P&amp;L</small>
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="cumulative" stroke="url(#dashboardExactLine)" fill="url(#dashboardExactFill)" strokeWidth={3} dot={false}
                    activeDot={{ r: 5, stroke: "#080808", strokeWidth: 3 }} animationDuration={800} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="dashboard-exact-empty">Add trades to see your performance</div>
          )}
        </div>

        <div className="dashboard-exact-panel dashboard-exact-calendar">
          <div className="dashboard-exact-calendar-head">
            <div className="dashboard-exact-calendar-title">Monthly P&amp;L</div>
            <div className="dashboard-exact-calendar-head-right">
              <div className="dashboard-exact-monthly">Monthly: <strong>{money(monthlyPnl)}</strong></div>
              <div className="dashboard-exact-calendar-nav">
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
                <span>{currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
              </div>
            </div>
          </div>

          <div className="dashboard-exact-week-head">
            {["M","T","W","T","F","S","S"].map((d, i) => <div key={i}>{d}</div>)}
            <div>Weekly</div>
          </div>

          <div className="dashboard-exact-calendar-body">
            {Array.from({ length: weeks }).map((_, w) => {
              const wt = weeklyTotals[w];
              return (
                <div className="dashboard-exact-week-row" key={w}>
                  {Array.from({ length: 7 }).map((__, d) => {
                    const dayNum = w * 7 + d - startDow + 1;
                    if (dayNum < 1 || dayNum > daysInMonth) {
                      return <div className="dashboard-exact-day empty" key={d} />;
                    }
                    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                    const value = calendarData[key];
                    const positive = value ? value.pnl >= 0 : false;
                    const today = dayNum === now.getDate() && month === now.getMonth() && year === now.getFullYear();
                    return (
                      <div
                        key={d}
                        className={`dashboard-exact-day ${value ? "has-profit" : ""} ${today ? "today" : ""}`}
                        onClick={e => setSelectedDay({ date: key, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
                      >
                        <span className="dashboard-exact-day-num">{dayNum}{today && <span className="dashboard-exact-day-today-dot" />}</span>
                        {value && <span className={`dashboard-exact-day-value ${positive ? "" : "loss-value"}`}>{money(value.pnl, Math.abs(value.pnl) >= 1000 ? 1 : 2)}</span>}
                      </div>
                    );
                  })}
                  <div className={`dashboard-exact-week-summary ${wt.trades ? "active" : ""}`}>
                    <span className="dashboard-exact-week-summary-label">Weekly</span>
                    <span className={`dashboard-exact-week-summary-value ${wt.trades ? "" : "muted"}`}>{wt.trades ? money(wt.pnl, Math.abs(wt.pnl) >= 1000 ? 1 : 2) : "$0"}</span>
                    <span className="dashboard-exact-week-summary-trades">{wt.trades ? `${wt.trades} Traded D...` : "Traded D..."}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="dashboard-exact-legend">
            <span><i className="dashboard-exact-legend-dot" /> Profit</span>
            <span><i className="dashboard-exact-legend-dot loss" /> Loss</span>
          </div>
        </div>
      </section>

      {selectedDay && (
        <DayTradesPopup
          anchorRect={selectedDay.rect}
          dateStr={selectedDay.date}
          trades={trades.filter(t => t.close_time.split("T")[0] === selectedDay.date)}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
