import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronUp, Clock3 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { calendarToUtcDate, currentUtcInput, parseUtcTime, utcDateToCalendar } from '@/lib/utcToIst';

type Props = {
  date: string;
  time: string;
  stage: 'date' | 'time';
  onDate: (date: string) => void;
  onTime: (time: string) => void;
  onStage: (stage: 'date' | 'time' | 'convert') => void;
};

const calendarClasses = {
  months: 'trade-calendar-months', month: 'trade-calendar-month',
  caption: 'trade-calendar-caption', caption_label: 'trade-calendar-title',
  nav: 'trade-calendar-nav', nav_button: 'trade-calendar-nav-button',
  nav_button_previous: 'trade-calendar-previous', nav_button_next: 'trade-calendar-next',
  table: 'trade-calendar-grid', head_row: 'trade-calendar-week', head_cell: 'trade-calendar-weekday',
  row: 'trade-calendar-week', cell: 'trade-calendar-cell', day: 'trade-calendar-day',
  day_selected: 'trade-calendar-selected', day_today: 'trade-calendar-today', day_outside: 'trade-calendar-outside',
};

export default function UtcConverterPicker({ date, time, stage, onDate, onTime, onStage }: Props) {
  const today = utcDateToCalendar(currentUtcInput().slice(0, 10))!;
  const selected = utcDateToCalendar(date);
  const [month, setMonth] = useState(selected ?? today);

  return <>
    <div className="utc-picker-back">
      <button type="button" onClick={() => onStage('convert')} aria-label="Back to converter"><ChevronLeft size={16} />Converter</button>
    </div>
    {stage === 'date' ? <>
      <div className="trade-time-shortcuts">
        <button type="button" onClick={() => {
          const now = currentUtcInput(); onDate(now.slice(0, 10)); onTime(now.slice(11)); onStage('time');
        }}>Now</button>
        <button type="button" onClick={() => {
          const yesterday = new Date(); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
          onDate(yesterday.toISOString().slice(0, 10)); onStage('time');
        }}>Yesterday</button>
        <button type="button" onClick={() => { onDate(''); onStage('convert'); }}>Clear</button>
      </div>
      <Calendar mode="single" fixedWeeks month={month} onMonthChange={setMonth} selected={selected} today={today}
        fromYear={1} toYear={9999}
        formatters={{ formatCaption: d => format(d, 'MMM yyyy'), formatWeekdayName: d => format(d, 'EEEEEE').toUpperCase() }}
        classNames={calendarClasses}
        onDayClick={d => { onDate(calendarToUtcDate(d)); onStage('time'); }} initialFocus />
    </> : <>
      <div className="trade-time-heading">
        <button type="button" aria-label="Back to UTC calendar" onClick={() => onStage('date')}><ChevronLeft size={16} /><CalendarDays size={15} /></button>
        <strong>{selected ? format(selected, 'MMMM do, yyyy') : 'Choose a UTC date'}</strong>
      </div>
      <p className="trade-time-caption"><Clock3 size={16} />Set Time · UTC</p>
      <UtcClock time={time} onTime={onTime} />
      {!parseUtcTime(time) && <p className="utc-converter-hint text-destructive" role="status">Enter hour (1–12), minute and second (0–59).</p>}
      <div className="trade-time-footer">
        <button type="button" className="trade-time-done" disabled={!selected || !parseUtcTime(time)} onClick={() => onStage('convert')}><Check size={18} />Done</button>
      </div>
    </>}
  </>;
}

function UtcClock({ time, onTime }: { time: string; onTime: (time: string) => void }) {
  const parsed = parseUtcTime(time);
  const [fields, setFields] = useState(() => ({
    hour: parsed ? String(parsed.hour % 12 || 12) : '',
    minute: parsed ? String(parsed.minute).padStart(2, '0') : '',
    second: parsed ? String(parsed.second).padStart(2, '0') : '',
    period: parsed && parsed.hour >= 12 ? 'PM' : 'AM',
  }));
  type Part = 'hour' | 'minute' | 'second';
  function update(next: typeof fields) {
    setFields(next);
    // Keep incomplete input incomplete instead of coercing blanks to zero.
    onTime(`${next.hour}:${next.minute.padStart(next.minute ? 2 : 0, '0')}:${next.second.padStart(next.second ? 2 : 0, '0')} ${next.period}`);
  }
  function step(part: Part, amount: number) {
    const min = part === 'hour' ? 1 : 0, max = part === 'hour' ? 12 : 59;
    const current = fields[part] === '' ? (amount > 0 ? min - 1 : max + 1) : Number(fields[part]);
    const next = ((current - min + amount) % (max - min + 1) + (max - min + 1)) % (max - min + 1) + min;
    update({ ...fields, [part]: String(next).padStart(part === 'hour' ? 1 : 2, '0') });
  }
  return <div className="trade-time-clock utc-time-clock">
    {(['hour', 'minute', 'second'] as const).map(part => <div className="trade-time-unit" key={part}>
      <button type="button" aria-label={`Increase UTC ${part}`} onClick={() => step(part, 1)}><ChevronUp size={17} /></button>
      <input aria-label={`UTC ${part}`} type="text" inputMode="numeric" maxLength={2} value={fields[part]}
        aria-invalid={fields[part] === '' || Number(fields[part]) < (part === 'hour' ? 1 : 0) || Number(fields[part]) > (part === 'hour' ? 12 : 59)}
        onChange={e => { if (/^\d{0,2}$/.test(e.target.value)) update({ ...fields, [part]: e.target.value }); }} />
      <button type="button" aria-label={`Decrease UTC ${part}`} onClick={() => step(part, -1)}><ChevronDown size={17} /></button>
      <span className="utc-unit-label">{part === 'hour' ? 'HH' : part === 'minute' ? 'MM' : 'SS'}</span>
    </div>)}
    <button type="button" className="trade-time-period" aria-label="Toggle UTC AM/PM"
      onClick={() => update({ ...fields, period: fields.period === 'AM' ? 'PM' : 'AM' })}>{fields.period}</button>
  </div>;
}
