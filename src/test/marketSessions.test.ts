import { describe, expect, it } from 'vitest';
import { IST_MARKET_SESSIONS, IST_TIMELINE_TICKS, istSessionClock, normalizeSessionIds, sessionsAt, sessionSegments } from '@/lib/marketSessions';

describe('fixed IST market sessions', () => {
  it('defines only the requested windows and derives display hours from them', () => {
    expect(IST_MARKET_SESSIONS).toEqual([
      { id: 'asian', name: 'Asian', start: 330, end: 480, hours: '5:30 AM – 8:00 AM' },
      { id: 'london', name: 'London', start: 660, end: 870, hours: '11:00 AM – 2:30 PM' },
      { id: 'new-york', name: 'New York', start: 1020, end: 1230, hours: '5:00 PM – 8:30 PM' },
    ]);
    for (const session of IST_MARKET_SESSIONS) {
      expect(sessionSegments(session.start, session.end)).toEqual([{ start: session.start, end: session.end }]);
      expect(IST_TIMELINE_TICKS.map(t => t.minute)).toEqual(expect.arrayContaining([session.start, session.end]));
    }
  });
  it.each([
    ['00:00:00.000', []], ['05:29:59.999', []], ['05:30:00.000', ['Asian']],
    ['07:59:59.999', ['Asian']], ['08:00:00.000', []], ['10:59:59.999', []],
    ['11:00:00.000', ['London']], ['14:29:59.999', ['London']], ['14:30:00.000', []],
    ['16:59:59.999', []], ['17:00:00.000', ['New York']], ['20:29:59.999', ['New York']],
    ['20:30:00.000', []], ['23:59:59.999', []],
  ])('at %s IST shows %j', (time, expected) => {
    const date = new Date('2026-10-08T' + time + '+05:30');
    expect(sessionsAt(date).map(s => s.name)).toEqual(expected);
    expect(istSessionClock(date).active).toEqual(sessionsAt(date));
  });
  it('uses the same instants across offsets, winter, summer and DST transition dates', () => {
    for (const day of ['2026-01-08', '2026-07-08', '2026-03-08', '2026-11-01']) {
      const utc = new Date(day + 'T05:30:00Z');
      expect(sessionsAt(utc).map(s => s.name)).toEqual(['London']);
      expect(istSessionClock(utc)).toEqual(istSessionClock(new Date(day + 'T11:00:00+05:30')));
      expect(sessionsAt(new Date(day + 'T01:30:00-04:00'))).toEqual(sessionsAt(utc));
    }
    expect(istSessionClock(new Date('2026-10-07T18:30:00Z')).time).toBe('00:00:00');
    expect(sessionsAt(new Date('invalid'))).toEqual([]);
  });
  it('consolidates legacy selections without losing current selections or hiding invalid IDs', () => {
    expect(normalizeSessionIds(['sydney', 'tokyo', 'asian', 'london', 'new-york'])).toEqual(['asian', 'london', 'new-york']);
    expect(normalizeSessionIds(['unknown'])).toEqual(['unknown']);
  });
});
