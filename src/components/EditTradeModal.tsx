import TradeDateTimePicker from '@/components/TradeDateTimePicker';
import { holdingDuration, formatHoldingDuration, localTimeZone } from '@/lib/holdingTime';
import LoadError from '@/components/LoadError';
import { StrategySetupCard } from '@/components/journal/StrategySetupCard';
import { parseStrategySetup, serializeStrategySetup } from '@/lib/strategySetup';
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Trade, useJournal, useChecklist, useUpdateTrade } from "@/hooks/useTrades";
import { ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { toast } from "sonner";

import { toLocalDateTime, toUtcTimestamp } from "@/lib/tradeTimestamps";

interface EditTradeModalProps {
  trade: Trade | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditTradeModal({ trade, isOpen, onClose }: EditTradeModalProps) {
  const { data: journal, isLoading: isJournalLoading, isError: journalError, refetch: retryJournal } = useJournal(trade?.id ?? null);
  const { data: checklist, isLoading: isChecklistLoading, isError: checklistError, refetch: retryChecklist } = useChecklist(trade?.id ?? null);
  const updateTrade = useUpdateTrade();
  const hydratedTrade = useRef<string | null>(null);

  const [form, setForm] = useState({
    symbol: '',
    direction: 'Long' as 'Long' | 'Short',
    entryPrice: '',
    exitPrice: '',
    lotSize: '',
    stopLoss: '',
    riskPct: '',
    takeProfit: '',
    openDate: '',
    closeDate: '',
    commission: '',
    swap: '',
    tags: '',
    notes: '',
    strategySetup: '',
    emotions: '',
    mistakes: '',
    lessons: '',
    checked_higher_tf: false,
    risk_within_limits: false,
    fits_plan: false,
    key_levels: false,
    news_checked: false,
  });

  useEffect(() => {
    if (!isOpen) { hydratedTrade.current = null; return; }
    if (trade && !isJournalLoading && !isChecklistLoading && !journalError && !checklistError && hydratedTrade.current !== trade.id) {
      hydratedTrade.current = trade.id;
      // Parse mistakes from lessons if stored together, or just use as is
      let parsedMistakes = '';
      let parsedLessons = journal?.lessons || '';

      if (parsedLessons.includes('Mistakes:')) {
        const parts = parsedLessons.split('Mistakes:');
        parsedLessons = parts[0].replace('Lessons:', '').trim();
        parsedMistakes = parts[1].trim();
      }

      setForm({
        symbol: trade.symbol,
        direction: trade.direction as 'Long' | 'Short',
        entryPrice: trade.entry_price.toString(),
        exitPrice: trade.exit_price.toString(),
        lotSize: trade.lot_size.toString(),
        stopLoss: trade.stop_loss?.toString() || '',
        riskPct: trade.risk_pct?.toString() ?? '',
        takeProfit: trade.take_profit?.toString() || '',
        openDate: toLocalDateTime(trade.open_time),
        closeDate: toLocalDateTime(trade.close_time),
        commission: '', // No direct field in Trade schema yet
        swap: '',       // No direct field in Trade schema yet
        tags: journal?.tags || '',
        notes: journal?.post_trade_notes || '',
        strategySetup: journal?.strategy_setup || '',
        emotions: journal?.emotions || '',
        mistakes: parsedMistakes,
        lessons: parsedLessons,
        checked_higher_tf: checklist?.checked_higher_tf || false,
        risk_within_limits: checklist?.risk_within_limits || false,
        fits_plan: checklist?.fits_plan || false,
        key_levels: checklist?.key_levels || false,
        news_checked: checklist?.news_checked || false,
      });
    }
  }, [trade, journal, checklist, isOpen, isJournalLoading, isChecklistLoading, journalError, checklistError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trade) return;

    try {
      const tradeData = {
        symbol: form.symbol.trim().toUpperCase(),
        direction: form.direction,
        entry_price: parseFloat(form.entryPrice) || 0,
        exit_price: parseFloat(form.exitPrice) || 0,
        lot_size: parseFloat(form.lotSize) || 0,
        risk_pct: form.riskPct.trim() ? Number(form.riskPct) : null,
        stop_loss: form.stopLoss ? parseFloat(form.stopLoss) : null,
        take_profit: form.takeProfit ? parseFloat(form.takeProfit) : null,
        open_time: toUtcTimestamp(form.openDate, trade.open_time),
        close_time: toUtcTimestamp(form.closeDate, trade.close_time),
      };

      const combinedLessons = form.mistakes
        ? `Lessons: ${form.lessons}\nMistakes: ${form.mistakes}`
        : form.lessons;

      const journalData = {
        post_trade_notes: form.notes,
        emotions: form.emotions,
        lessons: combinedLessons,
        tags: form.tags,
        strategy_setup: form.strategySetup,
      };

      const checklistData = {
        checked_higher_tf: form.checked_higher_tf,
        risk_within_limits: form.risk_within_limits,
        fits_plan: form.fits_plan,
        key_levels: form.key_levels,
        news_checked: form.news_checked,
      };

      await updateTrade.mutateAsync({
        id: trade.id,
        tradeData,
        journalData,
        checklistData,
      });

      toast.success("Trade updated successfully.");
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Unable to save changes.");
    }
  };

  const isLoading = isJournalLoading || isChecklistLoading;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !updateTrade.isPending && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border text-card-foreground p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 pb-2 border-b border-border">
          <DialogTitle className="text-xl font-bold">Edit Trade</DialogTitle>
          <DialogDescription>Update trade details, notes, and execution checks.</DialogDescription>
        </DialogHeader>

        {journalError || checklistError ? <LoadError name="trade details" retry={() => Promise.all([retryJournal(), retryChecklist()])} /> : isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Activity className="w-6 h-6 animate-pulse text-muted-foreground" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <form id="edit-trade-form" onSubmit={handleSubmit}><fieldset disabled={updateTrade.isPending} className="min-w-0 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Symbol</label>
                  <input aria-label="Symbol" type="text" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))}
                    className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" required />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Direction</label>
                  <div className="flex gap-2 h-[42px]">
                    {(['Long', 'Short'] as const).map(d => (
                      <button key={d} type="button" aria-pressed={form.direction === d} onClick={() => setForm(f => ({ ...f, direction: d }))}
                        className={`flex-1 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${form.direction === d
                            ? (d === 'Long' ? 'bg-profit-tint text-profit' : 'bg-loss-tint text-loss')
                            : 'bg-secondary text-foreground border border-border hover:bg-muted'
                          }`}>
                        {d === 'Long' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {[
                  { label: 'Entry Price', key: 'entryPrice', type: 'number' },
                  { label: 'Exit Price', key: 'exitPrice', type: 'number' },
                  { label: 'Lot Size', key: 'lotSize', type: 'number' },
                  { label: 'Stop Loss', key: 'stopLoss', type: 'number' },
                  { label: 'Take Profit', key: 'takeProfit', type: 'number' },


                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{field.label}</label>
                    <input aria-label={field.label} required={["entryPrice", "exitPrice", "lotSize"].includes(field.key)} min="0.01" type={field.type} step="0.01" value={(form as any)[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                ))}

                <div>
                  <label htmlFor="edit-risk-pct" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Recorded risk (%)</label>
                  <input id="edit-risk-pct" type="number" min="0" max="100" step="any" value={form.riskPct} onChange={e => setForm(f => ({ ...f, riskPct: e.target.value }))} placeholder="Not recorded" className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm" />
                  <p className="text-xs text-muted-foreground mt-1">Account equity risked at entry. Leave blank if unknown.</p>
                </div>
                <TradeDateTimePicker label="Open Date & Time" value={form.openDate} onChange={openDate => setForm(f => ({ ...f, openDate }))} />
                <TradeDateTimePicker label="Close Date & Time" value={form.closeDate} onChange={closeDate => setForm(f => ({ ...f, closeDate }))} />
                <div className="sm:col-span-2 text-xs text-muted-foreground" aria-live="polite">Holding duration: <strong className="text-foreground">{formatHoldingDuration(holdingDuration({ open_time: form.openDate && toUtcTimestamp(form.openDate, trade?.open_time), close_time: form.closeDate && toUtcTimestamp(form.closeDate, trade?.close_time) }))}</strong><span className="block mt-1">Local time · {localTimeZone()}. Close must be on or after open.</span></div>
              </div>

              <div className="pt-4 border-t border-border space-y-4">
                <h4 className="text-sm font-bold text-foreground">Journaling & Analysis</h4>
                <StrategySetupCard value={parseStrategySetup(form.strategySetup)} onChange={setup => setForm(f => ({ ...f, strategySetup: serializeStrategySetup(setup) }))} />

                {[
                  { label: 'Tags (comma separated)', key: 'tags' },

                  { label: 'Emotions', key: 'emotions' },
                  { label: 'Mistakes', key: 'mistakes' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{field.label}</label>
                    <input aria-label={field.label} type="text" value={(form as any)[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full bg-secondary dark:bg-[#121212] border border-border dark:border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                ))}

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Notes</label>
                  <textarea aria-label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                    className="w-full bg-secondary dark:bg-[#121212] border border-border dark:border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Lessons Learned</label>
                  <textarea aria-label="Lessons Learned" value={form.lessons} onChange={e => setForm(f => ({ ...f, lessons: e.target.value }))} rows={3}
                    className="w-full bg-secondary dark:bg-[#121212] border border-border dark:border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-bold text-foreground mb-4">Execution Checklist</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Checked Higher TF', key: 'checked_higher_tf' },
                    { label: 'Risk Within Limits', key: 'risk_within_limits' },
                    { label: 'Fits Trading Plan', key: 'fits_plan' },
                    { label: 'At Key Levels', key: 'key_levels' },
                    { label: 'News Checked', key: 'news_checked' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-muted rounded-lg transition-colors">
                      <div className="relative flex items-center justify-center">
                        <input type="checkbox" checked={(form as any)[item.key]} onChange={e => setForm(f => ({ ...f, [item.key]: e.target.checked }))}
                          className="peer appearance-none w-5 h-5 border-2 border-border rounded bg-transparent checked:bg-primary checked:border-primary transition-all cursor-pointer" />
                        <svg className="absolute w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-foreground dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm text-foreground/80 font-medium select-none">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </fieldset></form>
          </div>
        )}

        <div className="p-4 sm:p-6 border-t border-border flex flex-col sm:flex-row gap-3">
          <button type="submit" form="edit-trade-form" disabled={updateTrade.isPending || isLoading}
            className="touch-target w-full sm:flex-1 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 min-h-[44px] rounded-xl font-bold text-sm transition-all disabled:opacity-50">
            {updateTrade.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={onClose}
            className="touch-target w-full sm:w-auto bg-transparent border border-border hover:bg-muted text-foreground px-6 py-3 min-h-[44px] rounded-xl font-semibold text-sm transition-all">
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
