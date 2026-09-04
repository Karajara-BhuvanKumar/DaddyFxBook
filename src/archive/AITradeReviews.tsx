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
        <Card className="p-12 text-center bg-[#0B0B0B] border-white/[0.06] rounded-[24px]">
          <BookOpen className="w-7 h-7 mx-auto mb-3 text-zinc-500" />
          <h2 className="text-xl font-bold text-white mb-1">No trades yet</h2>
          <p className="text-sm text-zinc-500 font-medium">Add trades to unlock AI insights.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="p-6 bg-[#0B0B0B] border border-white/[0.06] rounded-[24px]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[20px] bg-blue-500/10 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                AI Trade Reviews
                <span className="text-[10px] font-extrabold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded uppercase tracking-wider">PRO</span>
              </h1>
              <p className="text-[13px] text-zinc-500 font-medium mt-0.5">
                {reviews.length} reviewed of {trades.length} trades · graded A+ through F
              </p>
            </div>
          </div>
          <button 
            onClick={onGenerate} 
            disabled={generate.isPending} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:opacity-50 flex items-center gap-2"
          >
            {generate.isPending ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Reviewing...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> {reviews.length ? "Re-review trades" : "Review trades"}</>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 bg-[#0B0B0B] border border-white/[0.06] rounded-[24px] flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search summary or symbol..."
            className="pl-9 bg-[#121212] border-white/[0.08] text-white placeholder:text-zinc-500 focus-visible:ring-blue-500/50 rounded-xl"
          />
        </div>
        <div className="flex gap-1.5">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => setGrade(g)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                grade === g
                  ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                  : "bg-[#121212] border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center bg-[#0B0B0B] border-white/[0.06] rounded-[24px]">
          <BookOpen className="w-9 h-9 mx-auto mb-3 text-zinc-600" />
          <h3 className="font-semibold text-white mb-1">
            {reviews.length === 0 ? "No reviews yet" : "No reviews match your filters"}
          </h3>
          <p className="text-sm text-zinc-500 font-medium">
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
