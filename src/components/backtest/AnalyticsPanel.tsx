import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import type { BacktestAnalytics, BreakdownRow } from "@/lib/backtest";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" }) {
  return (
    <div className="rounded-lg bg-background/40 border border-border/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`font-mono text-base font-semibold ${
          tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function BreakdownTable({ rows }: { rows: BreakdownRow[] }) {
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No data</p>;
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between text-xs gap-3">
          <span className="text-foreground font-medium truncate flex-1">{r.key}</span>
          <span className="text-muted-foreground tabular-nums">{r.trades}t</span>
          <span className="text-muted-foreground tabular-nums w-12 text-right">
            {(r.winRate * 100).toFixed(0)}%
          </span>
          <span
            className={`font-mono font-semibold tabular-nums w-16 text-right ${
              r.netR >= 0 ? "text-profit" : "text-loss"
            }`}
          >
            {r.netR >= 0 ? "+" : ""}{r.netR.toFixed(2)}R
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPanel({ a }: { a: BacktestAnalytics }) {
  if (a.total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        Add trades to unlock analytics.
      </div>
    );
  }
  const distColors = ["hsl(var(--profit))", "hsl(var(--loss))", "hsl(var(--muted-foreground))"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <Metric label="Trades" value={String(a.total)} />
        <Metric label="Wins" value={String(a.wins)} tone="profit" />
        <Metric label="Losses" value={String(a.losses)} tone="loss" />
        <Metric label="Break-even" value={String(a.breakeven)} />
        <Metric label="Win rate" value={`${(a.winRate * 100).toFixed(1)}%`} />
        <Metric label="Loss rate" value={`${(a.lossRate * 100).toFixed(1)}%`} />
        <Metric label="Net R" value={`${a.netR >= 0 ? "+" : ""}${a.netR.toFixed(2)}`} tone={a.netR >= 0 ? "profit" : "loss"} />
        <Metric label="Total R+" value={a.totalRGained.toFixed(2)} tone="profit" />
        <Metric label="Total R−" value={a.totalRLost.toFixed(2)} tone="loss" />
        <Metric label="Profit factor" value={a.profitFactor.toFixed(2)} />
        <Metric label="Expectancy" value={`${a.expectancy.toFixed(2)}R`} />
        <Metric label="Avg RR" value={a.avgRR.toFixed(2)} />
        <Metric label="Largest win" value={`${a.largestWinner.toFixed(2)}R`} tone="profit" />
        <Metric label="Largest loss" value={`${a.largestLoser.toFixed(2)}R`} tone="loss" />
        <Metric label="Max win streak" value={String(a.maxConsecutiveWins)} />
        <Metric label="Max loss streak" value={String(a.maxConsecutiveLosses)} />
        <Metric label="P&L" value={a.totalPnl.toFixed(2)} tone={a.totalPnl >= 0 ? "profit" : "loss"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Equity curve (R)">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={a.equityCurve}>
              <defs>
                <linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="idx" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="equity" stroke="hsl(var(--primary))" fill="url(#eqg)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Drawdown (R)">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={a.drawdownCurve}>
              <defs>
                <linearGradient id="ddg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--loss))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--loss))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="idx" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="drawdown" stroke="hsl(var(--loss))" fill="url(#ddg)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Win / Loss distribution">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={a.distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {a.distribution.map((_, i) => <Cell key={i} fill={distColors[i % distColors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Per-trade R">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={a.equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="idx" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="r" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="By pair"><BreakdownTable rows={a.byPair} /></Card>
        <Card title="By setup"><BreakdownTable rows={a.bySetup} /></Card>
        <Card title="By session"><BreakdownTable rows={a.bySession} /></Card>
        <Card title="By market condition"><BreakdownTable rows={a.byCondition} /></Card>
        <Card title="Long vs Short"><BreakdownTable rows={a.byDirection} /></Card>
      </div>
    </div>
  );
}
