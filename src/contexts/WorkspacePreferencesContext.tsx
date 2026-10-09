import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { applyWorkspaceAppearance, DEFAULT_PREFERENCES, resolvePreferences, type WorkspacePreferences } from "@/lib/workspacePreferences";

const WorkspacePreferencesContext = createContext({
  preferences: DEFAULT_PREFERENCES,
  previewPreferences: (_patch: Partial<WorkspacePreferences> | null) => {},
  isPreviewing: false,
});

export function WorkspacePreferencesProvider({ saved, children }: { saved?: Partial<WorkspacePreferences>; children: ReactNode }) {
  const [preview, previewPreferences] = useState<Partial<WorkspacePreferences> | null>(null);
  const { setTheme, resolvedTheme } = useTheme();
  const preferences = useMemo(() => resolvePreferences({ ...saved, ...preview }), [saved, preview]);
  useEffect(() => { applyWorkspaceAppearance(preferences, resolvedTheme); }, [preferences, resolvedTheme]);
  useEffect(() => {
    if (saved?.theme || preview?.theme) setTheme(preferences.theme);
  }, [saved?.theme, preview?.theme, preferences.theme, setTheme]);
  useEffect(() => () => {
    const root = document.documentElement;
    for (const property of ["--primary", "--profit", "--profit-color", "--ring", "--sidebar-primary", "--sidebar-ring"]) root.style.removeProperty(property);
    delete root.dataset.compact;
    delete root.dataset.accent;
  }, []);
  const value = useMemo(() => ({ preferences, previewPreferences, isPreviewing: !!preview && Object.keys(preview).length > 0 }), [preferences, preview]);
  return <WorkspacePreferencesContext.Provider value={value}>{children}</WorkspacePreferencesContext.Provider>;
}

export function useWorkspacePreferences() { return useContext(WorkspacePreferencesContext); }
