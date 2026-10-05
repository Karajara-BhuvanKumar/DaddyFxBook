import { describe, expect, it } from 'vitest';
import { toLocalDateTime, toUtcTimestamp } from '@/lib/tradeTimestamps';

describe('trade timestamp serialization', () => {
  it('converts wall-clock input to an absolute timestamp', () => {
    const local = '2026-10-05T18:16';
    expect(toUtcTimestamp(local)).toBe(new Date(2026, 9, 5, 18, 16).toISOString());
    expect(toLocalDateTime(toUtcTimestamp(local))).toBe(local);
  });
  it('preserves seconds, milliseconds and the original instant for an unchanged edit', () => {
    const original = '2026-10-05T18:16:37.123+05:30';
    expect(toUtcTimestamp(toLocalDateTime(original), original)).toBe(original);
  });
  it('rejects empty and invalid timestamps', () => {
    expect(() => toUtcTimestamp('')).toThrow('valid trade date');
    expect(() => toUtcTimestamp('invalid')).toThrow('valid trade date');
    expect(toLocalDateTime('invalid')).toBe('');
  });
});
