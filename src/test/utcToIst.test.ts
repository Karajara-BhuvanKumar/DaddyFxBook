import { describe, expect, it } from 'vitest';
import { currentUtcInput, parseUtcDateTime, utcToIst } from '@/lib/utcToIst';

describe('UTC to IST conversion', () => {
  it.each([
    ['2026-10-23T12:00', 'Oct 23, 2026 · 5:30 PM IST'],
    ['2026-10-23T20:00', 'Oct 24, 2026 · 1:30 AM IST'],
    ['2026-10-23T00:00', 'Oct 23, 2026 · 5:30 AM IST'],
    ['2026-10-23T18:30', 'Oct 24, 2026 · 12:00 AM IST'],
    ['2026-10-31T23:59', 'Nov 1, 2026 · 5:29 AM IST'],
    ['2026-12-31T20:00', 'Jan 1, 2027 · 1:30 AM IST'],
    ['2028-02-28T20:00', 'Feb 29, 2028 · 1:30 AM IST'],
    ['2028-02-29T20:00', 'Mar 1, 2028 · 1:30 AM IST'],
    ['2026-03-08T02:30', 'Mar 8, 2026 · 8:00 AM IST'],
    ['2026-11-01T01:30', 'Nov 1, 2026 · 7:00 AM IST'],
  ])('converts %s correctly', (input, expected) => {
    expect(utcToIst(input)).toBe(expected);
    expect(parseUtcDateTime(input)?.toISOString()).toBe(`${input}:00.000Z`);
  });

  it.each(['', 'bad', '2026-02-29T10:00', '2026-04-31T10:00', '2026-13-01T10:00',
    '2026-00-01T10:00', '2026-01-00T10:00', '2026-01-01T24:00', '2026-01-01T12:60',
    '2026-10-23', '2026-10-23T12:00Z', '0000-01-01T00:00', '2026-10-23T12:00:30',
  ])('rejects invalid or incomplete input %s', input => {
    expect(parseUtcDateTime(input)).toBeNull();
    expect(utcToIst(input)).toBeNull();
  });

  it('preserves years below 100', () => {
    expect(parseUtcDateTime('0099-01-01T00:00')?.toISOString()).toBe('0099-01-01T00:00:00.000Z');
  });
  it('populates UTC fields at minute precision', () => {
    expect(currentUtcInput(new Date('2026-12-31T23:59:45Z'))).toBe('2026-12-31T23:59');
  });
});
