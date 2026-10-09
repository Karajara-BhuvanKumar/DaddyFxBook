import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Journal from '@/pages/Journal';
import { journalDrafts } from '@/lib/journalDrafts';

const state = vi.hoisted(() => ({
  saveJournal: vi.fn(), saveChecklist: vi.fn(), loading: false, error: false,
  trades: [1, 2].map(n => ({ id: String(n), symbol: n === 1 ? 'XAUUSD' : 'EURUSD', direction: 'Long', pnl: 0, entry_price: 2600, lot_size: 0.1, open_time: '2026-10-09T10:00:00Z' })),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test-account' } }) }));
vi.mock('@/components/ai-report/AITradeReviewPanel', () => ({ AITradeReviewPanel: () => <p>Trade review</p> }));
vi.mock('@/components/journal/ExportJournalDialog', () => ({ ExportJournalDialog: () => <button>Export Journal</button> }));
vi.mock('@/hooks/useTrades', () => {
  const query = (data: unknown) => ({ data, isLoading: false, isSuccess: true, isError: false, refetch: vi.fn() });
  return {
    useTrades: () => query(state.trades), useAllJournals: () => query([]),
    useJournal: () => ({ ...query(null), isLoading: state.loading, isSuccess: !state.loading && !state.error, isError: state.error }),
    useChecklist: () => query(null), useScreenshots: () => query([]),
    useSaveJournal: () => ({ mutateAsync: state.saveJournal }),
    useSaveChecklist: () => ({ mutateAsync: state.saveChecklist }),
    useUploadScreenshot: () => ({ mutateAsync: vi.fn() }),
  };
});
const mount = () => render(<MemoryRouter><Journal /></MemoryRouter>);
beforeEach(() => { HTMLElement.prototype.scrollTo = vi.fn(); journalDrafts.clear(); state.loading = false; state.error = false; state.saveJournal.mockReset().mockResolvedValue(undefined); state.saveChecklist.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);

describe('journal editing reliability', () => {
  it('keeps drafts separate across trades and page navigation', async () => {
    const view = mount();
    fireEvent.change(await screen.findByLabelText('Pre-Trade Analysis'), { target: { value: 'Wait for London' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open EURUSD journal' }));
    await waitFor(() => expect(screen.getByLabelText('Pre-Trade Analysis')).toHaveValue(''));
    fireEvent.click(screen.getByRole('button', { name: 'Open XAUUSD journal' }));
    await waitFor(() => expect(screen.getByLabelText('Pre-Trade Analysis')).toHaveValue('Wait for London'));
    view.unmount(); mount();
    await waitFor(() => expect(screen.getByLabelText('Pre-Trade Analysis')).toHaveValue('Wait for London'));
  });
  it('saves custom checklist content and awaits both writes', async () => {
    mount(); await screen.findByLabelText('Pre-Trade Analysis');
    fireEvent.change(screen.getByLabelText('Custom checklist item'), { target: { value: 'Check spread' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add checklist item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check spread' }));
    let finish!: () => void;
    state.saveChecklist.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(state.saveChecklist).toHaveBeenCalled());
    expect(screen.getByLabelText('Pre-Trade Analysis')).toBeDisabled();
    const saved = state.saveJournal.mock.calls[0][0];
    expect(JSON.parse(saved.strategy_setup).custom_checklist).toEqual([{ id: expect.any(String), label: 'Check spread', checked: true }]);
    finish();
    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument());
    expect(journalDrafts.size).toBe(0);
  });
  it('keeps failed saves editable and preserves the draft', async () => {
    state.saveChecklist.mockRejectedValue(new Error('offline'));
    mount(); fireEvent.change(await screen.findByLabelText('Pre-Trade Analysis'), { target: { value: 'Do not lose this' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(state.saveChecklist).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText('Pre-Trade Analysis')).toBeEnabled());
    expect(screen.getByLabelText('Pre-Trade Analysis')).toHaveValue('Do not lose this');
    expect(journalDrafts.size).toBe(1);
  });
  it('does not allow edits before details load or when a read fails', async () => {
    state.loading = true;
    const view = mount();
    expect(screen.queryByLabelText('Pre-Trade Analysis')).not.toBeInTheDocument();
    view.unmount(); state.loading = false; state.error = true; mount();
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this journal");
    expect(screen.queryByLabelText('Pre-Trade Analysis')).not.toBeInTheDocument();
  });
});
