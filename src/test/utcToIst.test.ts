import { describe, expect, it } from 'vitest';
import { calendarToUtcDate, convertUtcTime, currentUtcInput, parseUtcDateTime, parseUtcTime, utcDateToCalendar, utcToIst } from '@/lib/utcToIst';

describe('UTC parsing and IST conversion', () => {
  it.each([
    ['11:19:36 AM', 11, 19, 36], ['11:19:36 pm', 23, 19, 36], ['  11:19:36\u00a0AM  ', 11, 19, 36],
    ['12:00:00 AM', 0, 0, 0], ['12:00:00 PM', 12, 0, 0], ['23:59:59', 23, 59, 59],
    ['00:00', 0, 0, 0], ['9:05', 9, 5, 0], ['1:05PM', 13, 5, 0],
  ])('parses %s explicitly as UTC', (input, hour, minute, second) => {
    expect(parseUtcTime(input)).toEqual({ hour, minute, second });
  });
  it.each(['', 'bad', '13:10 PM', '0:10 AM', '24:00', '12:60', '12:00:60', '11:19:3 AM',
    '11:1 AM', '-1:00', '11:19:36 AM extra', '11:19:', '1e1:00', '12:00:00.5', '99:99'])('rejects invalid time %s', value => {
    expect(parseUtcTime(value)).toBeNull();
    expect(convertUtcTime('2026-10-23', value)).toBeNull();
  });
  it.each([
    ['2026-10-23', '11:19:36 AM', 'Oct 23, 2026', '4:49:36 PM IST', false],
    ['2026-10-23', '12:00 PM', 'Oct 23, 2026', '5:30:00 PM IST', false],
    ['2026-10-23', '20:00:17', 'Oct 24, 2026', '1:30:17 AM IST', true],
    ['2026-10-23', '00:00:00', 'Oct 23, 2026', '5:30:00 AM IST', false],
    ['2026-10-23', '18:29:59', 'Oct 23, 2026', '11:59:59 PM IST', false],
    ['2026-10-23', '18:30:00', 'Oct 24, 2026', '12:00:00 AM IST', true],
    ['2026-10-31', '23:59:59', 'Nov 1, 2026', '5:29:59 AM IST', true],
    ['2026-12-31', '11:59:59 PM', 'Jan 1, 2027', '5:29:59 AM IST', true],
    ['2028-02-28', '20:00', 'Feb 29, 2028', '1:30:00 AM IST', true],
    ['2028-02-29', '20:00', 'Mar 1, 2028', '1:30:00 AM IST', true],
    ['2026-03-08', '02:30:12', 'Mar 8, 2026', '8:00:12 AM IST', false],
    ['2026-11-01', '01:30:12', 'Nov 1, 2026', '7:00:12 AM IST', false],
  ])('converts %s %s with seconds and calendar rollover', (date, time, dateLabel, timeLabel, nextDay) => {
    expect(convertUtcTime(date, time)).toEqual({ dateLabel, timeLabel, timestamp: dateLabel + ' · ' + timeLabel, nextDay });
  });
  it.each(['', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '0000-01-01', '2026-1-1'])('rejects invalid date %s', date => expect(convertUtcTime(date, '11:19:36 AM')).toBeNull());
  it('supports both minute and second precision without ambiguous parsing', () => {
    expect(parseUtcDateTime('2026-10-23T11:19:36')?.toISOString()).toBe('2026-10-23T11:19:36.000Z');
    expect(utcToIst('2026-10-23T12:00')).toBe('Oct 23, 2026 · 5:30 PM IST');
    expect(utcToIst('2026-10-23T11:19:36')).toBe('Oct 23, 2026 · 4:49:36 PM IST');
    expect(parseUtcDateTime('2026-10-23T11:19:60')).toBeNull();
    expect(parseUtcDateTime('2026-10-23T12:00Z')).toBeNull();
    expect(parseUtcDateTime('0099-01-01T00:00')?.toISOString()).toBe('0099-01-01T00:00:00.000Z');
  });
  it('uses UTC now to second precision and keeps calendar date carriers separate', () => {
    expect(currentUtcInput(new Date('2026-12-31T23:59:45Z'))).toBe('2026-12-31T23:59:45');
    for (const day of ['2026-10-23', '2026-03-08', '2026-11-01', '2028-02-29']) {
      const carrier = utcDateToCalendar(day)!;
      expect(calendarToUtcDate(carrier)).toBe(day);
    }
    expect(utcDateToCalendar('2026-02-30')).toBeUndefined();
  });
});
