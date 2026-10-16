import { describe, expect, it } from 'vitest';
import type { Trade } from '@/hooks/useTrades';
import { analyzeTrades } from '@/lib/analysisStats';
import { resolvePreferences } from '@/lib/workspacePreferences';
import { toLocalDateTime, toUtcTimestamp, draftHoldingDuration } from '@/lib/tradeTimestamps';
import { dateBounds, DEFAULT_FILTERS, filterHistory, exportHistoryRows } from '@/lib/tradeHistory';
import { filterJournalTrades, journalExportRows, DEFAULT_JOURNAL_FILTERS } from '@/lib/journalExport';
import { resolveCoachWindow } from '@/lib/coach/period';

const trade = (id: string, close: string, pnl = 10) => ({ id, symbol: 'XAUUSD', direction: 'Long', entry_price: 2000, exit_price: 2001, lot_size: 0.1, pnl, open_time: close, close_time: close } as Trade);
const now = new Date('2026-10-02T12:00:00Z');
const trades = [trade('before', '2026-10-01T18:29:59Z'), trade('after', '2026-10-01T18:30:00Z', -5)];

describe('saved timezone across the workspace', () => {
  it('defaults to IST but preserves explicitly saved UTC', () => {
    expect(resolvePreferences().timezone).toBe('Asia/Kolkata');
    expect(resolvePreferences({ timezone: 'invalid' }).timezone).toBe('Asia/Kolkata');
    expect(resolvePreferences({ timezone: 'UTC' }).timezone).toBe('UTC');
  });
  it('groups days and weekdays in the saved timezone without changing totals', () => {
    const ist = analyzeTrades(trades, [], 'All Time', 'All Trades', +now, 'Asia/Kolkata');
    const utc = analyzeTrades(trades, [], 'All Time', 'All Trades', +now, 'UTC');
    expect(ist.dailyPnl).toEqual([['2026-10-01', 10], ['2026-10-02', -5]]);
    expect(utc.dailyPnl).toEqual([['2026-10-01', 5]]);
    expect(ist.dayPerf[4].pnl).toBe(-5);
    expect(ist.totalPnl).toBe(utc.totalPnl);
    expect(analyzeTrades(trades, [], 'Today', 'All Trades', +now, 'Asia/Kolkata').includedClosedTrades.map(t => t.id)).toEqual(['after']);
  });
  it('aligns custom trade and journal filters, report dates, and export dates', () => {
    const filters = { ...DEFAULT_FILTERS, period: 'Custom' as const, start: '2026-10-02', end: '2026-10-02' };
    expect(filterHistory(trades, filters, {}, now, 'Asia/Kolkata').map(t => t.id)).toEqual(['after']);
    expect(filterHistory(trades, filters, {}, now, 'UTC')).toHaveLength(0);
    expect(filterJournalTrades(trades, [], { ...DEFAULT_JOURNAL_FILTERS, days: 'custom', start: filters.start, end: filters.end, timezone: 'Asia/Kolkata' }, now).map(t => t.id)).toEqual(['after']);
    expect(exportHistoryRows([trades[1]], ['close_time'], 'Asia/Kolkata')[1][0]).toContain('Oct 2, 2026');
    const row = journalExportRows({ trades: [trades[1]], journals: [], checklists: [], screenshots: [] }, { includeFields: {}, timezone: 'UTC' })[0];
    expect(row['Closing date']).toBe('Oct 1, 2026');
    expect(row['Display timezone']).toBe('UTC');
    expect(resolveCoachWindow('Custom', filters.start, filters.end, now).start).toBe('2026-10-01T18:30:00.000Z');
  });
  it.each([['2026-03-08', 23], ['2026-11-01', 25]])('uses the full DST calendar day %s', (day, hours) => {
    const filters = { ...DEFAULT_FILTERS, period: 'Custom' as const, start: day, end: day };
    const bounds = dateBounds(filters, now, 'America/New_York');
    expect((bounds[1] - bounds[0]) / 3600000).toBe(hours);
    const window = resolveCoachWindow('Custom', day, day, new Date('2026-12-01T00:00:00Z'), 'America/New_York');
    expect(Date.parse(window.end) - Date.parse(window.start!)).toBe(hours * 3600000);
  });
  it('last month ends at the current month boundary even on the last day', () => {
    const bounds = dateBounds({ ...DEFAULT_FILTERS, period: 'Last Month' }, new Date('2026-10-31T16:00:00Z'), 'Asia/Kolkata');
    expect(bounds.map(t => new Date(t).toISOString())).toEqual(['2026-08-31T18:30:00.000Z', '2026-09-30T18:30:00.000Z']);
  });
  it('uses the same rolling 30-day cutoff in history and Analysis', () => {
    const cutoff = +now - 30 * 86400000;
    const rows = [trade('before', new Date(cutoff - 1).toISOString()), trade('boundary', new Date(cutoff).toISOString()), trade('now', now.toISOString()), trade('future', new Date(+now + 1).toISOString())];
    const history = filterHistory(rows, { ...DEFAULT_FILTERS, period: 'Last 30 Days' }, {}, now, 'Asia/Kolkata');
    const analysis = analyzeTrades(rows, [], '30 Days', 'All Trades', +now, 'Asia/Kolkata');
    expect(history.map(t => t.id)).toEqual(['boundary', 'now']);
    expect(history.map(t => t.id)).toEqual(analysis.includedClosedTrades.map(t => t.id));
  });
  it('accepts both saved-zone wall times and explicit instants in date conditions', () => {
    for (const value of ['2026-10-02T00:00', '2026-10-01T18:30:00Z', '2026-10-02T00:00:00+05:30']) {
      const filters = { ...DEFAULT_FILTERS, rules: [{ id: 'date', field: 'close_time' as const, operator: 'eq' as const, value }] };
      expect(filterHistory(trades, filters, {}, now, 'Asia/Kolkata').map(t => t.id)).toEqual(['after']);
    }
  });
  it('serializes saved-zone wall time independently of the device', () => {
    expect(toUtcTimestamp('2026-10-05T18:16', undefined, 'America/New_York')).toBe('2026-10-05T22:16:00.000Z');
    expect(toLocalDateTime('2026-10-05T22:16:37.123Z', 'America/New_York')).toBe('2026-10-05T18:16');
    const original = '2026-11-01T06:30:37.123Z';
    expect(toUtcTimestamp('2026-11-01T01:30', original, 'America/New_York')).toBe(original);
    expect(() => toUtcTimestamp('2026-03-08T02:30', undefined, 'America/New_York')).toThrow('does not exist');
    expect(draftHoldingDuration('2026-03-08T01:30', '2026-03-08T03:30', 'America/New_York')).toBe(3600000);
  });
});
