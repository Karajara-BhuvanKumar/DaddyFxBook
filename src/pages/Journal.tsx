import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LoadError from '@/components/LoadError';
import { journalDrafts, readCustomChecklist, serializeJournalSetup } from '@/lib/journalDrafts';
import { useState, useEffect, useRef, useMemo } from "react";
import { useTrades, useJournal, useSaveJournal, useChecklist, useSaveChecklist, useScreenshots, useUploadScreenshot, useAllJournals } from "@/hooks/useTrades";
import { BookOpen, Save, Star, Check, Activity, ArrowLeft, Search, ArrowUpRight, ArrowDownRight, RefreshCw, FileText, SlidersHorizontal, DollarSign, Smile, Tag, Image, Plus, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AITradeReviewPanel } from "@/components/ai-report/AITradeReviewPanel";
import { StrategySetupCard } from "@/components/journal/StrategySetupCard";
import { ExportJournalDialog } from "@/components/journal/ExportJournalDialog";
import { emptyStrategySetup, parseStrategySetup, type StrategySetup } from "@/lib/strategySetup";
import { cn } from "@/lib/utils";
import { filterJournalTrades } from '@/lib/journalExport';
import '@/styles/journal.css';
import { formatTradeDateTime, formatHoldingDuration, holdingDuration, localTimeZone } from '@/lib/holdingTime';

export default function Journal() {
  const { user } = useAuth();
  const tradesQuery = useTrades();
  const { data: trades = [], isLoading: isTradesLoading } = tradesQuery;
  const journalsQuery = useAllJournals();
  const { data: allJournals = [], isLoading: isJournalsLoading } = journalsQuery;
  const isLoading = isTradesLoading || isJournalsLoading;

  const [activeTab, setActiveTab] = useState<'ALL' | 'JOURNALED' | 'PENDING'>('ALL');
  const [search, setSearch] = useState('');
  const [days, setDays] = useState('all');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [sort, setSort] = useState('newest');
  const [mobileEditor, setMobileEditor] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const filters = useMemo(() => ({ search, days, start, end, sort, status: activeTab }), [search, days, start, end, sort, activeTab]);
  
  const journaledTradeIds = useMemo(() => new Set(allJournals.map(j => j.trade_id)), [allJournals]);
  const journaledTrades = useMemo(() => trades.filter(t => journaledTradeIds.has(t.id)), [trades, journaledTradeIds]);
  const pendingTrades = useMemo(() => trades.filter(t => !journaledTradeIds.has(t.id)), [trades, journaledTradeIds]);
  
  const displayedTrades = useMemo(() => filterJournalTrades(trades, allJournals, filters), [trades, allJournals, filters]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const journalQuery = useJournal(selectedId);
  const { data: existingJournal } = journalQuery;
  const checklistQuery = useChecklist(selectedId);
  const { data: existingChecklist } = checklistQuery;
  const screenshotsQuery = useScreenshots(selectedId);
  const { data: screenshots = [] } = screenshotsQuery;
  const saveJournal = useSaveJournal();
  const saveChecklist = useSaveChecklist();
  const uploadScreenshot = useUploadScreenshot();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedTrade = trades.find(t => t.id === selectedId);
  const isWinner = selectedTrade ? Number(selectedTrade.pnl) >= 0 : true;
  const iconColor = isWinner ? "text-blue-500" : "text-red-700 dark:text-red-500";

  const [journal, setJournal] = useState({ pre_trade_notes: '', post_trade_notes: '', emotions: '', lessons: '', tags: '', rating: 5, risk_reward: '' });
  const [strategySetup, setStrategySetup] = useState<StrategySetup>(emptyStrategySetup);
  const [checklist, setChecklist] = useState({ checked_higher_tf: false, risk_within_limits: false, fits_plan: false, key_levels: false, news_checked: false });
  const [customChecklist, setCustomChecklist] = useState<{ id: string; label: string; checked: boolean }[]>([]);
  const [newCustomLabel, setNewCustomLabel] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState('');
  const [saving, setSaving] = useState(false);
  const snapshot = JSON.stringify({ journal, strategySetup, checklist, customChecklist });
  const draftKey = `${user?.id}:${selectedId}`;
  const dirty = loadedId === selectedId && !!baseline && baseline !== snapshot;
  const editorLoading = journalQuery.isLoading || checklistQuery.isLoading || loadedId !== selectedId;
  useEffect(() => {
    if (!selectedId || loadedId !== selectedId || !baseline) return;
    if (dirty) journalDrafts.set(draftKey, { snapshot, baseline });
    else journalDrafts.delete(draftKey);
  }, [snapshot, baseline, dirty, draftKey, loadedId, selectedId]);
  useEffect(() => {
    if (mobileEditor) {
      editorRef.current?.scrollTo({ top: 0 });
      if (window.innerWidth < 1280) editorRef.current?.focus({ preventScroll: true });
    }
  }, [selectedId, mobileEditor]);

  useEffect(() => { 
    if (saving) return;
    if (selectedId && journalDrafts.has(`${user?.id}:${selectedId}`) && trades.some(t => t.id === selectedId)) return;
    if (displayedTrades.length > 0 && (!selectedId || !displayedTrades.some(t => t.id === selectedId))) {
      setSelectedId(displayedTrades[0].id); 
    } else if (displayedTrades.length === 0) {
      setSelectedId(null);
    }
  }, [displayedTrades, selectedId, saving, trades, user?.id]);

  useEffect(() => {
    if (!selectedId || loadedId === selectedId || !journalQuery.isSuccess || !checklistQuery.isSuccess) return;
    const saved = {
      journal: { pre_trade_notes: existingJournal?.pre_trade_notes || '', post_trade_notes: existingJournal?.post_trade_notes || '', emotions: existingJournal?.emotions || '', lessons: existingJournal?.lessons || '', tags: existingJournal?.tags || '', rating: existingJournal?.rating ?? 5, risk_reward: existingJournal?.risk_reward || '' },
      strategySetup: parseStrategySetup(existingJournal?.strategy_setup),
      checklist: { checked_higher_tf: existingChecklist?.checked_higher_tf || false, risk_within_limits: existingChecklist?.risk_within_limits || false, fits_plan: existingChecklist?.fits_plan || false, key_levels: existingChecklist?.key_levels || false, news_checked: existingChecklist?.news_checked || false },
      customChecklist: readCustomChecklist(existingJournal?.strategy_setup),
    };
    const draft = journalDrafts.get(draftKey);
    const values = draft ? JSON.parse(draft.snapshot) as typeof saved : saved;
    setJournal(values.journal); setStrategySetup(values.strategySetup); setChecklist(values.checklist); setCustomChecklist(values.customChecklist);
    setBaseline(draft?.baseline || JSON.stringify(saved));
    setLoadedId(selectedId); setNewCustomLabel('');
  }, [selectedId, loadedId, draftKey, existingJournal, existingChecklist, journalQuery.isSuccess, checklistQuery.isSuccess]);

  async function refreshJournal() {
    if (saving || (dirty && !window.confirm('Discard unsaved changes and reload this journal?'))) return;
    const results = await Promise.all([journalQuery.refetch(), checklistQuery.refetch(), screenshotsQuery.refetch()]);
    if (results.some(result => result.isError)) { toast.error('Could not refresh the journal. Your draft is still available.'); return; }
    journalDrafts.delete(draftKey); setLoadedId(null);
    toast.success('Journal refreshed');
  }

  const formatJournalDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const year = d.getFullYear();
    const time = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    return `${month} ${day}, ${year}, ${time}`;
  };

  async function handleSave() {
    if (!selectedId || editorLoading || saving) return;
    setSaving(true);
    try {
      await saveJournal.mutateAsync({ trade_id: selectedId, ...journal, strategy_setup: serializeJournalSetup(strategySetup, customChecklist) });
      await saveChecklist.mutateAsync({ trade_id: selectedId, ...checklist });
      setBaseline(snapshot); journalDrafts.delete(draftKey);
      toast.success("Journal saved!");
    } catch (err: any) { toast.error(err.message || "Could not save. Your draft has been kept; please retry."); }
    finally { setSaving(false); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedId) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { toast.error('Choose an image smaller than 10 MB.'); return; }
    try { await uploadScreenshot.mutateAsync({ tradeId: selectedId, file }); toast.success("Screenshot uploaded!"); } catch (err: any) { toast.error(err.message); }
  }

  const handleAddCustomChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomLabel.trim()) return;
    setCustomChecklist(c => [...c, { id: crypto.randomUUID(), label: newCustomLabel.trim(), checked: false }]);
    setNewCustomLabel("");
  };

  const toggleCustomChecklist = (id: string) => {
    setCustomChecklist(c => c.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const deleteCustomChecklist = (id: string) => {
    setCustomChecklist(c => c.filter(item => item.id !== id));
  };

  const checkCount = Object.values(checklist).filter(Boolean).length + customChecklist.filter(item => item.checked).length;
  const totalCheckCount = 5 + customChecklist.length;

  if (tradesQuery.isError || journalsQuery.isError) return <LoadError name="your journal" retry={() => Promise.all([tradesQuery.refetch(), journalsQuery.refetch()])} />;

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex items-center gap-3 text-muted-foreground"><Activity className="w-5 h-5 animate-pulse" /><span className="text-base font-medium">Loading journal...</span></div>
    </div>
  );

  return (
    <div className="journal-page">
      <div className="journal-toolbar">
        <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{journaledTrades.length}</span> journaled · {trades.length} trades</p>
        <ExportJournalDialog currentTradeId={selectedId} filters={filters} />
      </div>

      <div className={cn('journal-workspace', mobileEditor && 'journal-show-editor')}>
        {/* Trade list */}
        <div className="journal-list rounded-[20px] border border-border dark:border-white/[0.08] bg-card dark:bg-[#0B0B0B] overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 border-b border-border dark:border-white/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-foreground">Trade Journal</h3>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-border dark:border-white/[0.08] text-[10px] font-semibold text-muted-foreground bg-secondary hover:text-foreground transition-all">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-0.5" /> Saved trades
              </span>
            </div>
            <span className="text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/10 px-2 py-0.5 rounded-full">
              {trades.length} entries
            </span>
          </div>

          <div className="journal-tabs p-2 border-b border-border dark:border-white/[0.05] flex items-center gap-1.5 overflow-x-auto select-none">
            <button 
              onClick={() => setActiveTab('ALL')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all duration-200",
                activeTab === 'ALL'
                  ? "bg-secondary text-foreground border border-border dark:border-white/[0.08]"
                  : "bg-transparent text-muted-foreground hover:text-foreground border border-transparent"
              )}>
              ALL {trades.length}
            </button>
            <button 
              onClick={() => setActiveTab('JOURNALED')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all duration-200",
                activeTab === 'JOURNALED'
                  ? "bg-secondary text-foreground border border-border dark:border-white/[0.08]"
                  : "bg-transparent text-muted-foreground hover:text-foreground border border-transparent"
              )}>
              JOURNALED {journaledTrades.length}
            </button>
            <button 
              onClick={() => setActiveTab('PENDING')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all duration-200",
                activeTab === 'PENDING'
                  ? "bg-secondary text-foreground border border-border dark:border-white/[0.08]"
                  : "bg-transparent text-muted-foreground hover:text-foreground border border-transparent"
              )}>
              PENDING {pendingTrades.length}
            </button>
          </div>

          <div className="space-y-2 border-b border-border dark:border-white/5 p-3">
            <label className="flex h-11 items-center gap-2 rounded-xl border border-border dark:border-white/[0.08] bg-secondary px-3"><Search className="h-4 w-4 shrink-0 text-muted-foreground" /><input aria-label="Search journal symbol" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search symbol…" className="min-w-0 w-full bg-transparent text-sm outline-none" /></label>
            <div className="grid grid-cols-2 gap-2">
              <select aria-label="Journal date range" value={days} onChange={e => setDays(e.target.value)} className="min-w-0 h-11 rounded-xl border border-border dark:border-white/[0.08] bg-secondary px-2 text-xs"><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="custom">Custom dates</option></select>
              <select aria-label="Sort journals" value={sort} onChange={e => setSort(e.target.value)} className="min-w-0 h-11 rounded-xl border border-border dark:border-white/[0.08] bg-secondary px-2 text-xs"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="pnl">Highest P&L</option></select>
            </div>
            {days === 'custom' && <div className="space-y-2"><div className="grid grid-cols-2 gap-2"><label className="min-w-0 text-xs text-muted-foreground">From<input aria-label="Journal start date" type="date" value={start} onChange={e => setStart(e.target.value)} className="mt-1 h-11 w-full min-w-0 rounded-lg border border-border dark:border-white/10 bg-secondary px-1 text-xs" /></label><label className="min-w-0 text-xs text-muted-foreground">Through<input aria-label="Journal end date" type="date" min={start || undefined} value={end} onChange={e => setEnd(e.target.value)} className="mt-1 h-11 w-full min-w-0 rounded-lg border border-border dark:border-white/10 bg-secondary px-1 text-xs" /></label></div>{start && end && end < start && <p className="text-xs text-amber-700 dark:text-amber-400">End date must be on or after start date.</p>}</div>}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3 space-y-2">
            {displayedTrades.length === 0 ? (
              <p className="text-center text-muted-foreground dark:text-zinc-500 py-12 text-xs font-semibold">
                {trades.length === 0 ? "Add trades first" : "No trades found"}
              </p>
            ) : (
              displayedTrades.map(t => (
                <button key={t.id} aria-label={`Open ${t.symbol} journal`} aria-current={selectedId === t.id ? 'true' : undefined} disabled={saving} onClick={() => { setSelectedId(t.id); setMobileEditor(true); }}
                  className={cn(
                    "w-full text-left p-4 rounded-[20px] border transition-all duration-200 flex flex-col",
                    selectedId === t.id
                      ? 'bg-blue-600/[0.08] border-blue-600/[0.35]'
                      : 'bg-card dark:bg-[#0B0B0B] border-border dark:border-white/[0.06] hover:bg-foreground/[0.02] dark:hover:bg-white/[0.02]'
                  )}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-sm">
                        <DollarSign className="w-3 h-3 text-black stroke-[3]" />
                      </div>
                      <span className="font-bold text-foreground text-xs">{t.symbol}</span>
                    </div>
                    <span className="bg-muted text-[9px] text-muted-foreground font-bold px-1.5 py-0.5 rounded">
                      {journaledTradeIds.has(t.id) ? 'JOURNALED' : 'NEW'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs mt-2 font-semibold">
                    <span className={t.direction === 'Long' ? 'text-blue-500' : 'text-red-700 dark:text-red-500'}>{t.direction}</span>
                    <span className="text-muted-foreground">${Number(t.entry_price).toFixed(2)}</span>
                    <span className={Number(t.pnl) >= 0 ? 'text-profit' : 'text-loss'}>
                      {Number(t.pnl) >= 0 ? '+' : '-'}${Math.abs(Number(t.pnl)).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-semibold mt-2.5">
                    {formatJournalDate(t.open_time)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Journal editor */}
        <div
          ref={editorRef}
          tabIndex={-1}
          aria-label="Selected trade journal"
          className={cn(
            "journal-editor flex-1 min-w-0 rounded-3xl border p-4 sm:p-6 overflow-auto shadow-[0_4px_20px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.35)] relative",
            "bg-card dark:bg-[#0B0B0B] border-border dark:border-white/[0.06]",
          )}
        >
          {selectedTrade && (journalQuery.isError || checklistQuery.isError) ? <LoadError name="this journal" retry={() => Promise.all([journalQuery.refetch(), checklistQuery.refetch()])} /> : selectedTrade && editorLoading ? <p role="status">Loading journal details…</p> : selectedTrade ? (
            <fieldset disabled={saving} className="min-w-0 space-y-5 md:space-y-6 animate-fade-up">
              <button onClick={() => { setMobileEditor(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.journal-list [aria-current="true"]')?.focus({ preventScroll: true })); }} className="journal-back min-h-11 items-center gap-2 rounded-xl border border-border dark:border-white/10 bg-secondary px-3 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Trade Journal</button>
              <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-4 border-b border-border dark:border-white/[0.05] pb-4 md:pb-5">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-sm shrink-0">
                    <DollarSign className="w-4 h-4 text-black stroke-[3]" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{selectedTrade.symbol}</h2>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0",
                    isWinner
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-500/20'
                      : 'bg-red-500/10 text-red-700 dark:text-red-500 border-red-500/20'
                  )}>
                    {Number(selectedTrade.pnl) === 0 ? 'BREAK-EVEN' : isWinner ? 'WINNER' : 'LOSER'}
                  </span>
                </div>
                <div className="journal-actions flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
                  <button onClick={refreshJournal} disabled={journalQuery.isFetching || checklistQuery.isFetching} aria-label="Refresh journal" className="touch-target inline-flex items-center justify-center h-11 w-11 shrink-0 border border-border dark:border-white/[0.08] p-2 rounded-[20px] text-muted-foreground hover:text-foreground bg-secondary hover:bg-muted transition-all">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button onClick={() => { const review = document.getElementById("journal-ai-review"); review?.scrollIntoView({ behavior: "smooth", block: "start" }); review?.focus({ preventScroll: true }); }} className="touch-target inline-flex items-center justify-center h-11 gap-1.5 border border-border dark:border-white/[0.08] px-3 sm:px-4 py-2 rounded-[20px] text-xs leading-none font-semibold text-muted-foreground hover:text-foreground bg-secondary hover:bg-muted transition-all">
                    <FileText className="w-3.5 h-3.5" /> <span>Report</span>
                  </button>
                  <Link to="/analysis" className="touch-target inline-flex items-center justify-center h-11 gap-1.5 border border-border dark:border-white/[0.08] px-3 sm:px-4 py-2 rounded-[20px] text-xs leading-none font-semibold text-muted-foreground hover:text-foreground bg-secondary hover:bg-muted transition-all">
                    <SlidersHorizontal className="w-3.5 h-3.5" /> <span>Analytics</span>
                  </Link>
                  <button onClick={handleSave} disabled={saving || editorLoading}
                    className={cn(
                      "touch-target inline-flex items-center justify-center h-11 w-full sm:w-auto text-white font-bold px-6 py-2 rounded-[20px] text-xs leading-none transition-all disabled:opacity-50 shadow-sm min-h-[44px]",
                      isWinner ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"
                    )}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              <p role="status" className="text-xs text-muted-foreground">{dirty ? "Unsaved changes · Draft kept while you browse this tab" : "All changes saved"}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground font-semibold mb-4 md:mb-6">
                <span className={selectedTrade.direction === 'Long' ? 'text-blue-500' : 'text-red-700 dark:text-red-500'}>{selectedTrade.direction}</span>
                <span>·</span>
                <span>Entry ${Number(selectedTrade.entry_price).toFixed(2)}</span>
                <span>·</span>
                <span>Size {selectedTrade.lot_size}</span>
                <span>·</span>
                <span>Held {formatHoldingDuration(holdingDuration(selectedTrade))}</span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-border bg-secondary/40 p-4 text-xs">
                <div><dt className="text-muted-foreground mb-1">Open date & time</dt><dd className="font-semibold">{formatTradeDateTime(selectedTrade.open_time)}</dd></div>
                <div><dt className="text-muted-foreground mb-1">Close date & time</dt><dd className="font-semibold">{formatTradeDateTime(selectedTrade.close_time)}</dd></div>
                <div><dt className="text-muted-foreground mb-1">Holding duration</dt><dd className="font-semibold">{formatHoldingDuration(holdingDuration(selectedTrade))}</dd></div>
                <div className="sm:col-span-3 text-muted-foreground">Local time · {localTimeZone()}</div>
              </dl>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Pre-Trade Analysis */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <FileText className={cn("w-3.5 h-3.5", iconColor)} /> Pre-Trade Analysis
                </label>
                <textarea aria-label="Pre-Trade Analysis" value={journal.pre_trade_notes} onChange={e => setJournal(j => ({ ...j, pre_trade_notes: e.target.value }))}
                  placeholder="What did you see? Plan, thesis, levels, risk..."
                  className={cn(
                    "w-full bg-input dark:bg-[#050505] text-foreground border border-border dark:border-white/[0.08] rounded-[20px] px-4 py-3.5 text-sm leading-relaxed focus:outline-none min-h-[100px] resize-y transition-all placeholder:text-muted-foreground dark:placeholder:text-muted-foreground/60 dark:placeholder:text-zinc-500",
                    "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
                  )} />
              </div>

              {/* Post-Trade Review */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className={cn("w-3.5 h-3.5", iconColor)} /> Post-Trade Review
                </label>
                <textarea aria-label="Post-Trade Review" value={journal.post_trade_notes} onChange={e => setJournal(j => ({ ...j, post_trade_notes: e.target.value }))}
                  placeholder="What happened? Execution, slippage, improvements..."
                  className={cn(
                    "w-full bg-input dark:bg-[#050505] text-foreground border border-border dark:border-white/[0.08] rounded-[20px] px-4 py-3.5 text-sm leading-relaxed focus:outline-none min-h-[100px] resize-y transition-all placeholder:text-muted-foreground dark:placeholder:text-muted-foreground/60 dark:placeholder:text-zinc-500",
                    "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
                  )} />
              </div>

              </div>
              {/* Risk Reward */}
              <div className={cn(
                "rounded-[20px] p-4 flex items-center justify-between transition-all duration-300 bg-card dark:bg-[#0B0B0B] border border-border dark:border-white/[0.06]"
              )}>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" /> Risk : Reward
                </span>
                <div className="flex items-center gap-2">
                  <input
                    aria-label="Risk" value={journal.risk_reward.split(':')[0] ?? ''}
                    onChange={e => setJournal(j => ({ ...j, risk_reward: `${e.target.value}:${j.risk_reward.split(':')[1] ?? ''}` }))}
                    placeholder="1"
                    className={cn(
                      "w-12 h-8 bg-input dark:bg-[#050505] text-foreground border border-border dark:border-white/[0.08] rounded-lg px-2 text-xs text-center font-bold focus:outline-none transition-all placeholder:text-muted-foreground dark:placeholder:text-muted-foreground/45 dark:placeholder:text-zinc-500",
                      "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
                    )} />
                  <span className="text-muted-foreground dark:text-zinc-400 dark:text-zinc-600 font-bold text-sm">:</span>
                  <input
                    aria-label="Reward" value={journal.risk_reward.split(':')[1] ?? ''}
                    onChange={e => setJournal(j => ({ ...j, risk_reward: `${j.risk_reward.split(':')[0] ?? ''}:${e.target.value}` }))}
                    placeholder="2"
                    className={cn(
                      "w-12 h-8 bg-input dark:bg-[#050505] text-foreground border border-border dark:border-white/[0.08] rounded-lg px-2 text-xs text-center font-bold focus:outline-none transition-all placeholder:text-muted-foreground dark:placeholder:text-muted-foreground/45 dark:placeholder:text-zinc-500",
                      "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
                    )} />
                </div>
              </div>

              {/* Emotions & Lessons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Smile className={cn("w-3.5 h-3.5", iconColor)} /> Emotions
                  </label>
                  <textarea aria-label="Emotions" value={journal.emotions} onChange={e => setJournal(j => ({ ...j, emotions: e.target.value }))} placeholder="Calm, anxious, FOMO, confident..."
                    className={cn(
                      "w-full bg-input dark:bg-[#050505] text-foreground border border-border dark:border-white/[0.08] rounded-[20px] px-4 py-3.5 text-sm leading-relaxed focus:outline-none min-h-[80px] resize-y transition-all placeholder:text-muted-foreground dark:placeholder:text-muted-foreground/60 dark:placeholder:text-zinc-500",
                      "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
                    )} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <BookOpen className={cn("w-3.5 h-3.5", iconColor)} /> Lessons Learned
                  </label>
                  <textarea aria-label="Lessons Learned" value={journal.lessons} onChange={e => setJournal(j => ({ ...j, lessons: e.target.value }))} placeholder="Key takeaways to repeat or avoid..."
                    className={cn(
                      "w-full bg-input dark:bg-[#050505] text-foreground border border-border dark:border-white/[0.08] rounded-[20px] px-4 py-3.5 text-sm leading-relaxed focus:outline-none min-h-[80px] resize-y transition-all placeholder:text-muted-foreground dark:placeholder:text-muted-foreground/60 dark:placeholder:text-zinc-500",
                      "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
                    )} />
                </div>
              </div>

              {/* Tags & Rating */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Tag className={cn("w-3.5 h-3.5", iconColor)} /> Tags
                  </label>
                  <input aria-label="Tags" value={journal.tags} onChange={e => setJournal(j => ({ ...j, tags: e.target.value }))} placeholder="breakout, trend, news (comma separated)"
                    className={cn(
                      "w-full bg-input dark:bg-[#050505] text-foreground border border-border dark:border-white/[0.08] rounded-[20px] px-4 py-3 text-sm focus:outline-none transition-all placeholder:text-muted-foreground dark:placeholder:text-muted-foreground/60 dark:placeholder:text-zinc-500",
                      "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
                    )} />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Star className={cn("w-4 h-4", iconColor)} /> Rating</span>
                    <span className={cn(
                      "text-xs font-extrabold px-2.5 py-0.5 rounded border",
                      isWinner
                        ? "text-blue-500 bg-blue-500/10 border-blue-500/10"
                        : "text-red-700 dark:text-red-500 bg-red-500/10 border-red-500/10"
                    )}>{journal.rating}/10</span>
                  </label>
                  <div className="relative mt-3 px-2">
                    <input
                      aria-label="Trade rating" type="range"
                      min={1}
                      max={10}
                      value={journal.rating}
                      onChange={e => setJournal(j => ({ ...j, rating: parseInt(e.target.value) }))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer outline-none bg-gradient-to-r from-red-500 via-amber-500 to-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/20 [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:active:scale-110"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground font-bold mt-2 select-none">
                      <span>1</span>
                      <span>5</span>
                      <span>10</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Execution Checklist */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className={cn("w-3.5 h-3.5", iconColor)} /> Execution Checklist</span>
                  <span className={cn("font-bold text-xs", isWinner ? "text-blue-500" : "text-red-700 dark:text-red-500")}>{checkCount}/{totalCheckCount}</span>
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    { key: 'checked_higher_tf', label: 'Checked higher timeframe' },
                    { key: 'risk_within_limits', label: 'Risk within limits' },
                    { key: 'fits_plan', label: 'Fits my trading plan' },
                    { key: 'key_levels', label: 'Key levels identified' },
                    { key: 'news_checked', label: 'Economic calendar checked' },
                  ].map(item => (
                    <button key={item.key} type="button" aria-pressed={checklist[item.key as keyof typeof checklist]}
                      onClick={() => setChecklist(c => ({ ...c, [item.key]: !c[item.key as keyof typeof c] }))}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-[20px] border text-xs text-left transition-all duration-200",
                        checklist[item.key as keyof typeof checklist]
                          ? isWinner
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-white'
                            : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-white'
                          : 'bg-card dark:bg-[#0B0B0B] border-border dark:border-white/[0.08] text-muted-foreground hover:bg-secondary'
                      )}>
                      <div className={cn(
                        "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all",
                        checklist[item.key as keyof typeof checklist]
                          ? isWinner
                            ? 'bg-blue-500 border-blue-500'
                            : 'bg-red-500 border-red-500'
                          : 'border-muted-foreground/60 dark:border-zinc-700'
                      )}>
                        {checklist[item.key as keyof typeof checklist] && <Check className="w-2.5 h-2.5 text-primary-foreground dark:text-black stroke-[3]" />}
                      </div>
                      {item.label}
                    </button>
                  ))}
                  {customChecklist.map(item => (
                    <div key={item.id} className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-[20px] border text-xs text-left transition-all duration-200",
                      item.checked
                        ? isWinner
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-white'
                          : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-white'
                        : 'bg-card dark:bg-[#0B0B0B] border-border dark:border-white/[0.08] text-muted-foreground hover:bg-secondary'
                    )}>
                      <button type="button" aria-pressed={item.checked} onClick={() => toggleCustomChecklist(item.id)} className="flex items-center gap-2 text-left">
                        <div className={cn(
                          "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all",
                          item.checked
                            ? isWinner
                              ? 'bg-blue-500 border-blue-500'
                              : 'bg-red-500 border-red-500'
                            : 'border-muted-foreground/60 dark:border-zinc-700'
                        )}>
                          {item.checked && <Check className="w-2.5 h-2.5 text-primary-foreground dark:text-black stroke-[3]" />}
                        </div>
                        {item.label}
                      </button>
                      <button type="button" aria-label={`Remove ${item.label}`} onClick={() => deleteCustomChecklist(item.id)} className="text-muted-foreground dark:text-zinc-500 hover:text-red-700 dark:hover:text-red-500 transition-colors ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddCustomChecklist} className="flex items-center gap-2 mt-3 w-full max-w-xs">
                  <input type="text" aria-label="Custom checklist item" value={newCustomLabel} onChange={e => setNewCustomLabel(e.target.value)} placeholder="Add custom item..."
                    className={cn(
                      "flex-1 bg-input dark:bg-[#050505] text-foreground border border-border dark:border-white/[0.08] rounded-lg px-2.5 py-1 text-xs focus:outline-none transition-all placeholder:text-muted-foreground dark:placeholder:text-muted-foreground/60 dark:placeholder:text-zinc-500",
                      "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
                    )} />
                  <button type="submit" aria-label="Add checklist item" className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-white transition-colors",
                    isWinner ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"
                  )}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

              {/* Screenshots */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <Image className={cn("w-3.5 h-3.5", iconColor)} /> Screenshots
                </label>
                <div className="flex flex-wrap gap-3">
                  {screenshots.map(s => (
                    <div key={s.id} className="w-full max-w-[144px] sm:w-36 h-24 rounded-[20px] overflow-hidden border border-border dark:border-white/[0.08] hover:border-blue-500/30 transition-all duration-200 group relative">
                      <img src={(s as { signed_url?: string }).signed_url || s.image_url} alt="Trade screenshot" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  ))}
                  <button type="button" disabled={uploadScreenshot.isPending} onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "w-full max-w-[144px] sm:w-36 h-24 rounded-[20px] border border-dashed bg-card dark:bg-[#0B0B0B] flex flex-col items-center justify-center text-muted-foreground transition-all duration-200 group",
                      isWinner ? "border-border dark:border-white/[0.08] dark:border-zinc-800 hover:border-blue-500/30 hover:text-foreground" : "border-border dark:border-white/[0.08] dark:border-zinc-800 hover:border-red-500/30 hover:text-foreground"
                    )}>
                    <Plus className="w-5 h-5 mb-1 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{uploadScreenshot.isPending ? "Uploading…" : "Add Image"}</span>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </div>
              </div>

              <StrategySetupCard value={strategySetup} onChange={setStrategySetup} />

              {screenshotsQuery.isError && <LoadError name="screenshots" retry={screenshotsQuery.refetch} />}
              <div id="journal-ai-review" tabIndex={-1}><AITradeReviewPanel tradeId={selectedTrade.id} /></div>
            </fieldset>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-base font-medium">Select a trade to write your journal entry</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
