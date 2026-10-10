/** Require an actual clock time; legacy date-only values cannot establish a duration. */
export function timestampMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const second = Number(match[6] ?? 0);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function holdingDuration(trade: { open_time?: string | null; close_time?: string | null; status?: string }): number | null {
  if (trade.status && !['closed', 'realized'].includes(trade.status.toLowerCase())) return null;
  const open = timestampMs(trade.open_time), close = timestampMs(trade.close_time);
  return open === null || close === null || close < open ? null : close - open;
}

/** Round only the display. All calculations and bucket boundaries use milliseconds. */
export function formatHoldingDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return 'Not available';
  if (ms === 0) return '0m';
  if (ms < 60000) return '<1m';
  const minutes = Math.floor(ms / 60000);
  return [Math.floor(minutes / 1440) && `${Math.floor(minutes / 1440)}d`, Math.floor(minutes / 60) % 24 && `${Math.floor(minutes / 60) % 24}h`, minutes % 60 && `${minutes % 60}m`].filter(Boolean).join(' ');
}

export function tradeTimeParts(value: unknown) {
  const ms = timestampMs(value);
  if (ms === null) return { date: 'Not recorded', time: 'Not recorded' };
  const date = new Date(ms);
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }),
  };
}
export function formatTradeDateTime(value: unknown) {
  const parts = tradeTimeParts(value);
  return parts.date === 'Not recorded' ? parts.date : `${parts.date}, ${parts.time}`;
}
export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
