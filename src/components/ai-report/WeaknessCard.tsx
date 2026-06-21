import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Weakness } from "./types";

const sevColor: Record<Weakness["severity"], string> = {
  low: "bg-muted/50 text-muted-foreground",
  medium: "bg-warning/15 text-warning",
  high: "bg-loss/15 text-loss",
};

export function WeaknessCard({ item }: { item: Weakness }) {
  return (
    <Card className="p-4 bg-[#0B0B0B] border-white/[0.08]/60 hover:border-loss/40 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-loss/15 text-loss flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
            <span className={`badge-pill uppercase text-[10px] ${sevColor[item.severity]}`}>
              {item.severity}
            </span>
            <span className="badge-pill bg-muted/50 text-muted-foreground uppercase text-[10px]">
              {item.category.replace("_", " ")}
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">{item.description}</p>
          <p className="text-[12px] text-loss/90 font-medium">{item.evidence}</p>
        </div>
      </div>
    </Card>
  );
}
