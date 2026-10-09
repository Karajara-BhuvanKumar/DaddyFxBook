import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EditTradeModal from '@/components/EditTradeModal';
import type { Trade } from '@/hooks/useTrades';

const state = vi.hoisted(() => ({ journal: { post_trade_notes: 'Saved notes' }, loading: false }));
vi.mock('@/hooks/useTrades', () => ({
  useJournal: () => ({ data: state.journal, isLoading: state.loading, isError: false }),
  useChecklist: () => ({ data: null, isLoading: false, isError: false }),
  useUpdateTrade: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock('@/components/journal/StrategySetupCard', () => ({ StrategySetupCard: () => null }));
const trade = { id: 't', symbol: 'XAUUSD', direction: 'Long', entry_price: 2600, exit_price: 2610, lot_size: 0.1, open_time: '2026-10-09T10:00:00Z', close_time: '2026-10-09T11:00:00Z' } as Trade;
const props = { trade, isOpen: true, onClose: vi.fn() };
beforeEach(() => { state.journal = { post_trade_notes: 'Saved notes' }; state.loading = false; });
afterEach(cleanup);
describe('trade editor draft protection', () => {
  it('does not overwrite in-progress edits when server data refreshes', () => {
    const { rerender } = render(<EditTradeModal {...props} />);
    const notes = screen.getByRole('textbox', { name: 'Notes' });
    fireEvent.change(notes, { target: { value: 'My unsaved edit' } });
    state.journal = { post_trade_notes: 'Refreshed server notes' };
    rerender(<EditTradeModal {...props} />);
    expect(notes).toHaveValue('My unsaved edit');
    rerender(<EditTradeModal {...props} isOpen={false} />);
    rerender(<EditTradeModal {...props} />);
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('Refreshed server notes');
  });
  it('waits for journal details before initializing the editable form', () => {
    state.loading = true;
    const { rerender } = render(<EditTradeModal {...props} />);
    expect(screen.queryByRole('textbox', { name: 'Notes' })).not.toBeInTheDocument();
    state.loading = false;
    state.journal = { post_trade_notes: 'Loaded saved notes' };
    rerender(<EditTradeModal {...props} />);
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('Loaded saved notes');
  });
});
