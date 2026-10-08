import { describe, expect, it } from 'vitest';
import { analyzeTrades, includedTrades, metrics, sum, utcSession } from '@/lib/analysisStats';
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

describe('journal-based session performance', () => {
  const entry = (trade: Trade, session: unknown): Journal => ({ id: `journal-${trade.id}`, trade_id: trade.id, user_id: trade.user_id,
    pre_trade_notes: null, post_trade_notes: null, emotions: null, lessons: null, tags: null, rating: null, risk_reward: null,
    strategy_setup: JSON.stringify({ market_session: session }), created_at: '', updated_at: '' });
  it('uses the journal selection even when the timestamp and trade session disagree', () => {
    const trades = [make(100, 0), make(-40, 1), make(20, 2)].map(t => ({ ...t, session: 'London' }));
    const journals = trades.map((t, i) => entry(t, ['New York', 'New York', 'Asian'][i]));
    const result = analyzeTrades(trades, journals, '30 Days', 'All Trades', now);
    expect(result.sessionPerf).toEqual([
      { name: 'Asian', pnl: 20, count: 1, wins: 1, losses: 0 },
      { name: 'London', pnl: 0, count: 0, wins: 0, losses: 0 },
      { name: 'New York', pnl: 60, count: 2, wins: 1, losses: 1 },
    ]);
    expect(result.unassignedSession.count).toBe(0);
    const winners = analyzeTrades(trades, journals, '30 Days', 'Winners', now);
    expect(winners.sessionPerf[2]).toMatchObject({ pnl: 100, count: 1, wins: 1, losses: 0 });
    expect(analyzeTrades(trades, journals, 'Today', 'All Trades', now).sessionPerf.every(s => s.count === 0)).toBe(true);
  });
  it('includes all six journal session choices in their named group exactly once', () => {
    const names = ['Asian', 'Off Session Asian', 'London', 'Off Session London', 'New York', 'Off Session New York'];
    const trades = names.map((_, i) => make(i % 2 ? -10 : 25, i));
    const result = analyzeTrades(trades, trades.map((t, i) => entry(t, names[i])), '30 Days', 'All Trades', now);
    result.sessionPerf.forEach(s => expect(s).toMatchObject({ count: 2, pnl: 15, wins: 1, losses: 1 }));
    expect(sum(result.sessionPerf.map(s => s.pnl))).toBe(result.totalPnl);
  });
  it('keeps missing, malformed and unknown journal sessions unassigned without a time or trade-tag fallback', () => {
    const trades = [1, 2, 3, 4, 5].map((value, i) => ({ ...make(value, i), session: 'London' }));
    const journals = [entry(trades[1], ''), entry(trades[2], 'Unknown'), entry(trades[3], 12), { ...entry(trades[4], 'London'), strategy_setup: 'broken JSON' }];
    const result = analyzeTrades(trades, journals, '30 Days', 'All Trades', now);
    expect(result.sessionPerf.every(s => s.count === 0)).toBe(true);
    expect(result.unassignedSession).toMatchObject({ pnl: 15, count: 5 });
    expect(result.totalPnl).toBe(15);
  });
  it('moves performance when a journal session is edited, without changing overall P&L', () => {
    const trade = make(0);
    const initial = analyzeTrades([trade], [entry(trade, 'London')], '30 Days', 'All Trades', now);
    const edited = analyzeTrades([trade], [entry(trade, '  off session   NEW YORK  ')], '30 Days', 'All Trades', now);
    expect(initial.sessionPerf[1].count).toBe(1);
    expect(edited.sessionPerf[1].count).toBe(0);
    expect(edited.sessionPerf[2]).toMatchObject({ pnl: 0, count: 1, wins: 0, losses: 0 });
    expect(initial.totalPnl).toBe(edited.totalPnl);
  });
});

describe('UTC session boundaries', () => {
  it.each([['07:59:00', 'Asian', 0], ['08:00:00', 'London', 1], ['12:59:00', 'London', 1], ['13:00:00', 'New York', 2], ['21:59:00', 'New York', 2], ['22:00:00', 'Asian', 3], ['23:59:59', 'Asian', 3], ['00:00:00', 'Asian', 0]] as const)('%s is %s', (time, name, segment) => {
    const result = utcSession(new Date(`2026-10-05T${time}Z`));
    const [hour, minute, second] = time.split(':').map(Number);
    expect(result).toEqual({ name, segment, progress: (hour * 3600 + minute * 60 + second) / 86400 * 100 });
  });
  it('is independent of timezone offsets and daylight saving', () => {
    expect(utcSession(new Date('2026-10-05T13:30:00+05:30'))).toEqual(utcSession(new Date('2026-10-05T08:00:00Z')));
    expect(utcSession(new Date('2026-11-01T01:30:00-04:00')).name).toBe('Asian');
    expect(utcSession(new Date('2026-11-01T01:30:00-05:00')).name).toBe('Asian');
  });
});
