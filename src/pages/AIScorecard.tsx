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
  if (c === "Elite") return "text-profit border-profit/40 bg-profit/15";
  if (c === "Advanced") return "text-primary border-primary/40 bg-primary/15";
  if (c === "Developing") return "text-warning border-warning/40 bg-warning/15";
  return "text-muted-foreground border-border bg-muted/40";
}

function scoreColor(score: number) {
  if (score >= 85) return "hsl(var(--profit))";
  if (score >= 70) return "hsl(var(--primary))";
  if (score >= 50) return "hsl(var(--warning))";
  return "hsl(var(--loss))";
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
      <Card className="p-5 bg-gradient-to-br from-primary/10 via-card to-card border-border/60">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                AI Trader Scorecard
                <span className="badge-pill bg-primary/15 text-primary">PRO</span>
              </h1>
              <p className="text-[13px] text-muted-foreground">
                {latest ? `Last snapshot ${new Date(latest.created_at).toLocaleString()}` : "Live preview from current trades"}
              </p>
            </div>
          </div>
          <Button onClick={onGenerate} disabled={generate.isPending || trades.length === 0} className="gap-2">
            {generate.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Scoring...</> : <><Sparkles className="w-4 h-4" /> {latest ? "Re-score with AI" : "Score with AI"}</>}
          </Button>
        </div>
      </Card>

      {trades.length === 0 ? (
        <Card className="p-10 text-center bg-card border-border/60 border-dashed">
          <Award className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">No trades yet</h3>
          <p className="text-sm text-muted-foreground">More trading history is required to generate meaningful AI reports.</p>
        </Card>
      ) : (
        <>
          {/* Overall */}
          <Card className="p-6 bg-card border-border/60">
            <div className="flex items-center gap-6 flex-wrap">
              <Gauge value={display.overall} size={140} label="Overall" />
              <div className="flex-1 min-w-[200px]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Trader classification</p>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-2xl font-extrabold px-3 py-1 rounded-lg border ${classColor(display.classification)}`}>
                    {display.classification}
                  </span>
                  <span className="text-sm text-muted-foreground">Based on {display.trade_count} trades</span>
                </div>
                {insights?.overall_summary ? (
                  <p className="text-sm text-foreground/90 leading-relaxed mt-2">{insights.overall_summary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Run AI scoring to get a personalized narrative.</p>
                )}
              </div>
            </div>
          </Card>

          {/* Categories */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {CATEGORIES.map((cat) => {
              const r = display[cat.key] as ScoreResult;
              return (
                <Card key={cat.key} className="p-4 bg-card border-border/60">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <cat.icon className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-foreground text-sm">{cat.label}</h3>
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
                <Card key={cat.key} className="p-5 bg-card border-border/60">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <cat.icon className="w-4 h-4 text-primary" />
                      <h3 className="font-bold text-foreground text-sm">{cat.label}</h3>
                    </div>
                    <span className="text-xl font-extrabold font-mono" style={{ color: scoreColor(r.score) }}>
                      {r.score.toFixed(0)}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    {r.factors.map((f) => (
                      <div key={f.label}>
                        <div className="flex items-center justify-between text-[12px] mb-1">
                          <span className="text-foreground/90 font-medium">{f.label}</span>
                          <span className="text-muted-foreground font-mono">{Math.round(f.value * 100)}</span>
                        </div>
                        <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${f.value * 100}%`, background: scoreColor(f.value * 100) }} />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{f.detail}</p>
                      </div>
                    ))}
                  </div>

                  {aiCat ? (
                    <div className="border-t border-border/60 pt-3 space-y-2">
                      <p className="text-[12.5px] text-foreground/90 leading-relaxed">{aiCat.explanation}</p>
                      {aiCat.recommendations.length > 0 && (
                        <ul className="space-y-1">
                          {aiCat.recommendations.map((rec, i) => (
                            <li key={i} className="text-[12px] text-foreground/80 flex gap-2 leading-relaxed">
                              <span className="text-primary mt-0.5">→</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11.5px] text-muted-foreground italic border-t border-border/60 pt-3">
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
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={8} fill="none" opacity={0.3} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={8} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 800ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-extrabold font-mono text-foreground" style={{ fontSize: size * 0.22 }}>
          {value.toFixed(0)}
        </span>
        {label && <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">{label}</span>}
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
    <Card className="p-5 bg-card border-border/60">
      <h3 className="font-bold text-foreground text-sm mb-4">Historical Scores</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Line type="monotone" dataKey="Overall" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="Discipline" stroke="hsl(var(--profit))" strokeWidth={1.5} dot={false} opacity={0.6} />
            <Line type="monotone" dataKey="Risk" stroke="hsl(var(--warning))" strokeWidth={1.5} dot={false} opacity={0.6} />
            <Line type="monotone" dataKey="Execution" stroke="hsl(var(--loss))" strokeWidth={1.5} dot={false} opacity={0.6} />
            <Line type="monotone" dataKey="Psychology" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} opacity={0.6} />
            <Line type="monotone" dataKey="Consistency" stroke="hsl(var(--accent-foreground))" strokeWidth={1.5} dot={false} opacity={0.6} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
