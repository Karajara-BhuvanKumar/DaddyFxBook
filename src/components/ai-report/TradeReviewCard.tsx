import { useState } from "react";
import { ChevronDown, Check, X, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TradeGradeBadge } from "./TradeGradeBadge";
import type { TradeReview } from "./types";
import type { Trade } from "@/hooks/useTrades";

export function TradeReviewCard({ review, trade }: { review: TradeReview; trade?: Trade }) {
  const [open, setOpen] = useState(false);
  const pnl = trade ? Number(trade.pnl) : 0;
  const pnlClass = pnl > 0 ? "text-blue-500" : pnl < 0 ? "text-red-500" : "text-zinc-500";
  const dateStr = trade
    ? new Date(trade.close_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <Card className="bg-[#0B0B0B] border-white/[0.06] rounded-[20px] overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full p-4 flex items-center gap-4 hover:bg-[#121212] transition-colors">
          <TradeGradeBadge grade={review.grade} />
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-white text-sm">
                {trade?.symbol ?? "Trade"}{" "}
                <span className="text-zinc-500 font-medium">· {trade?.direction ?? ""}</span>
              </span>
              {trade && <span className="text-[11px] font-semibold text-zinc-500">{dateStr}</span>}
            </div>
            <p className="text-[13px] text-zinc-400 font-medium truncate">{review.summary}</p>
          </div>
          {trade && (
            <span className={`font-mono font-extrabold text-base ${pnlClass}`}>
              {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 grid sm:grid-cols-3 gap-4 border-t border-white/[0.05]">
            <Section title="What went right" color="profit" icon={<Check className="w-3.5 h-3.5" />} items={review.went_right} />
            <Section title="What went wrong" color="loss" icon={<X className="w-3.5 h-3.5" />} items={review.went_wrong} />
            <Section title="Improvements" color="primary" icon={<ArrowUpRight className="w-3.5 h-3.5" />} items={review.improvements} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function Section({
  title,
  color,
  icon,
  items,
}: {
  title: string;
  color: "profit" | "loss" | "primary";
  icon: React.ReactNode;
  items: string[];
}) {
  const tone =
    color === "profit"
      ? "text-blue-500"
      : color === "loss"
        ? "text-red-500"
        : "text-purple-500";
  return (
    <div>
      <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${tone}`}>
        {icon}
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-[12px] text-zinc-500 italic font-medium">None noted.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="text-[12.5px] text-zinc-300 font-medium leading-relaxed flex gap-2">
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${tone.replace("text-", "bg-")}`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
