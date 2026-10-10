import { describe, expect, it } from 'vitest';
import { holdingDuration, formatHoldingDuration, tradeTimeParts } from '@/lib/holdingTime';
import { analyzeTrades } from '@/lib/analysisStats';
import { columnText, columnValue, exportHistoryRows } from '@/lib/tradeHistory';
import { journalExportRows, DEFAULT_EXPORT_FIELDS } from '@/lib/journalExport';
import type { Trade } from '@/hooks/useTrades';

const open = '2026-10-01T10:00:00.123Z';
const trade = (minutes: number, pnl = 10, id = String(minutes)): Trade => ({ id, symbol: 'XAUUSD', direction: 'Long', entry_price: 100, exit_price: 101, lot_size: .1, pnl, open_time: open, close_time: new Date(Date.parse(open) + minutes * 60000).toISOString() } as Trade);
const analyze = (rows: Trade[], outcome: 'All Trades' | 'Winners' | 'Losers' = 'All Trades') => analyzeTrades(rows, [], 'All Time', outcome, Date.parse('2026-10-10T00:00:00Z'));
describe('holding time across trade records', () => {
  it('uses absolute instants, including offsets, sub-minute precision and DST changes', () => {
    expect(holdingDuration({ open_time: '2026-11-01T01:30:00-04:00', close_time: '2026-11-01T01:30:00-05:00' })).toBe(3600000);
    expect(holdingDuration({ open_time: open, close_time: '2026-10-01T15:30:30.456+05:30' })).toBe(30333);
    expect(formatHoldingDuration(30333)).toBe('<1m');
    expect(formatHoldingDuration(0)).toBe('0m');
    expect(formatHoldingDuration((24 * 60 + 135) * 60000)).toBe('1d 2h 15m');
  });
  it('does not invent durations for missing, date-only, open or invalid records', () => {
    for (const close_time of [null, undefined, '', 'bad', '2026-10-02', '2026-02-30T10:00:00Z', '2026-09-30T10:00:00Z']) expect(holdingDuration({ open_time: open, close_time })).toBeNull();
    expect(holdingDuration({ ...trade(10), status: 'open' })).toBeNull();
    expect(holdingDuration({ close_time: open })).toBeNull();
    expect(formatHoldingDuration(null)).toBe('Not available');
    expect(tradeTimeParts(null).date).toBe('Not recorded');
  });
  it('computes exact aggregate metrics and non-overlapping boundary buckets', () => {
    const rows = [trade(14.999, 5), trade(15, -3), trade(60, 0), trade(240, 20), trade(1440, -2)];
    const h = analyze(rows).holding;
    expect(h.ranges.map(r => r.count)).toEqual([1, 1, 1, 1, 1]);
    expect(h.median).toBe(3600000);
    expect(h.total).toBeCloseTo(1769.999 * 60000);
    expect(h.average).toBeCloseTo(1769.999 * 60000 / 5);
    expect(h.winningAverage).toBeCloseTo(254.999 * 60000 / 2);
    expect(h.losingAverage).toBe(1455 * 60000 / 2);
    expect(h.ranges[2].winRate).toBeNull();
    expect(h.longest?.trade.id).toBe('1440');
    expect(h.shortest?.trade.id).toBe('14.999');
    expect(analyze(rows, 'Winners').holding.count).toBe(2);
    expect(analyze(rows.slice(0, 2)).holding.median).toBeCloseTo(29.999 * 60000 / 2);
    expect(analyze([]).holding.average).toBeNull();
    expect(analyze([{ ...trade(10), close_time: '' }]).holding.count).toBe(0);
  });
  it('shares duration and time values with history and every journal export section', () => {
    const t = trade(1575);
    const data = { trades: [t], journals: [], checklists: [], screenshots: [] };
    const row = journalExportRows(data, { includeFields: DEFAULT_EXPORT_FIELDS })[0];
    expect(columnValue(t, 'duration')).toBe(1575);
    expect(columnText(t, 'duration')).toBe('1d 2h 15m');
    expect(exportHistoryRows([t], ['duration'])[1][0]).toBe(row['Holding duration']);
    expect(row['Opening time']).toBe(tradeTimeParts(t.open_time).time);
    expect(row['Closing date']).toBe(tradeTimeParts(t.close_time).date);
    expect(row['Display timezone']).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
