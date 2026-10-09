import { describe, expect, it } from 'vitest';
import { validateTrade } from '@/lib/tradeValidation';
import { readCustomChecklist, serializeJournalSetup } from '@/lib/journalDrafts';
import { emptyStrategySetup, parseStrategySetup } from '@/lib/strategySetup';
import { computeAnalytics, type BacktestTrade } from '@/lib/backtest';

describe('trade validation', () => {
  const trade = { entry_price: 2600, exit_price: 2610, lot_size: 0.1, open_time: '2026-10-09T10:00:00Z', close_time: '2026-10-09T11:00:00Z' };
  it('allows a valid closed trade including same-time entries', () => {
    expect(() => validateTrade(trade)).not.toThrow();
    expect(() => validateTrade({ ...trade, close_time: trade.open_time })).not.toThrow();
  });
  it.each([0, -1, NaN, Infinity])('rejects invalid price or size %s', value => {
    for (const key of ['entry_price', 'exit_price', 'lot_size']) expect(() => validateTrade({ ...trade, [key]: value })).toThrow('greater than zero');
  });
  it('rejects missing and reversed dates', () => {
    expect(() => validateTrade({ ...trade, close_time: '' })).toThrow('valid');
    expect(() => validateTrade({ ...trade, close_time: '2026-10-09T09:00:00Z' })).toThrow('on or after');
  });
});

describe('custom journal checklist persistence', () => {
  it('round trips labels and state without disturbing strategy information', () => {
    const checklist = [{ id: 'a', label: 'Wait for confirmation', checked: true }];
    const raw = serializeJournalSetup({ ...emptyStrategySetup, market_session: 'London' }, checklist);
    expect(readCustomChecklist(raw)).toEqual(checklist);
    expect(parseStrategySetup(raw).market_session).toBe('London');
    expect(readCustomChecklist(serializeJournalSetup(parseStrategySetup(raw), checklist))).toEqual(checklist);
  });
  it('accepts legacy journals and ignores malformed checklist entries', () => {
    for (const raw of [null, '', 'legacy text', '{}', '{"custom_checklist":{}}']) expect(readCustomChecklist(raw)).toEqual([]);
    expect(readCustomChecklist('{"custom_checklist":[null,{"label":"bad"}]}')).toEqual([]);
  });
});

describe('backtesting statistics', () => {
  const trade = (id: string, patch: Partial<BacktestTrade>): BacktestTrade => ({ id, trade_date: '2026-10-09', created_at: `2026-10-09T0${id}:00:00Z`, outcome: 'win', r_gained: 2, rr: 2, pnl: 10, ...patch } as BacktestTrade);
  it('does not describe an all-winning strategy as having zero profit factor', () => {
    expect(computeAnalytics([trade('1', {})]).profitFactor).toBe(Infinity);
    expect(computeAnalytics([]).profitFactor).toBe(0);
  });
  it('does not treat an unrecorded planned risk/reward as zero', () => {
    expect(computeAnalytics([trade('1', {}), trade('2', { rr: null })]).avgRR).toBe(2);
  });
  it('distinguishes missing P&L from a recorded break-even amount', () => {
    expect(computeAnalytics([trade('1', { pnl: null })]).recordedPnlCount).toBe(0);
    expect(computeAnalytics([trade('1', { pnl: 0 })]).recordedPnlCount).toBe(1);
  });
  it('orders same-date trades consistently for streaks and drawdown', () => {
    const trades = [trade('3', {}), trade('1', { outcome: 'loss', r_gained: -1 }), trade('2', {})];
    expect(computeAnalytics(trades).maxConsecutiveWins).toBe(2);
    expect(computeAnalytics(trades).equityCurve.map(p => p.equity)).toEqual([-1, 1, 3]);
  });
});
