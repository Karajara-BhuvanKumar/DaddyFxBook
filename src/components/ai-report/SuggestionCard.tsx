import { Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Suggestion } from "./types";

const priColor: Record<Suggestion["priority"], string> = {
  low: "bg-muted/50 text-muted-foreground",
  medium: "bg-primary/15 text-primary",
  high: "bg-warning/15 text-warning",
};

export function SuggestionCard({ item }: { item: Suggestion }) {
  return (
    <Card className="p-4 bg-card border-border/60 hover:border-primary/40 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
            <span className={`badge-pill uppercase text-[10px] ${priColor[item.priority]}`}>
              {item.priority}
            </span>
          </div>
          <p className="text-[13px] text-foreground mb-1.5 leading-relaxed">{item.action}</p>
          <p className="text-[12px] text-muted-foreground italic">{item.rationale}</p>
        </div>
      </div>
    </Card>
  );
}
