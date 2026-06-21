import { Sparkles, RefreshCw, Brain, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTrades } from "@/hooks/useTrades";
import { useLatestReport, useGenerateReport } from "@/hooks/useAIReport";
import { StrengthCard } from "@/components/ai-report/StrengthCard";
import { WeaknessCard } from "@/components/ai-report/WeaknessCard";
import { SuggestionCard } from "@/components/ai-report/SuggestionCard";

export default function AIReportPage() {
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { data: persisted, isLoading: reportLoading } = useLatestReport();
  const generate = useGenerateReport();
  const { toast } = useToast();

  const report = persisted?.report;

  async function onGenerate() {
    try {
      await generate.mutateAsync({ mode: "full" });
      toast({ title: "AI report generated", description: "Your performance analysis is ready." });
    } catch (e) {
      toast({
        title: "Generation failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  }

  if (tradesLoading || reportLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center bg-card border-border/60">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
            <Brain className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">No trades yet</h2>
          <p className="text-sm text-muted-foreground">Add trades to unlock AI insights.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <Card className="p-5 bg-gradient-to-br from-primary/10 via-card to-card border-border/60">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                AI Performance Coach
                <span className="badge-pill bg-primary/15 text-primary">PRO</span>
              </h1>
              <p className="text-[13px] text-muted-foreground">
                {persisted
                  ? `Analyzed ${persisted.trade_count} trades · ${new Date(persisted.created_at).toLocaleString()}`
                  : `${Math.min(trades.length, 60)} of ${trades.length} recent trades will be analyzed`}
              </p>
            </div>
          </div>
          <Button onClick={onGenerate} disabled={generate.isPending} className="gap-2">
            {generate.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {report ? "Regenerate Report" : "Generate Report"}
              </>
            )}
          </Button>
        </div>
      </Card>

      {generate.isPending && !report && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {!generate.isPending && !report && (
        <Card className="p-10 text-center bg-card border-border/60 border-dashed">
          <Brain className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Ready when you are</h3>
          <p className="text-sm text-muted-foreground">
            Click <span className="font-medium text-foreground">Generate Report</span> to analyze your trade history.
          </p>
        </Card>
      )}

      {report && (
        <>
          <Section icon={<TrendingUp className="w-4 h-4" />} title="Strengths" tone="profit" count={report.strengths.length}>
            <div className="grid md:grid-cols-2 gap-3">
              {report.strengths.map((s, i) => <StrengthCard key={i} item={s} />)}
            </div>
          </Section>

          <Section icon={<AlertTriangle className="w-4 h-4" />} title="Weaknesses" tone="loss" count={report.weaknesses.length}>
            <div className="grid md:grid-cols-2 gap-3">
              {report.weaknesses.map((w, i) => <WeaknessCard key={i} item={w} />)}
            </div>
          </Section>

          <Section icon={<Lightbulb className="w-4 h-4" />} title="Actionable Suggestions" tone="primary" count={report.suggestions.length}>
            <div className="grid md:grid-cols-2 gap-3">
              {report.suggestions.map((s, i) => <SuggestionCard key={i} item={s} />)}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Section({
  icon, title, tone, count, children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "profit" | "loss" | "primary";
  count: number;
  children: React.ReactNode;
}) {
  const toneCls =
    tone === "profit" ? "bg-profit/15 text-profit"
    : tone === "loss" ? "bg-loss/15 text-loss"
    : "bg-primary/15 text-primary";
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toneCls}`}>{icon}</div>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <span className="badge-pill bg-muted/60 text-muted-foreground">{count}</span>
      </div>
      {children}
    </section>
  );
}
