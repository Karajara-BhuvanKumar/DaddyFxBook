import { describe, expect, it } from 'vitest';
import { activitySeries, bestTradingWindows, buildForexSchedule, forexMarketHours, marketActivity, timelineBounds } from '@/lib/forexMarketHours';
import { formatCountdown, formatMarketDate, formatMarketTime, marketZoneInfo } from '@/lib/marketTime';

describe('market timezone transitions from IANA data', () => {
  it.each([
    ['Australia/Sydney', '2026-04-04T15:59:59Z', '2026-04-04T16:00:00Z', '02:59:59', '02:00:00', 'AEDT', 'AEST'],
    ['Australia/Sydney', '2026-10-03T15:59:59Z', '2026-10-03T16:00:00Z', '01:59:59', '03:00:00', 'AEST', 'AEDT'],
    ['Europe/London', '2026-03-29T00:59:59Z', '2026-03-29T01:00:00Z', '00:59:59', '02:00:00', 'GMT', 'BST'],
    ['Europe/London', '2026-10-25T00:59:59Z', '2026-10-25T01:00:00Z', '01:59:59', '01:00:00', 'BST', 'GMT'],
    ['America/New_York', '2026-03-08T06:59:59Z', '2026-03-08T07:00:00Z', '01:59:59', '03:00:00', 'EST', 'EDT'],
    ['America/New_York', '2026-11-01T05:59:59Z', '2026-11-01T06:00:00Z', '01:59:59', '01:00:00', 'EDT', 'EST'],
  ])('%s updates its clock and name at the exact transition', (zone, before, after, timeBefore, timeAfter, nameBefore, nameAfter) => {
    expect(formatMarketTime(new Date(before), zone, '24h', true)).toBe(timeBefore);
    expect(formatMarketTime(new Date(after), zone, '24h', true)).toBe(timeAfter);
    expect(marketZoneInfo(new Date(before), zone).abbreviation).toBe(nameBefore);
    expect(marketZoneInfo(new Date(after), zone).abbreviation).toBe(nameAfter);
  });
  it('keeps Tokyo on JST, IST at its fractional offset, and independent October DST states', () => {
    for (const month of ['01', '03', '04', '07', '10', '11', '12']) {
      const date = new Date(`2026-${month}-12T12:00:00Z`);
      expect(marketZoneInfo(date, 'Asia/Tokyo')).toMatchObject({ abbreviation: 'JST', offset: 'UTC+09:00' });
      expect(marketZoneInfo(date, 'Asia/Kolkata')).toMatchObject({ abbreviation: 'IST', offset: 'UTC+05:30' });
    }
    const date = new Date('2026-10-28T12:00:00Z');
    expect(marketZoneInfo(date, 'Australia/Sydney').abbreviation).toBe('AEDT');
    expect(marketZoneInfo(date, 'Europe/London').abbreviation).toBe('GMT');
    expect(marketZoneInfo(date, 'America/New_York').abbreviation).toBe('EDT');
  });
  it('formats real dates across the international date line and year end', () => {
    const date = new Date('2026-12-31T18:30:00Z');
    expect(formatMarketDate(date, 'Australia/Sydney')).toContain('1 Jan 2027');
    expect(formatMarketDate(date, 'Asia/Tokyo')).toContain('1 Jan 2027');
    expect(formatMarketDate(date, 'Europe/London')).toContain('31 Dec 2026');
    expect(formatMarketDate(date, 'America/New_York')).toContain('31 Dec 2026');
    expect(formatMarketTime(date, 'Asia/Kolkata', '12h')).toBe('12:00 am');
    expect(formatMarketTime(date, 'Asia/Kolkata', '24h')).toBe('00:00');
  });
});

describe('shared session windows, timeline geometry and activity', () => {
  it.each([
    ['America/New_York', '2026-03-08T08:00:00Z', 23],
    ['America/New_York', '2026-11-01T08:00:00Z', 25],
    ['Europe/London', '2026-03-29T03:00:00Z', 23],
    ['Europe/London', '2026-10-25T03:00:00Z', 25],
    ['Australia/Sydney', '2026-04-04T18:00:00Z', 25],
    ['Australia/Sydney', '2026-10-03T18:00:00Z', 23],
    ['Asia/Kolkata', '2026-03-08T08:00:00Z', 24],
  ])('uses a real %s calendar window of %s (%s hours)', (zone, iso, hours) => {
    const now = new Date(iso), schedule = buildForexSchedule(now, zone, 6);
    const result = forexMarketHours(now, zone, schedule);
    expect(result.durationMinutes).toBe(hours * 60);
    expect(result.progress).toBeGreaterThanOrEqual(0);
    expect(result.progress).toBeLessThan(100);
    expect(result.ticks).toHaveLength(hours + 1);
    expect(result.ticks[0].progress).toBe(0);
    expect(result.ticks[result.ticks.length - 1].progress).toBe(100);
    for (const s of result.sessions) for (const p of s.segments) {
      expect(p.start).toBeGreaterThanOrEqual(0);
      expect(p.end).toBeLessThanOrEqual(hours * 60);
      expect(p.end).toBeGreaterThan(p.start);
    }
  });
  it.each([
    ['2026-01-14', '18:30', '22:30', '13:30'],
    ['2026-03-18', '17:30', '22:30', '13:30'],
    ['2026-07-15', '17:30', '21:30', '12:30'],
    ['2026-10-28', '17:30', '22:30', '13:30'],
    ['2026-11-04', '18:30', '22:30', '13:30'],
  ])('derives overlap and opening windows for %s', (date, overlapStart, overlapEnd, londonOpen) => {
    const now = new Date(`${date}T00:00:00Z`);
    const windows = bestTradingWindows(buildForexSchedule(now), now);
    const overlap = windows.find(w => w.id === 'overlap')!;
    expect(formatMarketTime(overlap.start, 'Asia/Kolkata')).toBe(overlapStart);
    expect(formatMarketTime(overlap.end, 'Asia/Kolkata')).toBe(overlapEnd);
    expect(formatMarketTime(windows.find(w => w.id === 'london-open')!.start, 'Asia/Kolkata')).toBe(londonOpen);
    const tokyo = windows.find(w => w.id === 'tokyo-open')!;
    expect(formatMarketTime(tokyo.start, 'Asia/Kolkata')).toBe('05:30');
    expect(formatMarketTime(tokyo.end, 'Asia/Kolkata')).toBe('08:30');
  });
  it('skips closed weekends and uses Monday’s new offset even before DST changes on Sunday', () => {
    const friday = new Date('2026-10-23T17:00:00Z');
    const windows = bestTradingWindows(buildForexSchedule(friday), friday);
    const london = windows.find(w => w.id === 'london-open')!;
    expect(new Date(london.start).toISOString()).toBe('2026-10-26T08:00:00.000Z');
    expect(formatMarketTime(london.start, 'Asia/Kolkata')).toBe('13:30');
    const overlap = windows.find(w => w.id === 'overlap')!;
    expect((overlap.end - overlap.start) / 3600000).toBe(5);
  });
  it('advances cards at closing boundaries and activity follows the same intervals', () => {
    const now = new Date('2026-10-12T12:00:00Z'), schedule = buildForexSchedule(now);
    expect(bestTradingWindows(schedule, now)[0].active).toBe(true);
    expect(marketActivity(schedule, now.getTime())).toEqual({ score: 3, label: 'High' });
    const after = new Date('2026-10-12T16:00:00Z');
    expect(bestTradingWindows(schedule, after)[0].active).toBe(false);
    expect(new Date(bestTradingWindows(schedule, after)[0].start).toISOString()).toBe('2026-10-13T12:00:00.000Z');
    expect(marketActivity(schedule, after.getTime()).score).toBe(2);
    expect(activitySeries(schedule).some(p => p.score === 3)).toBe(true);
    const weekend = new Date('2026-10-11T10:00:00Z');
    expect(marketActivity(buildForexSchedule(weekend), weekend.getTime()).score).toBe(0);
  });
  it('keeps actual statuses identical across user timezones and resets at the new timeline day', () => {
    const now = new Date('2026-10-12T12:00:00Z');
    for (const zone of ['Asia/Kolkata', 'Pacific/Auckland', 'America/Los_Angeles', 'Europe/London']) {
      expect(forexMarketHours(now, zone).sessions.filter(s => s.active).map(s => s.id)).toEqual(['london', 'new-york']);
    }
    const end = timelineBounds(now, 'Asia/Kolkata', 6).end;
    const next = new Date(end), schedule = buildForexSchedule(next, 'Asia/Kolkata', 6);
    expect(forexMarketHours(next, 'Asia/Kolkata', schedule).progress).toBe(0);
    expect(formatCountdown(1000)).toBe('00:00:01');
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(-1000)).toBe('00:00:00');
    expect(formatCountdown(90000000)).toBe('1d 01:00:00');
  });
});
