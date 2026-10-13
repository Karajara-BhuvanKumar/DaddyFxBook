import { describe, expect, it } from 'vitest';
import { calculatePositionSize, decimalValue, POSITION_INSTRUMENTS, validRisk } from '@/lib/positionSize';

describe('position sizing', () => {
  it.each([[0.6, 60, 0.3], [0.75, 75, 0.37], [1.25, 125, 0.62], [1.5, 150, 0.75]])('calculates %s percent without exceeding the risk budget', (risk, amount, lots) => {
    const result = calculatePositionSize(10000, risk, 20, 10)!;
    expect(result.riskAmount).toBeCloseTo(amount);
    expect(result.lots).toBe(lots);
    expect(result.lossAtStop).toBeCloseTo(lots * 200);
    expect(result.lossAtStop).toBeLessThanOrEqual(amount);
    expect(result.miniLots).toBeCloseTo(lots * 10);
    expect(result.microLots).toBeCloseTo(lots * 100);
  });
  it('uses the rounded position for loss at stop, including the screenshot example', () => {
    expect(calculatePositionSize(5000, 0.5, 30, 10)).toMatchObject({ riskAmount: 25, lots: 0.08, lossAtStop: 24 });
  });
  it('supports exact decimal percentages and custom pip values', () => {
    expect(validRisk('0.755')).toBe(0.755);
    expect(calculatePositionSize(10000, 0.755, 10, 2.5)).toMatchObject({ riskAmount: 75.5, lots: 3.02, lossAtStop: 75.5 });
  });
  it.each(['', ' ', '-1', 'NaN', 'Infinity', '1abc', '1,000', '1e3', '0'])('rejects malformed/nonpositive input %s', value => expect(decimalValue(value)).toBeNull());
  it('rejects excessive percentages and nonfinite calculations', () => {
    expect(validRisk('100')).toBe(100);
    expect(validRisk('100.01')).toBeNull();
    for (const value of [0, -1, NaN, Infinity]) {
      expect(calculatePositionSize(value, 1, 20, 10)).toBeNull();
      expect(calculatePositionSize(10000, value, 20, 10)).toBeNull();
      expect(calculatePositionSize(10000, 1, value, 10)).toBeNull();
      expect(calculatePositionSize(10000, 1, 20, value)).toBeNull();
    }
    expect(calculatePositionSize(1e308, 100, 1e-300, 1e-300)).toBeNull();
    expect(calculatePositionSize(100, 101, 20, 10)).toBeNull();
  });
  it('does not suggest an oversized minimum position', () => expect(calculatePositionSize(10, 0.1, 50, 10)).toMatchObject({ lots: 0, lossAtStop: 0 }));
  it('keeps the gold contract and pip definition consistent', () => {
    const gold = POSITION_INSTRUMENTS.find(i => i.symbol === 'XAUUSD')!;
    expect(gold.contractSize).toBe(100);
    expect(gold.pipSize).toBe(0.1);
    const pipValue = gold.contractSize * gold.pipSize;
    expect(pipValue).toBe(10);
    expect(30 * gold.pipSize).toBe(3);
    const result = calculatePositionSize(10000, 1, 30, pipValue)!;
    expect(result.riskAmount).toBe(100);
    expect(result.estimate.lots).toBeCloseTo(1 / 3, 12);
    expect(result.estimate.miniLots).toBeCloseTo(10 / 3, 12);
    expect(result.estimate.microLots).toBeCloseTo(100 / 3, 12);
    expect(result.estimate.lossAtStop).toBeCloseTo(100, 12);
    expect(result.lots).toBe(0.33);
    expect(result.lossAtStop).toBe(99);
  });
  it.each(POSITION_INSTRUMENTS.filter(i => i.symbol !== 'XAUUSD'))('preserves $symbol Forex specifications and rounded risk', instrument => {
    expect(instrument.pipSize).toBe(0.0001);
    expect(instrument.contractSize).toBe(100000);
    const pipValue = instrument.contractSize * instrument.pipSize;
    expect(pipValue).toBe(10);
    const result = calculatePositionSize(10000, 1, 30, pipValue)!;
    expect(result).toMatchObject({ lots: 0.33, microLots: 33, riskAmount: 100, lossAtStop: 99 });
    expect(result.miniLots).toBeCloseTo(3.3, 12);
    expect(calculatePositionSize(5000, 0.5, 30, pipValue)).toMatchObject({ lots: 0.08, riskAmount: 25, lossAtStop: 24 });
  });
  it.each([0.6, 0.75, 1.25, 1.4, 1.65])('retains full Gold precision at %s percent', risk => {
    const result = calculatePositionSize(10000, risk, 30, 10)!;
    expect(result.estimate.lots).toBeCloseTo(risk / 3, 12);
    expect(result.estimate.miniLots).toBeCloseTo(risk * 10 / 3, 12);
    expect(result.estimate.microLots).toBeCloseTo(risk * 100 / 3, 12);
    expect(result.estimate.lossAtStop).toBeCloseTo(risk * 100, 10);
    expect(result.lossAtStop).toBeLessThanOrEqual(result.riskAmount + 1e-10);
  });
});
