import { describe, expect, it } from 'vitest';
import { IST_MARKET_SESSIONS, istSessionClock, sessionSegments } from '@/lib/marketSessions';

describe('fixed IST market clock', () => {
  it.each([
    ['00:00:00', ['New York']], ['03:29:59', ['New York']], ['03:30:00', ['Sydney']],
    ['05:29:59', ['Sydney']], ['05:30:00', ['Sydney', 'Tokyo']], ['12:30:00', ['Tokyo']],
    ['13:30:00', ['Tokyo', 'London']], ['14:30:00', ['London']],
    ['18:30:00', ['London', 'New York']], ['22:30:00', ['New York']], ['23:59:59', ['New York']],
  ])('at %s IST shows %j', (time, expected) => {
    const result = istSessionClock(new Date(`2026-10-08T${time}+05:30`));
    expect(result.time).toBe(time);
    expect(result.active.map(s => s.name)).toEqual(expected);
    const [h, m, s] = time.split(':').map(Number);
    expect(result.progress).toBeCloseTo((h * 3600 + m * 60 + s) / 86400 * 100, 8);
  });
  it('splits New York across midnight while preserving all nine hours', () => {
    expect(sessionSegments(1110, 210)).toEqual([{ start: 0, end: 210 }, { start: 1110, end: 1440 }]);
    for (const s of IST_MARKET_SESSIONS) {
      expect(sessionSegments(s.start, s.end).reduce((sum, part) => sum + part.end - part.start, 0)).toBe(540);
    }
  });
  it('uses IST dates and the same fixed schedule across device offsets and seasons', () => {
    expect(istSessionClock(new Date('2026-10-07T18:30:00Z'))).toEqual(istSessionClock(new Date('2026-10-08T00:00:00+05:30')));
    expect(istSessionClock(new Date('2026-10-07T14:30:00-04:00')).time).toBe('00:00:00');
    for (const month of ['01', '07']) expect(istSessionClock(new Date(`2026-${month}-08T08:00:00Z`)).active.map(s => s.name)).toEqual(['Tokyo', 'London']);
  });
});
