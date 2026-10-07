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
  it('advances in IST, shows overlaps, resets at IST midnight, and cleans up', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-05T07:59:59Z'));
    const parent = vi.fn(() => <AnalysisSessionTimeline />);
    const Parent = parent;
    const { container, unmount } = render(<Parent />);
    expect(screen.getByLabelText('IST market sessions. Active: Tokyo')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText('IST market sessions. Active: Tokyo + London')).toBeInTheDocument();
    expect(container.querySelector('.an-now')).toHaveAttribute('title', '13:30:00 IST · Tokyo + London');
    expect(container.querySelector('.an-now')).toHaveStyle({ left: '56.25%' });
    expect(container.querySelectorAll('[aria-current="time"]')).toHaveLength(2);
    expect(container.querySelector('.an-session-times')).toHaveTextContent('00:00');
    expect(container.querySelector('.an-session-times')).toHaveTextContent('24:00');
    expect(parent).toHaveBeenCalledTimes(1);
    act(() => { vi.setSystemTime(new Date('2026-10-05T18:29:59Z')); window.dispatchEvent(new Event('focus')); });
    expect(parseFloat((container.querySelector('.an-now') as HTMLElement).style.left)).toBeGreaterThan(99.99);
    act(() => vi.advanceTimersByTime(1000));
    expect(container.querySelector('.an-now')).toHaveStyle({ left: '0%' });
    expect(container.querySelector('[aria-current="time"]')).toHaveTextContent('New York');
    expect(container.querySelector('.an-clock-time')).toHaveTextContent('Tue, 6 Oct 2026');
    act(() => { vi.setSystemTime(new Date('2026-10-06T00:00:00Z')); document.dispatchEvent(new Event('visibilitychange')); });
    expect(container.querySelector('.an-now')).toHaveAttribute('title', '05:30:00 IST · Sydney + Tokyo');
    unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});
