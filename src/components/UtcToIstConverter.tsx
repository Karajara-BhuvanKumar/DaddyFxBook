import { useId, useState } from 'react';
import { Clock3, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { currentUtcInput, utcToIst } from '@/lib/utcToIst';

export default function UtcToIstConverter() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const converted = utcToIst(value);
  const invalid = value !== '' && converted === null;

  async function copyTimestamp() {
    if (!converted) return;
    try {
      await navigator.clipboard.writeText(converted);
      toast.success('IST timestamp copied');
    } catch {
      toast.error('Could not copy. Select the IST timestamp and copy it manually.');
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm"
          aria-label="UTC → IST converter"
          className="min-h-11 shrink-0 rounded-full bg-card px-3 text-xs data-[state=open]:border-primary/50 data-[state=open]:text-primary">
          <Clock3 className="text-primary" aria-hidden="true" />
          UTC → IST
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} collisionPadding={12}
        aria-labelledby={`${id}-title`}
        className="w-80 max-w-[calc(100vw-24px)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-2xl border-border bg-popover p-4 shadow-sm"
        onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <h2 id={`${id}-title`} className="text-sm font-semibold">UTC → IST Converter</h2>
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full"
            aria-label="Close UTC → IST converter" onClick={() => setOpen(false)}>
            <X aria-hidden="true" />
          </Button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">UTC +00:00 → IST +05:30</p>
        <Label htmlFor={`${id}-input`} className="mb-2 block text-xs">UTC Date &amp; Time</Label>
        <Input id={`${id}-input`} type="datetime-local" value={value}
          min="0001-01-01T00:00" max="9999-12-31T23:59" step={60}
          onChange={event => setValue(event.target.value)}
          aria-invalid={invalid} aria-describedby={`${id}-hint`}
          className="h-11 min-w-0 max-w-full rounded-lg" />
        <Button type="button" variant="link" className="min-h-11 px-0 text-xs"
          onClick={() => setValue(currentUtcInput())}>Use Current UTC Time</Button>
        <p id={`${id}-hint`} className={`mb-3 text-xs ${invalid ? 'text-destructive' : 'text-muted-foreground'}`}>
          {invalid ? 'Enter a valid UTC date and time.' : !value ? 'Enter a complete UTC date and time to convert.' : 'Input is UTC. IST has no daylight saving time.'}
        </p>
        <div className="rounded-xl border border-border bg-secondary/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <span id={`${id}-output-label`} className="text-xs text-muted-foreground">Converted IST</span>
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-lg text-primary"
              aria-label="Copy IST timestamp" disabled={!converted} onClick={copyTimestamp}>
              <Copy aria-hidden="true" />
            </Button>
          </div>
          <output aria-labelledby={`${id}-output-label`} aria-live="polite" aria-atomic="true"
            className="block select-text text-sm font-semibold leading-relaxed">
            {converted ?? '—'}
          </output>
        </div>
      </PopoverContent>
    </Popover>
  );
}
