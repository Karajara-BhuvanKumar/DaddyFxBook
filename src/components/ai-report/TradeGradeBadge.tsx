import type { Grade } from "./types";

const styles: Record<Grade, string> = {
  "A+": "bg-profit/15 text-profit border-profit/30",
  A: "bg-profit/10 text-profit border-profit/25",
  B: "bg-primary/15 text-primary border-primary/30",
  C: "bg-warning/15 text-warning border-warning/30",
  F: "bg-loss/15 text-loss border-loss/30",
};

export function TradeGradeBadge({ grade }: { grade: Grade }) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[44px] h-9 px-2 rounded-lg border font-mono font-extrabold text-base tracking-tight ${styles[grade]}`}
    >
      {grade}
    </span>
  );
}
