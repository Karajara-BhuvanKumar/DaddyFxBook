import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2, AlertCircle, Image } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { fetchExportData, resolveExportScreenshots } from '@/hooks/useTrades';
import { DEFAULT_EXPORT_FIELDS, DEFAULT_JOURNAL_FILTERS, EXPORT_FIELDS, filterJournalTrades, selectJournalExport, type ExportData, type ExportScope, type JournalFilters } from '@/lib/journalExport';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const FORMATS = [
  { id: 'pdf', label: 'PDF', detail: 'Journal report', icon: FileText },
  { id: 'xlsx', label: 'Excel', detail: 'Analyze your data', icon: FileSpreadsheet },
  { id: 'csv', label: 'CSV', detail: 'Portable data', icon: FileSpreadsheet },
  { id: 'docx', label: 'Word', detail: 'Editable document', icon: FileText },
] as const;
const SCOPES: { id: ExportScope; label: string; detail: string }[] = [
  { id: 'current', label: 'Current Trade', detail: 'The journal you have open' },
  { id: 'journaled', label: 'All Journaled Trades', detail: 'Trades with a saved journal' },
  { id: 'all', label: 'All Trades', detail: 'Journaled and pending trades' },
  { id: 'selected', label: 'Selected Trades', detail: 'Choose individual entries below' },
];
const EMPTY: ExportData = { trades: [], journals: [], checklists: [], screenshots: [] };

export function ExportJournalDialog({ currentTradeId = null, filters = DEFAULT_JOURNAL_FILTERS }: { currentTradeId?: string | null; filters?: JournalFilters }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ExportScope>('current');
  const [format, setFormat] = useState('pdf');
  const [fields, setFields] = useState({ ...DEFAULT_EXPORT_FIELDS });
  const [data, setData] = useState<ExportData>(EMPTY);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applyFilters, setApplyFilters] = useState(true);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError(''); setData(EMPTY);
    if (!userId) { setLoading(false); setError('Sign in to export your journal.'); return; }
    fetchExportData(userId).then(result => { if (active) setData(result); })
      .catch(() => { if (active) setError('We could not load your complete journal. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, userId, retry]);
  const filtered = useMemo(() => applyFilters ? filterJournalTrades(data.trades, data.journals, filters) : data.trades, [data, filters, applyFilters]);
  const exportData = useMemo(() => selectJournalExport(data, scope, currentTradeId, selectedIds, applyFilters ? filters : undefined), [data, scope, currentTradeId, selectedIds, applyFilters, filters]);
  const candidates = filtered.filter(t => t.symbol.toLowerCase().includes(search.trim().toLowerCase()));
  const count = exportData.trades.length;
  const hasFields = Object.values(fields).some(Boolean);
  const filtersActive = filters.status !== 'ALL' || filters.days !== 'all' || !!filters.search.trim();
  const dateLabel = filters.days === 'all' ? 'All time' : filters.days === 'custom' ? `${filters.start || 'Any date'} to ${filters.end || 'Any date'}` : `Last ${filters.days} days`;
  const toggle = (id: string) => setSelectedIds(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  async function download() {
    if (!count || !hasFields || busy || loading || error) return;
    setBusy(true); setProgress('Preparing your journal…');
    try {
      const exporters = await import('@/lib/exportUtils');
      const options = { includeFields: fields };
      let missing = 0;
      if (format === 'pdf') {
        setProgress('Preparing report and screenshots…');
        const report = fields.screenshots ? await resolveExportScreenshots(exportData) : exportData;
        missing = await exporters.exportToPDF(report, options);
      } else if (format === 'xlsx') exporters.exportToExcel(exportData, options);
      else if (format === 'csv') exporters.exportToCSV(exportData, options);
      else await exporters.exportToWord(exportData, options);
      if (missing) toast.warning(`Report downloaded. ${missing} screenshot${missing === 1 ? ' was' : 's were'} unavailable; their references are included.`);
      else toast.success(`Exported ${count} trade${count === 1 ? '' : 's'} as ${format === 'xlsx' ? 'Excel' : format.toUpperCase()}.`);
      setOpen(false);
    } catch {
      setProgress('Export failed. Your journal is unchanged. Please try again.');
    } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!busy) { setOpen(value); setProgress(''); if (value) setScope(currentTradeId ? 'current' : 'all'); } }}>
    <DialogTrigger asChild><Button className="min-h-11 gap-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"><Download className="h-4 w-4" />Export Journal</Button></DialogTrigger>
    <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-border dark:border-white/10 bg-card dark:bg-[#0b0b0b] p-0 text-foreground sm:rounded-2xl sm:p-0" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}>
      <DialogHeader className="shrink-0 border-b border-border dark:border-white/[0.08] p-5 pr-12 text-left sm:p-6">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-blue-400"><Download className="h-4 w-4" /> YOUR TRADING RECORD</div>
        <DialogTitle className="text-xl font-bold">Export Journal</DialogTitle>
        <DialogDescription className="leading-relaxed">Your trades, decisions, and lessons in one complete export.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
        {loading ? <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading complete journal…</div> : error ? <div role="alert" className="space-y-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm"><AlertCircle className="h-5 w-5 text-red-700 dark:text-red-400" /><p>{error}</p><Button variant="outline" onClick={() => setRetry(v => v + 1)}>Try again</Button></div> : <fieldset disabled={busy} className="min-w-0 space-y-6 disabled:opacity-70">
          <fieldset className="min-w-0"><legend className="mb-3 text-sm font-semibold">1. Choose trades</legend>
            <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
              {SCOPES.map(item => {
                const amount = selectJournalExport(data, item.id, currentTradeId, selectedIds, applyFilters ? filters : undefined).trades.length;
                return <label key={item.id} className={cn('flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors', scope === item.id ? 'border-blue-500/60 bg-blue-500/10' : 'border-border dark:border-white/[0.08] bg-foreground/[0.025] dark:bg-white/[0.025] hover:bg-foreground/[0.05] dark:hover:bg-white/[0.05]', item.id === 'current' && !currentTradeId && 'cursor-not-allowed opacity-40')}>
                  <input type="radio" name="export-scope" value={item.id} checked={scope === item.id} disabled={item.id === 'current' && !currentTradeId} onChange={() => setScope(item.id)} className="mt-1 h-4 w-4 shrink-0 accent-blue-500" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.detail}</span></span><span className="rounded-md bg-foreground/5 dark:bg-white/5 px-1.5 py-0.5 text-xs tabular-nums text-blue-400">{amount}</span>
                </label>;
              })}
            </div>
          </fieldset>
          {scope !== 'current' && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border dark:border-white/[0.08] p-3 text-sm"><input type="checkbox" checked={applyFilters} onChange={e => setApplyFilters(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-500" /><span>Use current list filters<span className="mt-1 block text-xs text-muted-foreground">{filtersActive ? `${filters.status === 'ALL' ? 'All statuses' : filters.status === 'JOURNALED' ? 'Journaled' : 'Pending'} · ${dateLabel}${filters.search ? ` · ${filters.search}` : ''}` : 'All statuses · All time'}{!applyFilters && ' · Filters ignored'}</span></span></label>}
          {scope === 'selected' && <div className="space-y-2 rounded-xl border border-border dark:border-white/10 p-3">
            <input aria-label="Find trades to export" placeholder="Find a symbol…" value={search} onChange={e => setSearch(e.target.value)} className="h-11 w-full rounded-lg border border-border dark:border-white/10 bg-secondary px-3 text-sm" />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{count} selected for export</span><div className="flex gap-3"><button type="button" className="min-h-9 text-blue-400" onClick={() => setSelectedIds(new Set([...selectedIds, ...candidates.map(t => t.id)]))}>Select visible</button><button type="button" className="min-h-9 text-muted-foreground" onClick={() => setSelectedIds(new Set())}>Clear</button></div></div>
            <div className="max-h-48 overflow-y-auto">{candidates.length ? candidates.map(t => <label key={t.id} className="flex cursor-pointer items-center gap-3 border-t border-border dark:border-white/5 py-3"><input aria-label={`Select ${t.symbol} ${t.id}`} type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4 accent-blue-500" /><span className="min-w-0 flex-1 text-sm"><strong>{t.symbol}</strong><span className="block text-xs text-muted-foreground">{t.direction} · {new Date(t.open_time).toLocaleString()}</span></span><span className={cn('text-xs font-semibold', Number(t.pnl) >= 0 ? 'text-blue-400' : 'text-red-700 dark:text-red-400')}>{Number(t.pnl).toFixed(2)}</span></label>) : <p className="py-4 text-center text-sm text-muted-foreground">No trades match these filters.</p>}</div>
          </div>}
          <fieldset className="min-w-0"><legend className="mb-3 text-sm font-semibold">2. Export format</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{FORMATS.map(item => <label key={item.id} className={cn('relative cursor-pointer rounded-xl border p-3', format === item.id ? 'border-blue-500/60 bg-blue-500/10' : 'border-border dark:border-white/[0.08] bg-foreground/[0.025] dark:bg-white/[0.025]')}><input className="absolute right-3 top-3 h-4 w-4 accent-blue-500" type="radio" name="export-format" aria-label={item.label} checked={format === item.id} onChange={() => setFormat(item.id)} /><item.icon className="mb-3 h-5 w-5 text-blue-400" /><strong className="block text-sm">{item.label}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span></label>)}</div></fieldset>
          <details className="rounded-xl border border-border dark:border-white/[0.08] p-3"><summary className="cursor-pointer text-sm font-semibold">Included sections <span className="ml-2 text-xs font-normal text-muted-foreground">{Object.values(fields).filter(Boolean).length} of {EXPORT_FIELDS.length}</span></summary><div className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">{EXPORT_FIELDS.map(([id, label]) => <label key={id} className="flex min-h-10 cursor-pointer items-center gap-2 text-xs"><input type="checkbox" className="h-4 w-4 accent-blue-500" checked={fields[id]} onChange={e => setFields(previous => ({ ...previous, [id]: e.target.checked }))} />{label}</label>)}</div></details>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><Image className="mt-0.5 h-4 w-4 shrink-0" />{format === 'pdf' ? 'PDF embeds available screenshots. Unavailable images are identified in the report.' : 'Screenshots are included as original storage references. Choose PDF to embed images.'}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">Exports use saved journal data. Save any editor changes first. Dates in downloaded files use UTC.</p>
        </fieldset>}
      </div>
      <div className="shrink-0 space-y-3 border-t border-border dark:border-white/[0.08] bg-foreground/[0.02] dark:bg-white/[0.02] p-4 sm:px-6">
        <div aria-live="polite" className="text-sm"><span className="font-semibold">{loading ? 'Preparing trade count…' : `${count} trade${count === 1 ? '' : 's'} ready to export`}</span>{!loading && !error && !count && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{scope === 'selected' ? 'Select at least one trade to continue.' : 'No matching trades. Choose another scope or adjust your filters.'}</p>}{!hasFields && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Choose at least one section to include.</p>}</div>
        {progress && <p role="status" className="text-xs text-blue-300">{progress}</p>}
        <div className="flex gap-2"><Button variant="outline" className="min-h-11 rounded-xl border-border dark:border-white/10" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button className="min-h-11 flex-1 gap-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700" disabled={loading || !!error || busy || !count || !hasFields} onClick={download}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{busy ? 'Exporting…' : `Export ${count} trade${count === 1 ? '' : 's'}`}</Button></div>
      </div>
    </DialogContent>
  </Dialog>;
}
