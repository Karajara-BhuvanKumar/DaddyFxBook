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
    <div className="rounded-[24px] border border-white/[0.06] bg-[#0B0B0B] p-5">
      <h3 className="text-sm font-bold text-white mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" }) {
  return (
    <div className="rounded-[20px] bg-[#0B0B0B] border border-white/[0.06] px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">{label}</div>
      <div
        className={`font-mono text-base font-extrabold ${
          tone === "profit" ? "text-blue-500" : tone === "loss" ? "text-red-500" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function BreakdownTable({ rows }: { rows: BreakdownRow[] }) {
  if (rows.length === 0) return <p className="text-xs text-zinc-500 font-medium">No data</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between text-xs gap-3">
          <span className="text-white font-bold truncate flex-1">{r.key}</span>
          <span className="text-zinc-500 font-medium tabular-nums">{r.trades}t</span>
          <span className="text-zinc-500 font-medium tabular-nums w-12 text-right">
            {(r.winRate * 100).toFixed(0)}%
          </span>
          <span
            className={`font-mono font-bold tabular-nums w-16 text-right ${
              r.netR >= 0 ? "text-blue-500" : "text-red-500"
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
      <div className="rounded-[24px] border border-white/[0.06] bg-[#0B0B0B] p-10 text-center text-sm text-zinc-500 font-medium">
        Add trades to unlock analytics.
      </div>
    );
  }
  const distColors = ["#3B82F6", "#EF4444", "#71717A"];

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
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
              <XAxis dataKey="idx" stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#121212",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#fff"
                }}
                itemStyle={{ color: "#fff" }}
              />
              <Area type="monotone" dataKey="equity" stroke="#3B82F6" fill="url(#eqg)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Drawdown (R)">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={a.drawdownCurve}>
              <defs>
                <linearGradient id="ddg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
              <XAxis dataKey="idx" stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#121212",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#fff"
                }}
                itemStyle={{ color: "#fff" }}
              />
              <Area type="monotone" dataKey="drawdown" stroke="#EF4444" fill="url(#ddg)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Win / Loss distribution">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={a.distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
              <XAxis dataKey="name" stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#121212",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#fff"
                }}
                itemStyle={{ color: "#fff" }}
                cursor={{ fill: "rgba(255,255,255,0.02)" }}
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
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
              <XAxis dataKey="idx" stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#121212",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#fff"
                }}
                itemStyle={{ color: "#fff" }}
              />
              <Line type="monotone" dataKey="r" stroke="#3B82F6" dot={false} strokeWidth={3} />
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
