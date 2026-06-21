import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  List,
  BookOpen,
  BarChart3,
  TrendingUp,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LineChart,
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
import { useState } from "react";

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
  { to: "/market", label: "Market", icon: LineChart },
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

function NavRow({ item, collapsed, isActive }: { item: NavItem; collapsed: boolean; isActive: boolean }) {
  return (
    <RouterNavLink
      to={item.to}
      style={
        isActive
          ? { background: "linear-gradient(90deg, rgba(59,130,246,0.18), rgba(59,130,246,0.03))" }
          : undefined
      }
      className={`relative flex items-center ${collapsed ? "justify-center" : "gap-[14px]"} ${collapsed ? "px-3" : "pl-5 pr-3"} rounded-2xl text-[13px] font-medium transition-colors duration-200 group ${
        isActive
          ? "text-foreground"
          : "text-sidebar-foreground hover:text-foreground hover:bg-accent/40"
      }`}
    >
      <span style={{ height: 52 }} className="absolute inset-0 pointer-events-none" />
      <div className="flex items-center w-full" style={{ height: 52 }}>
        {isActive && (
          <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />
        )}
        <item.icon className={`shrink-0 ${isActive ? "text-primary" : ""}`} style={{ width: 18, height: 18, strokeWidth: 1.8 }} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate ml-[14px]">{item.label}</span>
            {item.badge && (
              <span className={`badge-pill ${badgeClass(item.badge.tone)}`}>{item.badge.label}</span>
            )}
            {item.dot && !item.badge && (
              <span className="w-2 h-2 rounded-full bg-primary" />
            )}
            {item.hasSub && <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60 ml-2" />}
          </>
        )}
      </div>
    </RouterNavLink>
  );
}

export default function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const initial = (user?.email?.[0] ?? "u").toUpperCase();

  return (
    <aside
      className={`${collapsed ? "w-[72px]" : "w-[264px]"} min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 transition-all duration-300 ease-out relative`}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Brand */}
      <div className={`px-5 pt-5 pb-4 flex items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
        <div className="w-9 h-9 rounded-xl btn-premium flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="brand-wordmark whitespace-nowrap flex items-center gap-2">
            Daddy<span className="accent">FX</span>Book
            <span className="badge-pill bg-warning/15 text-warning">BETA</span>
          </span>
        )}
      </div>

      {/* User card */}
      {!collapsed && (
        <div className="mx-3 mb-4 rounded-xl bg-card/60 border border-border/60 p-2.5 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold text-foreground truncate">
                {user?.email?.split("@")[0] ?? "user"}
              </p>
              <span className="badge-pill bg-muted/60 text-muted-foreground">FREE</span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </div>
      )}

      {/* Menu */}
      <nav className="flex-1 px-3 space-y-2 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em] px-3 mt-7 mb-3.5">
            Menu
          </p>
        )}
        {mainItems.map((item) => {
          const parentActive =
            location.pathname === item.to ||
            (item.children?.some((c) => location.pathname === c.to) ?? false);
          return (
            <div key={item.to}>
              <NavRow item={item} collapsed={collapsed} isActive={location.pathname === item.to} />
              {!collapsed && item.children && parentActive && (
                <div className="ml-6 mt-0.5 mb-1 border-l border-border/50 pl-2 space-y-0.5">
                  {item.children.map((child) => {
                    const active = location.pathname === child.to;
                    return (
                      <RouterNavLink
                        key={child.to}
                        to={child.to}
                        end
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12.5px] font-medium transition-all duration-150 ${
                          active
                            ? "text-foreground bg-primary/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                        }`}
                      >
                        <child.icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-primary" : ""}`} />
                        <span className="truncate">{child.label}</span>
                      </RouterNavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {!collapsed && (
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em] px-3 mt-7 mb-3.5">
            Support
          </p>
        )}
        {supportItems.map((item) => (
          <NavRow key={item.to} item={item} collapsed={collapsed} isActive={location.pathname === item.to} />
        ))}
      </nav>

      {/* Sign out */}
      <div className={`p-3 border-t border-sidebar-border ${collapsed ? "items-center flex flex-col" : ""}`}>
        <button
          onClick={signOut}
          className={`flex items-center ${collapsed ? "justify-center" : "gap-2"} px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-all duration-200 w-full group`}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
