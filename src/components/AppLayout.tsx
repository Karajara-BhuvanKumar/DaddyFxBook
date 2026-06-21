import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import TopHeader from "./TopHeader";

const titleMap: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "Dashboard" },
  "/trades": { title: "Trades" },
  "/journal": { title: "Journal" },
  "/analysis": { title: "Analysis" },
};

export default function AppLayout() {
  const location = useLocation();
  const meta = titleMap[location.pathname] ?? { title: "DaddyFXBook" };
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto px-8 py-8 space-y-6">
          <TopHeader title={meta.title} subtitle={meta.subtitle ?? today} />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
