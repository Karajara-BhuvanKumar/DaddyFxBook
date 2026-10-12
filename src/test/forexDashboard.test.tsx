import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ForexMarketHours from '@/components/tools/ForexMarketHours';

const context = vi.hoisted(() => ({ preferences: { timezone: 'Asia/Kolkata', time_format: '24h' } }));
vi.mock('@/contexts/WorkspacePreferencesContext', () => ({ useWorkspacePreferences: () => context }));
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T12:00:00Z')); context.preferences = { timezone: 'Asia/Kolkata', time_format: '24h' }; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('live Forex dashboard', () => {
  it('uses market-local dates and timezone names independently from saved IST', () => {
    render(<ForexMarketHours />);
    expect(screen.getByTestId('market-user-clock')).toHaveTextContent('17:30:00');
    expect(screen.getByTestId('sydney-clock')).toHaveTextContent('23:00:00');
    expect(screen.getByTestId('tokyo-clock')).toHaveTextContent('21:00:00');
    expect(screen.getByTestId('london-clock')).toHaveTextContent('13:00:00');
    expect(screen.getByTestId('new-york-clock')).toHaveTextContent('08:00:00');
    for (const [id, zone] of [['sydney', 'AEDT'], ['tokyo', 'JST'], ['london', 'BST'], ['new-york', 'EDT']]) expect(screen.getByTestId(`${id}-zone`)).toHaveTextContent(zone);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId('market-user-clock')).toHaveTextContent('17:30:01');
    expect(screen.getByTestId('new-york-countdown')).toHaveTextContent('Closes in 08:59:59');
  });
  it('synchronizes format toggle across clocks, ranges and ticks, and follows saved preference changes', () => {
    const view = render(<ForexMarketHours />);
    fireEvent.click(screen.getByRole('switch', { name: 'Use 24-hour time' }));
    expect(screen.getByTestId('market-user-clock')).toHaveTextContent('5:30:00 pm');
    expect(screen.getByTestId('london-clock')).toHaveTextContent('1:00:00 pm');
    expect(view.container.querySelector('[data-window=overlap] h4')).toHaveTextContent('5:30 pm – 9:30 pm');
    context.preferences = { timezone: 'America/New_York', time_format: '12h' };
    view.rerender(<ForexMarketHours />);
    expect(screen.getByTestId('market-user-clock')).toHaveTextContent('8:00:00 am');
    expect(screen.getByTestId('london-clock')).toHaveTextContent('1:00:00 pm');
    expect(view.container.querySelector('[data-window=overlap] h4')).toHaveTextContent('8:00 am – 12:00 pm');
    context.preferences = { timezone: 'Europe/London', time_format: '24h' };
    view.rerender(<ForexMarketHours />);
    expect(screen.getByTestId('market-user-clock')).toHaveTextContent('13:00:00');
    expect(screen.getByTestId('london-clock')).toHaveTextContent('13:00:00');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
  it('changes DST labels in a mounted dashboard at the real transition', () => {
    vi.setSystemTime(new Date('2026-10-25T00:59:59Z'));
    render(<ForexMarketHours />);
    expect(screen.getByTestId('london-clock')).toHaveTextContent('01:59:59');
    expect(screen.getByTestId('london-zone')).toHaveTextContent('BST');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId('london-clock')).toHaveTextContent('01:00:00');
    expect(screen.getByTestId('london-zone')).toHaveTextContent('GMT');
    expect(screen.getByTestId('new-york-zone')).toHaveTextContent('EDT');
  });
  it('recovers from sleep, updates active lanes and advances opening windows without stale timers', () => {
    const view = render(<ForexMarketHours />);
    expect(view.container.querySelectorAll('.fx-session[aria-current=time]')).toHaveLength(2);
    const oldMarker = view.container.querySelector('.fx-timeline')!.getAttribute('style');
    act(() => vi.advanceTimersByTime(250));
    expect(view.container.querySelector('.fx-timeline')!.getAttribute('style')).not.toBe(oldMarker);
    act(() => { vi.setSystemTime(new Date('2026-10-24T12:00:00Z')); window.dispatchEvent(new Event('focus')); });
    expect(view.container.querySelectorAll('.fx-session[aria-current=time]')).toHaveLength(0);
    expect(view.container.querySelector('[data-window=london-open] h4')).toHaveTextContent('13:30 – 15:30');
    expect(view.container.querySelector('[data-window=london-open]')).toHaveTextContent('26 Oct 2026');
    act(() => { vi.setSystemTime(new Date('2026-10-26T08:00:00Z')); document.dispatchEvent(new Event('visibilitychange')); });
    expect(view.container.querySelector('[data-market=london]')).toHaveAttribute('aria-current', 'time');
    expect(view.container.querySelector('[data-window=london-open]')).toHaveTextContent('Active · ends in 02:00:00');
    expect(screen.getByTestId('london-zone')).toHaveTextContent('GMT');
  });
  it('cleans up the live timer when leaving the tool', () => {
    const view = render(<ForexMarketHours />);
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
