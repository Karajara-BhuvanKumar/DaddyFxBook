import { formatMarketTime } from '@/lib/marketTime';

const IST_TIME_ZONE = 'Asia/Kolkata';
const istDate = new Intl.DateTimeFormat('en-US', {
  timeZone: IST_TIME_ZONE, year: 'numeric', month: 'short', day: 'numeric',
});

/** Interpret datetime-local fields as UTC, independent of the device timezone. */
export function parseUtcDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  // setUTCFullYear handles years 0001–0099 without Date.UTC's 1900 offset.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, 0, 0);
  // Reject impossible dates instead of accepting JS date normalization.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function utcToIst(value: string): string | null {
  const date = parseUtcDateTime(value);
  if (!date) return null;
  return `${istDate.format(date)} · ${formatMarketTime(date, IST_TIME_ZONE, '12h').toUpperCase()} IST`;
}

export function currentUtcInput(now = new Date()): string {
  return now.toISOString().slice(0, 16);
}
