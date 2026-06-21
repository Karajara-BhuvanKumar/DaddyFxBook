import { useState, useMemo } from "react";
import { useTrades, useAddTrade, useDeleteTrade, calculatePnl } from "@/hooks/useTrades";
import { Plus, Trash2, Activity, ArrowUpRight, ArrowDownRight, X } from "lucide-react";
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
          <p className="text-base text-muted-foreground mt-1 font-medium">{trades.length} trades recorded</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-secondary/60 text-secondary-foreground px-4 py-2.5 rounded-xl font-semibold text-sm border border-border hover:bg-accent/60 transition-all duration-200 opacity-50 cursor-not-allowed">
            Connect MT4/MT5
          </button>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 btn-premium text-primary-foreground px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200">
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
                className={`flex-1 py-3 rounded-xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 ${
                  form.direction === d
                    ? (d === 'Long' ? 'btn-premium text-primary-foreground' : 'bg-loss text-primary-foreground shadow-[0_4px_14px_-3px_hsl(0,84%,60%,0.5)]')
                    : 'bg-secondary/60 text-secondary-foreground border border-border hover:bg-accent/60'
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
                  placeholder={field.placeholder} className="w-full bg-secondary/60 text-foreground border border-border rounded-xl px-4 py-3 text-base font-mono-num focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 placeholder:text-muted-foreground/40" required />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Open Date</label>
              <input type="datetime-local" value={form.openDate} onChange={e => setForm(f => ({ ...f, openDate: e.target.value }))}
                className="w-full bg-secondary/60 text-foreground border border-border rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Close Date</label>
              <input type="datetime-local" value={form.closeDate} onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))}
                className="w-full bg-secondary/60 text-foreground border border-border rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200" />
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
            <button type="button" onClick={() => setShowForm(false)} className="bg-secondary/60 text-secondary-foreground px-6 py-3 rounded-xl font-semibold text-base border border-border hover:bg-accent/60 transition-all duration-200">Cancel</button>
          </div>
        </form>
      )}

      {/* Trades Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60">
                {['Date', 'Symbol', 'Type', 'Entry', 'Exit', 'Size', 'P&L', 'Source', ''].map(h => (
                  <th key={h} className={`text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-4 ${['Entry', 'Exit', 'Size', 'P&L'].includes(h) ? 'text-right' : h === 'Source' ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-muted-foreground py-16">
                  <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-base font-medium">No trades yet. Click "Add Trade" to get started.</p>
                </td></tr>
              ) : (
                trades.map(t => (
                  <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/30 transition-all duration-150 group">
                    <td className="px-5 py-4">
                      <p className="text-sm text-foreground font-medium">{new Date(t.open_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      <p className="text-xs text-muted-foreground">{new Date(t.close_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center text-xs">🥇</div>
                        <span className="font-semibold text-foreground text-base">{t.symbol}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 ${
                        t.direction === 'Long' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-loss/10 text-loss border border-loss/20'
                      }`}>
                        {t.direction === 'Long' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {t.direction}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-mono-num text-base text-foreground">${Number(t.entry_price).toFixed(2)}</td>
                    <td className="px-5 py-4 text-right font-mono-num text-base text-foreground">${Number(t.exit_price).toFixed(2)}</td>
                    <td className="px-5 py-4 text-right text-base text-foreground font-medium">{t.lot_size}</td>
                    <td className="px-5 py-4 text-right">
                      <span className={`font-bold font-mono-num text-base px-2.5 py-1 rounded-lg ${Number(t.pnl) >= 0 ? 'text-profit bg-profit/8' : 'text-loss bg-loss/8'}`}>
                        {Number(t.pnl) >= 0 ? '+' : ''}${Number(t.pnl).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-xs bg-secondary/60 text-secondary-foreground px-2.5 py-1 rounded-lg font-medium border border-border/50">{t.source}</span>
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => handleDelete(t.id)} className="text-muted-foreground/40 hover:text-loss transition-all duration-200 opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
