import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import UtcToIstConverter from '@/components/UtcToIstConverter';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
const toggle = () => screen.getByRole('button', { name: 'UTC → IST converter' });
const input = () => screen.getByLabelText('UTC Date & Time');
const copy = () => screen.getByRole('button', { name: 'Copy IST timestamp' });

describe('UTC converter widget', () => {
  it('starts collapsed, toggles, closes with Escape, returns focus and retains its value', async () => {
    render(<UtcToIstConverter />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(toggle());
    expect(screen.getByRole('dialog', { name: 'UTC → IST Converter' })).toBeInTheDocument();
    expect(copy()).toBeDisabled();
    fireEvent.change(input(), { target: { value: '2026-10-23T20:00' } });
    expect(screen.getByRole('status')).toHaveTextContent('Oct 24, 2026 · 1:30 AM IST');
    fireEvent.keyDown(input(), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(toggle()).toHaveFocus());
    fireEvent.click(toggle());
    expect(input()).toHaveValue('2026-10-23T20:00');
    fireEvent.click(toggle());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('populates current UTC and clears stale output when input becomes empty', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T23:59:45Z'));
    render(<UtcToIstConverter />);
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('button', { name: 'Use Current UTC Time' }));
    expect(input()).toHaveValue('2026-12-31T23:59');
    expect(screen.getByRole('status')).toHaveTextContent('Jan 1, 2027 · 5:29 AM IST');
    fireEvent.change(input(), { target: { value: '' } });
    expect(copy()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('—');
    expect(screen.getByText('Enter a complete UTC date and time to convert.')).toBeVisible();
  });

  it('copies the displayed timestamp and reports clipboard failure', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard: { writeText } }));
    render(<UtcToIstConverter />);
    fireEvent.click(toggle());
    fireEvent.change(input(), { target: { value: '2026-10-23T12:00' } });
    fireEvent.click(copy());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('IST timestamp copied'));
    expect(writeText).toHaveBeenCalledWith('Oct 23, 2026 · 5:30 PM IST');
    writeText.mockRejectedValueOnce(new Error('Permission denied'));
    fireEvent.click(copy());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Could not copy')));
    vi.unstubAllGlobals();
  });
});
