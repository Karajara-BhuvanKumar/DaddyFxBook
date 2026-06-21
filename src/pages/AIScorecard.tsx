import { useEffect, useMemo, useState } from "react";
import { Award, Sparkles, RefreshCw, TrendingUp, Shield, Target, Brain, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTrades, type Journal, type Checklist } from "@/hooks/useTrades";
import { useLatestScorecard, useScorecardHistory, useGenerateScorecard, type ScorecardRecord } from "@/hooks/useAIInsights";
import { buildScorecard, type ScoreResult, type ScorecardSnapshot } from "@/lib/scoring";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

type CategoryKey = "discipline" | "risk" | "execution" | "psychology" | "consistency";

const CATEGORIES: Array<{ key: CategoryKey; label: string; icon: React.ComponentType<{ className?: string }>; tone: "primary" | "profit" | "loss" | "warning" }> = [
  { key: "discipline", label: "Discipline", icon: Shield, tone: "primary" },
  { key: "risk", label: "Risk Management", icon: Target, tone: "warning" },
  { key: "execution", label: "Execution", icon: TrendingUp, tone: "profit" },
  { key: "psychology", label: "Psychology", icon: Brain, tone: "primary" },
  { key: "consistency", label: "Consistency", icon: BarChart3, tone: "profit" },
];

function classColor(c: string) {
  if (c === "Elite") return "text-blue-500 border-blue-500/40 bg-blue-500/15";
  if (c === "Advanced") return "text-blue-400 border-blue-400/40 bg-blue-400/15";
  if (c === "Developing") return "text-amber-500 border-amber-500/40 bg-amber-500/15";
  return "text-zinc-500 border-white/[0.08] bg-[#121212]";
}

function scoreColor(score: number) {
  if (score >= 85) return "#3B82F6"; // blue-500
  if (score >= 70) return "#60A5FA"; // blue-400
  if (score >= 50) return "#F59E0B"; // amber-500
  return "#EF4444"; // red-500
}

export default function AIScorecard() {
  const { user } = useAuth();
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { data: latest, isLoading: latestLoading } = useLatestScorecard();
  const { data: history = [] } = useScorecardHistory();
  const generate = useGenerateScorecard();
  const { toast } = useToast();

  // Pull journals, checklists, trade-review grades for the user (one shot)
  const { data: journals = [] } = useQuery({
    queryKey: ["journals_all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("journals").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Journal[];
    },
  });
  const { data: checklists = [] } = useQuery({
    queryKey: ["checklists_all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("checklists").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Checklist[];
    },
  });
  const { data: grades = [] } = useQuery({
    queryKey: ["trade_review_grades", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_trade_reviews").select("grade");
      if (error) throw error;
      return ((data ?? []) as Array<{ grade: string }>).map((r) => r.grade as "A+" | "A" | "B" | "C" | "F");
    },
  });

  const liveSnapshot: ScorecardSnapshot = useMemo(
    () => buildScorecard(trades, journals, checklists, grades),
    [trades, journals, checklists, grades],
  );

  async function onGenerate() {
    if (trades.length === 0) {
      toast({ title: "Not enough data", description: "More trading history is required to generate meaningful AI reports.", variant: "destructive" });
      return;
    }
    try {
      await generate.mutateAsync({
        snapshot: liveSnapshot,
        trade_count: trades.length,
        trades_summary: {
          total: trades.length,
          last_30: trades.slice(0, 30).map((t) => ({ id: t.id, pnl: t.pnl, session: t.session, dir: t.direction, sl: t.stop_loss })),
        },
      });
      toast({ title: "Scorecard updated" });
    } catch (e) {
      toast({ title: "Generation failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  if (tradesLoading || latestLoading) {
    return <div className="p-6 space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></div>;
  }

  const display: ScorecardSnapshot = (latest?.breakdown as ScorecardSnapshot | undefined) ?? liveSnapshot;
  const insights = latest?.ai_insights ?? null;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="p-6 bg-[#0B0B0B] border border-white/[0.06] rounded-[24px]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[20px] bg-blue-500/10 flex items-center justify-center">
              <Award className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                AI Trader Scorecard
                <span className="text-[10px] font-extrabold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded uppercase tracking-wider">PRO</span>
              </h1>
              <p className="text-[13px] text-zinc-500 font-medium mt-0.5">
                {latest ? `Last snapshot ${new Date(latest.created_at).toLocaleString()}` : "Live preview from current trades"}
              </p>
            </div>
          </div>
          <button 
            onClick={onGenerate} 
            disabled={generate.isPending || trades.length === 0} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:opacity-50 flex items-center gap-2"
          >
            {generate.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Scoring...</> : <><Sparkles className="w-4 h-4" /> {latest ? "Re-score with AI" : "Score with AI"}</>}
          </button>
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="p-10 text-center bg-[#0B0B0B] border border-white/[0.06] rounded-[24px]">
          <Award className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="font-semibold text-white mb-1">No trades yet</h3>
          <p className="text-sm text-zinc-500 font-medium">More trading history is required to generate meaningful AI reports.</p>
        </div>
      ) : (
        <>
          {/* Overall */}
          <Card className="p-6 bg-[#0B0B0B] border-white/[0.06] rounded-[24px]">
            <div className="flex items-center gap-6 flex-wrap">
              <Gauge value={display.overall} size={140} label="Overall" />
              <div className="flex-1 min-w-[200px]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Trader classification</p>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-2xl font-extrabold px-4 py-1.5 rounded-xl border ${classColor(display.classification)}`}>
                    {display.classification}
                  </span>
                  <span className="text-sm text-zinc-500 font-medium">Based on {display.trade_count} trades</span>
                </div>
                {insights?.overall_summary ? (
                  <p className="text-sm text-zinc-300 font-medium leading-relaxed mt-2">{insights.overall_summary}</p>
                ) : (
                  <p className="text-sm text-zinc-500 italic font-medium mt-2">Run AI scoring to get a personalized narrative.</p>
                )}
              </div>
            </div>
          </Card>

          {/* Categories */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {CATEGORIES.map((cat) => {
              const r = display[cat.key] as ScoreResult;
              return (
                <Card key={cat.key} className="p-5 bg-[#0B0B0B] border-white/[0.06] rounded-[24px]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <cat.icon className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-white text-sm">{cat.label}</h3>
                  </div>
                  <Gauge value={r.score} size={110} label="" />
                </Card>
              );
            })}
          </div>

          {/* History */}
          {history.length >= 2 && <HistoryChart history={history} />}

          {/* Details */}
          <div className="grid lg:grid-cols-2 gap-4">
            {CATEGORIES.map((cat) => {
              const r = display[cat.key] as ScoreResult;
              const aiCat = insights?.categories?.[cat.key];
              return (
                <Card key={cat.key} className="p-6 bg-[#0B0B0B] border-white/[0.06] rounded-[24px]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <cat.icon className="w-4 h-4 text-blue-500" />
                      <h3 className="font-bold text-white text-sm">{cat.label}</h3>
                    </div>
                    <span className="text-xl font-extrabold font-mono" style={{ color: scoreColor(r.score) }}>
                      {r.score.toFixed(0)}
                    </span>
                  </div>

                  <div className="space-y-3 mb-5">
                    {r.factors.map((f) => (
                      <div key={f.label}>
                        <div className="flex items-center justify-between text-[12px] mb-1.5">
                          <span className="text-zinc-300 font-bold">{f.label}</span>
                          <span className="text-zinc-400 font-mono">{Math.round(f.value * 100)}</span>
                        </div>
                        <div className="h-1.5 bg-[#121212] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${f.value * 100}%`, background: scoreColor(f.value * 100) }} />
                        </div>
                        <p className="text-[11px] text-zinc-500 font-medium mt-1">{f.detail}</p>
                      </div>
                    ))}
                  </div>

                  {aiCat ? (
                    <div className="border-t border-white/[0.05] pt-4 space-y-3">
                      <p className="text-[13px] text-zinc-300 font-medium leading-relaxed">{aiCat.explanation}</p>
                      {aiCat.recommendations.length > 0 && (
                        <ul className="space-y-2">
                          {aiCat.recommendations.map((rec, i) => (
                            <li key={i} className="text-[12.5px] text-zinc-400 font-medium flex gap-2.5 leading-relaxed">
                              <span className="text-blue-500 font-bold mt-0.5">→</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <p className="text-[12px] text-zinc-500 font-medium italic border-t border-white/[0.05] pt-4">
                      Run AI scoring for personalized improvement recommendations.
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Gauge({ value, size, label }: { value: number; size: number; label: string }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const offset = c - (animated / 100) * c;
  const color = scoreColor(value);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#121212" strokeWidth={8} fill="none" opacity={1} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={8} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 800ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-extrabold font-mono text-white" style={{ fontSize: size * 0.22 }}>
          {value.toFixed(0)}
        </span>
        {label && <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mt-0.5">{label}</span>}
      </div>
    </div>
  );
}

function HistoryChart({ history }: { history: ScorecardRecord[] }) {
  const data = history.map((h) => ({
    date: new Date(h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    Overall: Number(h.overall_score),
    Discipline: Number(h.discipline_score),
    Risk: Number(h.risk_score),
    Execution: Number(h.execution_score),
    Psychology: Number(h.psychology_score),
    Consistency: Number(h.consistency_score),
  }));
  return (
    <Card className="p-6 bg-[#0B0B0B] border-white/[0.06] rounded-[24px]">
      <h3 className="font-bold text-white text-sm mb-5">Historical Scores</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
            <XAxis dataKey="date" stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff" }} itemStyle={{ color: "#fff" }} />
            <Line type="monotone" dataKey="Overall" stroke="#3B82F6" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="Discipline" stroke="#10B981" strokeWidth={1.5} dot={false} opacity={0.5} />
            <Line type="monotone" dataKey="Risk" stroke="#F59E0B" strokeWidth={1.5} dot={false} opacity={0.5} />
            <Line type="monotone" dataKey="Execution" stroke="#EF4444" strokeWidth={1.5} dot={false} opacity={0.5} />
            <Line type="monotone" dataKey="Psychology" stroke="#8B5CF6" strokeWidth={1.5} dot={false} opacity={0.5} />
            <Line type="monotone" dataKey="Consistency" stroke="#A855F7" strokeWidth={1.5} dot={false} opacity={0.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
