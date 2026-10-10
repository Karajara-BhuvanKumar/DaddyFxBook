import TradeDateTimePicker from '@/components/TradeDateTimePicker';
import { holdingDuration, formatHoldingDuration, localTimeZone } from '@/lib/holdingTime';
import LoadError from '@/components/LoadError';
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toUtcTimestamp } from "@/lib/tradeTimestamps";
import { useTrades, useAddTrade, useDeleteTrade, useDeleteTrades, calculatePnl, Trade, useAllJournals } from "@/hooks/useTrades";
import { Plus, Trash2, Activity, ArrowUpRight, ArrowDownRight, X } from "lucide-react";
import { toast } from "sonner";
import TradeHistory from "@/components/TradeHistory";
import EditTradeModal from "@/components/EditTradeModal";
import ShareTradeModal from "@/components/ShareTradeModal";
/** Return current local time as YYYY-MM-DDThh:mm for datetime-local inputs. */
function localNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Main Component ────────────────────────────────────────────
export default function Trades() {
  const { data: trades = [], isLoading, isError, refetch } = useTrades();
  const addTrade = useAddTrade();
  const deleteTrade = useDeleteTrade();
  const deleteTrades = useDeleteTrades();
  const [clearing, setClearing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [sharingTrade, setSharingTrade] = useState<Trade | null>(null);
  const { data: journals = [] } = useAllJournals();
  const historyTrades = useMemo(() => {
    const notes = new Map(journals.map(j => [j.trade_id, [j.pre_trade_notes, j.post_trade_notes].filter(Boolean).join('\n\n')]));
    return trades.map(t => ({ ...t, notes: notes.get(t.id) || '' }));
  }, [trades, journals]);
  const [form, setForm] = useState({
    direction: 'Long' as 'Long' | 'Short',
    entryPrice: '',
    exitPrice: '',
    lotSize: '0.1',
    riskPct: '',
    openDate: localNow(),
    closeDate: localNow(),
  });

  // Auto-open form when navigated with ?add=true
  useEffect(() => {
    if (searchParams.get("add") === "true") {
      setShowForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
      await addTrade.mutateAsync({ symbol: 'XAUUSD', risk_pct: form.riskPct.trim() ? Number(form.riskPct) : null, direction: form.direction, entry_price: entry, exit_price: exit, lot_size: lot, open_time: toUtcTimestamp(form.openDate), close_time: toUtcTimestamp(form.closeDate) });
      toast.success("Trade added!");
      setShowForm(false);
      setForm({ direction: 'Long', entryPrice: '', exitPrice: '', lotSize: '0.1', riskPct: '', openDate: localNow(), closeDate: localNow() });
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleDelete(id: string) {
    try { await deleteTrade.mutateAsync(id); toast.success("Trade deleted"); } catch (err: any) { toast.error(err.message); }
  }

  async function handleClearAll() {
    if (clearing || !trades.length) return;
    if (window.confirm("Are you sure you want to clear all trades? This cannot be undone.")) {
      setClearing(true);
      try {
        await deleteTrades.mutateAsync(trades.map(t => t.id));
        toast.success("All trades cleared!");
      } catch (err: any) {
        toast.error("Some trades could not be deleted. The list shows the remaining trades; please try again.");
      } finally { setClearing(false); }
    }
  }

  if (isError) return <LoadError name="your trades" retry={refetch} />;

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex items-center gap-3 text-muted-foreground"><Activity className="w-5 h-5 animate-pulse" /><span className="text-base font-medium">Loading trades...</span></div>
    </div>
  );

  return (
    <div className="trades-page space-y-6 md:space-y-8 overflow-guard">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-title text-foreground hidden lg:block">Trades</h1>
          <div className="flex items-center gap-2 mt-0 lg:mt-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            <span className="text-[13px] text-muted-foreground dark:text-zinc-500 font-semibold tracking-wide">Manual trade entry</span>
          </div>
        </div>
        <div className="trades-page-actions flex flex-col sm:flex-row gap-2 sm:gap-3 w-full lg:w-auto">
          <button disabled title="Broker sync is not available yet. Add trades manually." className="touch-target disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-[20px] font-bold text-[13px] transition-all duration-200">
            MT4/MT5 · Coming soon
          </button>
          <button onClick={handleClearAll} disabled={clearing || trades.length === 0} className="touch-target w-full sm:w-auto flex items-center justify-center gap-2 border border-loss/20 bg-card text-loss hover:bg-loss-tint px-5 py-2.5 rounded-[20px] font-semibold text-[13px] transition-all duration-200">
            <Trash2 className="w-4 h-4" /> {clearing ? "Clearing…" : "Clear All"}
          </button>
          <button disabled={clearing} aria-expanded={showForm} onClick={() => setShowForm(!showForm)} className="touch-target w-full sm:w-auto flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-[20px] font-bold text-[13px] transition-all duration-200">
            <Plus className="w-4 h-4" /> Add Trade
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card rounded-[20px] p-6 space-y-5 animate-fade-up">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground">New XAUUSD Trade</h3>
            <button type="button" aria-label="Close new trade form" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex gap-2">
            {(['Long', 'Short'] as const).map(d => (
              <button key={d} type="button" aria-pressed={form.direction === d} onClick={() => setForm(f => ({ ...f, direction: d }))}
                className={`flex-1 py-3 rounded-[20px] font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 ${form.direction === d
                    ? (d === 'Long' ? 'btn-premium text-primary-foreground' : 'bg-loss text-primary-foreground shadow-[0_4px_14px_-3px_hsl(0,84%,60%,0.5)]')
                    : 'bg-card text-foreground border border-border hover:bg-secondary'
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
                <input aria-label={field.label} type="number" min="0.01" step="0.01" value={form[field.key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  placeholder={field.placeholder} className="w-full bg-input text-foreground border border-border rounded-[20px] px-4 py-3 text-base font-mono-num focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 placeholder:text-muted-foreground dark:placeholder:text-muted-foreground/50" required />
              </div>
            ))}
            <div>
              <label htmlFor="new-risk-pct" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Recorded risk (%)</label>
              <input id="new-risk-pct" type="number" min="0" max="100" step="any" value={form.riskPct} onChange={e => setForm(f => ({ ...f, riskPct: e.target.value }))} placeholder="Not recorded" className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm" />
              <p className="text-xs text-muted-foreground mt-1">Account equity risked at entry. Leave blank if unknown.</p>
            </div>
            <TradeDateTimePicker label="Open Date & Time" value={form.openDate} onChange={openDate => setForm(f => ({ ...f, openDate }))} />
                <TradeDateTimePicker label="Close Date & Time" value={form.closeDate} onChange={closeDate => setForm(f => ({ ...f, closeDate }))} />
                <div className="sm:col-span-2 text-xs text-muted-foreground" aria-live="polite">Holding duration: <strong className="text-foreground">{formatHoldingDuration(holdingDuration({ open_time: form.openDate, close_time: form.closeDate }))}</strong><span className="block mt-1">Local time · {localTimeZone()}. Close must be on or after open.</span></div>
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
            <button type="button" onClick={() => setShowForm(false)} className="touch-target w-full sm:w-auto bg-secondary hover:bg-muted text-foreground px-6 py-3 rounded-[20px] font-semibold text-base border border-border transition-all duration-200">Cancel</button>
          </div>
        </form>
      )}

      <TradeHistory trades={historyTrades} onEdit={setEditingTrade} onShare={setSharingTrade} onDelete={handleDelete} />

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
