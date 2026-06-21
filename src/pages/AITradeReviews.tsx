import { useMemo, useState } from "react";
import { BookOpen, RefreshCw, Sparkles, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTrades, type Trade } from "@/hooks/useTrades";
import { useTradeReviews, useGenerateReport } from "@/hooks/useAIReport";
import { TradeReviewCard } from "@/components/ai-report/TradeReviewCard";
import type { TradeReview, Grade } from "@/components/ai-report/types";

const GRADES: (Grade | "ALL")[] = ["ALL", "A+", "A", "B", "C", "F"];

export default function AITradeReviewsPage() {
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { data: reviews = [], isLoading: reviewsLoading } = useTradeReviews();
  const generate = useGenerateReport();
  const { toast } = useToast();
  const [grade, setGrade] = useState<Grade | "ALL">("ALL");
  const [q, setQ] = useState("");

  const tradesById = useMemo(() => new Map(trades.map((t: Trade) => [t.id, t])), [trades]);

  const filtered = useMemo(() => {
    return reviews
      .filter((r) => (grade === "ALL" ? true : r.grade === grade))
      .filter((r) => {
        if (!q) return true;
        const t = tradesById.get(r.trade_id);
        return (
          r.summary.toLowerCase().includes(q.toLowerCase()) ||
          (t?.symbol ?? "").toLowerCase().includes(q.toLowerCase())
        );
      });
  }, [reviews, grade, q, tradesById]);

  async function onGenerate() {
    try {
      await generate.mutateAsync({ mode: "full" });
      toast({ title: "Trade reviews updated", description: "Latest reviews are ready." });
    } catch (e) {
      toast({ title: "Generation failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  if (tradesLoading || reviewsLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center bg-card border-border/60">
          <BookOpen className="w-7 h-7 mx-auto mb-3 text-muted-foreground" />
          <h2 className="text-xl font-bold text-foreground mb-1">No trades yet</h2>
          <p className="text-sm text-muted-foreground">Add trades to unlock AI insights.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <Card className="p-5 bg-gradient-to-br from-primary/10 via-card to-card border-border/60">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                AI Trade Reviews
                <span className="badge-pill bg-primary/15 text-primary">PRO</span>
              </h1>
              <p className="text-[13px] text-muted-foreground">
                {reviews.length} reviewed of {trades.length} trades · graded A+ through F
              </p>
            </div>
          </div>
          <Button onClick={onGenerate} disabled={generate.isPending} className="gap-2">
            {generate.isPending ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Reviewing...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> {reviews.length ? "Re-review trades" : "Review trades"}</>
            )}
          </Button>
        </div>
      </Card>

      <Card className="p-3 bg-card border-border/60 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search summary or symbol..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => setGrade(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                grade === g
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center bg-card border-border/60 border-dashed">
          <BookOpen className="w-9 h-9 mx-auto mb-3 text-muted-foreground/60" />
          <h3 className="font-semibold text-foreground mb-1">
            {reviews.length === 0 ? "No reviews yet" : "No reviews match your filters"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {reviews.length === 0
              ? "Generate your first round of AI trade reviews."
              : "Try changing the grade filter or clearing the search."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const review: TradeReview = {
              trade_id: r.trade_id,
              grade: r.grade,
              went_right: r.went_right,
              went_wrong: r.went_wrong,
              improvements: r.improvements,
              summary: r.summary,
            };
            return <TradeReviewCard key={r.id} review={review} trade={tradesById.get(r.trade_id)} />;
          })}
        </div>
      )}
    </div>
  );
}
