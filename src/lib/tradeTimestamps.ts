/** datetime-local controls display wall time; the database stores absolute instants. */
import { DEFAULT_MARKET_TIMEZONE, zonedParts } from './marketTime';

export function toLocalDateTime(value: string | null | undefined, timezone = DEFAULT_MARKET_TIMEZONE): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const p = zonedParts(date, timezone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function toUtcTimestamp(value: string, original?: string, timezone = DEFAULT_MARKET_TIMEZONE): string {
  // Saving unrelated fields must not truncate seconds or shift ambiguous DST times.
  if (original && toLocalDateTime(original, timezone) === value) return original;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('A valid trade date and time is required.');
  const wall = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== value) throw new Error('A valid trade date and time is required.');
  // Test offsets on both sides of a DST transition. Reject missing wall times;
  // choose the earlier occurrence of repeated times unless preserving an original.
  const candidates = new Set<number>();
  for (const delta of [-86400000, 0, 86400000]) {
    const probe = wall + delta;
    const p = zonedParts(probe, timezone);
    const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - probe;
    const candidate = wall - offset;
    if (toLocalDateTime(new Date(candidate).toISOString(), timezone) === value) candidates.add(candidate);
  }
  if (!candidates.size) throw new Error(`This time does not exist in ${timezone} because the clocks change. Choose another time.`);
  return new Date(Math.min(...candidates)).toISOString();
}

export function draftHoldingDuration(open: string, close: string, timezone: string, originalOpen?: string, originalClose?: string) {
  try {
    const duration = Date.parse(toUtcTimestamp(close, originalClose, timezone)) - Date.parse(toUtcTimestamp(open, originalOpen, timezone));
    return duration >= 0 ? duration : null;
  } catch { return null; }
}
