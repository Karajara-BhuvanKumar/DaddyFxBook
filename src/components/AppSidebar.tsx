import { memo, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BriefcaseBusiness, BookOpen, BarChart3, LogOut,
  ChevronsLeft, ChevronsRight, ChevronRight, BrainCircuit, Activity, Settings, Scale,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: LucideIcon; badge?: string };
const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/trades", label: "Trades", icon: BriefcaseBusiness },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/rules", label: "Rules", icon: Scale },
  { to: "/analysis", label: "Analysis", icon: BarChart3 },
  { to: "/ai-report", label: "Performance Coach", icon: BrainCircuit, badge: "PRO" },
  { to: "/backtesting", label: "Backtesting", icon: Activity, badge: "ELITE" },
  { to: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const { settings } = useUserSettings();
  const { pathname } = useLocation();
  const dashboardPath = pathname === "/preview" ? "/preview" : "/";
  const displayName = settings?.display_name || user?.email?.split("@")[0] || "Personal account";
  const initial = (settings?.display_name || user?.email || "D").slice(0, 1);

  return (
    <div className={cn("app-sidebar-inner", collapsed && "is-collapsed")}>
      <NavLink to={dashboardPath} className="app-brand" onClick={onNavigate} aria-label="DaddyFXBook dashboard">
        <img src="/daddyfxbook-logo.png" alt="" />
        {!collapsed && <><span className="app-brand-name">Daddy<span>FX</span><em>Book</em></span><span className="app-beta">BETA</span></>}
      </NavLink>

      <NavLink to="/settings" onClick={onNavigate} className="app-account" aria-label={`Account settings for ${displayName}`} title={collapsed ? displayName : undefined}>
        <span className="app-account-avatar-wrap">
          <Avatar className="app-account-avatar">
            <AvatarImage src={settings?.avatar_url ?? undefined} alt={displayName} />
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <span className="app-account-status" />
        </span>
        {!collapsed && <>
          <span className="app-account-copy"><strong>{displayName}</strong><span>Profile</span></span>
          <ChevronRight className="app-account-chevron" aria-hidden="true" />
        </>}
      </NavLink>

      <nav className="app-navigation" aria-label="Main navigation">
        {!collapsed && <div className="app-menu-label"><span>Menu</span><span /></div>}
        <div className="app-nav-items">
          {navItems.map(({ to, label, icon: Icon, badge }) => {
            const href = to === "/" ? dashboardPath : to;
            return (
              <NavLink key={to} to={href} end={to === "/"} onClick={onNavigate}
                className={({ isActive }) => cn("app-nav-item", isActive && "is-active")}
                title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}>
                <Icon aria-hidden="true" />
                {!collapsed && <><span className="app-nav-label">{label}</span>{badge && <span className="app-nav-badge">{badge}</span>}</>}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {user && <div className="app-sidebar-footer">
        <button onClick={() => { onNavigate?.(); void signOut(); }} className="app-nav-item app-signout" title={collapsed ? "Sign out" : undefined} aria-label="Sign out">
          <LogOut aria-hidden="true" />{!collapsed && <span>Sign out</span>}
        </button>
      </div>}
    </div>
  );
}

function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { mobileOpen, setMobileOpen, closeMobile } = useSidebar();

  // The drawer and its trigger use the same breakpoint, including tablet widths.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const handleResize = () => { if (desktop.matches) closeMobile(); };
    desktop.addEventListener("change", handleResize);
    return () => desktop.removeEventListener("change", handleResize);
  }, [closeMobile]);

  return (
    <>
      <aside className={cn("app-sidebar", collapsed && "is-collapsed")}>
        <SidebarContent collapsed={collapsed} />
        <button onClick={() => setCollapsed(!collapsed)} className="app-sidebar-collapse"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
          {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
        </button>
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="app-sidebar-drawer">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Navigate your DaddyFXBook trading workspace.</SheetDescription>
          <SidebarContent onNavigate={closeMobile} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export default memo(AppSidebar);
