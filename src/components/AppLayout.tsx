import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import TopHeader from "./TopHeader";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { WorkspacePreferencesProvider } from "@/contexts/WorkspacePreferencesContext";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useAuth } from "@/hooks/useAuth";
import "@/styles/app-shell.css";
import "@/styles/workspace-preferences.css";

const titleMap: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "Dashboard" },
  "/preview": { title: "Dashboard" },
  "/preview/analysis": { title: "Analysis" },
  "/trades": { title: "Trades" },
  "/journal": { title: "Journal" },
  "/rules": { title: "Rules" },
  "/analysis": { title: "Analysis" },
  "/ai-report": { title: "Performance Coach" },
  "/backtesting": { title: "Backtesting" },
  "/settings": { title: "Settings" },
};

export default function AppLayout() {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const location = useLocation();
  const meta = titleMap[location.pathname] ?? {
    title: location.pathname.startsWith("/backtesting/") ? "Backtesting" : "DaddyFXBook",
  };

  return (
    <WorkspacePreferencesProvider key={user?.id ?? "preview"} saved={settings}>
    <SidebarProvider>
      <div className="app-shell">
        <a href="#main-content" className="app-skip-link">Skip to content</a>
        <AppSidebar />
        <div className="app-workspace">
          <TopHeader title={meta.title} subtitle={meta.subtitle} />
          <main id="main-content" className="app-content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
    </WorkspacePreferencesProvider>
  );
}
