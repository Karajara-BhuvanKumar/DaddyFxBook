import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Settings from "@/pages/Settings";
import { DEFAULTS, useUserSettings, type UserSettings } from "@/hooks/useUserSettings";
import { WorkspacePreferencesProvider, useWorkspacePreferences } from "@/contexts/WorkspacePreferencesContext";
import { formatWorkspaceDate, formatWorkspaceTime } from "@/lib/workspacePreferences";
import { accentAppearance } from "@/lib/accentColors";
import { ThemeToggle } from "@/components/theme-toggle";

const backend = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), toast: vi.fn(), upload: vi.fn(), signedUrl: vi.fn(), remove: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "test-user", email: "trader@example.com" } }) }));
vi.mock("@/hooks/use-toast", () => ({ toast: backend.toast }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  storage: { from: () => ({ upload: backend.upload, createSignedUrl: backend.signedUrl, remove: backend.remove }) },
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: backend.read }) }),
    update: (patch: Partial<UserSettings>) => ({ eq: () => ({ select: () => ({ single: () => backend.save(patch) }) }) }),
  }),
} }));

let saved: UserSettings;
let systemDark: boolean;
let systemListeners: Set<(event: { matches: boolean }) => void>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => 'blob:local-preview'); URL.revokeObjectURL = vi.fn();
  backend.upload.mockResolvedValue({ error: null }); backend.signedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.test/avatar.png' }, error: null }); backend.remove.mockResolvedValue({ error: null });
  saved = DEFAULTS("test-user");
  backend.read.mockImplementation(async () => ({ data: saved, error: null }));
  backend.save.mockImplementation(async (patch) => { saved = { ...saved, ...patch }; return { data: saved, error: null }; });
  systemDark = false;
  systemListeners = new Set();
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({
    matches: systemDark, media: query, onchange: null,
    addListener: callback => systemListeners.add(callback), removeListener: callback => systemListeners.delete(callback),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: () => true,
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function ClockProbe() {
  const { preferences } = useWorkspacePreferences();
  const now = new Date("2026-10-08T23:30:00Z");
  return <output data-testid="clock">{formatWorkspaceDate(now, preferences.timezone)} {formatWorkspaceTime(now, preferences)}</output>;
}
function Workspace({ showSettings }: { showSettings: boolean }) {
  const { settings } = useUserSettings();
  return <WorkspacePreferencesProvider saved={settings}><ClockProbe /><ThemeToggle />{showSettings && <Settings />}</WorkspacePreferencesProvider>;
}
async function openSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const tree = (showSettings: boolean) => <ThemeProvider attribute="class" defaultTheme="dark" enableSystem><QueryClientProvider client={client}><MemoryRouter initialEntries={["/settings"]}><Workspace showSettings={showSettings} /></MemoryRouter></QueryClientProvider></ThemeProvider>;
  const view = render(tree(true));
  await screen.findByRole("tab", { name: "Preferences" });
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Preferences" }), { button: 0, ctrlKey: false });
  const panel = within(view.container.querySelector('.settings-tab-panel[data-state="active"]') as HTMLElement);
  return { ...view, panel, hide: () => view.rerender(tree(false)) };
}


describe("Workspace preferences", () => {
  it("keeps all preferences local and saves them together only on explicit submission", async () => {
    const { panel } = await openSettings();
    fireEvent.click(panel.getByRole('button', { name: 'Purple accent' }));
    fireEvent.click(panel.getByRole('button', { name: 'Light' }));
    fireEvent.click(panel.getByRole('switch', { name: 'Compact layout' }));
    fireEvent.change(panel.getByLabelText('Timezone'), { target: { value: 'Asia/Kolkata' } });
    fireEvent.change(panel.getByLabelText('Time format'), { target: { value: '12h' } });
    fireEvent.change(panel.getByLabelText('Default currency'), { target: { value: 'INR' } });
    fireEvent.change(panel.getByLabelText('Daily risk limit (%)'), { target: { value: '4' } });
    expect(backend.save).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.accent).toBe('blue');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.dataset.compact).toBe('false');
    expect(screen.getByTestId('clock')).toHaveTextContent('Oct 8, 2026 23:30');
    expect(panel.getByText('You have unsaved changes')).toBeVisible();
    fireEvent.click(panel.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(backend.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Changes saved' })));
    expect(backend.save).toHaveBeenCalledTimes(1);
    expect(backend.save).toHaveBeenCalledWith({ accent_color: 'purple', theme: 'light', compact_mode: true, timezone: 'Asia/Kolkata', time_format: '12h', currency: 'INR', max_daily_risk: 4 });
    expect(document.documentElement.dataset.accent).toBe('purple');
    await waitFor(() => expect(document.documentElement).toHaveClass('light'));
    expect(document.documentElement.dataset.compact).toBe('true');
    expect(screen.getByTestId('clock')).toHaveTextContent('Oct 9, 2026 05:00 AM');
    expect(panel.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('does not apply even submitted changes globally before the server confirms them', async () => {
    let finish!: (result: { data: UserSettings; error: null }) => void;
    backend.save.mockImplementationOnce(patch => new Promise(resolve => { saved = { ...saved, ...patch }; finish = resolve; }));
    const { panel, hide } = await openSettings();
    fireEvent.click(panel.getByRole('button', { name: 'Green accent' }));
    fireEvent.click(panel.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(backend.save).toHaveBeenCalledOnce());
    expect(document.documentElement.dataset.accent).toBe('blue');
    expect(panel.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(panel.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    hide();
    await act(async () => finish({ data: saved, error: null }));
    await waitFor(() => expect(document.documentElement.dataset.accent).toBe('green'));
  });

  it('Cancel discards every draft, including profile edits from another tab', async () => {
    const { panel, container } = await openSettings();
    fireEvent.click(panel.getByRole('button', { name: 'Gold accent' }));
    fireEvent.click(panel.getByRole('button', { name: 'Light' }));
    fireEvent.change(panel.getByLabelText('Timezone'), { target: { value: 'Asia/Kolkata' } });
    fireEvent.change(container.querySelector('#display-name')!, { target: { value: 'Unsaved name' } });
    fireEvent.click(panel.getByRole('button', { name: 'Cancel' }));
    expect(panel.getByRole('button', { name: 'Blue accent' })).toHaveAttribute('aria-pressed', 'true');
    expect(panel.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(panel.getByLabelText('Timezone')).toHaveValue('UTC');
    expect(container.querySelector('#display-name')).toHaveValue('');
    expect(document.documentElement.dataset.accent).toBe('blue');
    expect(backend.save).not.toHaveBeenCalled();
    expect(panel.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('preserves all drafts after failure, leaves the saved appearance unchanged, and allows retry', async () => {
    backend.save.mockResolvedValueOnce({ data: null, error: new Error('Connection lost') });
    const { panel } = await openSettings();
    fireEvent.change(panel.getByLabelText('Custom color'), { target: { value: '#ff6600' } });
    fireEvent.click(panel.getByRole('button', { name: 'Light' }));
    fireEvent.change(panel.getByLabelText('Timezone'), { target: { value: 'Asia/Kolkata' } });
    fireEvent.click(panel.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(panel.getByRole('alert')).toHaveTextContent('Connection lost'));
    expect(panel.getByLabelText('Custom color')).toHaveValue('#ff6600');
    expect(panel.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    expect(panel.getByLabelText('Timezone')).toHaveValue('Asia/Kolkata');
    expect(document.documentElement.dataset.accent).toBe('blue');
    expect(saved.accent_color).toBe('blue');
    fireEvent.click(panel.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(panel.getByRole('button', { name: 'Save changes' })).toBeDisabled());
    expect(saved.accent_color).toBe('#ff6600');
    expect(document.documentElement.dataset.accent).toBe('#ff6600');
    expect(panel.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reloads saved custom colors and preferences from the account with a fresh cache', async () => {
    const { panel, unmount } = await openSettings();
    fireEvent.change(panel.getByLabelText('Custom color'), { target: { value: '#12ABCD' } });
    fireEvent.change(panel.getByLabelText('Time format'), { target: { value: '12h' } });
    fireEvent.click(panel.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(saved.accent_color).toBe('#12abcd'));
    unmount(); localStorage.clear();
    const next = await openSettings();
    expect(next.panel.getByLabelText('Custom color')).toHaveValue('#12abcd');
    expect(next.panel.getByLabelText('Time format')).toHaveValue('12h');
    expect(document.documentElement.dataset.accent).toBe('#12abcd');
    expect(next.panel.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('does not save when navigating away from an unsaved form', async () => {
    const { panel, hide, unmount } = await openSettings();
    fireEvent.click(panel.getByRole('button', { name: 'Purple accent' }));
    hide(); expect(backend.save).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.accent).toBe('blue');
    unmount();
    const next = await openSettings();
    expect(next.panel.getByRole('button', { name: 'Blue accent' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('requires valid custom hex and cancels invalid text without saving it', async () => {
    const { panel } = await openSettings();
    fireEvent.change(panel.getByLabelText('Custom color'), { target: { value: '#zzzzzz' } });
    expect(panel.getByLabelText('Custom color')).toHaveAttribute('aria-invalid', 'true');
    expect(panel.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.submit(panel.getByRole('button', { name: 'Save changes' }).closest('form')!);
    expect(backend.save).not.toHaveBeenCalled();
    fireEvent.click(panel.getByRole('button', { name: 'Cancel' }));
    expect(panel.getByLabelText('Custom color')).toHaveAttribute('aria-invalid', 'false');
    expect(panel.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('keeps returning to a saved option clean and prevents duplicate submissions', async () => {
    const { panel } = await openSettings();
    fireEvent.click(panel.getByRole('button', { name: 'Gold accent' }));
    fireEvent.click(panel.getByRole('button', { name: 'Blue accent' }));
    expect(panel.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.click(panel.getByRole('button', { name: 'Gold accent' }));
    const form=panel.getByRole('button', { name: 'Save changes' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(backend.save).toHaveBeenCalledOnce());
  });

  it('follows OS theme after System is saved without applying a new theme draft', async () => {
    saved.theme = 'system';
    const { panel } = await openSettings();
    expect(document.documentElement).toHaveClass('light');
    act(() => { systemDark = true; systemListeners.forEach(callback => callback({ matches: true })); });
    expect(document.documentElement).toHaveClass('dark');
    fireEvent.click(panel.getByRole('button', { name: 'Light' }));
    expect(document.documentElement).toHaveClass('dark');
    fireEvent.click(panel.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(document.documentElement).toHaveClass('light'));
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(accentAppearance('blue','light').hsl);
  });

  it('disables the separate header theme shortcut while on Settings', async () => {
    await openSettings();
    const toggle = screen.getByRole('button', { name: 'Switch to light theme' });
    expect(toggle).toBeDisabled(); fireEvent.click(toggle);
    expect(backend.save).not.toHaveBeenCalled();
  });

  it('stages photos locally, discards them on Cancel, then uploads only on Save', async () => {
    const { panel, container } = await openSettings();
    const file = new File(['image'], 'photo.png', { type: 'image/png' });
    const input=container.querySelector('input[type=file]')!;
    fireEvent.change(input, { target: { files: [file] } });
    expect(backend.upload).not.toHaveBeenCalled(); expect(backend.save).not.toHaveBeenCalled();
    fireEvent.click(panel.getByRole('button', { name: 'Cancel' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-preview');
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(panel.getByRole('button', { name: 'Purple accent' }));
    fireEvent.click(panel.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(saved.avatar_url).toBe('https://example.test/avatar.png'));
    expect(backend.upload).toHaveBeenCalledOnce();
    expect(backend.save).toHaveBeenCalledWith({ avatar_url: 'https://example.test/avatar.png', accent_color: 'purple' });
  });

  it('preserves photo and settings drafts after a failed combined save and cleans the new upload', async () => {
    backend.save.mockResolvedValueOnce({ data: null, error: new Error('Try again') });
    const { panel, container } = await openSettings();
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } });
    fireEvent.click(panel.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(panel.getByRole('alert')).toHaveTextContent('Try again'));
    expect(backend.remove).toHaveBeenCalledOnce(); expect(saved.avatar_url).toBeNull();
    fireEvent.click(panel.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(saved.avatar_url).toBe('https://example.test/avatar.png'));
    expect(backend.upload).toHaveBeenCalledTimes(2);
  });
});
