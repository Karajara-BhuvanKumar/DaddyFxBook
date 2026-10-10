import { AlertTriangle } from 'lucide-react';
import type { Trade } from '@/hooks/useTrades';
import type { RuleViolation } from '@/lib/ruleChecks';
import { tradeInstant } from '@/lib/ruleChecks';

export function CalendarRuleViolations({ date, violations, trades, timeZone }: { date: string; violations: RuleViolation[]; trades: Trade[]; timeZone: string }) {
  if (!violations.length) return null;
  const label = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
  const byId = new Map(trades.map(t => [t.id, t]));
  const time = (value: string) => Number.isFinite(tradeInstant(value)) ? new Date(value).toLocaleString('en-US', { timeZone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : 'Not recorded';
  return <section className="an-rule-details" aria-label={label + ' — Rule Violations'}>
    <h3><AlertTriangle size={16} aria-hidden="true" />Rule Violations</h3>
    <p>{label} · {timeZone}</p>
    <ul>{violations.map(v => <li key={v.ruleId}>
      <h4>{v.ruleText}</h4><p>{v.detail}</p>
      {!!v.tradeIds?.length && <details><summary>View {v.tradeIds.length} relevant trade{v.tradeIds.length === 1 ? '' : 's'}</summary>
        <ul>{v.tradeIds.map(id => {
          const trade = byId.get(id);
          return trade && <li key={id}><b>{trade.symbol} · {trade.direction}</b><span>Trade {id}</span><span>Opened {time(trade.open_time)}</span><span>Closed {time(trade.close_time)}</span>
            {trade.risk_pct != null && Number.isFinite(trade.risk_pct) && <span>Recorded risk: {trade.risk_pct}%</span>}
            {trade.pnl != null && Number.isFinite(trade.pnl) && <span>P&amp;L: {trade.pnl < 0 ? '-' : ''}${Math.abs(trade.pnl).toFixed(2)}</span>}
          </li>;
        })}</ul>
      </details>}
    </li>)}</ul>
  </section>;
}
