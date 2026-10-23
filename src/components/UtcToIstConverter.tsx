import { useId, useRef, useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Clock3, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import UtcConverterPicker from '@/components/UtcConverterPicker';
import { convertUtcTime, currentUtcInput, parseUtcTime, utcDateToCalendar } from '@/lib/utcToIst';
import '@/styles/trade-time.css';
import '@/styles/utc-converter.css';

export default function UtcToIstConverter() {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<'convert' | 'date' | 'time'>('convert');
  const [date, setDate] = useState(() => currentUtcInput().slice(0, 10));
  const [time, setTime] = useState('');
  const converted = convertUtcTime(date, time);
  const selected = utcDateToCalendar(date);
  const invalidTime = time.trim() !== '' && !parseUtcTime(time);
  const hint = !date ? 'Choose a UTC date to convert.'
    : invalidTime ? 'Use h:mm[:ss] AM/PM or HH:mm[:ss] (00–23).'
    : !time.trim() ? 'Paste a 12-hour or 24-hour UTC time. Seconds are optional.'
    : 'Input is UTC. IST has no daylight saving time.';

  async function copyTimestamp(includeDate: boolean) {
    if (!converted) return;
    try {
      await navigator.clipboard.writeText(includeDate ? converted.timestamp : converted.timeLabel);
      toast.success(includeDate ? 'IST date and time copied' : 'IST time copied');
    } catch {
      toast.error('Could not copy. Select the IST result and copy it manually.');
    }
  }

  function useNow() {
    const now = currentUtcInput();
    setDate(now.slice(0, 10));
    setTime(now.slice(11));
  }

  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); if (next) setStage('convert'); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label="UTC → IST converter"
          className="min-h-11 shrink-0 rounded-full bg-card px-3 text-xs data-[state=open]:border-primary/50 data-[state=open]:text-primary">
          <Clock3 className="text-primary" aria-hidden="true" />UTC → IST
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} collisionPadding={12} aria-labelledby={`${id}-title`}
        className="trade-time-picker utc-converter" data-stage={stage}
        onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus(); }}
        onClick={event => event.stopPropagation()}>
        <div className="utc-converter-heading">
          <h2 id={`${id}-title`}>UTC → IST Converter</h2>
          <Button type="button" variant="ghost" size="icon" aria-label="Close UTC → IST converter"
            className="h-11 w-11 shrink-0 rounded-full" onClick={() => setOpen(false)}><X aria-hidden="true" /></Button>
        </div>
        <p className="utc-converter-zone">UTC +00:00 → IST +05:30</p>
        {stage === 'convert' ? <>
          <Label htmlFor={`${id}-time`} className="mb-2 block text-xs font-semibold">UTC time</Label>
          <div className="utc-paste-row">
            <Input ref={inputRef} id={`${id}-time`} type="text" value={time} autoComplete="off" spellCheck={false}
              placeholder="11:19:36 AM" aria-invalid={invalidTime} aria-describedby={`${id}-hint`}
              onChange={event => setTime(event.target.value)} className="h-12 min-w-0 rounded-xl font-mono text-base"
              autoFocus />
            <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-xl"
              aria-label="Choose UTC time" onClick={() => setStage('time')}><Clock3 aria-hidden="true" /></Button>
          </div>
          <div className="utc-date-row">
            <button type="button" className="utc-date-trigger" aria-label="Choose UTC date" onClick={() => setStage('date')}>
              <CalendarDays size={16} aria-hidden="true" /><span>{selected ? format(selected, 'MMM d, yyyy') : 'Choose date'}<small>UTC date</small></span>
            </button>
            <button type="button" className="utc-now" onClick={useNow}>Use Current UTC Time</button>
          </div>
          <p id={`${id}-hint`} className={`utc-converter-hint ${invalidTime || !date ? 'text-destructive' : 'text-muted-foreground'}`}>{hint}</p>
          <div className="utc-converter-result">
            <span id={`${id}-output-label`} className="text-xs text-muted-foreground">Converted IST</span>
            <div className="utc-result-row">
              <output aria-labelledby={`${id}-output-label`} aria-live="polite" aria-atomic="true">
                <strong>{converted?.timeLabel ?? '—'}</strong>
                {converted && <span>{converted.dateLabel}{converted.nextDay && <b>Next day</b>}</span>}
              </output>
              <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl text-primary"
                aria-label="Copy IST time" disabled={!converted} onClick={() => copyTimestamp(false)}><Copy aria-hidden="true" /></Button>
            </div>
            <button type="button" className="utc-copy-full" disabled={!converted} onClick={() => copyTimestamp(true)}>Copy date &amp; time</button>
          </div>
        </> : <UtcConverterPicker key={stage} stage={stage} date={date} time={time} onDate={setDate} onTime={setTime} onStage={setStage} />}
      </PopoverContent>
    </Popover>
  );
}
