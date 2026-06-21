import { useState, useMemo } from "react";
import { useTrades, useAddTrade, useDeleteTrade, calculatePnl } from "@/hooks/useTrades";
import { Plus, Trash2, Activity, ArrowUpRight, ArrowDownRight, X, SlidersHorizontal, DollarSign, Share2, Pencil } from "lucide-react";
import { toast } from "sonner";

export default function Trades() {
  const { data: trades = [], isLoading } = useTrades();
  const addTrade = useAddTrade();
  const deleteTrade = useDeleteTrade();
  const [showForm, setShowForm] = useState(false);
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold text-foreground tracking-tight">Trades</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            <span className="text-[13px] text-zinc-500 font-semibold tracking-wide">Not connected</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200">
            Connect MT4/MT5
          </button>
          <button onClick={handleClearAll} className="flex items-center gap-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200">
            <Trash2 className="w-4 h-4" /> Clear All
          </button>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200">
            <Plus className="w-4 h-4" /> Add Trade
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-5 animate-fade-up">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground">New XAUUSD Trade</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex gap-2">
            {(['Long', 'Short'] as const).map(d => (
              <button key={d} type="button" onClick={() => setForm(f => ({ ...f, direction: d }))}
                className={`flex-1 py-3 rounded-xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 ${form.direction === d
                    ? (d === 'Long' ? 'btn-premium text-primary-foreground' : 'bg-loss text-primary-foreground shadow-[0_4px_14px_-3px_hsl(0,84%,60%,0.5)]')
                    : 'bg-card text-foreground border border-border hover:bg-secondary'
                  }`}>
                {d === 'Long' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {d}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Entry Price', key: 'entryPrice', placeholder: '2650.00' },
              { label: 'Exit Price', key: 'exitPrice', placeholder: '2660.00' },
              { label: 'Lot Size', key: 'lotSize', placeholder: '0.1' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{field.label}</label>
                <input type="number" step="0.01" value={form[field.key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  placeholder={field.placeholder} className="w-full bg-card text-foreground border border-[#D1D5DB] dark:border-border rounded-xl px-4 py-3 text-base font-mono-num focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary/50 focus:border-primary/50 dark:focus:border-primary/50 transition-all duration-200 placeholder:text-muted-foreground/60 dark:placeholder:text-muted-foreground/30" required />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Open Date</label>
              <input type="datetime-local" value={form.openDate} onChange={e => setForm(f => ({ ...f, openDate: e.target.value }))}
                className="w-full bg-card text-foreground border border-[#D1D5DB] dark:border-border rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary/50 focus:border-primary/50 dark:focus:border-primary/50 transition-all duration-200" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Close Date</label>
              <input type="datetime-local" value={form.closeDate} onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))}
                className="w-full bg-card text-foreground border border-[#D1D5DB] dark:border-border rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary/50 focus:border-primary/50 dark:focus:border-primary/50 transition-all duration-200" />
            </div>
            <div className="flex items-end">
              {previewPnl !== null && (
                <div className={`text-2xl font-extrabold font-mono-num ${previewPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {previewPnl >= 0 ? '+' : ''}${previewPnl.toFixed(2)}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={addTrade.isPending} className="btn-premium text-primary-foreground px-6 py-3 rounded-xl font-semibold text-base transition-all duration-200 disabled:opacity-50">
              {addTrade.isPending ? 'Saving...' : 'Save Trade'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-secondary hover:bg-muted text-foreground px-6 py-3 rounded-xl font-semibold text-base border border-border transition-all duration-200">Cancel</button>
          </div>
        </form>
      )}

      {/* Trades Table */}
      <div className="glass-card rounded-2xl overflow-hidden p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <h3 className="text-[17px] font-bold text-foreground tracking-tight">Trade History</h3>
            <span className="text-xs text-muted-foreground font-medium">{trades.length} of {trades.length} trades</span>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground text-xs font-semibold bg-secondary hover:bg-muted transition-all">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filters <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          </button>
        </div>

        {/* Pro Banner */}
        <div className="bg-blue-500/5 dark:bg-[#0b172a]/30 border border-blue-500/10 dark:border-blue-500/10 text-blue-600 dark:text-blue-200 text-xs px-4 py-3 rounded-xl flex items-center justify-between mb-6">
          <span>Free plan loads <strong className="text-foreground font-bold">your last 15 trades</strong>. Upgrade to Pro to unlock full history and longer timeframes.</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Open / Close', 'Symbol', 'Type', 'Entry', 'Exit', 'Size', 'P&L', 'Source', ''].map(h => (
                  <th key={h} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-3.5 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted-foreground py-16">
                    <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No trades yet. Click "+ Add Trade" to get started.</p>
                  </td>
                </tr>
              ) : (
                trades.map(t => (
                  <tr key={t.id} className="hover:bg-[#F8FAFC] dark:hover:bg-zinc-900/10 transition-colors group">
                    <td className="px-4 py-4 text-left">
                      <div className="text-xs text-muted-foreground font-medium space-y-0.5">
                        <div>Open: <span className="text-foreground/80 dark:text-zinc-400 font-bold">{formatDate(t.open_time)}</span></div>
                        <div>Close: <span className="text-foreground/80 dark:text-zinc-400 font-bold">{formatDate(t.close_time)}</span></div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-left">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-sm shadow-amber-500/20">
                          <DollarSign className="w-3.5 h-3.5 text-black stroke-[3]" />
                        </div>
                        <span className="font-bold text-foreground text-[14px]">{t.symbol}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-left">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-0.5 ${t.direction === 'Long' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/10' : 'bg-red-500/10 text-red-500 border border-red-500/10'
                        }`}>
                        {t.direction === 'Long' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {t.direction}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-left font-bold text-[14px] text-foreground">${Number(t.entry_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-left font-bold text-[14px] text-foreground">${Number(t.exit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-left font-semibold text-[14px] text-muted-foreground">{t.lot_size}</td>
                    <td className={`px-4 py-4 text-left font-black text-[15px] ${Number(t.pnl) >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {Number(t.pnl) >= 0 ? '+' : '-'}${Math.abs(Number(t.pnl)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 text-left">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:bg-purple-950/20 dark:border-purple-500/10 dark:text-purple-400">
                        <Pencil className="w-2.5 h-2.5" /> Manual
                      </span>
                    </td>
                    <td className="px-4 py-4 text-left">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button className="text-muted-foreground hover:text-foreground transition-colors">
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
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
    </div>
  );
}
