export const ACCENT_COLORS = [
  { id: "blue", hsl: "217 91% 60%", label: "Blue" },
  { id: "purple", hsl: "262 83% 65%", label: "Purple" },
  { id: "green", hsl: "142 71% 45%", label: "Green" },
  { id: "gold", hsl: "45 93% 47%", label: "Gold" },
];
export const DEFAULT_PREFERENCES = {
  theme: "dark", accent_color: "blue", compact_mode: false,
  timezone: "UTC", time_format: "24h", currency: "USD",
};
export type WorkspacePreferences = typeof DEFAULT_PREFERENCES;

export function resolvePreferences(settings?: Partial<WorkspacePreferences> | null): WorkspacePreferences {
  const result = { ...DEFAULT_PREFERENCES };
  if (["light", "dark", "system"].includes(settings?.theme)) result.theme = settings.theme;
  if (ACCENT_COLORS.some(color => color.id === settings?.accent_color)) result.accent_color = settings.accent_color;
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
  const accent = ACCENT_COLORS.find(color => color.id === preferences.accent_color) ?? ACCENT_COLORS[0];
  // Light surfaces need deeper accents for readable small text and white button labels.
  const lightAccents: Record<string, string> = { blue: "221 83% 48%", purple: "262 72% 47%", green: "152 76% 28%", gold: "38 92% 29%" };
  const hsl = resolvedTheme === "light" ? lightAccents[accent.id] : accent.hsl;
  for (const property of ["--primary", "--profit", "--ring", "--sidebar-primary", "--sidebar-ring"]) root.style.setProperty(property, hsl);
  root.style.setProperty("--profit-color", `hsl(${hsl})`);
  root.dataset.accent = accent.id;
  root.dataset.compact = String(preferences.compact_mode);
  // next-themes owns theme classes and OS theme changes. CSS owns density.
  root.style.removeProperty("font-size");
  root.style.removeProperty("--sidebar-accent");
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
