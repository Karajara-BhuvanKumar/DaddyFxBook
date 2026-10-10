import type { Trade } from '@/hooks/useTrades';
import { holdingDuration, formatHoldingDuration, formatTradeDateTime, timestampMs } from './holdingTime';

export type HistoryTrade = Trade & { notes?: string; commission?: number | null; swap?: number | null; net_pnl?: number | null };
export const COLUMNS = [
  ['openClose', 'Open / Close'], ['symbol', 'Symbol'], ['direction', 'Type'], ['entry_price', 'Entry'],
  ['exit_price', 'Exit'], ['lot_size', 'Size'], ['pnl', 'P&L'], ['source', 'Source'],
  ['open_time', 'Open time'], ['close_time', 'Close time'], ['duration', 'Holding time'], ['net_pnl', 'Net P&L'],
  ['commission', 'Commission'], ['swap', 'Swap'], ['day', 'Day'], ['notes', 'Notes'],
] as const;
export type ColumnId = typeof COLUMNS[number][0];
export const DEFAULT_COLUMNS: ColumnId[] = [...COLUMNS.slice(0, 8).map(([id]) => id), 'duration'];
export const PERIODS = ['All Time', 'Today', 'This Week', 'Last 30 Days', 'This Month', 'Last Month', 'Last 3 Months', 'Custom'] as const;
export type Condition = { id: string; field: ColumnId; operator: 'contains' | 'eq' | 'neq' | 'gt' | 'lt'; value: string };
export type ConditionGroup = { id: string; match: 'all' | 'any'; rules: Condition[] };
export interface HistoryFilters {
  pnl: 'All' | 'Profitable' | 'Loss'; direction: 'All' | 'Long' | 'Short';
  period: typeof PERIODS[number]; start: string; end: string; rules: Condition[]; groups: ConditionGroup[];
}
export const DEFAULT_FILTERS: HistoryFilters = { pnl: 'All', direction: 'All', period: 'All Time', start: '', end: '', rules: [], groups: [] };
export type Sort = { column: ColumnId; direction: 'asc' | 'desc' };
export const DEFAULT_SORT: Sort[] = [{ column: 'close_time', direction: 'desc' }];
export const isFiltersActive = (f: HistoryFilters) => f.pnl !== 'All' || f.direction !== 'All' || f.period !== 'All Time' || f.rules.some(r => r.value.trim()) || f.groups.some(g => g.rules.some(r => r.value.trim()));
export function columnValue(t: HistoryTrade, id: ColumnId): string | number | null {
  switch (id) {
    case 'openClose': case 'close_time': return timestampMs(t.close_time);
    case 'open_time': return timestampMs(t.open_time);
    case 'duration': { const ms = holdingDuration(t); return ms === null ? null : ms / 60000; }
    case 'day': return new Date(t.close_time).toLocaleDateString('en-US', { weekday: 'long' });
    // Stored realized P&L is used when no separately recorded net figure exists.
    case 'net_pnl': return t.net_pnl ?? Number(t.pnl);
    case 'commission': case 'swap': return t[id] == null ? null : Number(t[id]);
    case 'entry_price': case 'exit_price': case 'lot_size': case 'pnl': return Number(t[id]);
    case 'source': return t.source ? t.source.charAt(0).toUpperCase() + t.source.slice(1) : 'Not recorded';
    case 'notes': return t.notes || '';
    default: return t[id];
  }
}
export function formatHistoryDate(value: string) {
  return formatTradeDateTime(value);
}
export function columnText(t: HistoryTrade, id: ColumnId): string {
  if (id === 'duration') return formatHoldingDuration(holdingDuration(t));
  if (id === 'openClose') return `Open: ${formatHistoryDate(t.open_time)}; Close: ${formatHistoryDate(t.close_time)}`;
  if (id === 'open_time' || id === 'close_time') return formatHistoryDate(t[id]);
  const value = columnValue(t, id);
  if (value === null) return 'Not recorded';
  return String(value);
}
export function dateBounds(f: HistoryFilters, now: Date): [number, number] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start); end.setDate(end.getDate() + 1);
  switch (f.period) {
    case 'All Time': return [-Infinity, Infinity];
    case 'Today': break;
    case 'This Week': start.setDate(start.getDate() - (start.getDay() + 6) % 7); break;
    case 'Last 30 Days': start.setDate(start.getDate() - 29); break;
    case 'This Month': start.setDate(1); break;
    case 'Last Month': end.setDate(1); start.setDate(1); start.setMonth(start.getMonth() - 1); break;
    case 'Last 3 Months': {
      const day = start.getDate(); start.setDate(1); start.setMonth(start.getMonth() - 3);
      const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      start.setDate(Math.min(day, lastDay)); break;
    }
    case 'Custom': {
      const from = f.start ? new Date(`${f.start}T00:00:00`).getTime() : -Infinity;
      const until = f.end ? new Date(`${f.end}T00:00:00`) : null;
      if (until) until.setDate(until.getDate() + 1);
      return [from, until?.getTime() ?? Infinity];
    }
  }
  return [start.getTime(), end.getTime()];
}
function matches(t: HistoryTrade, rule: Condition) {
  if (!rule.value.trim()) return true;
  const actual = columnValue(t, rule.field);
  if (rule.operator === 'contains') return columnText(t, rule.field).toLowerCase().includes(rule.value.trim().toLowerCase());
  if (actual === null) return false;
  const expected = typeof actual === 'number'
    ? (['openClose', 'open_time', 'close_time'].includes(rule.field) ? new Date(rule.value).getTime() : Number(rule.value))
    : rule.value.trim().toLowerCase();
  const value = typeof actual === 'string' ? actual.toLowerCase() : actual;
  if (rule.operator === 'eq') return value === expected;
  if (rule.operator === 'neq') return value !== expected;
  if (rule.operator === 'gt') return value > expected;
  return value < expected;
}
export function filterHistory(trades: HistoryTrade[], f: HistoryFilters, columns: Partial<Record<ColumnId, string>>, now = new Date()) {
  const [start, end] = dateBounds(f, now);
  return trades.filter(t => {
    const time = timestampMs(t.close_time) ?? timestampMs(t.open_time);
    return (f.pnl === 'All' || (f.pnl === 'Profitable' ? Number(t.pnl) > 0 : Number(t.pnl) < 0))
      && (f.direction === 'All' || t.direction === f.direction)
      && (f.period === 'All Time' || (time !== null && time >= start && time < end))
      && f.rules.every(r => matches(t, r))
      && f.groups.every(g => { const rules = g.rules.filter(r => r.value.trim()); return !rules.length || (g.match === 'all' ? rules.every(r => matches(t, r)) : rules.some(r => matches(t, r))); })
      && Object.entries(columns).every(([id, value]) => !value || columnText(t, id as ColumnId).toLowerCase().includes(value.trim().toLowerCase()));
  });
}
export function sortHistory(trades: HistoryTrade[], sorts: Sort[]) {
  return [...trades].sort((a, b) => {
    for (const sort of sorts) {
      const left = columnValue(a, sort.column), right = columnValue(b, sort.column);
      if (left === right) continue;
      if (left === null) return 1;
      if (right === null) return -1;
      const diff = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true });
      if (diff) return sort.direction === 'asc' ? diff : -diff;
    }
    return 0;
  });
}
export function exportHistoryRows(trades: HistoryTrade[], columns: ColumnId[]) {
  return [columns.map(id => COLUMNS.find(c => c[0] === id)![1]), ...trades.map(t => columns.map(id => {
    const value = columnValue(t, id);
    return typeof value === 'number' && !['openClose', 'open_time', 'close_time', 'duration'].includes(id) ? value : columnText(t, id);
  }))];
}
export function historyCsv(rows: (string | number)[][]) {
  return '\uFEFF' + rows.map(row => row.map(value => {
    const text = typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}
