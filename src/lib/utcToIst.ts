import { formatMarketTime, zonedParts } from '@/lib/marketTime';

const IST_TIME_ZONE = 'Asia/Kolkata';
const istDate = new Intl.DateTimeFormat('en-US', {
  timeZone: IST_TIME_ZONE, year: 'numeric', month: 'short', day: 'numeric',
});
const pad = (value: number) => String(value).padStart(2, '0');

export type UtcTime = { hour: number; minute: number; second: number };

/** A pasted clock time is always UTC, never the device's local wall time. */
export function parseUtcTime(value: string): UtcTime | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]), second = Number(match[3] ?? 0);
  const period = match[4]?.toUpperCase();
  if (minute > 59 || second > 59 || (period ? hour < 1 || hour > 12 : hour > 23)) return null;
  return { hour: period ? hour % 12 + (period === 'PM' ? 12 : 0) : hour, minute, second };
}

export function formatUtcTime(time: UtcTime): string {
  return `${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}`;
}

/** Strict calendar validation; do not let JS normalize impossible dates. */
export function parseUtcDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const second = Number(match[6] ?? 0);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function utcToIst(value: string): string | null {
  const date = parseUtcDateTime(value);
  if (!date) return null;
  return `${istDate.format(date)} · ${formatMarketTime(date, IST_TIME_ZONE, '12h', value.length === 19).toUpperCase()} IST`;
}

export function convertUtcTime(dateKey: string, value: string) {
  const time = parseUtcTime(value);
  if (!time) return null;
  const date = parseUtcDateTime(`${dateKey}T${formatUtcTime(time)}`);
  if (!date) return null;
  const parts = zonedParts(date, IST_TIME_ZONE);
  const istDateKey = `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}`;
  const dateLabel = istDate.format(date);
  const timeLabel = `${formatMarketTime(date, IST_TIME_ZONE, '12h', true).toUpperCase()} IST`;
  return { dateLabel, timeLabel, timestamp: `${dateLabel} · ${timeLabel}`, nextDay: istDateKey !== dateKey };
}

export function currentUtcInput(now = new Date()): string {
  return now.toISOString().slice(0, 19);
}

/** Calendar UI uses a local date carrier; it must never be serialized as an instant. */
export function utcDateToCalendar(dateKey: string): Date | undefined {
  const utc = parseUtcDateTime(`${dateKey}T00:00`);
  if (!utc) return undefined;
  const carrier = new Date(0);
  carrier.setFullYear(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
  carrier.setHours(12, 0, 0, 0);
  return carrier;
}

export function calendarToUtcDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
