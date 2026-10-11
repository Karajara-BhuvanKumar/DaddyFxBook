import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateRules, type RuleRow, type TradeRow } from '@/lib/ruleChecks';
import Rules from '@/pages/Rules';

const mocks = vi.hoisted(() => ({ update: vi.fn(), toast: vi.fn() }));
vi.mock('@/hooks/useRules', () => ({
  useRulesSchemaStatus: () => ({ outdated: false }),
  useRules: () => ({ rules: [{ id: 'legacy', rule: 'Trade selected sessions', active: true, rule_type: 'permitted_sessions', threshold: null, allowed_sessions: ['tokyo', 'london'] }],
    isLoading: false, addRule: { mutate: vi.fn() }, updateRule: { mutate: mocks.update }, deleteRule: { mutate: vi.fn() } }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const cases: [string, string | null][] = [
  ['00:00:00', null], ['05:29:59.999', null], ['05:30:00', 'asian'], ['07:59:59.999', 'asian'], ['08:00:00', null],
  ['10:59:59.999', null], ['11:00:00', 'london'], ['14:29:59.999', 'london'], ['14:30:00', null],
  ['16:59:59.999', null], ['17:00:00', 'new-york'], ['20:29:59.999', 'new-york'], ['20:30:00', null], ['23:59:59.999', null],
];
const base: RuleRow = { id: 'sessions', rule: 'Allowed entries', rule_type: 'permitted_sessions', active: true, threshold: null };
const now = Date.parse('2026-12-31T23:59:59Z');
const rows: TradeRow[] = cases.map(([time], i) => ({ id: String(i), open_time: `2026-10-09T${time}+05:30`, close_time: '', status: 'open', pnl: null }));
const violations = (rule: RuleRow, trades = rows, timeZone = 'UTC') => Object.values(evaluateRules([rule], trades, [], { now, timeZone })).flat().flatMap(v => v.tradeIds ?? []).sort();

describe('permitted IST entries', () => {
  it.each([['asian'], ['london'], ['new-york'], ['asian', 'london'], ['asian', 'new-york'], ['london', 'new-york'], ['asian', 'london', 'new-york']].map(selected => ({ selected })))('checks every boundary for $selected in any calendar timezone', ({ selected }) => {
    const expected = cases.flatMap(([, session], i) => session && selected.includes(session) ? [] : [String(i)]).sort();
    for (const zone of ['UTC', 'Asia/Kolkata', 'America/New_York']) {
      expect(violations({ ...base, allowed_sessions: selected }, rows, zone)).toEqual(expected);
      expect(violations({ ...base, allowed_sessions: selected }, rows.map(t => ({ ...t, open_time: new Date(t.open_time).toISOString() })), zone)).toEqual(expected);
    }
  });
  it('recalculates on enabled state, selected sessions and opening-time edits', () => {
    const rule = { ...base, allowed_sessions: ['london'] };
    const trade = { ...rows[6], id: 'edited', close_time: '2026-10-10T18:00:00Z', status: 'closed' };
    expect(violations(rule, [trade])).toEqual([]);
    expect(violations({ ...rule, allowed_sessions: ['asian'] }, [trade])).toEqual(['edited']);
    expect(violations(rule, [{ ...trade, open_time: '2026-10-09T09:00:00Z' }])).toEqual(['edited']);
    expect(violations({ ...rule, active: false })).toEqual([]);
  });
  it('does not shift windows with seasons or DST and preserves legacy selections', () => {
    for (const day of ['2026-01-08', '2026-07-08', '2026-03-08', '2026-11-01']) {
      const trade = { ...rows[2], open_time: `${day}T00:00:00Z` };
      expect(violations({ ...base, allowed_sessions: ['sydney', 'tokyo'] }, [trade])).toEqual([]);
      expect(violations({ ...base, allowed_sessions: ['london'] }, [trade])).toEqual([trade.id]);
    }
  });
  it('rejects ambiguous and invalid opening timestamps instead of inferring browser time', () => {
    const invalid = ['2026-10-09T11:00:00', '2026-02-30T11:00:00Z', 'invalid'];
    expect(violations({ ...base, allowed_sessions: ['asian'] }, invalid.map((open_time, i) => ({ ...rows[i], open_time })))).toEqual([]);
  });
});

it('edits saved rules using exactly three IST options and saves the selected union', () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(<Rules />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit rule: Trade selected sessions' }));
  expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  const asian = screen.getByRole('checkbox', { name: 'Asian · 5:30 AM – 8:00 AM IST' });
  const london = screen.getByRole('checkbox', { name: 'London · 11:00 AM – 2:30 PM IST' });
  const ny = screen.getByRole('checkbox', { name: 'New York · 5:00 PM – 8:30 PM IST' });
  expect(asian).toBeChecked(); expect(london).toBeChecked(); expect(ny).not.toBeChecked();
  fireEvent.click(london); fireEvent.click(ny);
  fireEvent.click(screen.getByRole('button', { name: 'Save Rule' }));
  expect(mocks.update).toHaveBeenCalledWith({ id: 'legacy', patch: { rule: 'Trade selected sessions', rule_type: 'permitted_sessions', threshold: null, allowed_sessions: ['asian', 'new-york'] } }, expect.anything());
  fireEvent.click(asian); fireEvent.click(ny);
  fireEvent.click(screen.getByRole('button', { name: 'Save Rule' }));
  expect(mocks.update).toHaveBeenCalledTimes(1);
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Choose at least one permitted session.' }));
});
