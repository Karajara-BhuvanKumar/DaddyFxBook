/**
 * Shared breakdown list component used by both backtesting AnalyticsPanel
 * and the live Analysis page "By Setup" section.
 */

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreakdownItem {
  key: string;
  trades: number;
  wins: number;
  winRate: number;
  netValue: number;  // R for backtest, P&L for live
  unit: "R" | "$";   // controls display format
  children?: BreakdownItem[];
}

interface BreakdownListProps {
  rows: BreakdownItem[];
}

export function BreakdownList({ rows }: BreakdownListProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  if (rows.length === 0) {
    return <p className="text-xs text-zinc-500 font-medium">No data</p>;
  }

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderRow = (r: BreakdownItem, isChild = false) => {
    const hasChildren = r.children && r.children.length > 0;
    const isExpanded = expandedKeys.has(r.key);

    return (
      <div key={r.key} className="flex flex-col gap-2">
        <div 
          className={cn(
            "flex items-center justify-between text-xs gap-3",
            hasChildren ? "cursor-pointer hover:bg-white/[0.02] p-1 -mx-1 rounded transition-colors" : "",
            isChild ? "pl-6" : ""
          )}
          onClick={hasChildren ? () => toggleExpand(r.key) : undefined}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {hasChildren && (
              <div className="text-zinc-500 shrink-0">
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </div>
            )}
            {!hasChildren && !isChild && <div className="w-3.5 h-3.5 shrink-0" />}
            <span className={cn("text-white truncate", isChild ? "font-semibold text-zinc-300" : "font-bold")}>{r.key}</span>
          </div>
          
          <span className="text-zinc-500 font-medium tabular-nums shrink-0 flex items-center gap-1">
            {r.trades}t
            {r.trades <= 2 && (
              <span className="text-[9px] text-zinc-600 font-semibold">(n={r.trades})</span>
            )}
          </span>
          <span className="text-zinc-500 font-medium tabular-nums w-12 text-right shrink-0">
            {(r.winRate * 100).toFixed(0)}%
          </span>
          <span
            className={`font-mono font-bold tabular-nums w-20 text-right shrink-0 ${
              r.netValue >= 0 ? "text-blue-500" : "text-red-500"
            }`}
          >
            {r.unit === "R"
              ? `${r.netValue >= 0 ? "+" : ""}${r.netValue.toFixed(2)}R`
              : `${r.netValue >= 0 ? "+" : "-"}$${Math.abs(r.netValue).toFixed(2)}`}
          </span>
        </div>

        {hasChildren && isExpanded && (
          <div className="flex flex-col gap-2 mt-1 mb-2 border-l border-white/[0.05] ml-1.5">
            {r.children!.map((child) => renderRow(child, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {rows.map((r) => renderRow(r))}
    </div>
  );
}
