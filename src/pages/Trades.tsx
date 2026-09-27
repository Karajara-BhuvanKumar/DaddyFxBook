import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTrades, useAddTrade, useDeleteTrade, calculatePnl, Trade } from "@/hooks/useTrades";
import { Plus, Trash2, Activity, ArrowUpRight, ArrowDownRight, X, SlidersHorizontal, DollarSign, Share2, Pencil } from "lucide-react";
import { toast } from "sonner";
import TradeCard from "@/components/TradeCard";
import EditTradeModal from "@/components/EditTradeModal";
import ShareTradeModal from "@/components/ShareTradeModal";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";

/** Return current local time as YYYY-MM-DDThh:mm for datetime-local inputs. */
function localNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Trades() {
  const { data: trades = [], isLoading } = useTrades();
  const addTrade = useAddTrade();
  const deleteTrade = useDeleteTrade();
  const [showForm, setShowForm] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [sharingTrade, setSharingTrade] = useState<Trade | null>(null);
  const [form, setForm] = useState({
    direction: 'Long' as 'Long' | 'Short',
    entryPrice: '',
    exitPrice: '',
    lotSize: '0.1',
    openDate: localNow(),
    closeDate: localNow(),
  });

  const [filterDirection, setFilterDirection] = useState({ long: true, short: true });
  const [filterOutcome, setFilterOutcome] = useState({ profit: true, loss: true });
  const [filterDatePreset, setFilterDatePreset] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedSymbols, setSelectedSymbols] = useState<string[] | null>(null);
  const [sortOrder, setSortOrder] = useState('newest');

  const distinctSymbols = useMemo(() => Array.from(new Set(trades.map(t => t.symbol))).sort(), [trades]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (!filterDirection.long || !filterDirection.short) count++;
    if (!filterOutcome.profit || !filterOutcome.loss) count++;
    if (filterDatePreset !== 'all') count++;
    if (selectedSymbols !== null && selectedSymbols.length < distinctSymbols.length) count++;
    return count;
  }, [filterDirection, filterOutcome, filterDatePreset, selectedSymbols, distinctSymbols]);

  const resetFilters = () => {
    setFilterDirection({ long: true, short: true });
    setFilterOutcome({ profit: true, loss: true });
    setFilterDatePreset('all');
    setFilterDateRange({});
    setSelectedSymbols(null);
  };

  const filteredTrades = useMemo(() => {
    let result = trades.filter(t => {
      const isLong = t.direction === 'Long';
      if (!filterDirection.long && isLong) return false;
      if (!filterDirection.short && !isLong) return false;

      const isProfit = Number(t.pnl) >= 0;
      if (!filterOutcome.profit && isProfit) return false;
      if (!filterOutcome.loss && !isProfit) return false;

      if (filterDatePreset !== 'all') {
        const closeDate = new Date(t.close_time);
        closeDate.setHours(0, 0, 0, 0);

        if (filterDatePreset === '7d') {
          const limit = new Date();
          limit.setDate(limit.getDate() - 7);
          limit.setHours(0, 0, 0, 0);
          if (closeDate < limit) return false;
        } else if (filterDatePreset === '30d') {
          const limit = new Date();
          limit.setDate(limit.getDate() - 30);
          limit.setHours(0, 0, 0, 0);
          if (closeDate < limit) return false;
        } else if (filterDatePreset === 'month') {
          const today = new Date();
          if (closeDate.getMonth() !== today.getMonth() || closeDate.getFullYear() !== today.getFullYear()) return false;
        } else if (filterDatePreset === 'custom' && filterDateRange.from) {
          const from = new Date(filterDateRange.from);
          from.setHours(0, 0, 0, 0);
          if (closeDate < from) return false;
          if (filterDateRange.to) {
            const to = new Date(filterDateRange.to);
            to.setHours(23, 59, 59, 999);
            if (new Date(t.close_time) > to) return false;
          }
        }
      }

      if (selectedSymbols !== null && !selectedSymbols.includes(t.symbol)) {
        return false;
      }

      return true;
    });

    result = [...result].sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.close_time).getTime() - new Date(a.close_time).getTime();
      if (sortOrder === 'oldest') return new Date(a.close_time).getTime() - new Date(b.close_time).getTime();
      if (sortOrder === 'highest-pnl') return Number(b.pnl) - Number(a.pnl);
      if (sortOrder === 'lowest-pnl') return Number(a.pnl) - Number(b.pnl);
      return 0;
    });

    return result;
  }, [trades, filterDirection, filterOutcome, filterDatePreset, filterDateRange, selectedSymbols, sortOrder]);

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
      setForm({ direction: 'Long', entryPrice: '', exitPrice: '', lotSize: '0.1', openDate: localNow(), closeDate: localNow() });
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
          <button className="touch-target w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-[20px] font-bold text-[13px] transition-all duration-200">
            Connect MT4/MT5
          </button>
          <button onClick={handleClearAll} className="touch-target w-full sm:w-auto flex items-center justify-center gap-2 border border-loss/20 bg-card text-loss hover:bg-loss-tint px-5 py-2.5 rounded-[20px] font-semibold text-[13px] transition-all duration-200">
            <Trash2 className="w-4 h-4" /> Clear All
          </button>
          <button onClick={() => setShowForm(!showForm)} className="touch-target w-full sm:w-auto flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-[20px] font-bold text-[13px] transition-all duration-200">
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
                <input type="number" step="0.01" value={form[field.key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  placeholder={field.placeholder} className="w-full bg-input text-foreground border border-border rounded-[20px] px-4 py-3 text-base font-mono-num focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 placeholder:text-muted-foreground/50" required />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Open Date</label>
              <input type="datetime-local" value={form.openDate} onChange={e => setForm(f => ({ ...f, openDate: e.target.value }))}
                className="w-full bg-input text-foreground border border-border rounded-[20px] px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Close Date</label>
              <input type="datetime-local" value={form.closeDate} onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))}
                className="w-full bg-input text-foreground border border-border rounded-[20px] px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200" />
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
            <button type="button" onClick={() => setShowForm(false)} className="touch-target w-full sm:w-auto bg-secondary hover:bg-muted text-foreground px-6 py-3 rounded-[20px] font-semibold text-base border border-border transition-all duration-200">Cancel</button>
          </div>
        </form>
      )}

      {/* Trades Table / Cards */}
      <div className="surface-card overflow-hidden p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h3 className="text-base sm:text-[18px] font-bold text-foreground tracking-tight">Trade History</h3>
            <span className="text-[13px] text-muted-foreground font-medium">{filteredTrades.length} of {trades.length} trades</span>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button className="touch-target w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-[20px] border border-border text-muted-foreground hover:text-foreground text-[13px] font-semibold bg-secondary hover:bg-muted transition-all">
                <SlidersHorizontal className="w-3.5 h-3.5" /> 
                Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                {activeFilterCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-1" />}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] max-w-sm p-4 overflow-y-auto max-h-[80vh] rounded-[20px] bg-card border-border shadow-lg" align="end">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-foreground text-sm">Filters</h4>
                  {activeFilterCount > 0 && (
                    <button onClick={resetFilters} className="text-[12px] font-semibold text-primary hover:text-primary/80 transition-colors">
                      Clear filters
                    </button>
                  )}
                </div>
                
                <div className="space-y-3">
                  <h5 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Direction</h5>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-[13px] font-semibold text-foreground cursor-pointer">
                      <Checkbox checked={filterDirection.long} onCheckedChange={(c) => setFilterDirection(prev => ({...prev, long: !!c}))} />
                      Long
                    </label>
                    <label className="flex items-center gap-2 text-[13px] font-semibold text-foreground cursor-pointer">
                      <Checkbox checked={filterDirection.short} onCheckedChange={(c) => setFilterDirection(prev => ({...prev, short: !!c}))} />
                      Short
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <h5 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Outcome</h5>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-[13px] font-semibold text-foreground cursor-pointer">
                      <Checkbox checked={filterOutcome.profit} onCheckedChange={(c) => setFilterOutcome(prev => ({...prev, profit: !!c}))} />
                      Profit
                    </label>
                    <label className="flex items-center gap-2 text-[13px] font-semibold text-foreground cursor-pointer">
                      <Checkbox checked={filterOutcome.loss} onCheckedChange={(c) => setFilterOutcome(prev => ({...prev, loss: !!c}))} />
                      Loss
                    </label>
                  </div>
                </div>

                {distinctSymbols.length > 1 && (
                  <div className="space-y-3">
                    <h5 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Symbol</h5>
                    <div className="grid grid-cols-2 gap-3">
                      {distinctSymbols.map(sym => {
                        const isChecked = selectedSymbols === null ? true : selectedSymbols.includes(sym);
                        return (
                          <label key={sym} className="flex items-center gap-2 text-[13px] font-semibold text-foreground cursor-pointer">
                            <Checkbox 
                              checked={isChecked} 
                              onCheckedChange={(c) => {
                                let next = selectedSymbols === null ? [...distinctSymbols] : [...selectedSymbols];
                                if (c) {
                                  if (!next.includes(sym)) next.push(sym);
                                } else {
                                  next = next.filter(s => s !== sym);
                                }
                                setSelectedSymbols(next.length === distinctSymbols.length ? null : next);
                              }} 
                            />
                            {sym}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h5 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Date Range</h5>
                  <div className="flex flex-wrap gap-2">
                    {['all', '7d', '30d', 'month', 'custom'].map(preset => {
                      const labels: Record<string, string> = { all: 'All time', '7d': 'Last 7 days', '30d': 'Last 30 days', month: 'This month', custom: 'Custom' };
                      return (
                        <button
                          key={preset}
                          onClick={() => setFilterDatePreset(preset)}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${filterDatePreset === preset ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
                        >
                          {labels[preset]}
                        </button>
                      );
                    })}
                  </div>
                  {filterDatePreset === 'custom' && (
                    <div className="pt-2 flex justify-center">
                      <Calendar
                        mode="range"
                        selected={filterDateRange as import("react-day-picker").DateRange}
                        onSelect={(range: import("react-day-picker").DateRange | undefined) => setFilterDateRange(range || {})}
                        className="rounded-xl border border-border"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h5 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Sort By</h5>
                  <select
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value)}
                    className="w-full bg-input text-foreground border border-border rounded-[20px] px-4 py-2 text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="highest-pnl">Highest P&L</option>
                    <option value="lowest-pnl">Lowest P&L</option>
                  </select>
                </div>

              </div>
            </PopoverContent>
          </Popover>
        </div>



        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {trades.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No trades yet. Click "+ Add Trade" to get started.</p>
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium mb-3">No trades match these filters.</p>
              <button onClick={resetFilters} className="text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors">Clear filters</button>
            </div>
          ) : (
            filteredTrades.map(t => (
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
                  <th key={h} className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-4 py-4 text-left border-b border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted-foreground py-16">
                    <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No trades yet. Click "+ Add Trade" to get started.</p>
                  </td>
                </tr>
              ) : filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted-foreground py-16">
                    <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium mb-3">No trades match these filters.</p>
                    <button onClick={resetFilters} className="text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors">Clear filters</button>
                  </td>
                </tr>
              ) : (
                filteredTrades.map(t => (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors group border-b border-border last:border-0">
                    <td className="px-4 py-5 text-left">
                      <div className="text-[12px] text-muted-foreground font-medium space-y-1">
                        <div>Open: {formatDate(t.open_time)}</div>
                        <div>Close: {formatDate(t.close_time)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-sm shadow-amber-500/20">
                          <DollarSign className="w-3.5 h-3.5 text-black stroke-[3]" />
                        </div>
                        <span className="font-bold text-foreground text-[14px]">{t.symbol}</span>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-left">
                      <span className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 ${t.direction === 'Long' ? 'bg-profit-tint text-profit' : 'bg-loss-tint text-loss'
                        }`}>
                        {t.direction === 'Long' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {t.direction}
                      </span>
                    </td>
                    <td className="px-4 py-5 text-left font-bold text-[14px] text-foreground">${Number(t.entry_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-5 text-left font-bold text-[14px] text-foreground">${Number(t.exit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-5 text-left font-semibold text-[14px] text-foreground/80">{t.lot_size}</td>
                    <td className={`px-4 py-5 text-left font-black text-[15px] ${Number(t.pnl) >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {Number(t.pnl) >= 0 ? '+' : '-'}${Math.abs(Number(t.pnl)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-5 text-left">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-purple-500/10 text-purple-400">
                        <Pencil className="w-3 h-3" /> Manual
                      </span>
                    </td>
                    <td className="px-4 py-5 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingTrade(t)}
                          className="touch-target flex items-center justify-center text-primary hover:brightness-125 transition-all min-w-[44px] min-h-[44px]"
                          aria-label="Edit Trade"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setSharingTrade(t)}
                          className="touch-target flex items-center justify-center text-primary hover:brightness-125 transition-all min-w-[44px] min-h-[44px]"
                          aria-label="Share Trade"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(t.id)} 
                          className="touch-target flex items-center justify-center text-loss hover:brightness-125 transition-all min-w-[44px] min-h-[44px]"
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
