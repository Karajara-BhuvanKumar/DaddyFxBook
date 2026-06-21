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
  if (c === "Elite") return "bg-blue-500/15 text-blue-500 border-blue-500/40";
  if (c === "Strong") return "bg-blue-400/15 text-blue-400 border-blue-400/40";
  if (c === "Average") return "bg-amber-500/15 text-amber-500 border-amber-500/40";
  return "bg-red-500/15 text-red-500 border-red-500/40";
}

function ScoreGauge({ label, value }: { label: string; value?: number }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const color = v >= 75 ? "text-blue-500" : v >= 50 ? "text-blue-400" : v >= 25 ? "text-amber-500" : "text-red-500";
  return (
    <div className="rounded-[16px] border border-white/[0.05] bg-[#121212] p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">{label}</div>
      <div className={`font-mono text-2xl font-extrabold ${color}`}>{v.toFixed(0)}</div>
      <div className="h-1.5 mt-3 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full ${
            v >= 75 ? "bg-blue-500" : v >= 50 ? "bg-blue-400" : v >= 25 ? "bg-amber-500" : "bg-red-500"
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
      <div className="rounded-[24px] border border-blue-500/20 bg-[#0B0B0B] p-6 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <h3 className="font-bold text-white text-[15px]">AI Strategy Report</h3>
          </div>
          <p className="text-sm text-zinc-500 font-medium">
            AI analyses every trade and identifies strengths, weaknesses, recurring patterns, and a strategy scorecard using your Gemini API key.
          </p>
        </div>
        <button 
          onClick={onGenerate} 
          disabled={!hasTrades || gen.isPending} 
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-[16px] transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          {gen.isPending ? "Generating…" : report ? "Regenerate report" : "Generate report"}
        </button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-[24px]" />
      ) : !report ? (
        <div className="rounded-[24px] border border-dashed border-white/[0.1] p-10 text-center text-sm font-medium text-zinc-500">
          {hasTrades ? "No AI report yet — click Generate to analyse this session." : "Add trades to unlock AI insights."}
        </div>
      ) : (
        <>
          {scorecard && Object.keys(scorecard).length > 0 && (
            <div className="rounded-[24px] border border-white/[0.06] bg-[#0B0B0B] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Award className="w-5 h-5 text-blue-500" />
                  <h3 className="font-bold text-white">Strategy Scorecard</h3>
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
                <p className="text-[13px] text-zinc-400 font-medium mt-4 leading-relaxed">{scorecard.rationale}</p>
              )}
            </div>
          )}

          {report.summary && (
            <div className="rounded-[24px] border border-white/[0.06] bg-[#0B0B0B] p-6">
              <h3 className="font-bold text-white mb-3">AI Summary</h3>
              <p className="text-sm text-zinc-400 font-medium leading-relaxed whitespace-pre-wrap">{report.summary}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-[24px] border border-white/[0.06] bg-[#0B0B0B] p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-white">Strengths</h3>
              </div>
              <div className="space-y-3">
                {strengths.length === 0 && <p className="text-[13px] text-zinc-500 font-medium">None identified.</p>}
                {strengths.map((s, i) => (
                  <div key={i} className="rounded-[16px] bg-[#121212] border border-white/[0.05] p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-[14px] font-bold text-white">{s.title}</h4>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">{s.category}</span>
                    </div>
                    <p className="text-[13px] text-zinc-400 font-medium leading-relaxed">{s.description}</p>
                    <p className="text-[11px] text-zinc-500 font-medium mt-2 italic">Evidence: {s.evidence}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.06] bg-[#0B0B0B] p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <TrendingDown className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-white">Weaknesses</h3>
              </div>
              <div className="space-y-3">
                {weaknesses.length === 0 && <p className="text-[13px] text-zinc-500 font-medium">None identified.</p>}
                {weaknesses.map((w, i) => (
                  <div key={i} className="rounded-[16px] bg-[#121212] border border-white/[0.05] p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-[14px] font-bold text-white">{w.title}</h4>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                        w.severity === "high" ? "bg-red-500/10 text-red-500" : 
                        w.severity === "medium" ? "bg-amber-500/10 text-amber-500" : 
                        "bg-white/5 text-zinc-400"
                      }`}>{w.severity}</span>
                    </div>
                    <p className="text-[13px] text-zinc-400 font-medium leading-relaxed">{w.description}</p>
                    <p className="text-[11px] text-zinc-500 font-medium mt-2 italic">Evidence: {w.evidence}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.06] bg-[#0B0B0B] p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-white">Patterns</h3>
              </div>
              <div className="space-y-3">
                {patterns.length === 0 && <p className="text-[13px] text-zinc-500 font-medium">No recurring patterns detected.</p>}
                {patterns.map((p, i) => (
                  <div key={i} className="rounded-[16px] bg-[#121212] border border-white/[0.05] p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-[14px] font-bold text-white">{p.title}</h4>
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${p.kind === "winning" ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500"}`}
                      >
                        {p.kind}
                      </span>
                    </div>
                    <p className="text-[13px] text-zinc-400 font-medium leading-relaxed">{p.description}</p>
                    <p className="text-[11px] text-zinc-500 font-medium mt-2 italic">Evidence: {p.evidence}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.06] bg-[#0B0B0B] p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <Target className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-white">Actionable Suggestions</h3>
              </div>
              <div className="space-y-3">
                {suggestions.length === 0 && <p className="text-[13px] text-zinc-500 font-medium">No suggestions yet.</p>}
                {suggestions.map((s, i) => (
                  <div key={i} className="rounded-[16px] bg-[#121212] border border-white/[0.05] p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-[14px] font-bold text-white">{s.title}</h4>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                        s.priority === "high" ? "bg-red-500/10 text-red-500" : 
                        s.priority === "medium" ? "bg-amber-500/10 text-amber-500" : 
                        "bg-white/5 text-zinc-400"
                      }`}>{s.priority}</span>
                    </div>
                    <p className="text-[13px] text-zinc-400 font-medium leading-relaxed">{s.description}</p>
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
