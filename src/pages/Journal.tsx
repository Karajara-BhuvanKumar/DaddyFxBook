import { useState, useEffect, useRef } from "react";
import { useTrades, useJournal, useSaveJournal, useChecklist, useSaveChecklist, useScreenshots, useUploadScreenshot } from "@/hooks/useTrades";
import { BookOpen, Save, Star, Check, Activity, ArrowUpRight, ArrowDownRight, RefreshCw, FileText, SlidersHorizontal, DollarSign, Smile, Tag, Image, Plus, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AITradeReviewPanel } from "@/components/ai-report/AITradeReviewPanel";
import { StrategySetupCard } from "@/components/journal/StrategySetupCard";
import { ExportJournalDialog } from "@/components/journal/ExportJournalDialog";
import { emptyStrategySetup, parseStrategySetup, serializeStrategySetup, type StrategySetup } from "@/lib/strategySetup";
import { cn } from "@/lib/utils";

export default function Journal() {
  const { data: trades = [], isLoading } = useTrades();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: existingJournal } = useJournal(selectedId);
  const { data: existingChecklist } = useChecklist(selectedId);
  const { data: screenshots = [] } = useScreenshots(selectedId);
  const saveJournal = useSaveJournal();
  const saveChecklist = useSaveChecklist();
  const uploadScreenshot = useUploadScreenshot();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedTrade = trades.find(t => t.id === selectedId);
  const isWinner = selectedTrade ? Number(selectedTrade.pnl) >= 0 : true;
  const iconColor = isWinner ? "text-blue-500" : "text-red-500";

  const [journal, setJournal] = useState({ pre_trade_notes: '', post_trade_notes: '', emotions: '', lessons: '', tags: '', rating: 5, risk_reward: '' });
  const [strategySetup, setStrategySetup] = useState<StrategySetup>(emptyStrategySetup);
  const [checklist, setChecklist] = useState({ checked_higher_tf: false, risk_within_limits: false, fits_plan: false, key_levels: false, news_checked: false });
  const [customChecklist, setCustomChecklist] = useState<{ id: string; label: string; checked: boolean }[]>([]);
  const [newCustomLabel, setNewCustomLabel] = useState("");

  useEffect(() => { if (!selectedId && trades.length > 0) setSelectedId(trades[0].id); }, [trades, selectedId]);

  useEffect(() => {
    if (existingJournal) {
      setJournal({ pre_trade_notes: existingJournal.pre_trade_notes || '', post_trade_notes: existingJournal.post_trade_notes || '', emotions: existingJournal.emotions || '', lessons: existingJournal.lessons || '', tags: existingJournal.tags || '', rating: existingJournal.rating || 5, risk_reward: existingJournal.risk_reward ?? '' });
      setStrategySetup(parseStrategySetup(existingJournal.strategy_setup));
    } else {
      setJournal({ pre_trade_notes: '', post_trade_notes: '', emotions: '', lessons: '', tags: '', rating: 5, risk_reward: '' });
      setStrategySetup(emptyStrategySetup);
    }
  }, [existingJournal, selectedId]);

  useEffect(() => {
    if (existingChecklist) {
      setChecklist({ checked_higher_tf: existingChecklist.checked_higher_tf || false, risk_within_limits: existingChecklist.risk_within_limits || false, fits_plan: existingChecklist.fits_plan || false, key_levels: existingChecklist.key_levels || false, news_checked: existingChecklist.news_checked || false });
    } else {
      setChecklist({ checked_higher_tf: false, risk_within_limits: false, fits_plan: false, key_levels: false, news_checked: false });
    }
  }, [existingChecklist, selectedId]);

  const formatJournalDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const year = d.getFullYear();
    const time = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    return `${month} ${day}, ${year}, ${time}`;
  };

  async function handleSave() {
    if (!selectedId) return;
    try {
      await saveJournal.mutateAsync({ trade_id: selectedId, ...journal, strategy_setup: serializeStrategySetup(strategySetup) });
      await saveChecklist.mutateAsync({ trade_id: selectedId, ...checklist });
      toast.success("Journal saved!");
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    try { await uploadScreenshot.mutateAsync({ tradeId: selectedId, file }); toast.success("Screenshot uploaded!"); } catch (err: any) { toast.error(err.message); }
  }

  const handleAddCustomChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomLabel.trim()) return;
    setCustomChecklist(c => [...c, { id: Math.random().toString(), label: newCustomLabel.trim(), checked: false }]);
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

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex items-center gap-3 text-muted-foreground"><Activity className="w-5 h-5 animate-pulse" /><span className="text-base font-medium">Loading journal...</span></div>
    </div>
  );

  return (
    <div className="space-y-6 md:space-y-8 overflow-guard">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-foreground hidden lg:block">Journal</h1>
          <div className="flex items-center gap-2 mt-0 lg:mt-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[13px] text-zinc-500 font-semibold tracking-wide">Sun, Jun 21</span>
          </div>
        </div>
        <ExportJournalDialog />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0 lg:min-h-[calc(100vh-12rem)]">
        {/* Trade list */}
        <div className="w-full lg:w-[40%] xl:w-80 shrink-0 rounded-[20px] border border-white/[0.08] bg-[#0B0B0B] overflow-hidden flex flex-col shadow-sm max-h-[420px] lg:max-h-none">
          <div className="p-4 border-b border-white/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-foreground">Trade Journal</h3>
              <button className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-white/[0.08] text-[10px] font-semibold text-muted-foreground bg-secondary hover:text-foreground transition-all">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-0.5" /> Live
              </button>
            </div>
            <span className="text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/10 px-2 py-0.5 rounded-full">
              {trades.length} entries
            </span>
          </div>

          <div className="p-2 border-b border-white/[0.05] flex items-center gap-1.5 overflow-x-auto select-none">
            <button className="px-2.5 py-1 rounded-lg bg-secondary text-foreground text-[10px] font-bold tracking-wider uppercase border border-white/[0.08]">
              AI {trades.length}
            </button>
            <button className="px-2.5 py-1 rounded-lg bg-transparent text-muted-foreground hover:text-foreground text-[10px] font-bold tracking-wider uppercase">
              Journaled 0
            </button>
            <button className="px-2.5 py-1 rounded-lg bg-transparent text-muted-foreground hover:text-foreground text-[10px] font-bold tracking-wider uppercase">
              Pending {trades.length}
            </button>
            <button className="px-2.5 py-1 rounded-lg bg-transparent text-muted-foreground hover:text-foreground text-[10px] font-bold tracking-wider uppercase">
              L...
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-2">
            {trades.length === 0 ? (
              <p className="text-center text-zinc-500 py-12 text-xs font-semibold">Add trades first</p>
            ) : (
              trades.map(t => (
                <button key={t.id} onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "w-full text-left p-4 rounded-[20px] border transition-all duration-200 flex flex-col",
                    selectedId === t.id
                      ? 'bg-blue-600/[0.08] border-blue-600/[0.35]'
                      : 'bg-[#0B0B0B] border-white/[0.06] hover:bg-white/[0.02]'
                  )}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-sm">
                        <DollarSign className="w-3 h-3 text-black stroke-[3]" />
                      </div>
                      <span className="font-bold text-foreground text-xs">{t.symbol}</span>
                    </div>
                    <span className="bg-muted text-[9px] text-muted-foreground font-bold px-1.5 py-0.5 rounded">
                      NEW
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs mt-2 font-semibold">
                    <span className={t.direction === 'Long' ? 'text-blue-500' : 'text-red-500'}>{t.direction}</span>
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
          className={cn(
            "flex-1 min-w-0 rounded-3xl border p-4 sm:p-6 overflow-auto transition-all duration-300 shadow-[0_4px_30px_rgba(0,0,0,0.35)] relative",
            "bg-[#0B0B0B] border-white/[0.06]",
          )}
        >
          {selectedTrade ? (
            <div className="space-y-5 md:space-y-6 animate-fade-up">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.05] pb-4 md:pb-5">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-sm shrink-0">
                    <DollarSign className="w-4 h-4 text-black stroke-[3]" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{selectedTrade.symbol}</h2>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0",
                    isWinner
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-500/20'
                      : 'bg-red-500/10 text-red-600 dark:text-red-500 border-red-500/20'
                  )}>
                    {isWinner ? 'WINNER' : 'LOSER'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button className="touch-target border border-white/[0.08] p-2 rounded-[20px] text-muted-foreground hover:text-foreground bg-secondary hover:bg-muted transition-all">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button className="touch-target flex items-center gap-1.5 border border-white/[0.08] px-3 sm:px-4 py-2 rounded-[20px] text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary hover:bg-muted transition-all">
                    <FileText className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Report</span>
                  </button>
                  <button className="touch-target flex items-center gap-1.5 border border-white/[0.08] px-3 sm:px-4 py-2 rounded-[20px] text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary hover:bg-muted transition-all">
                    <SlidersHorizontal className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Analytics</span>
                  </button>
                  <button onClick={handleSave} disabled={saveJournal.isPending}
                    className={cn(
                      "touch-target w-full sm:w-auto text-white font-bold px-6 py-2 rounded-[20px] text-xs transition-all disabled:opacity-50 shadow-sm min-h-[44px]",
                      isWinner ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"
                    )}>
                    {saveJournal.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground font-semibold mb-4 md:mb-6">
                <span className={selectedTrade.direction === 'Long' ? 'text-blue-500' : 'text-red-500'}>{selectedTrade.direction}</span>
                <span>·</span>
                <span>Entry ${Number(selectedTrade.entry_price).toFixed(2)}</span>
                <span>·</span>
                <span>Size {selectedTrade.lot_size}</span>
                <span>·</span>
                <span>{formatJournalDate(selectedTrade.open_time)}</span>
              </div>

              {/* Pre-Trade Analysis */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <FileText className={cn("w-3.5 h-3.5", iconColor)} /> Pre-Trade Analysis
                </label>
                <textarea value={journal.pre_trade_notes} onChange={e => setJournal(j => ({ ...j, pre_trade_notes: e.target.value }))}
                  placeholder="What did you see? Plan, thesis, levels, risk..."
                  className={cn(
                    "w-full bg-[#050505] text-foreground border border-white/[0.08] rounded-[20px] px-4 py-3.5 text-sm leading-relaxed focus:outline-none min-h-[100px] resize-y transition-all placeholder:text-muted-foreground/60 dark:placeholder:text-zinc-500",
                    "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                  )} />
              </div>

              {/* Post-Trade Review */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className={cn("w-3.5 h-3.5", iconColor)} /> Post-Trade Review
                </label>
                <textarea value={journal.post_trade_notes} onChange={e => setJournal(j => ({ ...j, post_trade_notes: e.target.value }))}
                  placeholder="What happened? Execution, slippage, improvements..."
                  className={cn(
                    "w-full bg-[#050505] text-foreground border border-white/[0.08] rounded-[20px] px-4 py-3.5 text-sm leading-relaxed focus:outline-none min-h-[100px] resize-y transition-all placeholder:text-muted-foreground/60 dark:placeholder:text-zinc-500",
                    "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                  )} />
              </div>

              {/* Risk Reward */}
              <div className={cn(
                "rounded-[20px] p-4 flex items-center justify-between transition-all duration-300 bg-[#0B0B0B] border border-white/[0.06]"
              )}>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" /> Risk : Reward
                </span>
                <div className="flex items-center gap-2">
                  <input
                    value={journal.risk_reward.split(':')[0] ?? ''}
                    onChange={e => setJournal(j => ({ ...j, risk_reward: `${e.target.value}:${j.risk_reward.split(':')[1] ?? ''}` }))}
                    placeholder="1"
                    className={cn(
                      "w-12 h-8 bg-[#050505] text-foreground border border-white/[0.08] rounded-lg px-2 text-xs text-center font-bold focus:outline-none transition-all placeholder:text-muted-foreground/45 dark:placeholder:text-zinc-500",
                      "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                    )} />
                  <span className="text-zinc-400 dark:text-zinc-600 font-bold text-sm">:</span>
                  <input
                    value={journal.risk_reward.split(':')[1] ?? ''}
                    onChange={e => setJournal(j => ({ ...j, risk_reward: `${j.risk_reward.split(':')[0] ?? ''}:${e.target.value}` }))}
                    placeholder="2"
                    className={cn(
                      "w-12 h-8 bg-[#050505] text-foreground border border-white/[0.08] rounded-lg px-2 text-xs text-center font-bold focus:outline-none transition-all placeholder:text-muted-foreground/45 dark:placeholder:text-zinc-500",
                      "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                    )} />
                </div>
              </div>

              {/* Emotions & Lessons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Smile className={cn("w-3.5 h-3.5", iconColor)} /> Emotions
                  </label>
                  <textarea value={journal.emotions} onChange={e => setJournal(j => ({ ...j, emotions: e.target.value }))} placeholder="Calm, anxious, FOMO, confident..."
                    className={cn(
                      "w-full bg-[#050505] text-foreground border border-white/[0.08] rounded-[20px] px-4 py-3.5 text-sm leading-relaxed focus:outline-none min-h-[80px] resize-y transition-all placeholder:text-muted-foreground/60 dark:placeholder:text-zinc-500",
                      "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                    )} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <BookOpen className={cn("w-3.5 h-3.5", iconColor)} /> Lessons Learned
                  </label>
                  <textarea value={journal.lessons} onChange={e => setJournal(j => ({ ...j, lessons: e.target.value }))} placeholder="Key takeaways to repeat or avoid..."
                    className={cn(
                      "w-full bg-[#050505] text-foreground border border-white/[0.08] rounded-[20px] px-4 py-3.5 text-sm leading-relaxed focus:outline-none min-h-[80px] resize-y transition-all placeholder:text-muted-foreground/60 dark:placeholder:text-zinc-500",
                      "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                    )} />
                </div>
              </div>

              {/* Tags & Rating */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Tag className={cn("w-3.5 h-3.5", iconColor)} /> Tags
                  </label>
                  <input value={journal.tags} onChange={e => setJournal(j => ({ ...j, tags: e.target.value }))} placeholder="breakout, trend, news (comma separated)"
                    className={cn(
                      "w-full bg-[#050505] text-foreground border border-white/[0.08] rounded-[20px] px-4 py-3 text-sm focus:outline-none transition-all placeholder:text-muted-foreground/60 dark:placeholder:text-zinc-500",
                      "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                    )} />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Star className={cn("w-4 h-4", iconColor)} /> Rating</span>
                    <span className={cn(
                      "text-xs font-extrabold px-2.5 py-0.5 rounded border",
                      isWinner
                        ? "text-blue-500 bg-blue-500/10 border-blue-500/10"
                        : "text-red-500 bg-red-500/10 border-red-500/10"
                    )}>{journal.rating}/10</span>
                  </label>
                  <div className="relative mt-3 px-2">
                    <input
                      type="range"
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
                  <span className={cn("font-bold text-xs", isWinner ? "text-blue-500" : "text-red-500")}>{checkCount}/{totalCheckCount}</span>
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    { key: 'checked_higher_tf', label: 'Checked higher timeframe' },
                    { key: 'risk_within_limits', label: 'Risk within limits' },
                    { key: 'fits_plan', label: 'Fits my trading plan' },
                    { key: 'key_levels', label: 'Key levels identified' },
                    { key: 'news_checked', label: 'Economic calendar checked' },
                  ].map(item => (
                    <button key={item.key} type="button"
                      onClick={() => setChecklist(c => ({ ...c, [item.key]: !c[item.key as keyof typeof c] }))}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-[20px] border text-xs text-left transition-all duration-200",
                        checklist[item.key as keyof typeof checklist]
                          ? isWinner
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-white'
                            : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-white'
                          : 'bg-[#0B0B0B] border-white/[0.08] text-muted-foreground hover:bg-secondary'
                      )}>
                      <div className={cn(
                        "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all",
                        checklist[item.key as keyof typeof checklist]
                          ? isWinner
                            ? 'bg-blue-500 border-blue-500'
                            : 'bg-red-500 border-red-500'
                          : 'border-white/[0.08] dark:border-zinc-700'
                      )}>
                        {checklist[item.key as keyof typeof checklist] && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
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
                        : 'bg-[#0B0B0B] border-white/[0.08] text-muted-foreground hover:bg-secondary'
                    )}>
                      <button type="button" onClick={() => toggleCustomChecklist(item.id)} className="flex items-center gap-2 text-left">
                        <div className={cn(
                          "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all",
                          item.checked
                            ? isWinner
                              ? 'bg-blue-500 border-blue-500'
                              : 'bg-red-500 border-red-500'
                            : 'border-white/[0.08] dark:border-zinc-700'
                        )}>
                          {item.checked && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                        </div>
                        {item.label}
                      </button>
                      <button type="button" onClick={() => deleteCustomChecklist(item.id)} className="text-zinc-500 hover:text-red-500 transition-colors ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddCustomChecklist} className="flex items-center gap-2 mt-3 w-full max-w-xs">
                  <input type="text" value={newCustomLabel} onChange={e => setNewCustomLabel(e.target.value)} placeholder="Add custom item..."
                    className={cn(
                      "flex-1 bg-[#050505] text-foreground border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs focus:outline-none transition-all placeholder:text-muted-foreground/60 dark:placeholder:text-zinc-500",
                      "focus:border-blue-600/[0.6] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                    )} />
                  <button type="submit" className={cn(
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
                    <div key={s.id} className="w-full max-w-[144px] sm:w-36 h-24 rounded-[20px] overflow-hidden border border-white/[0.08] hover:border-blue-500/30 transition-all duration-200 group relative">
                      <img src={(s as { signed_url?: string }).signed_url || s.image_url} alt="Trade screenshot" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  ))}
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "w-full max-w-[144px] sm:w-36 h-24 rounded-[20px] border border-dashed bg-[#0B0B0B] flex flex-col items-center justify-center text-muted-foreground transition-all duration-200 group",
                      isWinner ? "border-white/[0.08] dark:border-zinc-800 hover:border-blue-500/30 hover:text-foreground" : "border-white/[0.08] dark:border-zinc-800 hover:border-red-500/30 hover:text-foreground"
                    )}>
                    <Plus className="w-5 h-5 mb-1 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Add Image</span>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </div>
              </div>

              <StrategySetupCard value={strategySetup} onChange={setStrategySetup} />

              <AITradeReviewPanel tradeId={selectedTrade.id} />
            </div>
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
