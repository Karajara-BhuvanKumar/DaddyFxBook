import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Settings from "@/pages/Settings";
import { DEFAULTS, useUserSettings, type UserSettings } from "@/hooks/useUserSettings";
import { WorkspacePreferencesProvider, useWorkspacePreferences } from "@/contexts/WorkspacePreferencesContext";
import { formatWorkspaceDate, formatWorkspaceTime } from "@/lib/workspacePreferences";
import { ThemeToggle } from "@/components/theme-toggle";

const backend = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), toast: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "test-user", email: "trader@example.com" } }) }));
vi.mock("@/hooks/use-toast", () => ({ toast: backend.toast }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
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
  const tree = (showSettings: boolean) => <ThemeProvider attribute="class" defaultTheme="dark" enableSystem><QueryClientProvider client={client}><MemoryRouter><Workspace showSettings={showSettings} /></MemoryRouter></QueryClientProvider></ThemeProvider>;
  const view = render(tree(true));
  await screen.findByRole("tab", { name: "Preferences" });
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Preferences" }), { button: 0, ctrlKey: false });
  const panel = within(view.container.querySelector('.settings-tab-panel[data-state="active"]') as HTMLElement);
  return { ...view, panel, hide: () => view.rerender(tree(false)) };
}

describe("Workspace preferences", () => {
  it("previews appearance without saving and Cancel restores all saved choices", async () => {
    const { panel } = await openSettings();
    fireEvent.click(panel.getByRole("button", { name: "Light" }));
    fireEvent.click(panel.getByRole("button", { name: "Purple accent" }));
    fireEvent.click(panel.getByRole("switch", { name: "Compact layout" }));
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement.dataset.accent).toBe("purple");
    expect(document.documentElement.dataset.compact).toBe("true");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("262 83% 65%");
    expect(backend.save).not.toHaveBeenCalled();
    fireEvent.click(panel.getByRole("button", { name: "Cancel" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.dataset.accent).toBe("blue");
    expect(document.documentElement.dataset.compact).toBe("false");
    expect(panel.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("saves the selected preferences and restores them after a fresh mount", async () => {
    const { panel, unmount } = await openSettings();
    fireEvent.click(panel.getByRole("button", { name: "Light" }));
    fireEvent.click(panel.getByRole("button", { name: "Green accent" }));
    fireEvent.click(panel.getByRole("switch", { name: "Compact layout" }));
    fireEvent.change(panel.getByLabelText("Timezone"), { target: { value: "Asia/Kolkata" } });
    fireEvent.change(panel.getByLabelText("Time format"), { target: { value: "12h" } });
    fireEvent.change(panel.getByLabelText("Default currency"), { target: { value: "INR" } });
    expect(screen.getByTestId("clock")).toHaveTextContent("Oct 9, 2026 05:00 AM");
    expect(panel.getByLabelText("Account size (INR)")).toHaveValue(10000);
    fireEvent.submit(panel.getByRole("button", { name: "Save changes" }).closest("form")!);
    await waitFor(() => expect(panel.getByRole("button", { name: "Save changes" })).toBeDisabled());
    expect(backend.save).toHaveBeenCalledWith({ theme: "light", accent_color: "green", compact_mode: true, timezone: "Asia/Kolkata", time_format: "12h", currency: "INR" });
    unmount();
    const next = await openSettings();
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement.dataset.compact).toBe("true");
    expect(document.documentElement.dataset.accent).toBe("green");
    expect(next.panel.getByLabelText("Timezone")).toHaveValue("Asia/Kolkata");
    expect(screen.getByTestId("clock")).toHaveTextContent("05:00 AM");
  });

  it("retains edits after a save failure and allows retry", async () => {
    backend.save.mockResolvedValueOnce({ data: null, error: new Error("Connection lost") });
    const { panel } = await openSettings();
    fireEvent.click(panel.getByRole("button", { name: "Gold accent" }));
    const submit = () => fireEvent.submit(panel.getByRole("button", { name: "Save changes" }).closest("form")!);
    submit();
    await waitFor(() => expect(backend.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Failed to update settings" })));
    expect(panel.getByRole("button", { name: "Gold accent" })).toHaveAttribute("aria-pressed", "true");
    expect(panel.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(backend.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Changes saved" }));
    submit();
    await waitFor(() => expect(panel.getByRole("button", { name: "Save changes" })).toBeDisabled());
    expect(saved.accent_color).toBe("gold");
  });

  it("follows OS changes in System mode and discards previews when leaving Settings", async () => {
    saved.theme = "system";
    const { panel, hide } = await openSettings();
    expect(document.documentElement).toHaveClass("light");
    act(() => { systemDark = true; systemListeners.forEach(callback => callback({ matches: true })); });
    expect(document.documentElement).toHaveClass("dark");
    fireEvent.click(panel.getByRole("button", { name: "Light" }));
    expect(document.documentElement).toHaveClass("light");
    hide();
    expect(document.documentElement).toHaveClass("dark");
    expect(backend.save).not.toHaveBeenCalled();
  });

  it("persists header theme changes so other settings consumers cannot revert them", async () => {
    const { panel } = await openSettings();
    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
    await waitFor(() => expect(document.documentElement).toHaveClass("light"));
    expect(saved.theme).toBe("light");
    expect(panel.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
  });
});
