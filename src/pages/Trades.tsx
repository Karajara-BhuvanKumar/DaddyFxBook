import { useState, useMemo } from "react";
import { useTrades, useAddTrade, useDeleteTrade, calculatePnl, Trade } from "@/hooks/useTrades";
import { Plus, Trash2, Activity, ArrowUpRight, ArrowDownRight, X, SlidersHorizontal, DollarSign, Share2, Pencil } from "lucide-react";
import { toast } from "sonner";
import TradeCard from "@/components/TradeCard";
import EditTradeModal from "@/components/EditTradeModal";
import ShareTradeModal from "@/components/ShareTradeModal";

export default function Trades() {
  const { data: trades = [], isLoading } = useTrades();
  const addTrade = useAddTrade();
  const deleteTrade = useDeleteTrade();
  const [showForm, setShowForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [sharingTrade, setSharingTrade] = useState<Trade | null>(null);
  const [form, setForm] = useState({
    direction: 'Long' as 'Long' | 'Short',
    entryPrice: '',
    exitPrice: '',
    lotSize: '0.1',
    openDate: new Date().toISOString().slice(0, 16),
    closeDate: new Date().toISOString().slice(0, 16),
  });

  const previewPnl = useMemo(() => {
    const entry = parseFloat(form.entryPrice);
    const exit = parseFloat(form.exitPrice);
    const lot = parseFloat(form.lotSize);
    if (isNaN(entry) || isNaN(exit) || isNaN(lot)) return null;
    return calculatePnl(form.direction, entry, exit, lot);
  }, [form]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const time = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    return `${day} ${month} ${time}`;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const entry = parseFloat(form.entryPrice);
    const exit = parseFloat(form.exitPrice);
    const lot = parseFloat(form.lotSize);
    if (isNaN(entry) || isNaN(exit) || isNaN(lot)) return;
    try {
      await addTrade.mutateAsync({ symbol: 'XAUUSD', direction: form.direction, entry_price: entry, exit_price: exit, lot_size: lot, open_time: form.openDate, close_time: form.closeDate });
      toast.success("Trade added!");
      setShowForm(false);
      setForm({ direction: 'Long', entryPrice: '', exitPrice: '', lotSize: '0.1', openDate: new Date().toISOString().slice(0, 16), closeDate: new Date().toISOString().slice(0, 16) });
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleDelete(id: string) {
    try { await deleteTrade.mutateAsync(id); toast.success("Trade deleted"); } catch (err: any) { toast.error(err.message); }
  }

  async function handleClearAll() {
    if (window.confirm("Are you sure you want to clear all trades? This cannot be undone.")) {
      try {
        for (const t of trades) {
          await deleteTrade.mutateAsync(t.id);
        }
        toast.success("All trades cleared!");
      } catch (err: any) {
        toast.error(err.message);
      }
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex items-center gap-3 text-muted-foreground"><Activity className="w-5 h-5 animate-pulse" /><span className="text-base font-medium">Loading trades...</span></div>
    </div>
  );

  return (
    <div className="space-y-6 md:space-y-8 overflow-guard">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-title text-foreground hidden lg:block">Trades</h1>
          <div className="flex items-center gap-2 mt-0 lg:mt-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            <span className="text-[13px] text-zinc-500 font-semibold tracking-wide">Not connected</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full lg:w-auto">
          <button className="touch-target w-full sm:w-auto bg-[#3B82F6] hover:bg-blue-600 text-white px-5 py-2.5 rounded-[20px] font-bold text-[13px] transition-all duration-200">
            Connect MT4/MT5
          </button>
          <button onClick={handleClearAll} className="touch-target w-full sm:w-auto flex items-center justify-center gap-2 border border-red-500/20 bg-[#0B0B0B] text-[#EF4444] hover:bg-red-500/10 px-5 py-2.5 rounded-[20px] font-semibold text-[13px] transition-all duration-200">
            <Trash2 className="w-4 h-4" /> Clear All
          </button>
          <button onClick={() => setShowForm(!showForm)} className="touch-target w-full sm:w-auto flex items-center justify-center gap-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white px-5 py-2.5 rounded-[20px] font-bold text-[13px] transition-all duration-200">
            <Plus className="w-4 h-4" /> Add Trade
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card rounded-[20px] p-6 space-y-5 animate-fade-up">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground">New XAUUSD Trade</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex gap-2">
            {(['Long', 'Short'] as const).map(d => (
              <button key={d} type="button" onClick={() => setForm(f => ({ ...f, direction: d }))}
                className={`flex-1 py-3 rounded-[20px] font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 ${form.direction === d
                    ? (d === 'Long' ? 'btn-premium text-primary-foreground' : 'bg-loss text-primary-foreground shadow-[0_4px_14px_-3px_hsl(0,84%,60%,0.5)]')
                    : 'bg-[#0B0B0B] text-foreground border border-white/[0.08] hover:bg-secondary'
                  }`}>
                {d === 'Long' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {d}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Entry Price', key: 'entryPrice', placeholder: '2650.00' },
              { label: 'Exit Price', key: 'exitPrice', placeholder: '2660.00' },
              { label: 'Lot Size', key: 'lotSize', placeholder: '0.1' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{field.label}</label>
                <input type="number" step="0.01" value={form[field.key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  placeholder={field.placeholder} className="w-full bg-[#0B0B0B] text-foreground border border-[#D1D5DB] dark:border-white/[0.08] rounded-[20px] px-4 py-3 text-base font-mono-num focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary/50 focus:border-primary/50 dark:focus:border-primary/50 transition-all duration-200 placeholder:text-muted-foreground/60 dark:placeholder:text-muted-foreground/30" required />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Open Date</label>
              <input type="datetime-local" value={form.openDate} onChange={e => setForm(f => ({ ...f, openDate: e.target.value }))}
                className="w-full bg-[#0B0B0B] text-foreground border border-[#D1D5DB] dark:border-white/[0.08] rounded-[20px] px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary/50 focus:border-primary/50 dark:focus:border-primary/50 transition-all duration-200" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Close Date</label>
              <input type="datetime-local" value={form.closeDate} onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))}
                className="w-full bg-[#0B0B0B] text-foreground border border-[#D1D5DB] dark:border-white/[0.08] rounded-[20px] px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary/50 focus:border-primary/50 dark:focus:border-primary/50 transition-all duration-200" />
            </div>
            <div className="flex items-end">
              {previewPnl !== null && (
                <div className={`text-2xl font-extrabold font-mono-num ${previewPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {previewPnl >= 0 ? '+' : ''}${previewPnl.toFixed(2)}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button type="submit" disabled={addTrade.isPending} className="touch-target w-full sm:w-auto btn-premium text-primary-foreground px-6 py-3 rounded-[20px] font-semibold text-base transition-all duration-200 disabled:opacity-50">
              {addTrade.isPending ? 'Saving...' : 'Save Trade'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="touch-target w-full sm:w-auto bg-secondary hover:bg-muted text-foreground px-6 py-3 rounded-[20px] font-semibold text-base border border-white/[0.08] transition-all duration-200">Cancel</button>
          </div>
        </form>
      )}

      {/* Trades Table / Cards */}
      <div className="surface-card overflow-hidden p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h3 className="text-base sm:text-[18px] font-bold text-white tracking-tight">Trade History</h3>
            <span className="text-[13px] text-[#71717A] font-medium">{trades.length} of {trades.length} trades</span>
          </div>
          <button className="touch-target w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-[20px] border border-white/[0.05] text-[#71717A] hover:text-white text-[13px] font-semibold bg-[#121212] hover:bg-[#1A1A1A] transition-all">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filters <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] ml-1" />
          </button>
        </div>

        {/* Pro Banner */}
        <div className="bg-[#0A1224] text-[#E2E8F0] text-xs sm:text-[13px] px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl flex items-center justify-between mb-6 md:mb-8">
          <span>Free plan loads <strong className="text-white font-bold">your last 15 trades.</strong> Upgrade to Pro to unlock full history and longer timeframes.</span>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {trades.length === 0 ? (
            <div className="text-center text-[#71717A] py-16">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No trades yet. Click "+ Add Trade" to get started.</p>
            </div>
          ) : (
            trades.map(t => (
              <TradeCard 
                key={t.id} 
                trade={t as any} 
                formatDate={formatDate} 
                onDelete={handleDelete}
                onEdit={() => setEditingTrade(t)}
                onShare={() => setSharingTrade(t)}
              />
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Open / Close', 'Symbol', 'Type', 'Entry', 'Exit', 'Size', 'P&L', 'Source', ''].map(h => (
                  <th key={h} className="text-[10px] font-medium text-[#71717A] uppercase tracking-wider px-4 py-4 text-left border-b border-white/[0.02]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-[#71717A] py-16">
                    <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No trades yet. Click "+ Add Trade" to get started.</p>
                  </td>
                </tr>
              ) : (
                trades.map(t => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group border-b border-white/[0.02] last:border-0">
                    <td className="px-4 py-5 text-left">
                      <div className="text-[12px] text-[#71717A] font-medium space-y-1">
                        <div>Open: {formatDate(t.open_time)}</div>
                        <div>Close: {formatDate(t.close_time)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-sm shadow-amber-500/20">
                          <DollarSign className="w-3.5 h-3.5 text-black stroke-[3]" />
                        </div>
                        <span className="font-bold text-white text-[14px]">{t.symbol}</span>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-left">
                      <span className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 ${t.direction === 'Long' ? 'bg-[#0A1224] text-[#3B82F6]' : 'bg-[#240A0A] text-[#EF4444]'
                        }`}>
                        {t.direction === 'Long' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {t.direction}
                      </span>
                    </td>
                    <td className="px-4 py-5 text-left font-bold text-[14px] text-white">${Number(t.entry_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-5 text-left font-bold text-[14px] text-white">${Number(t.exit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-5 text-left font-semibold text-[14px] text-[#E2E8F0]">{t.lot_size}</td>
                    <td className={`px-4 py-5 text-left font-black text-[15px] ${Number(t.pnl) >= 0 ? 'text-[#3B82F6]' : 'text-[#EF4444]'}`}>
                      {Number(t.pnl) >= 0 ? '+' : '-'}${Math.abs(Number(t.pnl)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-5 text-left">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-[#1A1025] text-[#A855F7]">
                        <Pencil className="w-3 h-3" /> Manual
                      </span>
                    </td>
                    <td className="px-4 py-5 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingTrade(t)}
                          className="touch-target flex items-center justify-center text-[#3B82F6] hover:brightness-125 transition-all min-w-[44px] min-h-[44px]"
                          aria-label="Edit Trade"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setSharingTrade(t)}
                          className="touch-target flex items-center justify-center text-[#3B82F6] hover:brightness-125 transition-all min-w-[44px] min-h-[44px]"
                          aria-label="Share Trade"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(t.id)} 
                          className="touch-target flex items-center justify-center text-[#EF4444] hover:brightness-125 transition-all min-w-[44px] min-h-[44px]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EditTradeModal 
        trade={editingTrade} 
        isOpen={!!editingTrade} 
        onClose={() => setEditingTrade(null)} 
      />
      
      <ShareTradeModal 
        trade={sharingTrade} 
        isOpen={!!sharingTrade} 
        onClose={() => setSharingTrade(null)} 
      />
    </div>
  );
}
