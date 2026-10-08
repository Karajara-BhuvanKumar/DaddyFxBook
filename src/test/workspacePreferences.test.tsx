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
  it("automatically saves accent and keeps it when leaving Settings during the save", async () => {
    let finish!: (result: { data: UserSettings; error: null }) => void;
    backend.save.mockImplementationOnce(patch => new Promise(resolve => {
      saved = { ...saved, ...patch }; finish = resolve;
    }));
    const { panel, hide, unmount } = await openSettings();
    fireEvent.click(panel.getByRole("button", { name: "Purple accent" }));
    await waitFor(() => expect(document.documentElement.dataset.accent).toBe("purple"));
    expect(document.documentElement.style.getPropertyValue("--profit")).toBe("262 83% 65%");
    expect(backend.save).toHaveBeenCalledWith({ accent_color: "purple" });
    hide();
    expect(document.documentElement.dataset.accent).toBe("purple");
    await act(async () => finish({ data: saved, error: null }));
    expect(document.documentElement.dataset.accent).toBe("purple");
    unmount();
    const next = await openSettings();
    expect(next.panel.getByRole("button", { name: "Purple accent" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.accent).toBe("purple");
  });

  it("saves theme and density on selection without requiring the footer Save button", async () => {
    const { panel, hide } = await openSettings();
    fireEvent.click(panel.getByRole("button", { name: "Light" }));
    await waitFor(() => expect(panel.getByRole("switch", { name: "Compact layout" })).toBeEnabled());
    expect(saved.theme).toBe("light");
    fireEvent.click(panel.getByRole("switch", { name: "Compact layout" }));
    await waitFor(() => expect(saved.compact_mode).toBe(true));
    await waitFor(() => expect(panel.getByRole("switch", { name: "Compact layout" })).toBeEnabled());
    expect(panel.getByRole("button", { name: "Save changes" })).toBeDisabled();
    hide();
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement.dataset.compact).toBe("true");
  });

  it("rolls back a failed automatic save and allows selecting the accent again", async () => {
    backend.save.mockResolvedValueOnce({ data: null, error: new Error("Connection lost") });
    const { panel } = await openSettings();
    fireEvent.click(panel.getByRole("button", { name: "Gold accent" }));
    await waitFor(() => expect(backend.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Failed to update settings" })));
    await waitFor(() => expect(panel.getByRole("button", { name: "Gold accent" })).toBeEnabled());
    expect(document.documentElement.dataset.accent).toBe("blue");
    expect(saved.accent_color).toBe("blue");
    fireEvent.click(panel.getByRole("button", { name: "Gold accent" }));
    await waitFor(() => expect(saved.accent_color).toBe("gold"));
    expect(document.documentElement.dataset.accent).toBe("gold");
  });

  it("keeps Cancel and Save for region preferences without reverting a saved accent", async () => {
    const { panel, unmount } = await openSettings();
    fireEvent.click(panel.getByRole("button", { name: "Purple accent" }));
    await waitFor(() => expect(panel.getByLabelText("Timezone")).toBeEnabled());
    fireEvent.change(panel.getByLabelText("Timezone"), { target: { value: "Asia/Kolkata" } });
    expect(screen.getByTestId("clock")).toHaveTextContent("Oct 9, 2026 05:00");
    fireEvent.click(panel.getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("clock")).toHaveTextContent("Oct 8, 2026 23:30");
    expect(document.documentElement.dataset.accent).toBe("purple");
    fireEvent.change(panel.getByLabelText("Timezone"), { target: { value: "Asia/Kolkata" } });
    fireEvent.change(panel.getByLabelText("Time format"), { target: { value: "12h" } });
    fireEvent.change(panel.getByLabelText("Default currency"), { target: { value: "INR" } });
    fireEvent.submit(panel.getByRole("button", { name: "Save changes" }).closest("form")!);
    await waitFor(() => expect(saved.time_format).toBe("12h"));
    await waitFor(() => expect(panel.getByRole("button", { name: "Save changes" })).toBeDisabled());
    unmount();
    const next = await openSettings();
    expect(next.panel.getByLabelText("Account size (INR)")).toHaveValue(10000);
    expect(screen.getByTestId("clock")).toHaveTextContent("05:00 AM");
    expect(document.documentElement.dataset.accent).toBe("purple");
  });

  it("preserves unsaved region edits after a failed manual save", async () => {
    backend.save.mockResolvedValueOnce({ data: null, error: new Error("Connection lost") });
    const { panel } = await openSettings();
    fireEvent.change(panel.getByLabelText("Timezone"), { target: { value: "Asia/Kolkata" } });
    fireEvent.submit(panel.getByRole("button", { name: "Save changes" }).closest("form")!);
    await waitFor(() => expect(backend.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Failed to update settings" })));
    await waitFor(() => expect(panel.getByRole("button", { name: "Save changes" })).toBeEnabled());
    expect(panel.getByLabelText("Timezone")).toHaveValue("Asia/Kolkata");
    expect(saved.timezone).toBe("UTC");
  });

  it("follows OS changes in System mode and saves an explicit theme choice", async () => {
    saved.theme = "system";
    const { panel, hide } = await openSettings();
    expect(document.documentElement).toHaveClass("light");
    act(() => { systemDark = true; systemListeners.forEach(callback => callback({ matches: true })); });
    expect(document.documentElement).toHaveClass("dark");
    fireEvent.click(panel.getByRole("button", { name: "Light" }));
    await waitFor(() => expect(saved.theme).toBe("light"));
    hide();
    expect(document.documentElement).toHaveClass("light");
  });

  it("persists header theme changes so other settings consumers cannot revert them", async () => {
    const { panel } = await openSettings();
    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
    await waitFor(() => expect(saved.theme).toBe("light"));
    expect(document.documentElement).toHaveClass("light");
    expect(panel.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
  });
});
