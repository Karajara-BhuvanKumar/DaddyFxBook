import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildJournalCSV, journalExportRows, selectJournalExport, DEFAULT_EXPORT_FIELDS, DEFAULT_JOURNAL_FILTERS, type ExportData } from '@/lib/journalExport';
import { buildJournalWorkbook } from '@/lib/exportUtils';
import type { Trade, Journal } from '@/hooks/useTrades';

const trade = (id: string, symbol = 'XAUUSD'): Trade => ({ id, user_id: 'u', symbol, direction: 'Long', entry_price: 2650.12345, exit_price: 0, lot_size: 0.5, pnl: -30.3, open_time: '2026-10-05T00:11:00Z', close_time: '2026-10-05T01:11:00Z', stop_loss: null, take_profit: 2700, session: 'London', source: 'manual', created_at: '', updated_at: '' });
const journal: Journal = { id: 'j1', trade_id: '1', user_id: 'u', pre_trade_notes: 'Level, "confirmed"\nWait for retest.', post_trade_notes: '=HYPERLINK("bad")', emotions: 'Calm – धैर्य', lessons: 'Respect risk.', tags: 'breakout,news', rating: 0, risk_reward: '1:3', strategy_setup: JSON.stringify({ htf_tf: 'H4', htf_level: 'SBR', ltf_tf: 'M5', ltf_level: 'TJL 1', conf_tf: 'M1', conf_type: 'CC Engulfing', confluences: ['FIB Zone', 'Liquidity Sweep'], fib_tf: 'H1', demand_supply: 'Demand — M5', market_session: 'New York', bias: 'Bullish', execution_type: 'Limit Order' }), created_at: '', updated_at: '' };
const data: ExportData = { trades: [trade('1'), trade('2', 'EURUSD'), trade('3')], journals: [journal], checklists: [{ id: 'c1', user_id: 'u', trade_id: '1', checked_higher_tf: true, risk_within_limits: false, fits_plan: null, key_levels: true, news_checked: true }], screenshots: [{ id: 's1', trade_id: '1', image_url: 'u/1/chart.png' }] };
const options = { includeFields: DEFAULT_EXPORT_FIELDS };

describe('journal export selection', () => {
  it('uses current trade regardless of list filters and only saved journals for journaled scope', () => {
    const filters = { ...DEFAULT_JOURNAL_FILTERS, search: 'EUR' };
    expect(selectJournalExport(data, 'current', '1', new Set(), filters).trades.map(t => t.id)).toEqual(['1']);
    expect(selectJournalExport(data, 'journaled', null, new Set()).trades.map(t => t.id)).toEqual(['1']);
    expect(selectJournalExport(data, 'all', null, new Set(), filters).trades.map(t => t.id)).toEqual(['2']);
    expect(selectJournalExport(data, 'all', null, new Set()).trades).toHaveLength(3);
  });
  it('intersects selection with filters and never includes other trades attachments', () => {
    const selected = selectJournalExport(data, 'selected', '1', new Set(['2', '3']), { ...DEFAULT_JOURNAL_FILTERS, search: 'EUR' });
    expect(selected.trades.map(t => t.id)).toEqual(['2']);
    expect(selected.journals).toEqual([]); expect(selected.checklists).toEqual([]); expect(selected.screenshots).toEqual([]);
    expect(selectJournalExport(data, 'current', null, new Set()).trades).toEqual([]);
    expect(selectJournalExport(data, 'selected', '1', new Set()).trades).toEqual([]);
  });
  it('includes the entire custom end date and excludes reversed ranges', () => {
    const filters = { ...DEFAULT_JOURNAL_FILTERS, days: 'custom', start: '2026-10-05', end: '2026-10-05' };
    const local = { ...data, trades: [{ ...trade('1'), open_time: new Date(2026, 9, 5, 23, 59, 59).toISOString() }, { ...trade('2'), open_time: new Date(2026, 9, 6, 0, 0).toISOString() }] };
    expect(selectJournalExport(local, 'all', null, new Set(), filters).trades.map(t => t.id)).toEqual(['1']);
    expect(selectJournalExport(local, 'all', null, new Set(), { ...filters, start: '2026-10-06' }).trades).toEqual([]);
  });
});
describe('complete journal serialization', () => {
  it('preserves zeros, nulls, checklist states, structured setup and screenshot references', () => {
    const row = journalExportRows(data, options)[0];
    expect(row).toMatchObject({ Symbol: 'XAUUSD', Exit: 0, Rating: 0, 'P&L': -30.3, Size: 0.5, 'Stop loss': null, 'HTF timeframe': 'H4', 'LTF level type': 'TJL 1', 'Confirmation type': 'CC Engulfing', 'Market Session': 'New York', 'Checked higher timeframe': true, 'Risk within limits': false, 'Fits my trading plan': null, 'Parameters & Confluences': 'FIB Zone; Liquidity Sweep', 'Demand / Supply': 'Demand — M5', Bias: 'Bullish', 'Execution Type': 'Limit Order', 'Screenshot references': 'u/1/chart.png' });
    expect(row['Strategy Setup']).not.toContain('{');
    expect(row['Trade date/time (UTC)']).toEqual(new Date(trade('1').open_time));
    expect(journalExportRows(data, { includeFields: { ...DEFAULT_EXPORT_FIELDS, strategy: false, screenshots: false } })[0]).not.toHaveProperty('HTF timeframe');
  });
  it('round-trips CSV multiline text and quotes while neutralizing spreadsheet formulas', () => {
    const csv = buildJournalCSV(data, options);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const workbook = XLSX.read(csv, { type: 'string', raw: true });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets.Sheet1);
    expect(rows).toHaveLength(3);
    expect(rows[0]['Pre-Trade Analysis']).toBe(journal.pre_trade_notes);
    expect(rows[0]['Post-Trade Review']).toBe(`'${journal.post_trade_notes}`);
    expect(rows[0]['P&L']).toBe('-30.3');
    expect(rows[0].Emotions).toBe(journal.emotions);
  });
  it('writes real numeric, UTC date and boolean cells plus an analyzable summary', () => {
    const wb = XLSX.read(XLSX.write(buildJournalWorkbook(data, options), { type: 'array', bookType: 'xlsx' }), { type: 'array', cellNF: true });
    const sheet = wb.Sheets['Journal entries'];
    const headers = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0];
    const cell = (name: string) => sheet[XLSX.utils.encode_cell({ r: 1, c: headers.indexOf(name) })];
    expect(cell('P&L')).toMatchObject({ t: 'n', v: -30.3 });
    expect(cell('Exit')).toMatchObject({ t: 'n', v: 0 });
    expect(cell('Trade date/time (UTC)')).toMatchObject({ t: 'n', z: 'yyyy-mm-dd hh:mm:ss' });
    expect(Math.round((cell('Trade date/time (UTC)').v - 25569) * 86400000)).toBe(new Date(trade('1').open_time).getTime());
    expect(cell('Risk within limits')).toMatchObject({ t: 'b', v: false });
    expect(cell('Post-Trade Review').f).toBeUndefined();
    expect(wb.Sheets.Summary.B7.t).toBe('n'); expect(wb.Sheets.Summary.B6.z).toBe('0.00%');
    expect(sheet['!autofilter']).toBeDefined();
  });
  it('preserves legacy strategy text and handles pending trades without fabricated journal values', () => {
    const legacy = { ...data, journals: [{ ...journal, strategy_setup: 'My original setup' }] };
    expect(journalExportRows(legacy, options)[0]['Strategy Setup']).toBe('My original setup');
    expect(journalExportRows(data, options)[1].Rating).toBeNull();
    expect(journalExportRows(data, options)[1]['Journal status']).toBe('Pending');
  });
});
