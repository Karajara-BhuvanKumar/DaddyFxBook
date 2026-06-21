import { memo } from "react";
import { ArrowUpRight, ArrowDownRight, DollarSign, Pencil, Share2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type TradeRow = {
  id: string;
  symbol: string;
  direction: string;
  entry_price: number | string;
  exit_price: number | string;
  lot_size: number | string;
  pnl: number | string;
  open_time: string;
  close_time: string;
};

type TradeCardProps = {
  trade: TradeRow;
  formatDate: (dateStr: string) => string;
  onDelete?: (id: string) => void;
  onEdit?: () => void;
  onShare?: () => void;
};

function TradeCard({ trade, formatDate, onDelete, onEdit, onShare }: TradeCardProps) {
  const pnl = Number(trade.pnl);
  const isProfit = pnl >= 0;

  return (
    <div className="rounded-[20px] border border-white/[0.06] bg-[#0B0B0B] p-4 space-y-4 transition-colors hover:border-white/[0.1]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-sm shadow-amber-500/20 shrink-0">
            <DollarSign className="w-4 h-4 text-black stroke-[3]" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white text-base truncate">{trade.symbol}</p>
            <span
              className={cn(
                "text-[11px] font-bold px-2 py-1 rounded-lg inline-flex items-center gap-1 mt-1",
                trade.direction === "Long" ? "bg-[#0A1224] text-[#3B82F6]" : "bg-[#240A0A] text-[#EF4444]",
              )}
            >
              {trade.direction === "Long" ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              {trade.direction}
            </span>
          </div>
        </div>
        <p className={cn("font-black text-lg shrink-0", isProfit ? "text-[#3B82F6]" : "text-[#EF4444]")}>
          {isProfit ? "+" : "-"}${Math.abs(pnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Entry" value={`$${Number(trade.entry_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} />
        <Field label="Exit" value={`$${Number(trade.exit_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} />
        <Field label="Lot Size" value={String(trade.lot_size)} />
        <Field label="Source" value="Manual" muted />
      </div>

      <div className="pt-3 border-t border-white/[0.05] space-y-1.5">
        <Row label="Open" value={formatDate(trade.open_time)} />
        <Row label="Close" value={formatDate(trade.close_time)} />
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        <button 
          onClick={onEdit}
          className="touch-target flex items-center justify-center text-[#3B82F6] hover:brightness-125 transition-all min-w-[44px] min-h-[44px]" 
          aria-label="Edit Trade"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button 
          onClick={onShare}
          className="touch-target flex items-center justify-center text-[#3B82F6] hover:brightness-125 transition-all min-w-[44px] min-h-[44px]" 
          aria-label="Share Trade"
        >
          <Share2 className="w-4 h-4" />
        </button>
        {onDelete && (
          <button
            onClick={() => onDelete(trade.id)}
            className="touch-target flex items-center justify-center text-[#EF4444] hover:brightness-125 transition-all"
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("font-bold text-sm truncate", muted ? "text-[#A855F7]" : "text-white")}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[12px]">
      <span className="text-[#71717A] font-medium shrink-0">{label}</span>
      <span className="text-[#E2E8F0] font-semibold text-right truncate">{value}</span>
    </div>
  );
}

export default memo(TradeCard);
