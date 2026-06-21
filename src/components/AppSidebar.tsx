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
      className={`relative flex items-center ${collapsed ? "justify-center" : "gap-[14px]"} ${collapsed ? "px-3" : "pl-5 pr-3"} rounded-xl text-[13px] font-medium transition-all duration-200 group ${isActive
          ? "bg-[#0A1224] text-[#3b82f6]"
          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.02]"
        }`}
      style={{ height: 48 }}
    >
      <div className="flex items-center w-full h-full">
        <item.icon className={`shrink-0 ${isActive ? "text-blue-500" : ""}`} style={{ width: 18, height: 18, strokeWidth: 1.8 }} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate ml-[14px]">{item.label}</span>
            {item.badge && (
              <span className={`badge-pill ${item.badge.tone === "warning" ? "bg-[#d8a400] text-white" : badgeClass(item.badge.tone)}`}>{item.badge.label}</span>
            )}
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-auto" />
            )}
            {item.dot && !item.badge && !isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50 ml-auto" />
            )}
            {item.hasSub && <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-2" />}
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
      className={`${collapsed ? "w-[72px]" : "w-[260px]"} min-h-screen bg-sidebar flex flex-col shrink-0 transition-all duration-300 ease-out relative`}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all duration-200 z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Brand */}
      <div className={`px-5 pt-7 pb-4 flex flex-col ${collapsed ? "items-center" : ""}`}>
        <div className="flex items-center gap-2.5 w-full">
          {collapsed ? (
            <img
              src="/daddyfxbook-logo.png"
              alt="DF"
              className="w-10 h-10 object-contain dark:invert dark:hue-rotate-180"
            />
          ) : (
            <div className="flex items-center gap-2 w-full">
              <img
                src="/daddyfxbook-logo.png"
                alt="DaddyFxBook"
                className="h-10 object-contain dark:invert dark:hue-rotate-180"
              />
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#d8a400] text-white ml-auto">BETA</span>
            </div>
          )}
        </div>
        {!collapsed && (
          <p className="text-muted-foreground text-xs mt-3 ml-1 font-medium">Sun, Jun 21</p>
        )}
      </div>

      {/* User card */}
      {!collapsed && (
        <div className="mx-4 mt-2 mb-6 rounded-2xl bg-[#0B0B0B] border border-white/[0.02] p-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer relative group">
          <div className="w-10 h-10 rounded-xl bg-[#2A2A2A] text-zinc-400 flex items-center justify-center font-bold text-sm shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-zinc-300 truncate">
                {user?.email?.split("@")[0] ?? "trading ve..."}
              </p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/[0.08] text-zinc-500 bg-white/[0.02]">FREE</span>
            </div>
            <p className="text-[11px] text-zinc-500 truncate">{user?.email ?? "tradingview47@gmail.com"}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500 absolute right-4 opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Menu */}
      <nav className="flex-1 px-3 space-y-2 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.15em] px-4 mt-2 mb-3.5">
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
                <div className="ml-6 mt-0.5 mb-1 border-l border-white/[0.08]/50 pl-2 space-y-0.5">
                  {item.children.map((child) => {
                    const active = location.pathname === child.to;
                    return (
                      <RouterNavLink
                        key={child.to}
                        to={child.to}
                        end
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12.5px] font-medium transition-all duration-150 ${active
                            ? "text-blue-600 dark:text-white bg-blue-500/5 dark:bg-white/5"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/[0.02]"
                          }`}
                      >
                        <child.icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-blue-500" : ""}`} />
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
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.15em] px-4 mt-7 mb-3.5">
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
          className={`flex items-center ${collapsed ? "justify-center" : "gap-2"} px-4 py-2 rounded-[20px] text-[13px] text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 w-full group`}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
