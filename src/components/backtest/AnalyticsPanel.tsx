import { useId } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell, ReferenceLine } from "recharts";
import type { BacktestAnalytics, BreakdownRow } from "@/lib/backtest";
import SetupAnalysis, { BreakdownTable, formatR, resultClass } from "./SetupAnalysis";
import "./backtesting.css";

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="bt-panel" aria-label={title}>
    <div className="bt-panel-heading"><h3>{title}</h3>{description && <p>{description}</p>}</div>
    {children}
  </section>;
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: number }) {
  return <div className="bt-metric"><span>{label}</span><strong className={tone == null ? "" : resultClass(tone)}>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

const tooltipStyle = { background: "var(--chart-tooltip)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 12, fontSize: 12, color: "var(--chart-tooltip-text)" };
const axisProps = { stroke: "var(--chart-axis)", fontSize: 11, tickLine: false, axisLine: false };

function PerformanceChart({ a, drawdown = false }: { a: BacktestAnalytics; drawdown?: boolean }) {
  const gradient = useId().replace(/:/g, "");
  const color = drawdown ? "hsl(var(--loss))" : "hsl(var(--profit))";
  return <div className="bt-chart" role="img" aria-label={`${drawdown ? "Drawdown" : "Cumulative R"} across ${a.total} trades`}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={drawdown ? a.drawdownCurve : a.equityCurve} margin={{ top: 12, right: 12, left: 0, bottom: 4 }} accessibilityLayer>
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.24} /><stop offset="100%" stopColor={color} stopOpacity={0.01} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid-line)" vertical={false} />
        <XAxis {...axisProps} dataKey="idx" minTickGap={30} />
        <YAxis {...axisProps} width={48} tickFormatter={v => `${v}R`} />
        <ReferenceLine y={0} stroke="var(--chart-axis)" strokeDasharray="3 4" />
        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "var(--chart-tooltip-text)" }} labelFormatter={v => `Trade ${v}`} formatter={(v: number) => [`${Number(v).toFixed(2)}R`, drawdown ? "Drawdown" : "Cumulative R"]} />
        <Area type="linear" dataKey={drawdown ? "drawdown" : "equity"} stroke={color} fill={`url(#${gradient})`} strokeWidth={2.5} dot={a.total === 1} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

function Breakdown({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  return <Card title={title}><BreakdownTable rows={rows} /></Card>;
}

export default function AnalyticsPanel({ a }: { a: BacktestAnalytics }) {
  if (a.total === 0) return <div className="bt-panel bt-empty">Add trades to unlock analytics.</div>;
  const distColors = ["hsl(var(--profit))", "hsl(var(--loss))", "var(--chart-axis)"];
  return <div className="bt-analytics">
    <div className="bt-section-heading"><div><h2>Performance overview</h2><p>All {a.total} trades in this session · Results in R unless noted</p></div></div>
    <div className="bt-kpis">
      <Metric label="Net R" value={formatR(a.netR)} detail="Cumulative return" tone={a.netR} />
      <Metric label="Win rate" value={`${(a.winRate * 100).toFixed(1)}%`} detail={`${a.wins} wins from ${a.total} trades`} />
      <Metric label="Profit factor" value={Number.isFinite(a.profitFactor) ? a.profitFactor.toFixed(2) : "∞"} detail="Gross R gained / lost" />
      <Metric label="Expectancy" value={formatR(a.expectancy)} detail="Average return per trade" tone={a.expectancy} />
    </div>
    <div className="bt-primary-charts">
      <Card title="Cumulative R performance" description="Return over the sequence of trades"><PerformanceChart a={a} /></Card>
      <Card title="Win / loss distribution" description={`${a.total} trades · ${(a.lossRate * 100).toFixed(1)}% loss rate`}>
        <div className="bt-outcome-bar" aria-hidden="true">{a.distribution.map((d, i) => <span key={d.name} style={{ width: `${d.value / a.total * 100}%`, background: distColors[i] }} />)}</div>
        <div className="bt-outcomes">{a.distribution.map((d, i) => <div key={d.name}><span><i style={{ background: distColors[i] }} />{d.name}</span><strong>{d.value}</strong><small>{(d.value / a.total * 100).toFixed(1)}%</small></div>)}</div>
        <div className="bt-recorded"><span>Recorded P&L<small>{a.recordedPnlCount} of {a.total} trades recorded</small></span><strong className={a.recordedPnlCount ? resultClass(a.totalPnl) : ""}>{a.recordedPnlCount ? a.totalPnl.toFixed(2) : "Not recorded"}</strong></div>
      </Card>
    </div>
    <SetupAnalysis rows={a.bySetup} />
    <div className="bt-section-heading"><div><h2>Performance breakdown</h2><p>Compare results across markets, sessions, and direction.</p></div></div>
    <div className="bt-breakdowns">
      <div><Breakdown title="By session" rows={a.bySession} /><Breakdown title="By pair" rows={a.byPair} /></div>
      <div><Breakdown title="By market condition" rows={a.byCondition} /><Breakdown title="Long vs Short" rows={a.byDirection} /></div>
    </div>
    <div className="bt-section-heading"><div><h2>Risk & consistency</h2><p>Inspect drawdowns, individual returns, and streaks.</p></div></div>
    <div className="bt-secondary-charts">
      <Card title="Drawdown (R)" description="Decline from the running equity peak"><PerformanceChart a={a} drawdown /></Card>
      <Card title="Per-trade R" description="Each bar represents one trade">
        <div className="bt-chart" role="img" aria-label={`Individual R returns for ${a.total} trades`}><ResponsiveContainer width="100%" height="100%">
          <BarChart data={a.equityCurve} margin={{ top: 12, right: 12, left: 0, bottom: 4 }} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid-line)" vertical={false} />
            <XAxis {...axisProps} dataKey="idx" minTickGap={30} /><YAxis {...axisProps} width={48} tickFormatter={v => `${v}R`} />
            <ReferenceLine y={0} stroke="var(--chart-axis)" />
            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "var(--chart-tooltip-text)" }} cursor={{ fill: "var(--chart-cursor)" }} labelFormatter={v => `Trade ${v}`} formatter={(v: number) => [formatR(Number(v)), "Return"]} />
            <Bar dataKey="r" maxBarSize={28} radius={[3, 3, 0, 0]} isAnimationActive={false}>{a.equityCurve.map(p => <Cell key={p.idx} fill={p.r < 0 ? distColors[1] : distColors[0]} />)}</Bar>
          </BarChart>
        </ResponsiveContainer></div>
      </Card>
    </div>
    <div className="bt-secondary-metrics">
      <Metric label="Total R gained" value={formatR(a.totalRGained)} tone={a.totalRGained} />
      <Metric label="Total R lost" value={`${a.totalRLost.toFixed(2)}R`} tone={-a.totalRLost} />
      <Metric label="Avg RR" value={a.avgRR.toFixed(2)} />
      <Metric label="Largest win" value={formatR(a.largestWinner)} tone={a.largestWinner} />
      <Metric label="Largest loss" value={formatR(a.largestLoser)} tone={a.largestLoser} />
      <Metric label="Max win streak" value={String(a.maxConsecutiveWins)} />
      <Metric label="Max loss streak" value={String(a.maxConsecutiveLosses)} />
    </div>
  </div>;
}
