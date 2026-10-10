import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronUp, Clock } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toLocalDateTime } from '@/lib/tradeTimestamps';
import { localTimeZone } from '@/lib/holdingTime';
import '@/styles/trade-time.css';

export default function TradeDateTimePicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);
  const [stage, setStage] = useState<'date' | 'time'>('date');
  const [month, setMonth] = useState(new Date());
  const selected = value && Number.isFinite(new Date(value).getTime()) ? new Date(value) : null;
  const choose = (date: Date) => { setDraft(date); setMonth(date); setStage('time'); };
  const changeTime = (part: 'hour' | 'minute', amount: number, absolute = false) => {
    if (!draft) return;
    const next = new Date(draft);
    if (part === 'hour') next.setHours(absolute ? (amount % 12) + (draft.getHours() >= 12 ? 12 : 0) : (draft.getHours() + amount + 24) % 24);
    else next.setMinutes(absolute ? amount : (draft.getMinutes() + amount + 60) % 60);
    setDraft(next);
  };
  return <div className="trade-time-field">
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{label}</label>
    <Popover open={open} onOpenChange={next => { setOpen(next); if (next) { setDraft(selected); setMonth(selected ?? new Date()); setStage('date'); } }}>
      <PopoverTrigger asChild><button type="button" className="trade-time-trigger" aria-label={label} title={`Local time · ${localTimeZone()}`}><CalendarDays size={17} /><span>{selected ? format(selected, 'MMM d, yyyy h:mm a') : 'Select date and time'}</span></button></PopoverTrigger>
      <PopoverContent align="start" collisionPadding={12} className="trade-time-picker" data-stage={stage} aria-label={`${label} picker`}>
        {stage === 'date' ? <>
          <div className="trade-time-shortcuts"><button type="button" onClick={() => choose(new Date())}>Now</button><button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); choose(d); }}>Yesterday</button><button type="button" onClick={() => { onChange(''); setOpen(false); }}>Clear</button></div>
          <Calendar mode="single" fixedWeeks month={month} onMonthChange={setMonth} selected={draft ?? undefined}
            formatters={{ formatCaption: date => format(date, 'MMM yyyy'), formatWeekdayName: date => format(date, 'EEEEEE').toUpperCase() }}
            classNames={{ months: 'trade-calendar-months', month: 'trade-calendar-month', caption: 'trade-calendar-caption', caption_label: 'trade-calendar-title', nav: 'trade-calendar-nav', nav_button: 'trade-calendar-nav-button', nav_button_previous: 'trade-calendar-previous', nav_button_next: 'trade-calendar-next', table: 'trade-calendar-grid', head_row: 'trade-calendar-week', head_cell: 'trade-calendar-weekday', row: 'trade-calendar-week', cell: 'trade-calendar-cell', day: 'trade-calendar-day', day_selected: 'trade-calendar-selected', day_today: 'trade-calendar-today', day_outside: 'trade-calendar-outside' }}
            onDayClick={date => { date.setHours(draft?.getHours() ?? 0, draft?.getMinutes() ?? 0, 0, 0); choose(date); }} initialFocus />
        </> : draft && <>
          <div className="trade-time-heading"><button type="button" aria-label="Back to calendar" onClick={() => setStage('date')}><ChevronLeft size={16} /><CalendarDays size={15} /></button><strong>{format(draft, 'MMMM do, yyyy')}</strong></div>
          <p className="trade-time-caption"><Clock size={16} />Set Time</p>
          <div className="trade-time-clock">
            {(['hour', 'minute'] as const).map((part, index) => <div className="trade-time-unit" key={part}>
              <button type="button" aria-label={`Increase ${part}`} onClick={() => changeTime(part, 1)}><ChevronUp size={17} /></button>
              <input aria-label={part === 'hour' ? 'Hour' : 'Minute'} type="number" min={index ? 0 : 1} max={index ? 59 : 12} value={index ? String(draft.getMinutes()).padStart(2, '0') : draft.getHours() % 12 || 12} onChange={e => { const n = Number(e.target.value); if (e.target.value && n >= (index ? 0 : 1) && n <= (index ? 59 : 12)) changeTime(part, n, true); }} />
              <button type="button" aria-label={`Decrease ${part}`} onClick={() => changeTime(part, -1)}><ChevronDown size={17} /></button>
            </div>)}
            <button type="button" className="trade-time-period" aria-label="Toggle AM/PM" onClick={() => { const next = new Date(draft); next.setHours((next.getHours() + 12) % 24); setDraft(next); }}>{draft.getHours() < 12 ? 'AM' : 'PM'}</button>
          </div>
        </>}
        {stage === 'time' && <div className="trade-time-footer"><button type="button" className="trade-time-done" onClick={() => { onChange(draft ? toLocalDateTime(draft.toISOString()) : ''); setOpen(false); }}><Check size={18} />Done</button></div>}
      </PopoverContent>
    </Popover>
  </div>;
}
