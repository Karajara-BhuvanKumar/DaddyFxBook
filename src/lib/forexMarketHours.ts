import { calendarDay, DEFAULT_MARKET_TIMEZONE, formatMarketTime, localHourToUtc, zonedDateKey } from './marketTime';

// Conventional local forex activity sessions, not exchange/broker opening guarantees.
export const FOREX_SESSIONS = [
  { id: 'sydney', name: 'Sydney', zone: 'Australia/Sydney', open: 8, close: 17, flag: '🇦🇺' },
  { id: 'tokyo', name: 'Tokyo', zone: 'Asia/Tokyo', open: 9, close: 18, flag: '🇯🇵' },
  { id: 'london', name: 'London', zone: 'Europe/London', open: 8, close: 17, flag: '🇬🇧' },
  { id: 'new-york', name: 'New York', zone: 'America/New_York', open: 8, close: 17, flag: '🇺🇸' },
] as const;
export type MarketSessionId = typeof FOREX_SESSIONS[number]['id'];
export type SessionInterval = { start: number; end: number };
const DAY = 86400000, HOUR = 3600000;
const contains = (interval: SessionInterval, now: number) => interval.start <= now && now < interval.end;

function tradingWeekBounds(instant: number) {
  const day = calendarDay(instant, 'America/New_York');
  const sunday = day - new Date(day).getUTCDay() * DAY;
  return { start: localHourToUtc(sunday, 17, 'America/New_York'), end: localHourToUtc(sunday + 5 * DAY, 17, 'America/New_York') };
}

export function forexWeekIsOpen(now: Date) {
  return contains(tradingWeekBounds(now.getTime()), now.getTime());
}

export function timelineBounds(now: Date, zone: string, startHour = 0) {
  let day = calendarDay(now, zone);
  if (now.getTime() < localHourToUtc(day, startHour, zone)) day -= DAY;
  return { start: localHourToUtc(day, startHour, zone), end: localHourToUtc(day + DAY, startHour, zone) };
}

export function buildForexSchedule(now: Date, zone = DEFAULT_MARKET_TIMEZONE, startHour = 0) {
  const bounds = timelineBounds(now, zone, startHour);
  const anchor = calendarDay(now, zone);
  const sessions = FOREX_SESSIONS.map(session => {
    const intervals: SessionInterval[] = [];
    for (let offset = -3; offset <= 10; offset++) {
      const day = anchor + offset * DAY;
      if ([0, 6].includes(new Date(day).getUTCDay())) continue;
      const opening = localHourToUtc(day, session.open, session.zone);
      const closing = localHourToUtc(day, session.close, session.zone);
      const week = tradingWeekBounds(opening);
      const start = Math.max(opening, week.start), end = Math.min(closing, week.end);
      if (end > start) intervals.push({ start, end });
    }
    return { ...session, intervals };
  });
  return { bounds, zone, sessions };
}
export type ForexSchedule = ReturnType<typeof buildForexSchedule>;

export function sessionOverlap(first: SessionInterval[], second: SessionInterval[]) {
  return first.flatMap(a => second.map(b => ({ start: Math.max(a.start, b.start), end: Math.min(a.end, b.end) })).filter(i => i.end > i.start)).sort((a, b) => a.start - b.start);
}

export function bestTradingWindows(schedule: ForexSchedule, now: Date) {
  const intervals = (id: MarketSessionId) => schedule.sessions.find(s => s.id === id)!.intervals;
  const definitions = [
    { id: 'overlap', label: 'Highest activity', title: 'London + New York overlap', description: 'Two major sessions trading together. Often a busier window for EUR/USD and GBP/USD.', intervals: sessionOverlap(intervals('london'), intervals('new-york')) },
    { id: 'london-open', label: 'London open', title: 'First two session hours', description: 'The start of London’s session, when European trading activity typically increases.', intervals: intervals('london').map(i => ({ start: i.start, end: Math.min(i.end, i.start + 2 * HOUR) })) },
    { id: 'tokyo-open', label: 'Tokyo open', title: 'First three session hours', description: 'The opening hours of Tokyo’s session, with a focus on Asian currency markets.', intervals: intervals('tokyo').map(i => ({ start: i.start, end: Math.min(i.end, i.start + 3 * HOUR) })) },
  ];
  return definitions.map(({ intervals: windows, ...definition }) => {
    // Active or next occurrence: Friday/weekend cards never reuse a pre-DST range.
    const interval = windows.find(i => i.end > now.getTime())!;
    return { ...definition, ...interval, active: contains(interval, now.getTime()) };
  });
}

export function marketActivity(schedule: ForexSchedule, instant: number) {
  const active = schedule.sessions.filter(s => s.intervals.some(i => contains(i, instant))).map(s => s.id);
  // Qualitative schedule indicator only; no fabricated market-volume data.
  const overlap = active.includes('london') && active.includes('new-york');
  return { score: overlap ? 3 : active.length > 1 || active.includes('london') || active.includes('new-york') ? 2 : active.length ? 1 : 0,
    label: overlap ? 'High' : active.length > 1 || active.includes('london') || active.includes('new-york') ? 'Moderate' : active.length ? 'Low' : 'Closed' };
}

export function activitySeries(schedule: ForexSchedule) {
  const { start, end } = schedule.bounds;
  const boundaries = [...new Set([start, end, ...schedule.sessions.flatMap(s => s.intervals.flatMap(i => [i.start, i.end])).filter(t => t > start && t < end)])].sort((a, b) => a - b);
  return boundaries.map((time, index) => ({ progress: (time - start) / (end - start) * 100,
    score: marketActivity(schedule, time === end ? time - 1 : time).score,
    before: marketActivity(schedule, index ? time - 1 : time).score }));
}

export function forexMarketHours(now: Date, zone = DEFAULT_MARKET_TIMEZONE, schedule = buildForexSchedule(now, zone)) {
  const { start, end } = schedule.bounds;
  const durationMinutes = (end - start) / 60000;
  const sessions = schedule.sessions.map(session => {
    const current = session.intervals.find(i => contains(i, now.getTime()));
    const next = session.intervals.find(i => i.start > now.getTime())!;
    const today = session.intervals.filter(i => i.start < end && i.end > start);
    const display = current ?? today.find(i => i.start >= start) ?? today[0] ?? next;
    return { ...session, current, active: !!current, next, display,
      hours: `${formatMarketTime(display.start, zone)} – ${formatMarketTime(display.end, zone)}`,
      crossesMidnight: zonedDateKey(display.start, zone) !== zonedDateKey(display.end, zone),
      segments: today.map(i => ({ start: (Math.max(i.start, start) - start) / 60000, end: (Math.min(i.end, end) - start) / 60000 })),
    };
  });
  const ticks = [];
  for (let at = start; at <= end; at += HOUR) ticks.push({ at, progress: (at - start) / (end - start) * 100 });
  if (ticks[ticks.length - 1].at !== end) ticks.push({ at: end, progress: 100 });
  return { sessions, isOpen: forexWeekIsOpen(now), progress: (now.getTime() - start) / (end - start) * 100, durationMinutes,
    bounds: schedule.bounds, ticks, bestTimes: bestTradingWindows(schedule, now), activity: marketActivity(schedule, now.getTime()) };
}

export const formatIstTime = (date: Date | number) => formatMarketTime(date, DEFAULT_MARKET_TIMEZONE);
