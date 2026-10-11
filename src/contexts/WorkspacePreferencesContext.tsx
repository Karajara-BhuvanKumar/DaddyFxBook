import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { applyWorkspaceAppearance, DEFAULT_PREFERENCES, resolvePreferences, type WorkspacePreferences } from "@/lib/workspacePreferences";

const WorkspacePreferencesContext = createContext({
  preferences: DEFAULT_PREFERENCES,
});

export function WorkspacePreferencesProvider({ saved, children }: { saved?: Partial<WorkspacePreferences>; children: ReactNode }) {
  const { setTheme, resolvedTheme } = useTheme();
  const preferences = useMemo(() => resolvePreferences(saved), [saved]);
  useEffect(() => { applyWorkspaceAppearance(preferences, resolvedTheme); }, [preferences, resolvedTheme]);
  useEffect(() => {
    if (saved?.theme) setTheme(preferences.theme);
  }, [saved?.theme, preferences.theme, setTheme]);
  useEffect(() => () => {
    const root = document.documentElement;
    for (const property of ["--primary", "--primary-foreground", "--profit", "--profit-color", "--ring", "--accent", "--sidebar-accent", "--sidebar-accent-foreground", "--sidebar-primary", "--sidebar-primary-foreground", "--sidebar-ring"]) root.style.removeProperty(property);
    delete root.dataset.compact;
    delete root.dataset.accent;
  }, []);
  const value = useMemo(() => ({ preferences }), [preferences]);
  return <WorkspacePreferencesContext.Provider value={value}>{children}</WorkspacePreferencesContext.Provider>;
}

export function useWorkspacePreferences() { return useContext(WorkspacePreferencesContext); }
