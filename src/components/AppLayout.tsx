import { Outlet, useLocation, useNavigate } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import TopHeader from "./TopHeader";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { Search, Plus, Clock3, Bell, Moon, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const titleMap: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "Dashboard" }, "/trades": { title: "Trades" }, "/journal": { title: "Journal" },
  "/rules": { title: "Rules" }, "/analysis": { title: "Analysis" }, "/ai-report": { title: "AI Report" },
  "/backtesting": { title: "Backtesting" }, "/settings": { title: "Settings" },
};

function ExactDashboardHeader() {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [query, setQuery] = useState("");

  useEffect(() => {
    const id = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const initial = (settings?.display_name || user?.email || "T").slice(0, 1).toLowerCase();
  const dateText = time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeText = time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <header className="dashboard-exact-header">
      <div className="dashboard-exact-header-row">
        <div className="dashboard-exact-title"><h1>Dashboard</h1><p>{dateText}</p></div>
        <div className="dashboard-exact-search">
          <Search className="dashboard-exact-search-icon" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." aria-label="Search" />
          <span className="dashboard-exact-kbd">Ctrl+K</span>
        </div>
        <div className="dashboard-exact-actions">
          <button className="dashboard-exact-theme" aria-label="Theme"><Moon size={21} strokeWidth={1.8} /></button>
          <button className="dashboard-exact-action dashboard-exact-add" onClick={() => navigate("/trades?add=true")} aria-label="Add trade"><Plus size={25} /></button>
          <div className="dashboard-exact-time"><Clock3 size={20} strokeWidth={1.8} /><span>{timeText}</span></div>
          <button className="dashboard-exact-action" aria-label="Notifications"><Bell size={21} strokeWidth={1.8} /></button>
          <div className="dashboard-exact-profile">
            <Avatar className="dashboard-exact-profile-avatar">
              <AvatarImage src={settings?.avatar_url ?? undefined} />
              <AvatarFallback className="dashboard-exact-profile-avatar">{initial}</AvatarFallback>
            </Avatar>
            <ChevronDown className="dashboard-exact-profile-chevron" />
          </div>
        </div>
      </div>
    </header>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const meta = titleMap[location.pathname] ?? { title: "DaddyFXBook" };
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  if (location.pathname === "/") {
    return <div className="dashboard-exact-shell"><main className="dashboard-exact-main"><div className="dashboard-exact-page"><ExactDashboardHeader /><Outlet /></div></main></div>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-background">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="page-container space-y-4 md:space-y-6 overflow-guard">
            <TopHeader title={meta.title} subtitle={meta.subtitle ?? today} />
            <div className="overflow-guard"><Outlet /></div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
