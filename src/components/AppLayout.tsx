import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import TopHeader from "./TopHeader";
import { SidebarProvider } from "@/contexts/SidebarContext";

const titleMap: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "Dashboard" },
  "/trades": { title: "Trades" },
  "/journal": { title: "Journal" },
  "/analysis": { title: "Analysis" },
  "/ai-report": { title: "AI Report" },
  "/ai-report/reviews": { title: "Trade Reviews" },
  "/ai-report/daily": { title: "Daily Report" },
  "/ai-report/weekly": { title: "Weekly Report" },
  "/ai-report/monthly": { title: "Monthly Report" },
  "/ai-report/scorecard": { title: "Trader Scorecard" },
  "/backtesting": { title: "Backtesting" },
  "/settings": { title: "Settings" },
};

export default function AppLayout() {
  const location = useLocation();
  const meta = titleMap[location.pathname] ?? { title: "DaddyFXBook" };
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-background">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="page-container space-y-4 md:space-y-6 overflow-guard">
            <TopHeader title={meta.title} subtitle={meta.subtitle ?? today} />
            <div className="overflow-guard">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
