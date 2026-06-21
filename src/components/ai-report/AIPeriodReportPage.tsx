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
      <Card className="p-5 bg-gradient-to-br from-primary/10 via-card to-card border-border/60">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                {title}
                <span className="badge-pill bg-primary/15 text-primary">PRO</span>
              </h1>
              <p className="text-[13px] text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => shiftPeriod(-1)} className="w-9 h-9 rounded-lg bg-secondary/60 hover:bg-accent/60 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 h-9 rounded-lg bg-card border border-border flex items-center text-sm font-semibold text-foreground min-w-[200px] justify-center">
              {range.label}
            </div>
            <button onClick={() => shiftPeriod(1)} className="w-9 h-9 rounded-lg bg-secondary/60 hover:bg-accent/60 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition">
              <ChevronRight className="w-4 h-4" />
            </button>
            <Button onClick={onGenerate} disabled={generate.isPending || periodTrades.length === 0} className="gap-2 ml-2">
              {generate.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Sparkles className="w-4 h-4" /> {report ? "Regenerate" : "Generate"}</>}
            </Button>
          </div>
        </div>
      </Card>

      {periodTrades.length === 0 ? (
        <Card className="p-10 text-center bg-card border-border/60 border-dashed">
          <Activity className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">No trades in this period</h3>
          <p className="text-sm text-muted-foreground">More trading history is required to generate meaningful AI reports.</p>
        </Card>
      ) : (
        <>
          <StatsGrid stats={stats} />

          {reportLoading || generate.isPending ? (
            <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
          ) : !report ? (
            <Card className="p-10 text-center bg-card border-border/60 border-dashed">
              <Sparkles className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Ready when you are</h3>
              <p className="text-sm text-muted-foreground">Click <span className="text-foreground font-medium">Generate</span> to add the AI narrative.</p>
            </Card>
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
        <Card key={it.label} className="p-4 bg-card border-border/60">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{it.label}</p>
          <p className={`text-xl font-extrabold font-mono ${
            it.tone === "profit" ? "text-profit" : it.tone === "loss" ? "text-loss" : it.tone === "primary" ? "text-primary" : "text-foreground"
          }`}>{String(it.value)}</p>
        </Card>
      ))}
      <Card className="p-4 bg-card border-border/60 col-span-2 sm:col-span-2 lg:col-span-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Best / Worst</p>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-profit font-mono font-bold">
            {stats.best_trade ? `+$${stats.best_trade.pnl.toFixed(2)} · ${stats.best_trade.symbol}` : "—"}
          </span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-loss font-mono font-bold">
            {stats.worst_trade ? `$${stats.worst_trade.pnl.toFixed(2)} · ${stats.worst_trade.symbol}` : "—"}
          </span>
        </div>
      </Card>
      <Card className="p-4 bg-card border-border/60 col-span-2 sm:col-span-2 lg:col-span-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">By session</p>
        <div className="flex gap-3 flex-wrap">
          {Object.entries(stats.by_session).map(([s, v]) => (
            <span key={s} className="text-xs px-2.5 py-1 rounded-lg bg-secondary/60 border border-border/50 text-foreground">
              {s}: <span className="font-mono font-bold">{v.count}t</span> · <span className={`font-mono ${v.pnl >= 0 ? "text-profit" : "text-loss"}`}>{v.pnl >= 0 ? "+" : ""}${v.pnl.toFixed(2)}</span>
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
        <Card className="p-5 bg-gradient-to-r from-primary/10 to-card border-border/60">
          <p className="text-base text-foreground font-medium leading-relaxed">{headline}</p>
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
  const toneCls = tone === "profit" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss";
  return (
    <Card className="p-4 bg-card border-border/60">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${toneCls}`}>{icon}</div>
        <div>
          <h3 className="font-semibold text-foreground text-sm mb-1">{title}</h3>
          <p className="text-[13px] text-muted-foreground leading-relaxed">{text || "—"}</p>
        </div>
      </div>
    </Card>
  );
}

function MiniCard({ label, value, tone }: { label: string; value?: string; tone: "profit" | "loss" | "primary" }) {
  const toneCls = tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-primary";
  return (
    <Card className="p-4 bg-card border-border/60">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      <p className={`text-sm font-medium ${toneCls}`}>{value || "—"}</p>
    </Card>
  );
}

function ListCard({ title, items, tone, icon }: { title: string; items: string[]; tone: "profit" | "loss" | "primary"; icon?: React.ReactNode }) {
  const toneCls = tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-primary";
  return (
    <Card className="p-4 bg-card border-border/60">
      <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${toneCls}`}>
        {icon}{title}
      </h3>
      {items.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/70 italic">None noted.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="text-[13px] text-foreground/90 leading-relaxed flex gap-2">
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${toneCls.replace("text-", "bg-")}`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
