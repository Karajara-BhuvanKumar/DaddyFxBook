// Fixed IST schedule requested for this clock; independent of browser timezone and DST.
export const IST_MARKET_SESSIONS = [
  { id: 'sydney', name: 'Sydney', start: 210, end: 750, hours: '03:30 – 12:30' },
  { id: 'tokyo', name: 'Tokyo', start: 330, end: 870, hours: '05:30 – 14:30' },
  { id: 'london', name: 'London', start: 810, end: 1350, hours: '13:30 – 22:30' },
  { id: 'new-york', name: 'New York', start: 1110, end: 210, hours: '18:30 – 03:30' },
] as const;

export function sessionIsActive(minute: number, start: number, end: number) {
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

export function sessionSegments(start: number, end: number) {
  return start < end ? [{ start, end }] : [{ start: 0, end }, { start, end: 1440 }];
}

export function istSessionClock(date: Date) {
  const shifted = new Date(date.getTime() + 330 * 60000);
  const minute = shifted.getUTCHours() * 60 + shifted.getUTCMinutes() + shifted.getUTCSeconds() / 60 + shifted.getUTCMilliseconds() / 60000;
  return {
    minute,
    progress: minute / 1440 * 100,
    active: IST_MARKET_SESSIONS.filter(s => sessionIsActive(minute, s.start, s.end)),
    time: [shifted.getUTCHours(), shifted.getUTCMinutes(), shifted.getUTCSeconds()].map(v => String(v).padStart(2, '0')).join(':'),
    date: date.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

export const IST_TIMELINE_TICKS = [
  { minute: 0, label: '00:00', major: true },
  { minute: 210, label: '03:30' }, { minute: 330, label: '05:30' },
  { minute: 360, label: '06:00', mobileOnly: true, major: true },
  { minute: 480, label: '08:00' }, { minute: 720, label: '12:00', mobileOnly: true, major: true },
  { minute: 750, label: '12:30', lower: true }, { minute: 810, label: '13:30' }, { minute: 870, label: '14:30', lower: true },
  { minute: 1080, label: '18:00', mobileOnly: true, major: true },
  { minute: 1110, label: '18:30' }, { minute: 1350, label: '22:30', lower: true },
  { minute: 1440, label: '24:00', major: true },
] as const;
