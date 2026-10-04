import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import TopHeader from "./TopHeader";
import { SidebarProvider } from "@/contexts/SidebarContext";
import "@/styles/app-shell.css";

const titleMap: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "Dashboard" },
  "/preview": { title: "Dashboard" },
  "/trades": { title: "Trades" },
  "/journal": { title: "Journal" },
  "/rules": { title: "Rules" },
  "/analysis": { title: "Analysis" },
  "/ai-report": { title: "Performance Coach" },
  "/backtesting": { title: "Backtesting" },
  "/settings": { title: "Settings" },
};

export default function AppLayout() {
  const location = useLocation();
  const meta = titleMap[location.pathname] ?? {
    title: location.pathname.startsWith("/backtesting/") ? "Backtesting" : "DaddyFXBook",
  };
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <SidebarProvider>
      <div className="app-shell">
        <a href="#main-content" className="app-skip-link">Skip to content</a>
        <AppSidebar />
        <div className="app-workspace">
          <TopHeader title={meta.title} subtitle={meta.subtitle ?? today} />
          <main id="main-content" className="app-content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
