import { describe, expect, it } from 'vitest';
import { evaluateRules, getDayKey, type RuleRow, type TradeRow } from '@/lib/ruleChecks';
import { validateTrade } from '@/lib/tradeValidation';

const rule = (rule_type: string, threshold: number | null, patch: Partial<RuleRow> = {}): RuleRow => ({ id: rule_type, rule: rule_type, active: true, rule_type, threshold, ...patch });
const trade = (id: string, open = '2026-10-09T10:00:00Z', patch: Partial<TradeRow> = {}): TradeRow => ({ id, open_time: open, close_time: '2026-10-09T18:00:00Z', pnl: 10, ...patch });
const run = (rules: RuleRow[], trades: TradeRow[], timeZone = 'UTC') => evaluateRules(rules, trades, [], { timeZone, now: Date.parse('2026-10-11T12:00:00Z') });

describe('calendar discipline from actual trade evidence', () => {
  it('counts entries on the configured local date even when they close on different days', () => {
    const rows = [trade('a', '2026-10-09T20:00:00Z', { close_time: '2026-10-10T01:00:00Z' }), trade('b', '2026-10-10T00:00:00Z', { close_time: '2026-10-11T01:00:00Z' })];
    expect(run([rule('max_trades_per_day', 1)], rows)).toEqual({});
    expect(run([rule('max_trades_per_day', 1)], rows, 'Asia/Kolkata')['2026-10-10'][0].tradeIds).toEqual(['b']);
    expect(getDayKey('2026-11-01T05:30:00Z', 'America/New_York')).toBe('2026-11-01');
    expect(getDayKey('2026-11-01T06:30:00Z', 'America/New_York')).toBe('2026-11-01');
  });
  it('uses recorded risk, skips unknown/malformed risk, and recalculates edits and disabled rules', () => {
    const rows = [trade('a', undefined, { risk_pct: 1 }), trade('b', undefined, { risk_pct: 1.5 }), trade('c', undefined, { risk_pct: null }), trade('d', undefined, { risk_pct: NaN }), trade('e', undefined, { risk_pct: -1 })];
    const r = rule('max_risk_per_trade', 1);
    expect(run([r], rows)['2026-10-09'][0]).toMatchObject({ tradeIds: ['b'], detail: 'Recorded risk: 1.5%; maximum allowed is 1%.' });
    expect(run([{ ...r, threshold: 1.5 }], rows)).toEqual({});
    expect(run([{ ...r, active: false }], rows)).toEqual({});
    expect(run([r], rows.filter(t => t.id !== 'b'))).toEqual({});
  });
  it('checks fixed IST session boundaries, overlaps and overnight windows using entry instants', () => {
    const r = rule('permitted_sessions', null, { allowed_sessions: ['london', 'new-york'] });
    const rows = [trade('before', '2026-10-09T07:59:59Z'), trade('start', '2026-10-09T08:00:00Z'), trade('overlap', '2026-10-09T14:00:00Z'), trade('overnight', '2026-10-09T20:00:00Z', { close_time: '' }), trade('end', '2026-10-09T22:00:00Z', { close_time: '' })];
    expect(run([r], rows)['2026-10-09'][0].tradeIds).toEqual(['before', 'end']);
    expect(run([{ ...r, allowed_sessions: [] }], rows)).toEqual({});
    expect(run([{ ...r, allowed_sessions: ['unknown'] }], rows)).toEqual({});
  });
  it('does not warn for stopping at the loss limit, or for entries placed before losses closed', () => {
    const r = rule('max_consecutive_losses', 2);
    const rows = [trade('a', '2026-10-09T08:00:00Z', { pnl: -10, close_time: '2026-10-09T10:00:00Z' }), trade('b', '2026-10-09T09:00:00Z', { pnl: -10, close_time: '2026-10-09T11:00:00Z' }), trade('overlapping', '2026-10-09T10:30:00Z', { pnl: 20 })];
    expect(run([r], rows)).toEqual({});
    expect(run([r], [...rows, trade('late', '2026-10-09T12:00:00Z')])['2026-10-09'][0].tradeIds).toEqual(['late']);
  });
  it('does not invent a streak from unknown outcomes or ambiguous simultaneous closes', () => {
    const r = rule('max_consecutive_losses', 2);
    const rows = [trade('a', undefined, { pnl: -10, close_time: '2026-10-09T11:00:00Z' }), trade('unknown', undefined, { pnl: null, close_time: '2026-10-09T12:00:00Z' }), trade('b', undefined, { pnl: -10, close_time: '2026-10-09T13:00:00Z' }), trade('later', '2026-10-09T14:00:00Z')];
    expect(run([r], rows)).toEqual({});
    expect(run([r], [trade('loss1', undefined, { pnl: -1 }), trade('loss2', undefined, { pnl: -1 }), trade('win', undefined, { pnl: 1 }), trade('late', '2026-10-09T19:00:00Z', { close_time: '' })])).toEqual({});
  });
  it('uses closed-day net P&L precisely and skips incomplete daily outcomes', () => {
    const r = rule('max_daily_loss', 0.3);
    const rows = [trade('a', undefined, { pnl: -0.1 }), trade('b', undefined, { pnl: -0.2 })];
    expect(run([r], rows)).toEqual({});
    expect(run([r], [...rows, trade('c', undefined, { pnl: -0.01 })])['2026-10-09'][0].detail).toContain('$0.31');
    expect(run([r], [...rows, trade('c', undefined, { pnl: null })])).toEqual({});
  });
  it('ignores duplicates, deleted/cancelled/future trades, invalid thresholds and missing dates', () => {
    const a = trade('a');
    const rows = [a, a, trade('deleted', undefined, { deleted: true }), trade('cancelled', undefined, { status: 'cancelled' }), trade('future', '2027-01-01T10:00:00Z', { close_time: '' }), trade('invalid', '2026-02-30T10:00:00Z')];
    expect(run([rule('max_trades_per_day', 1)], rows)).toEqual({});
    for (const threshold of [null, NaN, -1, 0, 1.5]) expect(run([rule('max_trades_per_day', threshold)], [a, trade('b')])).toEqual({});
    expect(run([rule('manual', null)], [a, trade('b')])).toEqual({});
  });
  it('rejects invalid recorded risk when saving trades without requiring it', () => {
    const input = { entry_price: 1, exit_price: 2, lot_size: 1, open_time: '2026-10-09T10:00:00Z', close_time: '2026-10-09T11:00:00Z' };
    for (const risk_pct of [-1, NaN, Infinity, 101]) expect(() => validateTrade({ ...input, risk_pct })).toThrow('Recorded risk');
    for (const risk_pct of [null, undefined, 0, 1.5, 100]) expect(() => validateTrade({ ...input, risk_pct })).not.toThrow();
  });
});
