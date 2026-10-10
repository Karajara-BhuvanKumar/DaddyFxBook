import { sum } from '@/lib/analysisStats';
import { istSessionClock } from '@/lib/marketSessions';
import { SESSION_OPTIONS, validateRuleConfiguration } from '@/lib/ruleConfiguration';

export interface RuleRow { id: string; rule: string; active: boolean; rule_type: string; threshold: number | null; allowed_sessions?: string[] | null }
export interface TradeRow { id: string; pnl: number | null; open_time: string; close_time: string; risk_pct?: number | null; status?: string; deleted_at?: string | null; deleted?: boolean }
export interface ManualViolationRow { rule_id: string; violation_date: string; note: string }
export interface RuleViolation { ruleId: string; ruleText: string; source: 'auto' | 'manual'; detail: string; tradeIds?: string[] }
export interface DisciplineSummary { daysTraded: number; daysClean: number; daysBroken: number; compliancePct: number; pnlClean: number; pnlBroken: number; perRuleCounts: {ruleId: string; ruleText: string; count: number}[] }

// Reject ambiguous wall times: persisted trade timestamps must identify an instant.
export function tradeInstant(value: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return NaN;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return NaN;
  const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
  if (hour > 23 || minute > 59 || second > 59) return NaN;
  return Date.parse(value);
}
export function getDayKey(isoTimestamp: string, timeZone = 'UTC'): string {
  const instant = tradeInstant(isoTimestamp);
  if (!Number.isFinite(instant)) return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-');
}
const recordedNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER / 100;

export function evaluateRules(rules: RuleRow[], trades: TradeRow[], manualViolations: ManualViolationRow[] = [], options: { timeZone?: string; now?: number } = {}): Record<string, RuleViolation[]> {
  const timeZone = options.timeZone ?? 'UTC', now = options.now ?? Date.now();
  const entries = new Map<string, TradeRow[]>(), closures = new Map<string, TradeRow[]>(), seen = new Set<string>();
  for (const t of trades) {
    if (!t.id || seen.has(t.id) || t.deleted || t.deleted_at || (t.status && !['open', 'closed', 'realized'].includes(t.status.toLowerCase()))) continue;
    seen.add(t.id);
    const open = tradeInstant(t.open_time), close = tradeInstant(t.close_time);
    if (Number.isFinite(open) && open <= now && (!Number.isFinite(close) || close >= open)) {
      const day = getDayKey(t.open_time, timeZone);
      if (!entries.has(day)) entries.set(day, []);
      entries.get(day)!.push(t);
    }
    if (Number.isFinite(close) && close <= now && (!Number.isFinite(open) || close >= open) && t.status?.toLowerCase() !== 'open') {
      const day = getDayKey(t.close_time, timeZone);
      if (!closures.has(day)) closures.set(day, []);
      closures.get(day)!.push(t);
    }
  }
  for (const rows of entries.values()) rows.sort((a,b) => tradeInstant(a.open_time) - tradeInstant(b.open_time) || a.id.localeCompare(b.id));
  for (const rows of closures.values()) rows.sort((a,b) => tradeInstant(a.close_time) - tradeInstant(b.close_time) || a.id.localeCompare(b.id));
  const result: Record<string, RuleViolation[]> = {};
  for (const rule of rules.filter(r => r.active)) {
    const add = (day: string, detail: string, rows: TradeRow[], source: 'auto' | 'manual' = 'auto') => {
      (result[day] ??= []).push({ ruleId: rule.id, ruleText: rule.rule, source, detail, tradeIds: rows.map(t => t.id) });
    };
    if (rule.rule_type === 'manual') {
      for (const v of manualViolations.filter(v => v.rule_id === rule.id)) add(v.violation_date, v.note || 'Manually flagged', [], 'manual');
      continue;
    }
    const sessions = rule.allowed_sessions ?? [];
    if (validateRuleConfiguration(rule.rule_type, rule.threshold, sessions)) continue;
    const limit = rule.threshold!;
    if (rule.rule_type === 'max_daily_loss') {
      for (const [day, rows] of closures) {
        if (!rows.every(t => recordedNumber(t.pnl))) continue;
        const pnl = sum(rows.map(t => t.pnl!));
        if (pnl < -limit) add(day, 'Daily net loss: $' + Math.abs(pnl).toFixed(2) + '; maximum allowed is $' + limit + '.', rows);
      }
      continue;
    }
    for (const [day, rows] of entries) {
      if (rule.rule_type === 'max_trades_per_day' && rows.length > limit) add(day, rows.length + ' trades taken; limit is ' + limit + '.', rows.slice(limit));
      if (rule.rule_type === 'max_risk_per_trade') {
        const offending = rows.filter(t => recordedNumber(t.risk_pct) && t.risk_pct >= 0 && t.risk_pct <= 100 && t.risk_pct > limit);
        if (offending.length) add(day, 'Recorded risk: ' + [...new Set(offending.map(t => t.risk_pct + '%'))].join(', ') + '; maximum allowed is ' + limit + '%.', offending);
      }
      if (rule.rule_type === 'permitted_sessions') {
        const offending = rows.filter(t => !istSessionClock(new Date(t.open_time)).active.some(s => sessions.includes(s.id)));
        if (offending.length) add(day, offending.length + ' trade' + (offending.length === 1 ? '' : 's') + ' taken outside permitted sessions: ' + SESSION_OPTIONS.filter(s => sessions.includes(s.id)).map(s => s.name + ' (' + s.hours + ' IST)').join(', ') + '.', offending);
      }
      if (rule.rule_type === 'max_consecutive_losses') {
        // Only realized outcomes known BEFORE an entry can trigger a stop rule.
        // Closures sharing a timestamp are a batch: a win/unknown breaks an uncertain streak.
        const closed = (closures.get(day) ?? []).filter(c => tradeInstant(c.close_time) > tradeInstant(c.open_time));
        let cursor = 0, streak = 0, stopped = false;
        const offending: TradeRow[] = [];
        for (const t of rows) {
          while (cursor < closed.length && tradeInstant(closed[cursor].close_time) <= tradeInstant(t.open_time)) {
            const at = tradeInstant(closed[cursor].close_time), batch: TradeRow[] = [];
            while (cursor < closed.length && tradeInstant(closed[cursor].close_time) === at) batch.push(closed[cursor++]);
            if (batch.some(c => !recordedNumber(c.pnl) || c.pnl! > 0)) streak = 0;
            else streak += batch.filter(c => c.pnl! < 0).length;
            if (streak >= limit) stopped = true;
          }
          if (stopped) offending.push(t);
        }
        if (offending.length) add(day, 'Traded after ' + limit + ' consecutive losses', offending);
      }
    }
  }
  return result;
}

export function summarizeDiscipline(
  violations: Record<string, RuleViolation[]>,
  dailyPnl: Record<string, number>,
): DisciplineSummary {
  const tradedDays = Object.keys(dailyPnl);
  const daysTraded = tradedDays.length;
  const brokenDaySet = new Set(Object.keys(violations));
  const daysBroken = tradedDays.filter((d) => brokenDaySet.has(d)).length;
  const daysClean = daysTraded - daysBroken;
  const compliancePct = daysTraded > 0 ? (daysClean / daysTraded) * 100 : 100;

  let pnlClean = 0;
  let pnlBroken = 0;
  for (const day of tradedDays) {
    if (brokenDaySet.has(day)) {
      pnlBroken += dailyPnl[day];
    } else {
      pnlClean += dailyPnl[day];
    }
  }

  // Per-rule counts
  const ruleCounts = new Map<string, { ruleText: string; count: number }>();
  for (const dayViolations of Object.values(violations)) {
    for (const v of dayViolations) {
      const existing = ruleCounts.get(v.ruleId);
      if (existing) {
        existing.count++;
      } else {
        ruleCounts.set(v.ruleId, { ruleText: v.ruleText, count: 1 });
      }
    }
  }

  const perRuleCounts = Array.from(ruleCounts.entries())
    .map(([ruleId, { ruleText, count }]) => ({ ruleId, ruleText, count }))
    .sort((a, b) => b.count - a.count);

  return { daysTraded, daysClean, daysBroken, compliancePct, pnlClean, pnlBroken, perRuleCounts };
}
