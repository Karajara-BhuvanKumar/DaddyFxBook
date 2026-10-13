export const POSITION_INSTRUMENTS = [
  { symbol: 'EURUSD', pipSize: 0.0001, contractSize: 100000, unit: 'currency units' },
  { symbol: 'GBPUSD', pipSize: 0.0001, contractSize: 100000, unit: 'currency units' },
  { symbol: 'AUDUSD', pipSize: 0.0001, contractSize: 100000, unit: 'currency units' },
  { symbol: 'NZDUSD', pipSize: 0.0001, contractSize: 100000, unit: 'currency units' },
  // Reference convention: one Gold pip is a $0.10/oz move, not a $0.01 tick.
  // 100 oz per standard lot × $0.10 = $10 per pip per standard lot.
  { symbol: 'XAUUSD', pipSize: 0.1, contractSize: 100, unit: 'troy ounces' },
] as const;

export function decimalValue(value: string): number | null {
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function validRisk(value: string): number | null {
  const number = decimalValue(value);
  return number !== null && number <= 100 ? number : null;
}

export function calculatePositionSize(balance: number, riskPercent: number, stopPips: number, pipValue: number) {
  if (![balance, riskPercent, stopPips, pipValue].every(n => Number.isFinite(n) && n > 0) || riskPercent > 100) return null;
  const riskAmount = balance * (riskPercent / 100);
  const lossPerLot = stopPips * pipValue;
  const exactLots = riskAmount / lossPerLot;
  if (![riskAmount, lossPerLot, exactLots].every(n => Number.isFinite(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER / 100)) return null;
  // Round down to a 0.01 standard-lot increment so the estimate stays within budget.
  // Correct only machine-precision errors at an exact increment boundary.
  const lotSteps = exactLots * 100;
  const lots = Math.floor(lotSteps + Number.EPSILON * lotSteps * 2) / 100;
  const lossAtStop = lots * lossPerLot;
  return {
    riskAmount, exactLots, lots, miniLots: lots * 10, microLots: lots * 100, lossAtStop,
    // Keep the theoretical estimate separate from the broker-increment position.
    // Convert before display rounding so 1/3 standard lot remains 3.33 mini / 33.33 micro.
    estimate: { lots: exactLots, miniLots: exactLots * 10, microLots: exactLots * 100, lossAtStop: exactLots * lossPerLot },
  };
}
