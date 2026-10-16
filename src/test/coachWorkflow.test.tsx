import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import AIReportPage from '@/pages/AIReport';
import { CoachConnectionError } from '@/lib/coach/provider';

const api = vi.hoisted(() => ({ status: vi.fn(), generate: vi.fn(), read: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'qa-user' } }) }));
vi.mock('@/lib/coach/data', () => ({ fetchCoachData: async () => ({ trades: [{ id: 't1', symbol: 'XAUUSD', pnl: 10, lot_size: 1, direction: 'Long', open_time: new Date(Date.now() - 3600000).toISOString(), close_time: new Date(Date.now() - 1800000).toISOString() }], journals: [], checklists: [], screenshots: [], rules: [], violations: [], warnings: [] }) }));
vi.mock('@/lib/coach/provider', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/coach/provider')>(), getCoachProviderStatus: api.status, generateCoachReview: api.generate }));
vi.mock('@/lib/coach/report', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/coach/report')>(), readSavedReviews: api.read }));
vi.mock('@/components/coach/CoachReview', () => ({ CoachReview: ({ saved }: { saved: { report: { verdict: { headline: string } } } }) => <article>{saved.report.verdict.headline}</article>, ProcessMeasures: () => null }));
const prior = { id: 'saved', generatedAt: '2026-10-01T12:00:00Z', analysis: { window: { period: 'Weekly', label: 'Previous week' }, tradeCount: 3 }, report: { verdict: { headline: 'Existing saved review' } } };
beforeEach(() => { vi.clearAllMocks(); api.status.mockResolvedValue({ ready: true, limitRemaining: null, model: 'configured-model' }); api.read.mockReturnValue([prior]); });
afterEach(cleanup);
function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={client}><AIReportPage /></QueryClientProvider></MemoryRouter>);
}
describe('Coach connection and history workflow', () => {
  it('removes ready after a failed recheck and keeps past reviews accessible', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Coach ready' }));
    api.status.mockRejectedValueOnce(new CoachConnectionError('configuration', 'Provider key missing'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Check again' }));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent('Provider key missing'));
    expect(screen.queryByRole('button', { name: 'Coach ready' })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Existing saved review')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Past reviews/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Existing saved review/ }));
    expect(screen.getByText('Existing saved review')).toBeInTheDocument();
    expect(api.generate).not.toHaveBeenCalled();
  });
  it('rechecks before generation and retains the old review after billing failure', async () => {
    open();
    await screen.findByRole('button', { name: 'Coach ready' });
    api.generate.mockRejectedValueOnce(new CoachConnectionError('billing', 'Add OpenRouter credits'));
    fireEvent.click(screen.getByRole('button', { name: 'Generate Performance Report' }));
    await screen.findByText("Review couldn't be completed");
    expect(api.status).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Coach ready' })).not.toBeInTheDocument();
    expect(screen.getByText('Existing saved review')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    await screen.findByRole('button', { name: 'Coach ready' });
  });
});
