// Single source of truth: minutes after IST midnight (UTC+05:30, no DST).
// Entry is permitted at the start, and off-session at the exact end.
const formatHour = (minute: number) => `${Math.floor(minute / 60) % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${minute < 720 ? 'AM' : 'PM'}`;
export const IST_MARKET_SESSIONS = [
  { id: 'asian', name: 'Asian', start: 330, end: 480 },
  { id: 'london', name: 'London', start: 660, end: 870 },
  { id: 'new-york', name: 'New York', start: 1020, end: 1230 },
].map(session => ({ ...session, hours: `${formatHour(session.start)} – ${formatHour(session.end)}` }));

/** Compatibility for saved rules predating the combined Asian option. */
export function normalizeSessionIds(ids: readonly string[] = []) {
  return [...new Set(ids.map(id => id === 'sydney' || id === 'tokyo' ? 'asian' : id))];
}

function istMinute(date: Date) {
  const shifted = new Date(date.getTime() + 330 * 60000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes() + shifted.getUTCSeconds() / 60 + shifted.getUTCMilliseconds() / 60000;
}

export function sessionsAt(date: Date) {
  const minute = istMinute(date);
  return IST_MARKET_SESSIONS.filter(s => sessionIsActive(minute, s.start, s.end));
}

export function sessionIsActive(minute: number, start: number, end: number) {
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

export function sessionSegments(start: number, end: number) {
  return start < end ? [{ start, end }] : [{ start: 0, end }, { start, end: 1440 }];
}

export function istSessionClock(date: Date) {
  const shifted = new Date(date.getTime() + 330 * 60000);
  const minute = istMinute(date);
  return {
    minute,
    progress: minute / 1440 * 100,
    active: sessionsAt(date),
    time: [shifted.getUTCHours(), shifted.getUTCMinutes(), shifted.getUTCSeconds()].map(v => String(v).padStart(2, '0')).join(':'),
    date: date.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

export const IST_TIMELINE_TICKS: { minute: number; label: string; major?: boolean; mobileOnly?: boolean }[] = [
  { minute: 0, label: '00:00', major: true },
  ...[360, 720, 1080].map(minute => ({ minute, label: `${String(minute / 60).padStart(2, '0')}:00`, mobileOnly: true, major: true })),
  ...[...new Set(IST_MARKET_SESSIONS.flatMap(s => [s.start, s.end]))].map(minute => ({ minute, label: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}` })),
  { minute: 1440, label: '24:00', major: true },
].sort((a, b) => a.minute - b.minute);
