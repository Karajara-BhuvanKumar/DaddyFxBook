import { Sparkles, RefreshCw, Check, X, ArrowUpRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTradeReview, useGenerateReport } from "@/hooks/useAIReport";
import { TradeGradeBadge } from "./TradeGradeBadge";

export function AITradeReviewPanel({ tradeId }: { tradeId: string }) {
  const { data: review, isLoading } = useTradeReview(tradeId);
  const generate = useGenerateReport();
  const { toast } = useToast();

  async function onGenerate() {
    try {
      await generate.mutateAsync({ mode: "single", trade_id: tradeId });
      toast({ title: "AI review ready" });
    } catch (e) {
      toast({
        title: "Could not generate review",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="rounded-[20px] border border-white/[0.08]/60 bg-[#0B0B0B]/40 p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base flex items-center gap-2">
              AI Trade Review
              <span className="badge-pill bg-primary/15 text-primary">PRO</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              {review
                ? `Updated ${new Date(review.updated_at).toLocaleString()}`
                : "Get an AI grade and feedback for this trade"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {review && <TradeGradeBadge grade={review.grade} />}
          <button
            onClick={onGenerate}
            disabled={generate.isPending}
            className="btn-premium text-primary-foreground px-4 py-2 rounded-[20px] font-semibold text-xs flex items-center gap-2 disabled:opacity-50"
          >
            {generate.isPending ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Reviewing...</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> {review ? "Re-review" : "Generate review"}</>
            )}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading review...</p>
      ) : !review ? (
        <p className="text-sm text-muted-foreground italic">
          No AI review yet. Click <span className="font-medium text-foreground">Generate review</span> to grade this trade.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-foreground/90 leading-relaxed">{review.summary}</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <Bullets title="What went right" tone="profit" icon={<Check className="w-3.5 h-3.5" />} items={review.went_right} />
            <Bullets title="What went wrong" tone="loss" icon={<X className="w-3.5 h-3.5" />} items={review.went_wrong} />
            <Bullets title="Improvements" tone="primary" icon={<ArrowUpRight className="w-3.5 h-3.5" />} items={review.improvements} />
          </div>
        </div>
      )}
    </div>
  );
}

function Bullets({
  title, tone, icon, items,
}: {
  title: string;
  tone: "profit" | "loss" | "primary";
  icon: React.ReactNode;
  items: string[];
}) {
  const toneCls = tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-primary";
  return (
    <div>
      <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${toneCls}`}>
        {icon}{title}
      </h4>
      {items.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/70 italic">None noted.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="text-[12.5px] text-foreground/90 leading-relaxed flex gap-2">
              <span className={`mt-1.5 w-1 h-1 rounded-full shrink-0 ${toneCls.replace("text-", "bg-")}`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
