import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trade, useJournal, useChecklist, useUpdateTrade } from "@/hooks/useTrades";
import { ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EditTradeModalProps {
  trade: Trade | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditTradeModal({ trade, isOpen, onClose }: EditTradeModalProps) {
  const { data: journal, isLoading: isJournalLoading } = useJournal(trade?.id ?? null);
  const { data: checklist, isLoading: isChecklistLoading } = useChecklist(trade?.id ?? null);
  const updateTrade = useUpdateTrade();

  const [form, setForm] = useState({
    symbol: '',
    direction: 'Long' as 'Long' | 'Short',
    entryPrice: '',
    exitPrice: '',
    lotSize: '',
    stopLoss: '',
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
    if (trade && isOpen) {
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
        takeProfit: trade.take_profit?.toString() || '',
        openDate: trade.open_time.slice(0, 16),
        closeDate: trade.close_time.slice(0, 16),
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
  }, [trade, journal, checklist, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trade) return;

    try {
      const tradeData = {
        symbol: form.symbol,
        direction: form.direction,
        entry_price: parseFloat(form.entryPrice) || 0,
        exit_price: parseFloat(form.exitPrice) || 0,
        lot_size: parseFloat(form.lotSize) || 0,
        stop_loss: form.stopLoss ? parseFloat(form.stopLoss) : null,
        take_profit: form.takeProfit ? parseFloat(form.takeProfit) : null,
        open_time: form.openDate,
        close_time: form.closeDate,
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-[#0B0B0B] border-white/[0.08] text-white p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 pb-2 border-b border-white/[0.08]">
          <DialogTitle className="text-xl font-bold">Edit Trade</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Activity className="w-6 h-6 animate-pulse text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="flex-1 p-6">
            <form id="edit-trade-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Symbol</label>
                  <input type="text" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))}
                    className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" required />
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Direction</label>
                  <div className="flex gap-2 h-[42px]">
                    {(['Long', 'Short'] as const).map(d => (
                      <button key={d} type="button" onClick={() => setForm(f => ({ ...f, direction: d }))}
                        className={`flex-1 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${form.direction === d
                            ? (d === 'Long' ? 'bg-[#0A1224] text-[#3B82F6]' : 'bg-[#240A0A] text-[#EF4444]')
                            : 'bg-[#121212] text-foreground border border-white/[0.08] hover:bg-secondary'
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
                  { label: 'Commission', key: 'commission', type: 'number' },
                  { label: 'Swap', key: 'swap', type: 'number' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{field.label}</label>
                    <input type={field.type} step="0.01" value={(form as any)[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                ))}

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Open Date</label>
                  <input type="datetime-local" value={form.openDate} onChange={e => setForm(f => ({ ...f, openDate: e.target.value }))}
                    className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Close Date</label>
                  <input type="datetime-local" value={form.closeDate} onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))}
                    className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.08] space-y-4">
                <h4 className="text-sm font-bold text-white">Journaling & Analysis</h4>
                
                {[
                  { label: 'Tags (comma separated)', key: 'tags' },
                  { label: 'Strategy Setup', key: 'strategySetup' },
                  { label: 'Emotions', key: 'emotions' },
                  { label: 'Mistakes', key: 'mistakes' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{field.label}</label>
                    <input type="text" value={(form as any)[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                ))}

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                    className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Lessons Learned</label>
                  <textarea value={form.lessons} onChange={e => setForm(f => ({ ...f, lessons: e.target.value }))} rows={3}
                    className="w-full bg-[#121212] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.08]">
                <h4 className="text-sm font-bold text-white mb-4">Execution Checklist</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Checked Higher TF', key: 'checked_higher_tf' },
                    { label: 'Risk Within Limits', key: 'risk_within_limits' },
                    { label: 'Fits Trading Plan', key: 'fits_plan' },
                    { label: 'At Key Levels', key: 'key_levels' },
                    { label: 'News Checked', key: 'news_checked' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-[#121212] rounded-lg transition-colors">
                      <div className="relative flex items-center justify-center">
                        <input type="checkbox" checked={(form as any)[item.key]} onChange={e => setForm(f => ({ ...f, [item.key]: e.target.checked }))} 
                          className="peer appearance-none w-5 h-5 border-2 border-white/[0.2] rounded bg-transparent checked:bg-[#3B82F6] checked:border-[#3B82F6] transition-all cursor-pointer" />
                        <svg className="absolute w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm text-[#E2E8F0] font-medium select-none">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </form>
          </ScrollArea>
        )}

        <div className="p-4 sm:p-6 border-t border-white/[0.08] flex flex-col sm:flex-row gap-3">
          <button type="submit" form="edit-trade-form" disabled={updateTrade.isPending || isLoading} 
            className="touch-target w-full sm:flex-1 bg-[#3B82F6] hover:bg-blue-600 text-white px-6 py-3 min-h-[44px] rounded-xl font-bold text-sm transition-all disabled:opacity-50">
            {updateTrade.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={onClose} 
            className="touch-target w-full sm:w-auto bg-transparent border border-white/[0.1] hover:bg-white/[0.05] text-white px-6 py-3 min-h-[44px] rounded-xl font-semibold text-sm transition-all">
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
