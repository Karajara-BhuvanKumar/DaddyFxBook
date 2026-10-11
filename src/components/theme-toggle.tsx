import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useLocation } from 'react-router-dom';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { settings, updateSettingsAsync, isUpdating } = useUserSettings();
  const inSettings = useLocation().pathname === '/settings';
  const isDark = resolvedTheme === "dark";

  return (
    <button type="button" className="app-icon-button app-theme-toggle"
      disabled={isUpdating || inSettings}
      onClick={async () => {
        const theme = isDark ? "light" : "dark";
        if (!settings) { setTheme(theme); return; }
        try { await updateSettingsAsync({ theme }); }
        catch { /* The hook reports the failure; keep the saved theme. */ }
      }}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={inSettings ? 'Choose your appearance in Settings, then Save changes' : isDark ? "Switch to light theme" : "Switch to dark theme"}>
      {isDark ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    </button>
  );
}
