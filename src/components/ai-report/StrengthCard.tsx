import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Strength } from "./types";

export function StrengthCard({ item }: { item: Strength }) {
  return (
    <Card className="p-4 bg-[#0B0B0B] border-white/[0.08]/60 hover:border-profit/40 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-profit/15 text-profit flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
            <span className="badge-pill bg-muted/50 text-muted-foreground uppercase text-[10px]">
              {item.category.replace("_", " ")}
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">{item.description}</p>
          <p className="text-[12px] text-profit/90 font-medium">{item.evidence}</p>
        </div>
      </div>
    </Card>
  );
}
