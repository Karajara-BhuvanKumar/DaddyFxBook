import { IST_MARKET_SESSIONS } from '@/lib/marketSessions';

export const RULE_TYPE_OPTIONS = [
  { value: 'manual', label: 'Manual (self-checked)', thresholdLabel: '' },
  { value: 'max_trades_per_day', label: 'Max trades per day', thresholdLabel: 'Max trades' },
  { value: 'max_consecutive_losses', label: 'Stop after N consecutive losses', thresholdLabel: 'Max consecutive losses' },
  { value: 'max_daily_loss', label: 'Max daily loss', thresholdLabel: 'Max loss ($)' },
  { value: 'max_risk_per_trade', label: 'Max risk per trade', thresholdLabel: 'Max risk (%)' },
  { value: 'permitted_sessions', label: 'Permitted trading sessions', thresholdLabel: '' },
] as const;
export type RuleType = typeof RULE_TYPE_OPTIONS[number]['value'];
export const SESSION_OPTIONS = IST_MARKET_SESSIONS;
export function needsRuleThreshold(type: string) { return type !== 'manual' && type !== 'permitted_sessions'; }
export function validateRuleConfiguration(type: string, threshold: number | null, sessions: string[] = []) {
  if (!RULE_TYPE_OPTIONS.some(option => option.value === type)) return 'Choose a supported rule type.';
  if (type === 'permitted_sessions' && (!sessions.length || sessions.some(id => !SESSION_OPTIONS.some(s => s.id === id)))) return 'Choose at least one permitted session.';
  if (needsRuleThreshold(type) && (threshold === null || !Number.isFinite(threshold) || threshold <= 0)) return 'Enter a positive limit.';
  if (['max_trades_per_day', 'max_consecutive_losses'].includes(type) && !Number.isInteger(threshold)) return 'Trade counts must be whole numbers.';
  if (type === 'max_risk_per_trade' && threshold! > 100) return 'Risk must be at most 100%.';
  return null;
}
export function ruleBadge(type: string, threshold: number | null, sessions: string[] = []) {
  if (type === 'max_trades_per_day') return `Auto: max ${threshold}/day`;
  if (type === 'max_consecutive_losses') return `Auto: stop after ${threshold} losses`;
  if (type === 'max_daily_loss') return `Auto: max loss $${threshold}`;
  if (type === 'max_risk_per_trade') return `Auto: max risk ${threshold}%`;
  if (type === 'permitted_sessions') return `Auto: ${SESSION_OPTIONS.filter(s => sessions.includes(s.id)).map(s => s.name).join(', ')} · IST`;
  return null;
}
