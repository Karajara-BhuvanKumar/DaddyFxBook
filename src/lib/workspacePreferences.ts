import { accentAppearance, normalizeAccent } from './accentColors';
export { ACCENT_COLORS } from './accentColors';
export const DEFAULT_PREFERENCES = {
  theme: "dark", accent_color: "blue", compact_mode: false,
  timezone: "UTC", time_format: "24h", currency: "USD",
};
export type WorkspacePreferences = typeof DEFAULT_PREFERENCES;

export function resolvePreferences(settings?: Partial<WorkspacePreferences> | null): WorkspacePreferences {
  const result = { ...DEFAULT_PREFERENCES };
  if (["light", "dark", "system"].includes(settings?.theme)) result.theme = settings.theme;
  result.accent_color = normalizeAccent(settings?.accent_color ?? '') ?? DEFAULT_PREFERENCES.accent_color;
  result.compact_mode = settings?.compact_mode === true;
  if (settings?.time_format === "12h") result.time_format = "12h";
  try {
    if (settings?.timezone) {
      new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone }).format();
      result.timezone = settings.timezone;
    }
  } catch { /* Old/invalid preferences fall back to UTC. */ }
  if (["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD"].includes(settings?.currency)) result.currency = settings.currency;
  return result;
}

export function applyWorkspaceAppearance(preferences: WorkspacePreferences, resolvedTheme = "dark") {
  const root = document.documentElement;
  const { hsl, subtleHsl, foregroundHsl, needsContrastSupport } = accentAppearance(preferences.accent_color, resolvedTheme);
  for (const property of ["--primary", "--profit", "--ring", "--sidebar-primary", "--sidebar-ring"]) root.style.setProperty(property, hsl);
  root.style.setProperty("--profit-color", `hsl(${hsl})`);
  root.style.setProperty("--primary-foreground", foregroundHsl);
  root.style.setProperty("--sidebar-primary-foreground", foregroundHsl);
  root.style.setProperty("--accent", subtleHsl);
  root.style.setProperty("--sidebar-accent", subtleHsl);
  root.style.setProperty("--sidebar-accent-foreground", resolvedTheme === 'light' ? '221 39% 11%' : '210 40% 98%');
  root.dataset.accent = preferences.accent_color;
  root.dataset.accentContrast = needsContrastSupport ? 'low' : 'normal';
  root.dataset.compact = String(preferences.compact_mode);
  // next-themes owns theme classes and OS theme changes. CSS owns density.
  root.style.removeProperty("font-size");
}

export function formatWorkspaceTime(date: Date, preferences: Pick<WorkspacePreferences, "timezone" | "time_format">, seconds = false) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: preferences.timezone, hourCycle: preferences.time_format === "12h" ? "h12" : "h23",
    hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}),
  }).format(date);
}
export function formatWorkspaceDate(date: Date, timezone: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: timezone }).format(date);
}
