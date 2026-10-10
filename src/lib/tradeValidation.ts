export function validateTrade(input: { entry_price: number; exit_price: number; lot_size: number; open_time: string; close_time: string; risk_pct?: number | null }) {
  if (![input.entry_price, input.exit_price, input.lot_size].every(n => Number.isFinite(n) && n > 0)) {
    throw new Error('Entry price, exit price, and lot size must be greater than zero.');
  }
  if (input.risk_pct != null && (!Number.isFinite(input.risk_pct) || input.risk_pct < 0 || input.risk_pct > 100)) throw new Error('Recorded risk must be between 0% and 100%.');
  const open = Date.parse(input.open_time), close = Date.parse(input.close_time);
  if (!Number.isFinite(open) || !Number.isFinite(close)) throw new Error('Enter valid open and close dates.');
  if (close < open) throw new Error('Close date must be on or after the open date.');
}
