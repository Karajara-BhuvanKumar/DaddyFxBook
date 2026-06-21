import { useState, useEffect, useRef } from "react";
import { useTrades, useJournal, useSaveJournal, useChecklist, useSaveChecklist, useScreenshots, useUploadScreenshot } from "@/hooks/useTrades";
import { BookOpen, Save, Star, ImagePlus, Check, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import { AITradeReviewPanel } from "@/components/ai-report/AITradeReviewPanel";

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

  const [journal, setJournal] = useState({ pre_trade_notes: '', post_trade_notes: '', emotions: '', lessons: '', tags: '', rating: 5, risk_reward: '' });
  const [checklist, setChecklist] = useState({ checked_higher_tf: false, risk_within_limits: false, fits_plan: false, key_levels: false, news_checked: false });

  useEffect(() => { if (!selectedId && trades.length > 0) setSelectedId(trades[0].id); }, [trades, selectedId]);

  useEffect(() => {
    if (existingJournal) {
      setJournal({ pre_trade_notes: existingJournal.pre_trade_notes || '', post_trade_notes: existingJournal.post_trade_notes || '', emotions: existingJournal.emotions || '', lessons: existingJournal.lessons || '', tags: existingJournal.tags || '', rating: existingJournal.rating || 5, risk_reward: existingJournal.risk_reward ?? '' });
    } else {
      setJournal({ pre_trade_notes: '', post_trade_notes: '', emotions: '', lessons: '', tags: '', rating: 5, risk_reward: '' });
    }
  }, [existingJournal, selectedId]);

  useEffect(() => {
    if (existingChecklist) {
      setChecklist({ checked_higher_tf: existingChecklist.checked_higher_tf || false, risk_within_limits: existingChecklist.risk_within_limits || false, fits_plan: existingChecklist.fits_plan || false, key_levels: existingChecklist.key_levels || false, news_checked: existingChecklist.news_checked || false });
    } else {
      setChecklist({ checked_higher_tf: false, risk_within_limits: false, fits_plan: false, key_levels: false, news_checked: false });
    }
  }, [existingChecklist, selectedId]);

  async function handleSave() {
    if (!selectedId) return;
    try { await saveJournal.mutateAsync({ trade_id: selectedId, ...journal }); await saveChecklist.mutateAsync({ trade_id: selectedId, ...checklist }); toast.success("Journal saved!"); } catch (err: any) { toast.error(err.message); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    try { await uploadScreenshot.mutateAsync({ tradeId: selectedId, file }); toast.success("Screenshot uploaded!"); } catch (err: any) { toast.error(err.message); }
  }

  const checkCount = Object.values(checklist).filter(Boolean).length;

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex items-center gap-3 text-muted-foreground"><Activity className="w-5 h-5 animate-pulse" /><span className="text-base font-medium">Loading journal...</span></div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-extrabold text-foreground tracking-tight">Trade Journal</h1>
        <p className="text-base text-muted-foreground mt-1 font-medium">{trades.length} trades</p>
      </div>

      <div className="flex gap-6 min-h-[calc(100vh-12rem)]">
        {/* Trade list */}
        <div className="w-72 shrink-0 glass-card rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border/60">
            <span className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-lg border border-primary/20">All {trades.length}</span>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-border/40">
            {trades.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-base font-medium">Add trades first</p>
            ) : (
              trades.map(t => (
                <button key={t.id} onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left p-4 transition-all duration-200 ${selectedId === t.id ? 'bg-primary/8 border-l-2 border-l-primary' : 'hover:bg-secondary/40 border-l-2 border-l-transparent'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🥇</span>
                      <span className="font-semibold text-foreground text-base">{t.symbol}</span>
                    </div>
                    <span className={`text-sm font-bold font-mono-num ${Number(t.pnl) >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {Number(t.pnl) >= 0 ? '+' : ''}${Number(t.pnl).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`flex items-center gap-0.5 font-medium ${t.direction === 'Long' ? 'text-primary' : 'text-loss'}`}>
                      {t.direction === 'Long' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {t.direction}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground font-medium">{new Date(t.close_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Journal editor */}
        <div className="flex-1 glass-card rounded-2xl p-8 overflow-auto">
          {selectedTrade ? (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-warning/10 flex items-center justify-center text-lg">🥇</div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-extrabold text-foreground">{selectedTrade.symbol}</h2>
                      <span className={`text-xs font-bold px-3 py-1 rounded-lg ${Number(selectedTrade.pnl) >= 0 ? 'bg-profit/10 text-profit border border-profit/20' : 'bg-loss/10 text-loss border border-loss/20'}`}>
                        {Number(selectedTrade.pnl) >= 0 ? 'WIN' : 'LOSS'}
                      </span>
                      <span className={`text-xl font-extrabold font-mono-num ${Number(selectedTrade.pnl) >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {Number(selectedTrade.pnl) >= 0 ? '+' : ''}${Number(selectedTrade.pnl).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium mt-0.5">
                      {selectedTrade.direction} · ${Number(selectedTrade.entry_price).toFixed(2)} → ${Number(selectedTrade.exit_price).toFixed(2)} · {selectedTrade.lot_size} lots
                    </p>
                  </div>
                </div>
                <button onClick={handleSave} disabled={saveJournal.isPending}
                  className="flex items-center gap-2 btn-premium text-primary-foreground px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50">
                  <Save className="w-4 h-4" /> {saveJournal.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>

              {[
                { label: 'Pre-Trade Analysis', key: 'pre_trade_notes', placeholder: 'What did you see? Plan, thesis, levels, risk...', icon: '📋' },
                { label: 'Post-Trade Review', key: 'post_trade_notes', placeholder: 'What happened? Execution, slippage, improvements...', icon: '⏱️' },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-2">
                    <span>{field.icon}</span> {field.label}
                  </label>
                  <textarea value={journal[field.key as keyof typeof journal] as string} onChange={e => setJournal(j => ({ ...j, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full bg-secondary/40 text-foreground border border-border/60 rounded-xl px-4 py-3.5 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 min-h-[100px] resize-y transition-all duration-200 placeholder:text-muted-foreground/40" />
                </div>
              ))}

              <div className="bg-secondary/30 rounded-xl p-5 border border-border/40 flex items-center gap-6">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">⚖️ Risk : Reward</span>
                <div className="flex items-center gap-2">
                  <input
                    value={journal.risk_reward.split(':')[0] ?? ''}
                    onChange={e => setJournal(j => ({ ...j, risk_reward: `${e.target.value}:${j.risk_reward.split(':')[1] ?? ''}` }))}
                    placeholder="Risk"
                    className="w-16 h-10 bg-card text-foreground border border-border rounded-[18px] px-3 text-base text-center font-mono-num focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all duration-200 placeholder:text-[#64748B]" />
                  <span className="text-muted-foreground font-bold text-xl">:</span>
                  <input
                    value={journal.risk_reward.split(':')[1] ?? ''}
                    onChange={e => setJournal(j => ({ ...j, risk_reward: `${j.risk_reward.split(':')[0] ?? ''}:${e.target.value}` }))}
                    placeholder="Reward"
                    className="w-16 h-10 bg-card text-foreground border border-border rounded-[18px] px-3 text-base text-center font-mono-num focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all duration-200 placeholder:text-[#64748B]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">😊 Emotions</label>
                  <textarea value={journal.emotions} onChange={e => setJournal(j => ({ ...j, emotions: e.target.value }))} placeholder="Calm, anxious, FOMO, confident..."
                    className="w-full bg-secondary/40 text-foreground border border-border/60 rounded-xl px-4 py-3.5 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 min-h-[80px] resize-y transition-all duration-200 placeholder:text-muted-foreground/40" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">📖 Lessons Learned</label>
                  <textarea value={journal.lessons} onChange={e => setJournal(j => ({ ...j, lessons: e.target.value }))} placeholder="Key takeaways to repeat or avoid..."
                    className="w-full bg-secondary/40 text-foreground border border-border/60 rounded-xl px-4 py-3.5 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 min-h-[80px] resize-y transition-all duration-200 placeholder:text-muted-foreground/40" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">🏷️ Tags</label>
                  <input value={journal.tags} onChange={e => setJournal(j => ({ ...j, tags: e.target.value }))} placeholder="breakout, trend, news (comma separated)"
                    className="w-full bg-secondary/40 text-foreground border border-border/60 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all duration-200 placeholder:text-muted-foreground/40" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Rating</span>
                    <span className={`text-lg font-extrabold font-mono-num ${journal.rating >= 7 ? 'text-profit' : journal.rating >= 4 ? 'text-warning' : 'text-loss'}`}>{journal.rating}/10</span>
                  </label>
                  <input type="range" min={1} max={10} value={journal.rating} onChange={e => setJournal(j => ({ ...j, rating: parseInt(e.target.value) }))} className="w-full accent-primary h-2 mt-2" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>✅ Execution Checklist</span>
                  <span className="text-primary font-mono-num">{checkCount}/5</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: 'checked_higher_tf', label: 'Checked higher timeframe' },
                    { key: 'risk_within_limits', label: 'Risk within limits' },
                    { key: 'fits_plan', label: 'Fits my trading plan' },
                    { key: 'key_levels', label: 'Key levels identified' },
                    { key: 'news_checked', label: 'Economic calendar checked' },
                  ].map(item => (
                    <button key={item.key} type="button"
                      onClick={() => setChecklist(c => ({ ...c, [item.key]: !c[item.key as keyof typeof c] }))}
                      className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-sm text-left transition-all duration-200 ${
                        checklist[item.key as keyof typeof checklist] ? 'bg-primary/8 border-primary/30 text-foreground' : 'bg-secondary/30 border-border/60 text-muted-foreground hover:border-border'
                      }`}>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all duration-200 ${
                        checklist[item.key as keyof typeof checklist] ? 'bg-primary border-primary shadow-[0_0_8px_-2px_hsl(221,83%,53%,0.5)]' : 'border-muted-foreground/40'
                      }`}>
                        {checklist[item.key as keyof typeof checklist] && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">🖼️ Screenshots</label>
                <div className="flex flex-wrap gap-3">
                  {screenshots.map(s => (
                    <div key={s.id} className="w-36 h-28 rounded-xl overflow-hidden border border-border/60 hover:border-primary/30 transition-all duration-200 group">
                      <img src={(s as { signed_url?: string }).signed_url || s.image_url} alt="Trade screenshot" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  ))}
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="w-36 h-28 rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary transition-all duration-200 group">
                    <ImagePlus className="w-6 h-6 mb-1.5 group-hover:scale-110 transition-transform duration-200" />
                    <span className="text-xs font-medium">Add Image</span>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </div>
              </div>

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
