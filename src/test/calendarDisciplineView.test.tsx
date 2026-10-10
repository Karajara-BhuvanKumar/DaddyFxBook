import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AnalysisView } from '@/pages/Analysis';
import { previewTrades } from '@/lib/previewData';
import type { RuleRow } from '@/lib/ruleChecks';

const preferences = vi.hoisted(() => ({ timezone: 'Asia/Kolkata' }));
vi.mock('@/contexts/WorkspacePreferencesContext', () => ({ useWorkspacePreferences: () => ({ preferences }) }));
vi.mock('@/hooks/useAnalysisData', () => ({ useAnalysisData: vi.fn() }));
vi.mock('recharts', async importOriginal => ({ ...await importOriginal<typeof import('recharts')>(), ResponsiveContainer: () => null }));
const rules: RuleRow[] = [
  { id: 'count', rule: 'Maximum trades per day', active: true, rule_type: 'max_trades_per_day', threshold: 2 },
  { id: 'risk', rule: 'Risk per trade', active: true, rule_type: 'max_risk_per_trade', threshold: 1 },
  { id: 'sessions', rule: 'Off-session trading', active: true, rule_type: 'permitted_sessions', threshold: null, allowed_sessions: ['london'] },
];
const trades = [1, 2, 3].map((id, index) => ({ ...previewTrades[0], id: String(id), symbol: 'XAUUSD', pnl: index ? -20 : 100, open_time: '2026-10-09T20:00:00Z', close_time: '2026-10-10T01:00:00Z', risk_pct: index ? null : 1.5 }));
const props = { trades, rules, allJournals: [], initialDate: new Date(2026, 9, 1) };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T12:00:00Z')); preferences.timezone = 'Asia/Kolkata'; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('shows one corner marker, all exact violations and relevant trades without altering P&L', () => {
  const { container } = render(<AnalysisView {...props} />);
  const day = screen.getByRole('button', { name: 'October 10, 3 trades, $60.00, 3 rule violations' });
  expect(day).toHaveClass('an-day-profit');
  expect(day.querySelectorAll('.an-rule-warning')).toHaveLength(1);
  expect(container.querySelectorAll('.an-rule-warning')).toHaveLength(1);
  expect(within(day).getByText('10')).toBeVisible();
  expect(within(day).getByText('3 trades')).toBeVisible();
  fireEvent.click(day);
  const detail = within(screen.getByRole('region', { name: 'October 10, 2026 — Rule Violations' }));
  expect(detail.getByText('3 trades taken; limit is 2.')).toBeVisible();
  expect(detail.getByText('Recorded risk: 1.5%; maximum allowed is 1%.')).toBeVisible();
  expect(detail.getByText(/3 trades taken outside permitted sessions: London/)).toBeVisible();
  expect(detail.getAllByText('Trade 3')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Winners' }));
  expect(screen.getByRole('button', { name: 'October 10, 1 trades, $100.00, 3 rule violations' })).toBeInTheDocument();
});

it('recomputes selected-day details when limits, rules, trades or timezone change', () => {
  const { rerender } = render(<AnalysisView {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /October 10, 3 trades/ }));
  const updated = rules.map(r => ({ ...r, threshold: r.id === 'count' ? 3 : r.threshold, active: r.id !== 'sessions' }));
  rerender(<AnalysisView {...props} rules={updated} />);
  expect(screen.queryByText('3 trades taken; limit is 2.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /October 10, 3 trades.*1 rule violation$/ })).toBeInTheDocument();
  rerender(<AnalysisView {...props} rules={updated} trades={trades.map(t => ({ ...t, risk_pct: null }))} />);
  expect(screen.queryByRole('region', { name: /Rule Violations/ })).not.toBeInTheDocument();
  preferences.timezone = 'UTC';
  rerender(<AnalysisView {...props} />);
  expect(screen.getByRole('button', { name: 'October 9, no trades, 3 rule violations' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'October 10, 3 trades, $60.00' })).toBeInTheDocument();
});

it('shows unavailable checks instead of stale flags when rules fail to load', () => {
  const retry = vi.fn();
  const { container, rerender } = render(<AnalysisView {...props} rulesLoading />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading active rules');
  expect(container.querySelector('.an-rule-warning')).toBeNull();
  rerender(<AnalysisView {...props} rulesError retryRules={retry} />);
  fireEvent.click(screen.getByRole('button', { name: 'Retry rules' }));
  expect(retry).toHaveBeenCalledOnce();
  expect(container.querySelector('.an-rule-warning')).toBeNull();
});
