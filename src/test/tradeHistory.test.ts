import { describe, expect, it } from 'vitest';
import { COLUMNS, DEFAULT_FILTERS, DEFAULT_SORT, columnValue, dateBounds, exportHistoryRows, filterHistory, historyCsv, sortHistory, type HistoryTrade } from '@/lib/tradeHistory';
const trade = (id: string, close: string, pnl: number, direction = 'Long'): HistoryTrade => ({ id, user_id: 'test', symbol: 'XAUUSD', direction, entry_price: 4500, exit_price: 4510, lot_size: .1, stop_loss: null, take_profit: null, pnl, open_time: close, close_time: close, session: null, source: 'manual', created_at: close, updated_at: close });
const rows = [trade('1', '2026-10-07T10:00:00', 500), trade('2', '2026-10-05T10:00:00', -100, 'Short'), trade('3', '2026-09-30T23:59:59', 50), trade('4', '2026-08-01T00:00:00', 0)];
const now = new Date(2026, 9, 7, 12);
describe('Trade History data pipeline', () => {
  it('combines P&L, direction, dates and column filters against the supplied data', () => {
    expect(filterHistory(rows, { ...DEFAULT_FILTERS, pnl: 'Loss', direction: 'Short', period: 'This Week' }, { symbol: 'xau' }, now).map(t => t.id)).toEqual(['2']);
    expect(filterHistory(rows, { ...DEFAULT_FILTERS, pnl: 'Profitable' }, {}, now)).toHaveLength(2);
    expect(filterHistory(rows, { ...DEFAULT_FILTERS, pnl: 'Loss' }, {}, now)).toHaveLength(1);
  });
  it.each([
    ['Today', ['1']], ['This Week', ['1', '2']], ['Last 30 Days', ['1', '2', '3']],
    ['This Month', ['1', '2']], ['Last Month', ['3']], ['Last 3 Months', ['1', '2', '3', '4']], ['All Time', ['1', '2', '3', '4']],
  ] as const)('handles %s in local calendar time', (period, expected) => {
    expect(filterHistory(rows, { ...DEFAULT_FILTERS, period }, {}, now).map(t => t.id)).toEqual(expected);
  });
  it('includes the entire custom end date and rejects inverted ranges', () => {
    const f = { ...DEFAULT_FILTERS, period: 'Custom' as const, start: '2026-09-30', end: '2026-09-30' };
    expect(filterHistory(rows, f, {}, now).map(t => t.id)).toEqual(['3']);
    expect(filterHistory(rows, { ...f, start: '2026-10-01' }, {}, now)).toEqual([]);
  });
  it('handles month/year boundaries and clamps a rolling three-month cutoff', () => {
    const [start, end] = dateBounds({ ...DEFAULT_FILTERS, period: 'Last Month' }, new Date(2026, 0, 5));
    expect(new Date(start)).toEqual(new Date(2025, 11, 1)); expect(new Date(end)).toEqual(new Date(2026, 0, 1));
    expect(new Date(dateBounds({ ...DEFAULT_FILTERS, period: 'Last 3 Months' }, new Date(2026, 4, 31))[0])).toEqual(new Date(2026, 1, 28));
  });
  it('evaluates all/any groups with numeric comparisons and ignores unfinished conditions', () => {
    const groups = [{ id: 'g', match: 'any' as const, rules: [{ id: 'a', field: 'pnl' as const, operator: 'gt' as const, value: '100' }, { id: 'b', field: 'direction' as const, operator: 'eq' as const, value: 'short' }, { id: 'c', field: 'symbol' as const, operator: 'contains' as const, value: '' }] }];
    expect(filterHistory(rows, { ...DEFAULT_FILTERS, groups }, {}, now).map(t => t.id)).toEqual(['1', '2']);
    expect(filterHistory(rows, { ...DEFAULT_FILTERS, groups: [{ ...groups[0], match: 'all' }] }, {}, now)).toEqual([]);
  });
  it('sorts numbers numerically without mutating trades, including multiple sort columns', () => {
    expect(sortHistory(rows, [{ column: 'pnl', direction: 'asc' }]).map(t => t.id)).toEqual(['2', '4', '3', '1']);
    expect(sortHistory(rows, DEFAULT_SORT).map(t => t.id)).toEqual(['1', '2', '3', '4']);
    expect(sortHistory(rows, [{ column: 'direction', direction: 'asc' }, { column: 'pnl', direction: 'desc' }]).map(t => t.id)).toEqual(['1', '3', '4', '2']);
    expect(rows.map(t => t.id)).toEqual(['1', '2', '3', '4']);
  });
  it('exports filtered/sorted rows and only the requested column order; preserves missing fees', () => {
    const filtered = sortHistory(filterHistory(rows, { ...DEFAULT_FILTERS, pnl: 'Profitable' }, {}, now), [{ column: 'pnl', direction: 'asc' }]);
    expect(exportHistoryRows(filtered, ['pnl', 'symbol', 'commission'])).toEqual([['P&L', 'Symbol', 'Commission'], [50, 'XAUUSD', 'Not recorded'], [500, 'XAUUSD', 'Not recorded']]);
    expect(columnValue(rows[0], 'commission')).toBeNull();
    expect(exportHistoryRows(rows, COLUMNS.map(([id]) => id))[0]).toHaveLength(16);
  });
  it('escapes CSV notes and neutralizes formula-like text without changing numeric losses', () => {
    expect(historyCsv([['Notes', 'P&L'], ['a,"b"\nc', -100], ['=1+1', 0]])).toBe('\uFEFF"Notes","P&L"\r\n"a,""b""\nc","-100"\r\n"\'=1+1","0"');
  });
});
