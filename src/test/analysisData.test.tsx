import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllAnalysisRows } from '@/lib/fetchAllAnalysisRows';
import { AnalysisSessionTimeline } from '@/components/AnalysisSessionTimeline';

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('complete analysis pagination', () => {
  it('fetches more than the server cap, including server-shortened pages', async () => {
    const rows = Array.from({ length: 2501 }, (_, i) => ({ id: String(i).padStart(6, '0') }));
    const page = vi.fn(async (after?: string) => ({ data: rows.filter(r => !after || r.id > after).slice(0, 400), error: null }));
    expect(await fetchAllAnalysisRows(page)).toEqual(rows);
    expect(page).toHaveBeenCalledTimes(8);
  });
  it('rejects the entire load if a later page fails', async () => {
    const page = vi.fn().mockResolvedValueOnce({ data: [{ id: 'a' }], error: null }).mockResolvedValueOnce({ data: null, error: new Error('Unavailable') });
    await expect(fetchAllAnalysisRows(page)).rejects.toThrow('Unavailable');
  });
  it('guards against a repeated cursor and allows an empty account', async () => {
    await expect(fetchAllAnalysisRows(async () => ({ data: [], error: null }))).resolves.toEqual([]);
    await expect(fetchAllAnalysisRows(async () => ({ data: [{ id: 'a' }], error: null }))).rejects.toThrow('did not advance');
  });
});

describe('isolated session clock', () => {
  it('advances each second from actual UTC time, crosses boundaries, and cleans up', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-05T07:59:59Z'));
    const parent = vi.fn(() => <AnalysisSessionTimeline />);
    const Parent = parent;
    const { container, unmount } = render(<Parent />);
    expect(screen.getByLabelText('Current session: Asian')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText('Current session: London')).toBeInTheDocument();
    expect(container.querySelector('.an-now')).toHaveAttribute('title', '13:30:00 IST · London');
    expect(container.querySelector('.an-session-times')).toHaveTextContent('05:3013:3018:3003:3005:30');
    expect(parent).toHaveBeenCalledTimes(1);
    act(() => { vi.setSystemTime(new Date('2026-10-05T23:59:59Z')); window.dispatchEvent(new Event('focus')); });
    expect(parseFloat((container.querySelector('.an-now') as HTMLElement).style.left)).toBeGreaterThan(99.99);
    act(() => vi.advanceTimersByTime(1000));
    expect(container.querySelector('.an-now')).toHaveStyle({ left: '0%' });
    expect(container.querySelector('[aria-current="time"]')).toHaveTextContent('Asian');
    unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});
