import { describe, expect, it } from 'vitest';
import { forexMarketHours, forexWeekIsOpen, formatIstTime } from '@/lib/forexMarketHours';

const session = (at: string, id: string) => forexMarketHours(new Date(at)).sessions.find(s => s.id === id)!;
describe('forex sessions displayed in IST', () => {
  it('converts local winter/summer hours with each market’s DST rules', () => {
    expect(session('2026-01-14T12:00:00Z', 'london').hours).toBe('13:30 – 22:30');
    expect(session('2026-07-15T12:00:00Z', 'london').hours).toBe('12:30 – 21:30');
    expect(session('2026-01-14T15:00:00Z', 'new-york').hours).toBe('18:30 – 03:30');
    expect(session('2026-07-15T15:00:00Z', 'new-york').hours).toBe('17:30 – 02:30');
    expect(session('2026-01-14T00:00:00Z', 'sydney').hours).toBe('02:30 – 11:30');
    expect(session('2026-07-15T00:00:00Z', 'sydney').hours).toBe('03:30 – 12:30');
    expect(session('2026-07-15T00:00:00Z', 'tokyo').hours).toBe('05:30 – 14:30');
  });
  it('handles different US and UK DST transition dates', () => {
    expect(session('2026-03-18T13:00:00Z', 'london').hours).toBe('13:30 – 22:30');
    expect(session('2026-03-18T13:00:00Z', 'new-york').hours).toBe('17:30 – 02:30');
    expect(session('2026-10-28T13:00:00Z', 'london').hours).toBe('13:30 – 22:30');
    expect(session('2026-10-28T13:00:00Z', 'new-york').hours).toBe('17:30 – 02:30');
  });
  it('switches status at opening/closing boundaries and detects overlap', () => {
    expect(session('2026-10-12T06:59:59Z', 'london').active).toBe(false);
    expect(session('2026-10-12T07:00:00Z', 'london').active).toBe(true);
    expect(forexMarketHours(new Date('2026-10-12T12:00:00Z')).sessions.filter(s => s.active).map(s => s.name)).toEqual(['London', 'New York']);
    expect(session('2026-10-12T16:00:00Z', 'london').active).toBe(false);
  });
  it('closes on weekends but preserves New York’s early Saturday IST tail', () => {
    expect(session('2026-10-10T01:00:00+05:30', 'new-york').active).toBe(true);
    const closed = forexMarketHours(new Date('2026-10-10T08:00:00Z'));
    expect(closed.isOpen).toBe(false);
    expect(closed.sessions.some(s => s.active)).toBe(false);
    expect(closed.sessions.find(s => s.id === 'new-york')!.segments).toEqual([{ start: 0, end: 150 }]);
    expect(forexMarketHours(new Date('2026-10-11T08:00:00Z')).sessions.every(s => s.segments.length === 0)).toBe(true);
  });
  it('clips Sydney to the trading-week opening when Australia and New York offsets differ', () => {
    expect(forexWeekIsOpen(new Date('2026-01-11T21:59:59Z'))).toBe(false);
    expect(session('2026-01-11T21:59:59Z', 'sydney').active).toBe(false);
    expect(session('2026-01-11T22:00:00Z', 'sydney').active).toBe(true);
  });
  it('splits midnight-crossing lanes and is independent of the input offset', () => {
    const at = forexMarketHours(new Date('2026-10-12T18:30:00Z'));
    expect(at.progress).toBe(0);
    expect(at).toEqual(forexMarketHours(new Date('2026-10-13T00:00:00+05:30')));
    expect(at.sessions.find(s => s.id === 'new-york')!.segments).toEqual([{ start: 0, end: 150 }, { start: 1050, end: 1440 }]);
    expect(formatIstTime(new Date('2026-10-12T18:30:00Z'))).toBe('00:00');
  });
});
