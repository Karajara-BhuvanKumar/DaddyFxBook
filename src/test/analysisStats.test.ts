import { describe, expect, it } from 'vitest';
import { analyzeTrades, includedTrades, metrics, sum } from '@/lib/analysisStats';
import type { Trade, Journal } from '@/hooks/useTrades';

const now = Date.parse('2026-10-05T15:00:00Z');
const make = (pnl: number, index = 0): Trade => ({ id: `t${String(index).padStart(5, '0')}`, user_id: 'test', symbol: 'XAUUSD', direction: 'Long', entry_price: 100, exit_price: 101, lot_size: 0.1, stop_loss: null, take_profit: null, pnl, open_time: '2026-10-01T08:00:00Z', close_time: `2026-10-01T09:${String(index % 60).padStart(2, '0')}:00Z`, session: null, source: 'test', created_at: '', updated_at: '' });
const analyze = (trades: Trade[]) => analyzeTrades(trades, [], '30 Days', 'All Trades', now);

describe('analysis accounting', () => {
  it('cross-validates the 25-trade case with independent gross sums', () => {
    // Synthetic trades matching the verified aggregate, not account data or UI constants.
    const pnl = [...Array(8).fill(80), 132.6, ...Array(15).fill(-28), -25.8];
    const m = analyze(pnl.map(make));
    expect(m.includedClosedTrades).toHaveLength(25);
    expect(m.winners).toHaveLength(9); expect(m.losers).toHaveLength(16);
    expect(m.totalPnl).toBe(326.8); expect(m.winRate).toBe(36);
    expect(m.grossProfit).toBe(772.6); expect(m.grossLoss).toBe(-445.8);
    expect(m.profitFactor).toBeCloseTo(772.6 / 445.8, 12);
    expect(m.profitFactor.toFixed(2)).toBe('1.73');
    expect(m.expectancy).toBeCloseTo(13.072, 12); expect(m.expectancy.toFixed(2)).toBe('13.07');
    expect(m.chartData[m.chartData.length - 1].cumulative).toBe(m.totalPnl);
    expect(sum([...m.sessionPerf.map(s => s.pnl), m.unassignedSession.pnl])).toBe(m.totalPnl);
    expect(sum(m.dailyPnl.map(([, pnl]) => pnl))).toBe(m.totalPnl);
    expect(m.sessionPerf.reduce((n, s) => n + s.count, m.unassignedSession.count)).toBe(25);
  });
  it.each([[], [10, 20], [-10, -20], [0, -0], [100, -40, 0]].map(values => ({ values })))('handles empty, one-sided and break-even results: $values', ({ values }) => {
    const m = analyze(values.map(make));
    expect(m.totalPnl).toBe(sum(values));
    expect(m.winners.length + m.losers.length + values.filter(v => !v).length).toBe(values.length);
    expect(m.expectancy).toBe(values.length ? sum(values) / values.length : 0);
    expect(Number.isNaN(m.profitFactor)).toBe(false);
    expect(m.profitFactor).toBe(m.grossLoss ? m.grossProfit / -m.grossLoss : m.grossProfit ? Infinity : 0);
    expect(m.winRate).toBe(values.some(v => v !== 0) ? m.winners.length / (m.winners.length + m.losers.length) * 100 : 0);
    if (values.length) expect(m.expectancy).toBeCloseTo(m.winners.length / values.length * m.avgWin + m.losers.length / values.length * m.avgLoss, 12);
  });
  it('does not lose decimal cents or round individual trades', () => {
    expect(sum([0.1, 0.2, -0.3])).toBe(0);
    expect(sum([0.005, 0.005])).toBe(0.01);
    expect(sum([1e-8, 2e-8])).toBe(3e-8);
    expect(Object.is(sum([-0]), -0)).toBe(false);
  });
  it('normalizes string amounts, rejects corrupted, future and non-realized rows, and deduplicates IDs', () => {
    const valid = make(20);
    const corrupt = [null, undefined, '', 'abc', NaN, Infinity].map((pnl, i) => ({ ...make(1, i + 1), pnl } as unknown as Trade));
    const others = [
      { ...make(1, 8), close_time: '' }, { ...make(1, 9), close_time: '2026-02-30T10:00:00Z' },
      { ...make(1, 10), close_time: '2026-10-06T10:00:00Z' },
      { ...make(1, 11), close_time: '2026-10-01T07:00:00Z' },
      { ...make(1, 12), close_time: '2026-10-01T10:00:00' },
      ...['open', 'pending', 'cancelled', 'deleted'].map((status, i) => ({ ...make(1, i + 13), status })),
      { ...make(1, 18), exit_price: null },
    ] as Trade[];
    const result = analyze([valid, valid, ...corrupt, ...others, { ...make(1, 20), pnl: '2.50' } as unknown as Trade]);
    expect(result.includedClosedTrades).toHaveLength(2);
    expect(result.totalPnl).toBe(22.5); expect(result.rejected).toBe(17);
  });
  it('uses UTC dates and numeric chronological order; retains intraday drawdown', () => {
    const trades = [make(100, 0), make(-80, 1), make(50, 2)];
    trades[0].close_time = '2026-10-01T15:00:00+05:30';
    trades[1].close_time = '2026-10-01T10:00:00Z';
    trades[2].close_time = '2026-10-02T00:15:00+05:30';
    const m = analyze(trades.reverse());
    expect(m.chartData.map(p => p.cumulative)).toEqual([0, 100, 20, 70]);
    expect(m.maxDD).toBe(80);
    expect(m.dailyPnl).toEqual([['2026-10-01', 70]]);
    expect(m.dayPerf[3].pnl).toBe(70);
    expect(m.avgDailyVolume).toBe(0.3);
  });
  it('uses the same filtered rows for all metrics and includes unjournaled trades', () => {
    const trades = [100, -40, 0].map(make);
    for (const outcome of ['Winners', 'Losers', 'All Trades'] as const) {
      const m = analyzeTrades(trades, [], '30 Days', outcome, now);
      expect(metrics(m.includedClosedTrades).totalPnl).toBe(m.totalPnl);
      expect(sum(m.symbols.map(([, s]) => s.pnl))).toBe(m.totalPnl);
      expect(sum(m.dayPerf.map(d => d.pnl))).toBe(m.totalPnl);
      expect(m.setupRows).toHaveLength(0);
    }
    expect(analyze(trades).winRate).toBe(50);
  });
  it('uses inclusive UTC scope boundaries and rejects future closes even for All Time', () => {
    const before = { ...make(1), open_time: '2026-09-01T00:00:00Z', close_time: '2026-09-05T14:59:59Z' };
    const boundary = { ...before, id: 'boundary', close_time: '2026-09-05T15:00:00Z' };
    const future = { ...make(1, 3), close_time: '2026-10-05T18:16:00Z' };
    expect(includedTrades([before, boundary, future], '30 Days', 'All Trades', now).includedClosedTrades.map(t => t.id)).toEqual(['boundary']);
    expect(includedTrades([future], 'All Time', 'All Trades', now).includedClosedTrades).toHaveLength(0);
  });
});

describe('session performance from actual IST entry instants', () => {
  const entry = (trade: Trade, session: string): Journal => ({ id: 'journal-' + trade.id, trade_id: trade.id, user_id: trade.user_id,
    pre_trade_notes: null, post_trade_notes: null, emotions: null, lessons: null, tags: null, rating: null, risk_reward: null,
    strategy_setup: JSON.stringify({ market_session: session }), created_at: '', updated_at: '' });
  const at = (time: string, pnl: number, i: number) => ({ ...make(pnl, i), open_time: '2026-10-01T' + time + '+05:30', close_time: '2026-10-02T09:00:00Z', session: 'London' });
  it('ignores conflicting journal and trade labels and accounts for off-session trades', () => {
    const trades = [at('05:30:00', 100, 0), at('11:00:00', -40, 1), at('17:00:00', 20, 2), at('14:30:00', 5, 3)];
    const journals = trades.map(t => entry(t, 'Off Session New York'));
    const result = analyzeTrades(trades, journals, '30 Days', 'All Trades', now);
    expect(result.sessionPerf).toEqual([
      { name: 'Asian', pnl: 100, count: 1, wins: 1, losses: 0 },
      { name: 'London', pnl: -40, count: 1, wins: 0, losses: 1 },
      { name: 'New York', pnl: 20, count: 1, wins: 1, losses: 0 },
    ]);
    expect(result.unassignedSession).toEqual({ pnl: 5, count: 1, wins: 1, losses: 0 });
    expect(sum([...result.sessionPerf.map(s => s.pnl), result.unassignedSession.pnl])).toBe(result.totalPnl);
    expect(analyzeTrades(trades, [], '30 Days', 'Winners', now).sessionPerf[1].count).toBe(0);
  });
  it.each([
    ['05:29:59.999', -1], ['05:30:00', 0], ['07:59:59.999', 0], ['08:00:00', -1],
    ['10:59:59.999', -1], ['11:00:00', 1], ['14:29:59.999', 1], ['14:30:00', -1],
    ['16:59:59.999', -1], ['17:00:00', 2], ['20:29:59.999', 2], ['20:30:00', -1], ['00:00:00', -1],
  ])('assigns entry at %s IST to bucket %s', (time, index) => {
    const result = analyzeTrades([at(time, 10, 0)], [], '30 Days', 'All Trades', now);
    expect(result.sessionPerf.map(s => s.count)).toEqual([0, 1, 2].map(i => i === index ? 1 : 0));
    expect(result.unassignedSession.count).toBe(index === -1 ? 1 : 0);
  });
  it('changes session only when opening time changes, independently of journal or closing time', () => {
    const trade = at('11:00:00', 0, 0);
    const before = analyzeTrades([trade], [entry(trade, 'London')], '30 Days', 'All Trades', now);
    const journalEdit = analyzeTrades([trade], [entry(trade, 'Asian')], '30 Days', 'All Trades', now);
    expect(journalEdit.sessionPerf).toEqual(before.sessionPerf);
    const after = analyzeTrades([{ ...trade, open_time: '2026-10-01T17:00:00+05:30' }], [], '30 Days', 'All Trades', now);
    expect(after.sessionPerf[2]).toMatchObject({ count: 1, pnl: 0 });
    expect(after.totalPnl).toBe(before.totalPnl);
  });
});
