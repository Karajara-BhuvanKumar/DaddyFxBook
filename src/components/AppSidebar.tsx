import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  List,
  BookOpen,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  FlaskConical,
  Settings,
  Brain,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Award,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useSidebar } from "@/contexts/SidebarContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, memo } from "react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  badge?: { label: string; tone: "primary" | "warning" | "profit" };
  hasSub?: boolean;
  dot?: boolean;
  children?: { to: string; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[];
};

const mainItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, dot: true },
  { to: "/trades", label: "Trades", icon: List },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/analysis", label: "Analysis", icon: BarChart3, hasSub: true },
  {
    to: "/ai-report",
    label: "AI Report",
    icon: Sparkles,
    badge: { label: "PRO", tone: "primary" },
    hasSub: true,
    children: [
      { to: "/ai-report", label: "Performance Coach", icon: Brain },
      { to: "/ai-report/reviews", label: "Trade Reviews", icon: BookOpen },
      { to: "/ai-report/daily", label: "Daily Report", icon: CalendarDays },
      { to: "/ai-report/weekly", label: "Weekly Report", icon: CalendarRange },
      { to: "/ai-report/monthly", label: "Monthly Report", icon: CalendarClock },
      { to: "/ai-report/scorecard", label: "Trader Scorecard", icon: Award },
    ],
  },
  { to: "/backtesting", label: "Backtesting", icon: FlaskConical, badge: { label: "ELITE", tone: "warning" } },
];

const supportItems: NavItem[] = [
  { to: "/settings", label: "Settings", icon: Settings },
];

function badgeClass(tone: "primary" | "warning" | "profit") {
  if (tone === "warning") return "bg-warning/15 text-warning";
  if (tone === "profit") return "bg-profit/15 text-profit";
  return "bg-primary/15 text-primary";
}

type SidebarMode = "full" | "compact" | "icon";

function NavRow({
  item,
  mode,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  mode: SidebarMode;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const iconOnly = mode === "icon";

  return (
    <RouterNavLink
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center rounded-xl text-[13px] font-medium transition-all duration-200 group min-h-[44px]",
        iconOnly ? "justify-center px-3" : "gap-3 pl-4 pr-3",
        isActive
          ? "bg-[#0A1224] text-[#3b82f6]"
          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.02]",
      )}
    >
      <item.icon
        className={cn("shrink-0", isActive && "text-blue-500")}
        style={{ width: 18, height: 18, strokeWidth: 1.8 }}
      />
      {!iconOnly && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span
              className={cn(
                "badge-pill shrink-0",
                item.badge.tone === "warning" ? "bg-[#d8a400] text-white" : badgeClass(item.badge.tone),
              )}
            >
              {item.badge.label}
            </span>
          )}
          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-auto shrink-0" />}
          {item.dot && !item.badge && !isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50 ml-auto shrink-0" />
          )}
          {item.hasSub && <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />}
        </>
      )}
    </RouterNavLink>
  );
}

function SidebarContent({
  mode,
  onNavigate,
  showCollapseToggle,
  collapsed,
  onToggleCollapse,
}: {
  mode: SidebarMode;
  onNavigate?: () => void;
  showCollapseToggle?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { settings } = useUserSettings();

  const initial = (settings?.display_name || user?.email || "U").slice(0, 2).toUpperCase();
  const displayName = settings?.display_name || user?.email?.split("@")[0] || "User";
  const username = settings?.username ? `@${settings.username}` : user?.email || "";
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const iconOnly = mode === "icon";
  const compact = mode === "compact";

  return (
    <div className="flex flex-col h-full min-h-0 bg-sidebar">
      {showCollapseToggle && onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all duration-200 z-10 hidden xl:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      )}

      {/* Brand */}
      <div className={cn("pt-6 pb-3 flex flex-col shrink-0", iconOnly ? "px-3 items-center" : "px-4", compact && "px-3")}>
        <div className={cn("flex items-center w-full", iconOnly ? "justify-center" : "gap-2.5")}>
          <img
            src="/daddyfxbook-logo.png"
            alt="DaddyFxBook Logo"
            className="w-9 h-9 object-contain shrink-0"
          />
          {!iconOnly && (
            <>
              <span className="text-[15px] xl:text-[17px] font-extrabold tracking-tight text-foreground truncate">
                DaddyFxBook
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#d8a400] text-white ml-auto shrink-0">
                BETA
              </span>
            </>
          )}
        </div>
        {!iconOnly && (
          <p className="text-muted-foreground text-xs mt-2 ml-0.5 font-medium">{today}</p>
        )}
      </div>

      {/* User card */}
      {!iconOnly && (
        <div
          className={cn(
            "mx-3 mb-4 rounded-2xl bg-muted/40 border border-border/50 flex items-center gap-3 hover:bg-muted/60 transition-colors cursor-pointer relative group shrink-0",
            compact ? "p-2.5" : "p-3",
          )}
        >
          <Avatar className={cn("rounded-xl border border-border shrink-0", compact ? "w-9 h-9" : "w-10 h-10")}>
            <AvatarImage src={settings?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm rounded-xl">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[12px] xl:text-[13px] font-semibold text-foreground truncate">{displayName}</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-border text-muted-foreground bg-muted/30 shrink-0">
                FREE
              </span>
            </div>
            <p className="text-[10px] xl:text-[11px] text-muted-foreground truncate">{username}</p>
          </div>
          {!compact && (
            <ChevronRight className="w-4 h-4 text-muted-foreground absolute right-3 opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </div>
      )}

      {/* Menu */}
      <nav className="flex-1 px-2 xl:px-3 space-y-1.5 overflow-y-auto min-h-0">
        {!iconOnly && (
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.15em] px-3 mt-1 mb-2">
            Menu
          </p>
        )}
        {mainItems.map((item) => {
          const parentActive =
            location.pathname === item.to ||
            (item.children?.some((c) => location.pathname === c.to) ?? false);
          return (
            <div key={item.to}>
              <NavRow
                item={item}
                mode={mode}
                isActive={location.pathname === item.to}
                onNavigate={onNavigate}
              />
              {!iconOnly && item.children && parentActive && (
                <div className="ml-5 mt-0.5 mb-1 border-l border-white/[0.08] pl-2 space-y-0.5">
                  {item.children.map((child) => {
                    const active = location.pathname === child.to;
                    return (
                      <RouterNavLink
                        key={child.to}
                        to={child.to}
                        end
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-2 rounded-md text-[12px] font-medium transition-all duration-150 min-h-[36px]",
                          active
                            ? "text-blue-600 dark:text-white bg-blue-500/5 dark:bg-white/5"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/[0.02]",
                        )}
                      >
                        <child.icon className={cn("w-3.5 h-3.5 shrink-0", active && "text-blue-500")} />
                        <span className="truncate">{child.label}</span>
                      </RouterNavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {!iconOnly && (
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.15em] px-3 mt-5 mb-2">
            Support
          </p>
        )}
        {supportItems.map((item) => (
          <NavRow
            key={item.to}
            item={item}
            mode={mode}
            isActive={location.pathname === item.to}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* Sign out */}
      <div className={cn("p-3 border-t border-sidebar-border shrink-0", iconOnly && "flex flex-col items-center")}>
        <button
          onClick={signOut}
          className={cn(
            "flex items-center px-4 py-2.5 rounded-[20px] text-[13px] text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 w-full group min-h-[44px]",
            iconOnly ? "justify-center" : "gap-2",
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!iconOnly && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );
}

function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden lg:flex min-h-screen bg-sidebar flex-col shrink-0 transition-all duration-300 ease-out relative",
        collapsed ? "w-[72px]" : "w-[200px] xl:w-[260px]",
      )}
    >
      <SidebarContent
        mode={collapsed ? "icon" : "full"}
        showCollapseToggle
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />
    </aside>
  );
}

function MobileSidebarDrawer() {
  const { mobileOpen, setMobileOpen, closeMobile } = useSidebar();

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="p-0 w-[min(320px,90vw)] border-sidebar-border bg-sidebar">
        <SidebarContent mode="full" onNavigate={closeMobile} />
      </SheetContent>
    </Sheet>
  );
}

function AppSidebar() {
  const isMobile = useIsMobile();

  return (
    <>
      {!isMobile && <DesktopSidebar />}
      {isMobile && <MobileSidebarDrawer />}
    </>
  );
}

export default memo(AppSidebar);
