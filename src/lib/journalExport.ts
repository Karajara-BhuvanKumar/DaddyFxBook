import type { Trade, Journal, Checklist } from '@/hooks/useTrades';
import { buildStrategySummary, parseStrategySetup } from './strategySetup';

export interface JournalScreenshot { id: string; trade_id: string; image_url: string; signed_url?: string }
export interface ExportData { trades: Trade[]; journals: Journal[]; checklists: Checklist[]; screenshots: JournalScreenshot[] }
export interface ExportOptions { includeFields: Record<string, boolean>; formats?: string[] }
export type ExportScope = 'current' | 'journaled' | 'all' | 'selected';
export interface JournalFilters { search: string; days: string; start?: string; end?: string; status: 'ALL' | 'JOURNALED' | 'PENDING'; sort: string }
export const DEFAULT_JOURNAL_FILTERS: JournalFilters = { search: '', days: 'all', status: 'ALL', sort: 'newest' };
export const EXPORT_FIELDS = [
  ['trade', 'Trade details'], ['notes', 'Analysis & reflections'], ['review', 'Risk, rating & tags'],
  ['checklist', 'Execution checklist'], ['strategy', 'Strategy & market structure'], ['screenshots', 'Screenshots'],
] as const;
export const DEFAULT_EXPORT_FIELDS = Object.fromEntries(EXPORT_FIELDS.map(([id]) => [id, true]));

export function filterJournalTrades(trades: Trade[], journals: Journal[], filters: JournalFilters, now = new Date()) {
  const journaled = new Set(journals.map(j => j.trade_id));
  const cutoff = new Date(now);
  if (filters.days !== 'all' && filters.days !== 'custom') cutoff.setDate(cutoff.getDate() - Number(filters.days));
  const start = filters.start ? new Date(`${filters.start}T00:00:00`) : null;
  const end = filters.end ? new Date(`${filters.end}T23:59:59.999`) : null;
  return trades.filter(t => (!filters.search.trim() || t.symbol.toLowerCase().includes(filters.search.trim().toLowerCase()))
    && (filters.days === 'all' || (filters.days === 'custom'
      ? (!start || new Date(t.open_time) >= start) && (!end || new Date(t.open_time) <= end)
      : new Date(t.open_time) >= cutoff))
    && (filters.status === 'ALL' || (filters.status === 'JOURNALED' ? journaled.has(t.id) : !journaled.has(t.id))))
    .sort((a, b) => filters.sort === 'pnl' ? Number(b.pnl) - Number(a.pnl)
      : (new Date(b.open_time).getTime() - new Date(a.open_time).getTime()) * (filters.sort === 'oldest' ? -1 : 1));
}

export function selectJournalExport(data: ExportData, scope: ExportScope, currentId: string | null, selectedIds: Set<string>, filters?: JournalFilters): ExportData {
  const journaled = new Set(data.journals.map(j => j.trade_id));
  const candidates = filters && scope !== 'current' ? filterJournalTrades(data.trades, data.journals, filters) : data.trades;
  const trades = candidates.filter(t => scope === 'current' ? t.id === currentId : scope === 'journaled' ? journaled.has(t.id) : scope === 'selected' ? selectedIds.has(t.id) : true);
  const ids = new Set(trades.map(t => t.id));
  return { trades, journals: data.journals.filter(j => ids.has(j.trade_id)), checklists: data.checklists.filter(c => ids.has(c.trade_id)), screenshots: data.screenshots.filter(s => ids.has(s.trade_id)) };
}

export const CHECKLIST_FIELDS = [
  ['checked_higher_tf', 'Checked higher timeframe'], ['risk_within_limits', 'Risk within limits'],
  ['fits_plan', 'Fits my trading plan'], ['key_levels', 'Key levels identified'], ['news_checked', 'Economic calendar checked'],
] as const;
export type ExportValue = string | number | boolean | Date | null;
export type ExportSection = { title: string; fields: [string, ExportValue][] };
const number = (value: unknown): number | null => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const date = (value: string) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value) : null;
export function journalExportSections(trade: Trade, data: ExportData, options: ExportOptions): ExportSection[] {
  const j = data.journals.find(j => j.trade_id === trade.id);
  const c = data.checklists.find(c => c.trade_id === trade.id);
  const s = parseStrategySetup(j?.strategy_setup);
  // Keep legacy free-text strategies readable; structured fields remain individually analyzable.
  const confluences = Array.isArray(s.confluences) ? s.confluences : [];
  const strategy = buildStrategySummary({ ...s, confluences }) || j?.strategy_setup || '';
  const sections: (ExportSection & { id: string })[] = [
    { id: 'trade', title: 'Trade information', fields: [
      ['Trade ID', trade.id], ['Journal status', j ? 'Journaled' : 'Pending'], ['Symbol', trade.symbol], ['Direction', trade.direction],
      ['Entry', number(trade.entry_price)], ['Exit', number(trade.exit_price)], ['Size', number(trade.lot_size)], ['P&L', number(trade.pnl)],
      ['Trade date/time (UTC)', date(trade.open_time)], ['Close date/time (UTC)', date(trade.close_time)],
      ['Stop loss', number(trade.stop_loss)], ['Take profit', number(trade.take_profit)], ['Trade session', trade.session],
    ] },
    { id: 'notes', title: 'Analysis & reflections', fields: [
      ['Pre-Trade Analysis', j?.pre_trade_notes], ['Post-Trade Review', j?.post_trade_notes], ['Emotions', j?.emotions], ['Lessons Learned', j?.lessons],
    ] },
    { id: 'review', title: 'Trade review', fields: [['Risk : Reward', j?.risk_reward], ['Rating', number(j?.rating)], ['Tags', j?.tags]] },
    { id: 'checklist', title: 'Execution Checklist', fields: CHECKLIST_FIELDS.map(([key, label]) => [label, c?.[key] ?? null]) },
    { id: 'strategy', title: 'Strategy Setup', fields: [
      ['Strategy Setup', strategy], ['Market Structure', [s.htf_level && `HTF: ${s.htf_level}`, s.ltf_level && `LTF: ${s.ltf_level}`].filter(Boolean).join('; ')],
      ['HTF timeframe', s.htf_tf], ['HTF level type', s.htf_level], ['LTF timeframe', s.ltf_tf], ['LTF level type', s.ltf_level],
      ['Confirmation', [s.conf_tf, s.conf_type].filter(Boolean).join(' ')], ['Confirmation timeframe', s.conf_tf], ['Confirmation type', s.conf_type],
      ['Parameters & Confluences', confluences.join('; ')], ['FIB timeframe', s.fib_tf], ['Demand / Supply', s.demand_supply],
      ['Market Session', s.market_session || trade.session], ['Bias', s.bias], ['Execution Type', s.execution_type],
    ] },
    { id: 'screenshots', title: 'Screenshots', fields: [['Screenshot references', data.screenshots.filter(s => s.trade_id === trade.id).map(s => s.image_url).join('\n')]] },
  ];
  return sections.filter(section => options.includeFields[section.id] !== false);
}
export function journalExportRows(data: ExportData, options: ExportOptions) {
  return data.trades.map(t => Object.fromEntries(journalExportSections(t, data, options).flatMap(s => s.fields)));
}
export function exportValueText(value: ExportValue) {
  return value instanceof Date ? value.toISOString() : value == null || value === '' ? 'Not recorded' : typeof value === 'boolean' ? value ? 'Checked' : 'Not checked' : String(value);
}
export function buildJournalCSV(data: ExportData, options: ExportOptions) {
  const rows = journalExportRows(data, options);
  if (!rows.length) throw new Error('No trades match this export.');
  const escape = (value: ExportValue) => {
    let text = value instanceof Date ? value.toISOString() : value == null ? '' : String(value);
    // Quoting alone does not prevent spreadsheet applications evaluating formulas.
    const first = Array.from(text).find(char => char.charCodeAt(0) > 32 && !/\s/.test(char));
    if (typeof value === 'string' && first && '=+@-'.includes(first)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [Object.keys(rows[0]).map(escape).join(','), ...rows.map(row => Object.values(row).map(escape).join(','))].join('\r\n');
}
