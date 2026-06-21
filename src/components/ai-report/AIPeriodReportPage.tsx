import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Sparkles, RefreshCw, TrendingUp, AlertTriangle, Target, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTrades } from "@/hooks/useTrades";
import { usePeriodReport, useGeneratePeriodReport } from "@/hooks/useAIInsights";
import {
  buildPeriodStats,
  filterTradesInRange,
  getPeriodRange,
  type PeriodType,
} from "@/lib/periodStats";

interface Props {
  period: PeriodType;
  title: string;
  description: string;
}

export default function AIPeriodReportPage({ period, title, description }: Props) {
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const [anchor, setAnchor] = useState(new Date());
  const { toast } = useToast();
  const range = useMemo(() => getPeriodRange(period, anchor), [period, anchor]);
  const periodTrades = useMemo(() => filterTradesInRange(trades, range), [trades, range]);
  const stats = useMemo(() => buildPeriodStats(periodTrades), [periodTrades]);

  const { data: persisted, isLoading: reportLoading } = usePeriodReport(period, range.start);
  const generate = useGeneratePeriodReport();
  const report = (persisted?.report ?? null) as Record<string, unknown> | null;

  function shiftPeriod(dir: -1 | 1) {
    const next = new Date(anchor);
    if (period === "daily") next.setDate(next.getDate() + dir);
    else if (period === "weekly") next.setDate(next.getDate() + 7 * dir);
    else next.setMonth(next.getMonth() + dir);
    setAnchor(next);
  }

  async function onGenerate() {
    try {
      await generate.mutateAsync({
        period_type: period,
        period_start: range.start,
        period_end: range.end,
        stats,
        trades: periodTrades.map((t) => ({
          id: t.id, symbol: t.symbol, direction: t.direction, entry: t.entry_price,
          exit: t.exit_price, sl: t.stop_loss, tp: t.take_profit, lot: t.lot_size,
          pnl: t.pnl, session: t.session, opened: t.open_time, closed: t.close_time,
        })),
      });
      toast({ title: `${title} ready` });
    } catch (e) {
      toast({ title: "Generation failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  if (tradesLoading) {
    return <div className="p-6 space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></div>;
  }

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="p-6 bg-[#0B0B0B] border border-white/[0.06] rounded-[24px]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[20px] bg-blue-500/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                {title}
                <span className="text-[10px] font-extrabold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded uppercase tracking-wider">PRO</span>
              </h1>
              <p className="text-[13px] text-zinc-500 font-medium mt-0.5">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => shiftPeriod(-1)} className="w-9 h-9 rounded-xl bg-[#121212] hover:bg-white/5 border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-4 h-9 rounded-xl bg-[#121212] border border-white/[0.08] flex items-center text-sm font-bold text-white min-w-[200px] justify-center">
              {range.label}
            </div>
            <button onClick={() => shiftPeriod(1)} className="w-9 h-9 rounded-xl bg-[#121212] hover:bg-white/5 border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button 
              onClick={onGenerate} 
              disabled={generate.isPending || periodTrades.length === 0} 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:opacity-50 flex items-center gap-2 ml-2"
            >
              {generate.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Sparkles className="w-4 h-4" /> {report ? "Regenerate" : "Generate"}</>}
            </button>
          </div>
        </div>
      </div>

      {periodTrades.length === 0 ? (
        <div className="p-10 text-center bg-[#0B0B0B] border border-white/[0.06] rounded-[24px]">
          <Activity className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="font-semibold text-white mb-1">No trades in this period</h3>
          <p className="text-sm text-zinc-500 font-medium">More trading history is required to generate meaningful AI reports.</p>
        </div>
      ) : (
        <>
          <StatsGrid stats={stats} />

          {reportLoading || generate.isPending ? (
            <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
          ) : !report ? (
            <div className="p-10 text-center bg-[#0B0B0B] border border-white/[0.06] rounded-[24px]">
              <Sparkles className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <h3 className="font-semibold text-white mb-1">Ready when you are</h3>
              <p className="text-sm text-zinc-500 font-medium">Click <span className="text-white font-bold">Generate</span> to add the AI narrative.</p>
            </div>
          ) : (
            <ReportContent report={report} period={period} />
          )}
        </>
      )}
    </div>
  );
}

function StatsGrid({ stats }: { stats: ReturnType<typeof buildPeriodStats> }) {
  const items = [
    { label: "Trades", value: stats.trade_count, tone: "muted" as const },
    { label: "Win rate", value: `${Math.round(stats.win_rate * 100)}%`, tone: "primary" as const },
    { label: "Net P&L", value: `${stats.net_pnl >= 0 ? "+" : ""}$${stats.net_pnl.toFixed(2)}`, tone: stats.net_pnl >= 0 ? "profit" : "loss" as const },
    { label: "Total R", value: `${stats.total_r >= 0 ? "+" : ""}${stats.total_r.toFixed(2)}R`, tone: stats.total_r >= 0 ? "profit" : "loss" as const },
    { label: "Avg R:R", value: `${stats.avg_rr.toFixed(2)}R`, tone: "muted" as const },
    { label: "Win streak", value: stats.longest_streak.wins, tone: "profit" as const },
    { label: "Loss streak", value: stats.longest_streak.losses, tone: "loss" as const },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {items.map((it) => (
        <Card key={it.label} className="p-4 bg-[#0B0B0B] border-white/[0.06] rounded-[20px]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">{it.label}</p>
          <p className={`text-xl font-extrabold font-mono ${
            it.tone === "profit" ? "text-blue-500" : it.tone === "loss" ? "text-red-500" : it.tone === "primary" ? "text-blue-500" : "text-white"
          }`}>{String(it.value)}</p>
        </Card>
      ))}
      <Card className="p-4 bg-[#0B0B0B] border-white/[0.06] rounded-[20px] col-span-2 sm:col-span-2 lg:col-span-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Best / Worst</p>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-blue-500 font-mono font-bold">
            {stats.best_trade ? `+$${stats.best_trade.pnl.toFixed(2)} · ${stats.best_trade.symbol}` : "—"}
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-red-500 font-mono font-bold">
            {stats.worst_trade ? `$${stats.worst_trade.pnl.toFixed(2)} · ${stats.worst_trade.symbol}` : "—"}
          </span>
        </div>
      </Card>
      <Card className="p-4 bg-[#0B0B0B] border-white/[0.06] rounded-[20px] col-span-2 sm:col-span-2 lg:col-span-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">By session</p>
        <div className="flex gap-3 flex-wrap">
          {Object.entries(stats.by_session).map(([s, v]) => (
            <span key={s} className="text-xs px-2.5 py-1 rounded-lg bg-[#121212] border border-white/[0.05] text-white">
              {s}: <span className="font-mono font-bold">{v.count}t</span> · <span className={`font-mono ${v.pnl >= 0 ? "text-blue-500" : "text-red-500"}`}>{v.pnl >= 0 ? "+" : ""}${v.pnl.toFixed(2)}</span>
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ReportContent({ report, period }: { report: Record<string, unknown>; period: PeriodType }) {
  const headline = report.headline as string | undefined;
  const strength = report.biggest_strength as string | undefined;
  const weakness = report.biggest_weakness as string | undefined;
  const violations = (report.rule_violations as string[]) ?? [];
  const mistakes = (report.key_mistakes as string[]) ?? [];
  const actionPlan = (report.action_plan as string[]) ?? [];

  return (
    <div className="space-y-4">
      {headline && (
        <Card className="p-5 bg-gradient-to-r from-blue-900/20 to-[#0B0B0B] border border-blue-500/20 rounded-[20px]">
          <p className="text-[15px] text-blue-100 font-medium leading-relaxed">{headline}</p>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <InsightCard tone="profit" icon={<TrendingUp className="w-5 h-5" />} title="Biggest Strength" text={strength} />
        <InsightCard tone="loss" icon={<AlertTriangle className="w-5 h-5" />} title="Biggest Weakness" text={weakness} />
      </div>

      {period === "weekly" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MiniCard label="Best Setup" value={report.best_setup as string} tone="profit" />
          <MiniCard label="Worst Setup" value={report.worst_setup as string} tone="loss" />
          <MiniCard label="Best Instrument" value={report.best_instrument as string} tone="profit" />
          <MiniCard label="Worst Instrument" value={report.worst_instrument as string} tone="loss" />
          <MiniCard label="Most Profitable Session" value={report.best_session as string} tone="primary" />
          <MiniCard label="Recommended Focus" value={report.recommended_focus as string} tone="primary" />
        </div>
      )}

      {period === "monthly" && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <ListCard title="Performance Trends" items={(report.performance_trends as string[]) ?? []} tone="primary" />
            <ListCard title="Growth Metrics" items={(report.growth_metrics as string[]) ?? []} tone="profit" />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <MiniCard label="Consistency Analysis" value={report.consistency_analysis as string} tone="primary" />
            <MiniCard label="Drawdown Analysis" value={report.drawdown_analysis as string} tone="loss" />
            <MiniCard label="Strategy Effectiveness" value={report.strategy_effectiveness as string} tone="profit" />
          </div>
          <ListCard title="Long-Term Recommendations" items={(report.long_term_recommendations as string[]) ?? []} tone="primary" icon={<Target className="w-4 h-4" />} />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <ListCard title="Rule Violations" items={violations} tone="loss" icon={<AlertTriangle className="w-4 h-4" />} />
        <ListCard title="Key Mistakes" items={mistakes} tone="loss" />
      </div>

      <ListCard title={period === "daily" ? "Action Plan — Next Trading Day" : period === "weekly" ? "Action Plan — Next Week" : "Action Plan — Next Month"} items={actionPlan} tone="primary" icon={<Target className="w-4 h-4" />} />
    </div>
  );
}

function InsightCard({ tone, icon, title, text }: { tone: "profit" | "loss"; icon: React.ReactNode; title: string; text?: string }) {
  const toneCls = tone === "profit" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500";
  return (
    <Card className="p-5 bg-[#0B0B0B] border-white/[0.06] rounded-[20px]">
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toneCls}`}>{icon}</div>
        <div>
          <h3 className="font-bold text-white text-sm mb-1.5">{title}</h3>
          <p className="text-sm text-zinc-400 font-medium leading-relaxed">{text || "—"}</p>
        </div>
      </div>
    </Card>
  );
}

function MiniCard({ label, value, tone }: { label: string; value?: string; tone: "profit" | "loss" | "primary" }) {
  const toneCls = tone === "profit" ? "text-emerald-500" : tone === "loss" ? "text-red-500" : "text-blue-500";
  return (
    <Card className="p-5 bg-[#0B0B0B] border-white/[0.06] rounded-[20px]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">{label}</p>
      <p className={`text-[15px] font-bold ${toneCls}`}>{value || "—"}</p>
    </Card>
  );
}

function ListCard({ title, items, tone, icon }: { title: string; items: string[]; tone: "profit" | "loss" | "primary"; icon?: React.ReactNode }) {
  const toneCls = tone === "profit" ? "text-emerald-500" : tone === "loss" ? "text-red-500" : "text-blue-500";
  return (
    <Card className="p-6 bg-[#0B0B0B] border-white/[0.06] rounded-[20px]">
      <h3 className={`text-[12px] font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${toneCls}`}>
        {icon}{title}
      </h3>
      {items.length === 0 ? (
        <p className="text-[13px] text-zinc-500 italic font-medium">None noted.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="text-sm text-zinc-300 font-medium leading-relaxed flex gap-3">
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${toneCls.replace("text-", "bg-")}`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
