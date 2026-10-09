import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrades, useAllJournals, useUpdateTrade, useSaveChecklist, useDeleteTrades } from '@/hooks/useTrades';

const db = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, unknown>[]>, writes: [] as { table: string; operation: string; values: unknown }[], failLookup: false }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from(table: string) {
    const filters: [string, unknown][] = []; let cursor = ''; let single = false; let operation = 'select'; let values: unknown;
    const query = {
      select: () => query, order: () => query, limit: () => query, abortSignal: () => query,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      in: () => query, gt: (_: string, value: string) => { cursor = value; return query; },
      single: () => { single = true; return query; }, maybeSingle: () => { single = true; return query; },
      update: (input: unknown) => { operation = 'update'; values = input; return query; },
      insert: (input: unknown) => { operation = 'insert'; values = input; return query; },
      delete: () => { operation = 'delete'; return query; },
      then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
        if (operation !== 'select') db.writes.push({ table, operation, values });
        const rows = (db.rows[table] || []).filter(row => filters.every(([key, value]) => row[key] === value) && String(row.id) > cursor).sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(0, 400);
        const error = db.failLookup && table === 'checklists' && operation === 'select' ? new Error('Network error') : null;
        return Promise.resolve({ data: single ? rows[0] || null : rows, error }).then(resolve, reject);
      },
    };
    return query;
  },
} }));
let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
beforeEach(() => { client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); db.rows = {}; db.writes = []; db.failLookup = false; });
afterEach(() => { cleanup(); client.clear(); });

describe('complete account data and safe writes', () => {
  it('loads all trades and journals even when the server returns shortened pages', async () => {
    const rows = Array.from({ length: 1205 }, (_, index) => ({ id: String(index).padStart(5, '0'), user_id: 'owner', close_time: new Date(2026, 0, 1, 0, index).toISOString() }));
    db.rows.trades = [...rows, { id: '99999', user_id: 'other' }]; db.rows.journals = db.rows.trades;
    const { result } = renderHook(() => ({ trades: useTrades(), journals: useAllJournals() }), { wrapper });
    await waitFor(() => expect(result.current.trades.isSuccess && result.current.journals.isSuccess).toBe(true));
    expect(result.current.trades.data).toHaveLength(1205); expect(result.current.journals.data).toHaveLength(1205);
    expect(result.current.trades.data?.[0].id).toBe('01204');
  });
  it('preserves recorded P&L when saving unchanged trade details', async () => {
    const original = { id: 't', user_id: 'owner', symbol: 'XAUUSD', direction: 'Long', entry_price: 2600, exit_price: 2610, lot_size: 0.1, pnl: 97, open_time: '2026-10-09T10:00:00Z', close_time: '2026-10-09T11:00:00Z' };
    db.rows.trades = [original];
    const { result } = renderHook(useUpdateTrade, { wrapper });
    const { pnl: _pnl, id: _id, user_id: _uid, ...tradeData } = original;
    await act(async () => { await result.current.mutateAsync({ id: 't', tradeData }); });
    expect(db.writes[0].values).not.toHaveProperty('pnl');
  });
  it('refuses to insert a checklist after an unsuccessful lookup', async () => {
    db.failLookup = true;
    const { result } = renderHook(useSaveChecklist, { wrapper });
    await act(async () => { await expect(result.current.mutateAsync({ trade_id: 't', checked_higher_tf: true, risk_within_limits: false, fits_plan: true, key_levels: false, news_checked: false })).rejects.toThrow('Network error'); });
    expect(db.writes).toHaveLength(0);
  });
  it('keeps the trade session aligned when editing or clearing the structured journal setup', async () => {
    const { result } = renderHook(useUpdateTrade, { wrapper });
    for (const session of ['London', '']) {
      await act(async () => { await result.current.mutateAsync({ id: 't', tradeData: {}, journalData: { strategy_setup: JSON.stringify({ market_session: session }) } }); });
      expect(db.writes.at(-1)).toEqual({ table: 'trades', operation: 'update', values: { session: session || null } });
    }
  });
  it('refreshes cross-page caches once after bulk deletion instead of per trade', async () => {
    for (const key of ['trades', 'journal', 'journals-all', 'performance-coach-data']) client.setQueryData([key, 'owner'], []);
    const { result } = renderHook(useDeleteTrades, { wrapper });
    await act(async () => { await result.current.mutateAsync(Array.from({ length: 205 }, (_, i) => String(i))); });
    expect(db.writes).toHaveLength(3);
    for (const key of ['trades', 'journal', 'journals-all', 'performance-coach-data']) expect(client.getQueryState([key, 'owner'])?.isInvalidated).toBe(true);
  });
});
