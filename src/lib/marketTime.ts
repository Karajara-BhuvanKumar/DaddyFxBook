export type TimeFormat = '12h' | '24h';
export const DEFAULT_MARKET_TIMEZONE = 'Asia/Kolkata';
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string, options: Intl.DateTimeFormatOptions, locale = 'en-GB') {
  const key = JSON.stringify([zone, options, locale]);
  if (!formatters.has(key)) formatters.set(key, new Intl.DateTimeFormat(locale, { ...options, timeZone: zone }));
  return formatters.get(key)!;
}

export function zonedParts(date: Date | number, zone: string) {
  const parts = Object.fromEntries(formatter(zone, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]));
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, minute: +parts.minute, second: +parts.second };
}

export function zonedDateKey(date: Date | number, zone: string) {
  const p = zonedParts(date, zone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

// Calendar-day arithmetic uses UTC as a date container, never the device timezone.
export function calendarDay(date: Date | number, zone: string) {
  const p = zonedParts(date, zone);
  return Date.UTC(p.year, p.month - 1, p.day);
}

export function localHourToUtc(day: number, hour: number, zone: string) {
  const d = new Date(day);
  const wall = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour);
  let utc = wall;
  // Session boundaries and 06:00 timeline anchors are outside DST's ambiguous hours.
  for (let i = 0; i < 4; i++) {
    const p = zonedParts(utc, zone);
    const adjustment = wall - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    utc += adjustment;
    if (adjustment === 0) break;
  }
  return utc;
}

export function formatMarketTime(date: Date | number, zone: string, format: TimeFormat = '24h', seconds = false) {
  return formatter(zone, { hour: format === '12h' ? 'numeric' : '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}), hourCycle: format === '12h' ? 'h12' : 'h23' }).format(date);
}

export function formatMarketDate(date: Date | number, zone: string) {
  return formatter(zone, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

// Display aliases for Intl's date-specific names, not a zone->label or offset
// table. Intl decides which seasonal name applies at each instant.
const nameAliases: Record<string, string> = {
  'Australian Eastern Daylight Time': 'AEDT', 'Australian Eastern Standard Time': 'AEST',
  'Japan Standard Time': 'JST', 'British Summer Time': 'BST', 'Greenwich Mean Time': 'GMT',
  'Eastern Standard Time': 'EST', 'Eastern Daylight Time': 'EDT',
  'India Standard Time': 'IST', 'Coordinated Universal Time': 'UTC',
  // Some Chromium/ICU builds return an offset instead of the full winter name.
  'GMT+00:00': 'GMT', 'GMT+0': 'GMT',
};

export function marketZoneInfo(date: Date | number, zone: string) {
  const part = (style: 'long' | 'short' | 'longOffset') => formatter(zone, { timeZoneName: style }, 'en-GB').formatToParts(date).find(p => p.type === 'timeZoneName')!.value;
  const name = part('long');
  return { name, abbreviation: nameAliases[name] ?? part('short'), offset: part('longOffset').replace('GMT', 'UTC') };
}

export function formatCountdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(seconds / 86400);
  return `${days ? `${days}d ` : ''}${String(Math.floor(seconds / 3600) % 24).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
