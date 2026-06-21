import { useParams, Link } from "react-router-dom";
import { usePublicTrade } from "@/hooks/useTrades";
import { Activity, ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";

export default function ShareTrade() {
  const { tradeId } = useParams<{ tradeId: string }>();
  const { data, isLoading, error } = usePublicTrade(tradeId ?? null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-8 h-8 animate-pulse text-primary" />
          <span className="text-sm font-medium">Loading trade...</span>
        </div>
      </div>
    );
  }

  if (error || !data || !data.trade) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-muted-foreground space-y-6">
        <p className="text-xl font-bold text-white">Unable to load trade.</p>
        <Link to="/" className="text-primary hover:text-primary/80 transition-colors">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const { trade, journal } = data;
  const pnl = Number(trade.pnl);
  const isProfit = pnl >= 0;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const time = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    return `${day} ${month} ${time}`;
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      <header className="border-b border-white/[0.05] bg-[#0A0A0A] p-4 flex items-center justify-between">
        <div className="font-black text-xl text-white tracking-tight">DADDYFXBOOK</div>
        <Link to="/" className="bg-[#3B82F6] hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
          Open App <ExternalLink className="w-4 h-4" />
        </Link>
      </header>
      
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Preview Card */}
          <div className="rounded-[24px] bg-gradient-to-br from-[#121212] to-[#0A0A0A] border border-white/[0.08] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/[0.02] font-black text-5xl rotate-[-20deg] whitespace-nowrap pointer-events-none select-none">
              DADDYFXBOOK
            </div>

            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <h3 className="font-bold text-2xl text-white">{trade.symbol}</h3>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 mt-2 ${trade.direction === 'Long' ? 'bg-[#0A1224] text-[#3B82F6]' : 'bg-[#240A0A] text-[#EF4444]'}`}>
                  {trade.direction === 'Long' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {trade.direction}
                </span>
              </div>
              <div className="text-right">
                <p className={`font-black text-3xl ${isProfit ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>
                  {isProfit ? '+' : '-'}${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs font-bold text-[#71717A] uppercase tracking-wider mt-1.5">Net Profit</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8 relative z-10">
              <div>
                <p className="text-xs font-bold text-[#71717A] uppercase tracking-wider mb-1.5">Entry Price</p>
                <p className="font-bold text-base text-white">${Number(trade.entry_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#71717A] uppercase tracking-wider mb-1.5">Exit Price</p>
                <p className="font-bold text-base text-white">${Number(trade.exit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#71717A] uppercase tracking-wider mb-1.5">Lot Size</p>
                <p className="font-bold text-base text-white">{trade.lot_size}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#71717A] uppercase tracking-wider mb-1.5">Open Date</p>
                <p className="font-bold text-base text-white truncate">{formatDate(trade.open_time)}</p>
              </div>
            </div>

            {journal?.post_trade_notes && (
              <div className="mb-6 relative z-10">
                <p className="text-xs font-bold text-[#71717A] uppercase tracking-wider mb-1.5">Notes</p>
                <p className="text-sm text-white/80 leading-relaxed">{journal.post_trade_notes}</p>
              </div>
            )}
            
            <div className="pt-6 border-t border-white/[0.05] flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-[#71717A] uppercase tracking-wider">Shared via DaddyFXBook</span>
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <span className="text-black font-black text-xs">$</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
