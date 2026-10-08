import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTrades, type Trade } from "@/hooks/useTrades";
import { Activity, ArrowRight, Banknote, ChartNoAxesCombined, ChevronLeft, ChevronRight, ChevronsUp, LayoutDashboard, SlidersHorizontal, Trophy, Wallet } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { DayTradesPopup } from "@/components/DayTradesPopup";
import { CalendarPnlValue } from "@/components/CalendarPnlValue";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import "@/styles/dashboard.css";

const timeframes = ["1D", "1W", "1M", "3M", "ALL"] as const;
type Timeframe = typeof timeframes[number];

function money(value: number) {
  return `${value < 0 ? "−" : "+"}$${Math.abs(value).toFixed(2)}`;
}

function compactMoney(value: number, signed = true) {
  const amount = Math.abs(value);
  const display = amount >= 1000000 ? `${(amount / 1000000).toFixed(1).replace(/\.0$/, "")}m`
    : amount >= 1000 ? `${(amount / 1000).toFixed(1).replace(/\.0$/, "")}k`
    : amount.toFixed(2).replace(/\.00$/, "");
  return `${value < 0 ? "−" : signed && value > 0 ? "+" : ""}$${display}`;
}

interface DashboardViewProps {
  trades: Trade[];
  isLoading?: boolean;
  initialDate?: Date;
  initialTimeframe?: Timeframe;
  asOfDate?: Date;
}

export function DashboardView({ trades, isLoading = false, initialDate, initialTimeframe = "1M", asOfDate }: DashboardViewProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [selectedDay, setSelectedDay] = useState<{ date: string; rect: DOMRect } | null>(null);
  const [currentDate, setCurrentDate] = useState(() => initialDate ? new Date(initialDate) : new Date());
  const [showPerformance, setShowPerformance] = useState(true);
  const [showCalendar, setShowCalendar] = useState(true);
  const [showWeekly, setShowWeekly] = useState(true);

  const { filteredTrades, prevPnl } = useMemo(() => {
    if (timeframe === "ALL") return { filteredTrades: trades, prevPnl: null };
    const cutoff = new Date(asOfDate?.getTime() ?? Date.now());
    const prevCutoff = new Date(cutoff);
    if (timeframe === "1D" || timeframe === "1W") {
      const days = timeframe === "1D" ? 1 : 7;
      cutoff.setDate(cutoff.getDate() - days);
      prevCutoff.setDate(prevCutoff.getDate() - days * 2);
    } else {
      const months = timeframe === "1M" ? 1 : 3;
      cutoff.setMonth(cutoff.getMonth() - months);
      prevCutoff.setMonth(prevCutoff.getMonth() - months * 2);
    }
    return {
      filteredTrades: trades.filter((t) => new Date(t.close_time) >= cutoff),
      prevPnl: trades.filter((t) => new Date(t.close_time) >= prevCutoff && new Date(t.close_time) < cutoff)
        .reduce((sum, t) => sum + Number(t.pnl), 0),
    };
  }, [trades, timeframe, asOfDate]);

  // The existing trade schema records closed trades only.
  const realized = filteredTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0);
  const unrealized = 0;
  const totalPnl = realized + unrealized;
  const closedCount = filteredTrades.length;
  const winRate = closedCount ? filteredTrades.filter((t) => Number(t.pnl) > 0).length / closedCount * 100 : 0;
  const perfPct = prevPnl === null || prevPnl === 0 ? null : (totalPnl - prevPnl) / Math.abs(prevPnl) * 100;

  const chartData = useMemo(() => {
    const sorted = [...filteredTrades].sort((a, b) => a.close_time.localeCompare(b.close_time));
    if (!sorted.length) return [];
    // Daily points keep flat stretches visible without changing cumulative P&L.
    const daily = new Map<string, number>();
    sorted.forEach((trade) => {
      const key = trade.close_time.split("T")[0];
      daily.set(key, (daily.get(key) || 0) + Number(trade.pnl));
    });
    const start = new Date(`${sorted[0].close_time.split("T")[0]}T12:00:00`);
    const lastTradeDate = new Date(`${sorted[sorted.length - 1].close_time.split("T")[0]}T12:00:00`);
    const last = asOfDate && asOfDate > lastTradeDate ? new Date(asOfDate) : lastTradeDate;
    const dayCount = Math.round((last.getTime() - start.getTime()) / 86400000);
    let cumulative = 0;
    const points: { date: string; fullDate: string; cumulative: number }[] = [];
    const cursor = new Date(start);
    for (let index = 0; index <= dayCount; index++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      cumulative += daily.get(key) || 0;
      // Bound long history charts while always retaining trade days and endpoints.
      if (daily.has(key) || index % Math.max(1, Math.ceil(dayCount / 180)) === 0 || index === dayCount) {
        points.push({
          date: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          fullDate: cursor.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
          cumulative: Number(cumulative.toFixed(2)),
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return points.length === 1 ? [{ date: "Start", fullDate: "Start", cumulative: 0 }, points[0]] : points;
  }, [filteredTrades, asOfDate]);

  const calendarData = useMemo(() => {
    const daily: Record<string, { pnl: number; count: number }> = {};
    trades.forEach((t) => {
      const day = t.close_time.split("T")[0];
      daily[day] ??= { pnl: 0, count: 0 };
      daily[day].pnl += Number(t.pnl);
      daily[day].count++;
    });
    return daily;
  }, [trades]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const weeks = Math.ceil((startDow + daysInMonth) / 7);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthLabel = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const monthlyPnl = Object.entries(calendarData).filter(([day]) => day.startsWith(monthPrefix)).reduce((sum, [, day]) => sum + day.pnl, 0);
  const weeklyTotals = Array.from({ length: weeks }, (_, week) => {
    let pnl = 0;
    let count = 0;
    const days = Array.from({ length: 7 }, (_, column) => {
      const day = week * 7 + column - startDow + 1;
      if (day < 1 || day > daysInMonth) return null;
      const key = `${monthPrefix}-${String(day).padStart(2, "0")}`;
      const data = calendarData[key];
      if (data) { pnl += data.pnl; count += data.count; }
      return { day, key, data, weekday: new Date(year, month, day).toLocaleDateString("en-US", { weekday: "short" }) };
    });
    return { pnl, count, days, firstDay: Math.max(1, week * 7 - startDow + 1), lastDay: Math.min(daysInMonth, (week + 1) * 7 - startDow) };
  });
  const now = new Date();
  const dataMax = Math.max(...chartData.map((point) => point.cumulative), 0);
  const dataMin = Math.min(...chartData.map((point) => point.cumulative), 0);
  const gradientOffset = dataMax === 0 && dataMin === 0 ? 1 : dataMax <= 0 ? 0 : dataMin >= 0 ? 1 : dataMax / (dataMax - dataMin);
  const pnlTone = (value: number) => value < 0 ? "is-loss" : value > 0 ? "is-profit" : "is-neutral";
  const stats = [
    { label: "Total P&L", value: totalPnl, icon: Wallet, subtitle: `${closedCount} trades`, tone: pnlTone(totalPnl), link: true },
    { label: "Unrealized", value: unrealized, icon: Activity, subtitle: "0 open positions", tone: "is-neutral", warning: true },
    { label: "Realized", value: realized, icon: Banknote, subtitle: `${closedCount} closed trades`, tone: pnlTone(realized) },
  ];

  if (isLoading) return <div className="dashboard-loading" role="status"><Activity className="animate-pulse" /><span>Loading your dashboard…</span></div>;

  return (
    <div className="trading-dashboard">
      <div className="dashboard-toolbar">
        <Popover>
          <PopoverTrigger asChild><button className="customize-button"><LayoutDashboard size={17} />Customize</button></PopoverTrigger>
          <PopoverContent align="end" className="dashboard-customize">
            <h3><SlidersHorizontal size={16} />Your dashboard</h3>
            <p>Choose what you want to see.</p>
            <label><input type="checkbox" checked={showPerformance} onChange={(event) => setShowPerformance(event.target.checked)} />Performance chart</label>
            <label><input type="checkbox" checked={showCalendar} onChange={(event) => setShowCalendar(event.target.checked)} />Monthly calendar</label>
            <label><input type="checkbox" checked={showWeekly} onChange={(event) => setShowWeekly(event.target.checked)} />Weekly totals</label>
            <button onClick={() => { setShowPerformance(true); setShowCalendar(true); setShowWeekly(true); }}>Reset layout</button>
          </PopoverContent>
        </Popover>
      </div>

      <section className="dashboard-stats" aria-label="Trading statistics">
        {stats.map((stat) => <article className="dashboard-stat" key={stat.label}>
          <div className={cn("dashboard-stat-icon", stat.warning && "is-warning")}><stat.icon size={24} strokeWidth={1.8} /></div>
          <div className="dashboard-stat-content">
            <h2>{stat.label}</h2>
            <p className={cn("dashboard-stat-value", stat.tone)} title={money(stat.value)}>{money(stat.value)}</p>
            {stat.link ? <Link to="/trades" className="dashboard-stat-link"><ArrowRight size={15} />{stat.subtitle}</Link> : <p className="dashboard-stat-note">{stat.subtitle}</p>}
          </div>
        </article>)}
        <article className="dashboard-stat">
          <div className="dashboard-stat-icon"><Trophy size={25} strokeWidth={1.8} /></div>
          <div className="dashboard-stat-content">
            <h2>Win rate</h2><p className="dashboard-stat-value">{winRate.toFixed(0)}%</p>
            <div className="win-rate-track" role="meter" aria-label="Win rate" aria-valuenow={Math.round(winRate)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${winRate}%` }} /></div>
          </div>
        </article>
      </section>

      <div className={cn("dashboard-panels", (!showPerformance || !showCalendar) && "single-panel")}>
        {showPerformance && <section className="dashboard-panel performance-panel" aria-label="Performance">
          <div className="performance-heading">
            <div className="performance-summary">
              <h2><ChartNoAxesCombined size={21} strokeWidth={1.6} />Performance</h2>
              <div className="performance-value-row"><p className={cn("performance-value", pnlTone(totalPnl))}>{money(totalPnl)}</p>
                {perfPct !== null && <span className={cn("performance-change", perfPct < 0 && "is-loss")} title="Change compared with the previous period"><ChevronsUp size={16} className={perfPct < 0 ? "rotate-180" : ""} />{Math.abs(perfPct).toFixed(1)}%</span>}
              </div>
            </div>
            <div className="performance-timeframes" role="group" aria-label="Performance timeframe">
              {timeframes.map((tf) => <button key={tf} onClick={() => setTimeframe(tf)} aria-pressed={tf === timeframe} className={cn(tf === timeframe && "selected")}>{tf}</button>)}
            </div>
          </div>
          {chartData.length ? <div className="performance-chart" role="img" aria-label={`Cumulative profit and loss for ${timeframe}: ${money(totalPnl)}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 12, right: 3, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="dashboardLine" x1="0" y1="0" x2="0" y2="1"><stop offset={gradientOffset} stopColor="hsl(var(--primary))" /><stop offset={gradientOffset} stopColor="#f2444b" /></linearGradient>
                  <linearGradient id="dashboardFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="hsl(var(--primary))" stopOpacity={0.32} /><stop offset={gradientOffset} stopColor="hsl(var(--primary))" stopOpacity={0.015} /><stop offset={gradientOffset} stopColor="#f2444b" stopOpacity={0.015} /><stop offset="1" stopColor="#f2444b" stopOpacity={dataMin < 0 ? 0.3 : 0.015} /></linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" vertical horizontal />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--dashboard-muted)", fontSize: 12 }} minTickGap={40} tickMargin={14} interval="preserveStartEnd" />
                <YAxis orientation="right" domain={[dataMin < 0 ? "auto" : 0, "auto"]} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--primary))", fontSize: 12 }} width={55} tickMargin={10} tickCount={6} tickFormatter={(value: number) => compactMoney(value, false)} />
                <ReferenceLine y={0} stroke="var(--dashboard-line)" strokeDasharray="5 7" />
                <Tooltip cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.35, strokeDasharray: "4 4" }} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as { fullDate: string; cumulative: number };
                  return <div className="performance-tooltip"><p>{point.fullDate}</p><strong className={pnlTone(point.cumulative)}>{money(point.cumulative)}</strong><span>Cumulative P&L</span></div>;
                }} />
                <Area type="monotone" dataKey="cumulative" stroke="url(#dashboardLine)" fill="url(#dashboardFill)" strokeWidth={2.4} dot={false} activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div> : <div className="dashboard-empty"><ChartNoAxesCombined size={38} /><h3>Your performance starts here</h3><p>Add a trade to see your progress over time.</p><Link to="/trades?add=true">Add your first trade <ArrowRight size={16} /></Link></div>}
        </section>}

        {showCalendar && <section className="dashboard-panel calendar-panel" aria-label="Monthly profit and loss">
          <div className="calendar-heading">
            <h2>Monthly P&L</h2>
            <div className="calendar-controls"><p className="calendar-total">Monthly: <strong className={pnlTone(monthlyPnl)}>{money(monthlyPnl)}</strong></p>
              <div className="calendar-navigation"><button aria-label="Previous month" onClick={() => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); }}><ChevronLeft size={17} /></button><span aria-live="polite">{monthLabel}</span><button aria-label="Next month" onClick={() => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); }}><ChevronRight size={17} /></button></div>
            </div>
          </div>
          <div className={cn("pnl-calendar", !showWeekly && "without-weekly")}>
            <div className="calendar-weekdays" aria-hidden="true">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={index}>{day}</span>)}{showWeekly && <span className="weekly-heading">Weekly</span>}</div>
            <div className="calendar-weeks">
              {weeklyTotals.map((week, weekIndex) => <div className="calendar-week" key={weekIndex}>
                {week.days.map((entry, column) => {
                  if (!entry) return <div key={column} className="calendar-blank" aria-hidden="true" />;
                  const { day, key, data } = entry;
                  const today = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
                  return <button key={column} className={cn("pnl-day", data && (data.pnl < 0 ? "loss-day" : data.pnl > 0 ? "profit-day" : "flat-day"), today && "today")} aria-label={`${monthLabel} ${day}, ${data ? `${data.count} trades, ${money(data.pnl)}` : "no trades"}`} aria-current={today ? "date" : undefined} onClick={(event) => setSelectedDay({ date: key, rect: event.currentTarget.getBoundingClientRect() })}>
                    <span className="pnl-day-number">{day}</span>{data && <CalendarPnlValue title={money(data.pnl)} formatted={compactMoney(data.pnl)} />}
                  </button>;
                })}
                {showWeekly && <div className={cn("pnl-week-total", week.count > 0 && (week.pnl < 0 ? "loss-day" : week.pnl > 0 ? "profit-day" : "flat-day"))} title={`Week ${weekIndex + 1}: ${money(week.pnl)}, ${week.count} trades`}><span>Weekly</span><CalendarPnlValue formatted={compactMoney(week.pnl)} /><small>{week.count} trade{week.count !== 1 ? "s" : ""}</small></div>}
              </div>)}
            </div>
          </div>
          <div className="mobile-pnl-list">
            {weeklyTotals.some((week) => week.count > 0) ? weeklyTotals.map((week, weekIndex) => (
              <section className="mobile-pnl-week" key={weekIndex} aria-label={`Week ${weekIndex + 1}, days ${week.firstDay} to ${week.lastDay}`}>
                <div className={cn("mobile-pnl-week-band", showWeekly && pnlTone(week.pnl))}>
                  <div className="mobile-pnl-week-label"><h3>Week {weekIndex + 1}</h3><span>{week.firstDay}–{week.lastDay} {currentDate.toLocaleDateString("en-US", { month: "short" })}</span></div>
                  {showWeekly && <div className="mobile-pnl-week-summary"><strong>{week.pnl === 0 ? "$0.00" : money(week.pnl)}</strong><span>{week.count} trade{week.count !== 1 ? "s" : ""}</span></div>}
                </div>
                {week.days.map((entry) => {
                  if (!entry?.data) return null;
                  const { day, key, data, weekday } = entry;
                  const today = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
                  return <button key={key} type="button" className="mobile-pnl-day" aria-label={`${monthLabel} ${day}, ${data.count} ${data.count === 1 ? "trade" : "trades"}, ${money(data.pnl)}`} aria-current={today ? "date" : undefined} aria-haspopup="dialog" onClick={(event) => setSelectedDay({ date: key, rect: event.currentTarget.getBoundingClientRect() })}>
                    <span className="mobile-pnl-date" aria-hidden="true">{day}</span>
                    <span className="mobile-pnl-day-label"><span>{weekday}{today && <span className="mobile-pnl-today">Today</span>}</span><small>{data.count} trade{data.count !== 1 ? "s" : ""}</small></span>
                    <strong className={pnlTone(data.pnl)}>{data.pnl === 0 ? "$0.00" : money(data.pnl)}</strong>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>;
                })}
              </section>
            )) : <p className="mobile-pnl-empty">No trades this month.</p>}
          </div>
          <div className="calendar-legend"><span><i />Profit</span><span><i />Loss</span></div>
        </section>}
      </div>
      {!showCalendar && !showPerformance && <div className="dashboard-hidden-state">Your widgets are hidden. Select Customize to bring them back.</div>}
      {selectedDay && <DayTradesPopup anchorRect={selectedDay.rect} dateStr={selectedDay.date} trades={trades.filter((trade) => trade.close_time.split("T")[0] === selectedDay.date)} onClose={() => setSelectedDay(null)} />}
    </div>
  );
}

export default function Dashboard() {
  const { data: trades = [], isLoading, isError, refetch } = useTrades();
  if (isError) return <div className="dashboard-empty"><Activity size={32} /><h3>Unable to load your trades</h3><p>Please check your connection and try again.</p><button className="customize-button" onClick={() => refetch()}>Try again</button></div>;
  return <DashboardView trades={trades} isLoading={isLoading} />;
}
