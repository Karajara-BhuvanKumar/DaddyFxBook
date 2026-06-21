import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Target, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useBacktestAIReport, useGenerateBacktestAIReport } from "@/hooks/useBacktest";

type Strength = { title: string; description: string; evidence: string; category: string };
type Weakness = Strength & { severity: "low" | "medium" | "high" };
type Pattern = { kind: "winning" | "losing"; title: string; description: string; evidence: string };
type Suggestion = { title: string; description: string; priority: "low" | "medium" | "high" };
type Scorecard = {
  strategy_quality?: number;
  consistency?: number;
  risk_management?: number;
  execution?: number;
  overall?: number;
  classification?: "Elite" | "Strong" | "Average" | "Weak";
  rationale?: string;
};

function severityClass(s: string) {
  if (s === "high") return "bg-loss/15 text-loss";
  if (s === "medium") return "bg-warning/15 text-warning";
  return "bg-muted/40 text-muted-foreground";
}

function classificationClass(c?: string) {
  if (c === "Elite") return "bg-profit/20 text-profit border-profit/40";
  if (c === "Strong") return "bg-primary/20 text-primary border-primary/40";
  if (c === "Average") return "bg-warning/15 text-warning border-warning/40";
  return "bg-loss/15 text-loss border-loss/40";
}

function ScoreGauge({ label, value }: { label: string; value?: number }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const color = v >= 75 ? "text-profit" : v >= 50 ? "text-primary" : v >= 25 ? "text-warning" : "text-loss";
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`font-mono text-2xl font-bold ${color}`}>{v.toFixed(0)}</div>
      <div className="h-1.5 mt-2 rounded-full bg-muted/30 overflow-hidden">
        <div
          className={`h-full ${
            v >= 75 ? "bg-profit" : v >= 50 ? "bg-primary" : v >= 25 ? "bg-warning" : "bg-loss"
          }`}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

export default function AIReportPanel({ sessionId, hasTrades }: { sessionId: string; hasTrades: boolean }) {
  const { data: report, isLoading } = useBacktestAIReport(sessionId);
  const gen = useGenerateBacktestAIReport();
  const { toast } = useToast();

  const onGenerate = () =>
    gen.mutate(sessionId, {
      onSuccess: () => toast({ title: "AI strategy report ready" }),
      onError: (e) =>
        toast({ title: "AI report failed", description: (e as Error).message, variant: "destructive" }),
    });

  const strengths = (report?.strengths ?? []) as unknown as Strength[];
  const weaknesses = (report?.weaknesses ?? []) as unknown as Weakness[];
  const patterns = (report?.patterns ?? []) as unknown as Pattern[];
  const suggestions = (report?.suggestions ?? []) as unknown as Suggestion[];
  const scorecard = (report?.scorecard ?? {}) as Scorecard;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">AI Strategy Report</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Lovable AI analyses every trade and identifies strengths, weaknesses, recurring patterns, and a strategy scorecard.
          </p>
        </div>
        <Button onClick={onGenerate} disabled={!hasTrades || gen.isPending} className="gap-2">
          <Sparkles className="w-4 h-4" />
          {gen.isPending ? "Generating…" : report ? "Regenerate" : "Generate report"}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !report ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          {hasTrades ? "No AI report yet — click Generate to analyse this session." : "Add trades to unlock AI insights."}
        </div>
      ) : (
        <>
          {scorecard && Object.keys(scorecard).length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card/60 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Strategy Scorecard</h3>
                </div>
                {scorecard.classification && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${classificationClass(scorecard.classification)}`}
                  >
                    {scorecard.classification}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <ScoreGauge label="Strategy quality" value={scorecard.strategy_quality} />
                <ScoreGauge label="Consistency" value={scorecard.consistency} />
                <ScoreGauge label="Risk management" value={scorecard.risk_management} />
                <ScoreGauge label="Execution" value={scorecard.execution} />
                <ScoreGauge label="Overall" value={scorecard.overall} />
              </div>
              {scorecard.rationale && (
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{scorecard.rationale}</p>
              )}
            </div>
          )}

          {report.summary && (
            <div className="rounded-xl border border-border/60 bg-card/60 p-5">
              <h3 className="font-semibold text-foreground mb-2">AI Summary</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{report.summary}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/60 bg-card/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-profit" />
                <h3 className="font-semibold text-foreground">Strengths</h3>
              </div>
              <div className="space-y-3">
                {strengths.length === 0 && <p className="text-xs text-muted-foreground">None identified.</p>}
                {strengths.map((s, i) => (
                  <div key={i} className="rounded-lg bg-background/40 border border-border/40 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
                      <span className="text-[10px] uppercase tracking-wider text-profit">{s.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1 italic">Evidence: {s.evidence}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-loss" />
                <h3 className="font-semibold text-foreground">Weaknesses</h3>
              </div>
              <div className="space-y-3">
                {weaknesses.length === 0 && <p className="text-xs text-muted-foreground">None identified.</p>}
                {weaknesses.map((w, i) => (
                  <div key={i} className="rounded-lg bg-background/40 border border-border/40 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-foreground">{w.title}</h4>
                      <span className={`badge-pill ${severityClass(w.severity)}`}>{w.severity}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{w.description}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1 italic">Evidence: {w.evidence}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <h3 className="font-semibold text-foreground">Patterns</h3>
              </div>
              <div className="space-y-3">
                {patterns.length === 0 && <p className="text-xs text-muted-foreground">No recurring patterns detected.</p>}
                {patterns.map((p, i) => (
                  <div key={i} className="rounded-lg bg-background/40 border border-border/40 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-foreground">{p.title}</h4>
                      <span
                        className={`badge-pill ${p.kind === "winning" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"}`}
                      >
                        {p.kind}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1 italic">Evidence: {p.evidence}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Actionable Suggestions</h3>
              </div>
              <div className="space-y-3">
                {suggestions.length === 0 && <p className="text-xs text-muted-foreground">No suggestions yet.</p>}
                {suggestions.map((s, i) => (
                  <div key={i} className="rounded-lg bg-background/40 border border-border/40 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
                      <span className={`badge-pill ${severityClass(s.priority)}`}>{s.priority}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
