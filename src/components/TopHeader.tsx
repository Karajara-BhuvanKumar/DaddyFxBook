import { useEffect, useState } from "react";
import { Search, Plus, Clock, Bell, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/theme-toggle";

export default function TopHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());
  const initial = (user?.email?.[0] ?? "u").toUpperCase();

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center gap-4 mb-8 sticky top-0 z-50 backdrop-blur-xl border-b border-border/20" style={{ height: 70, background: "var(--bg-secondary)" }}>
      {/* Title block */}
      <div className="shrink-0 min-w-[200px]">
        <h1 className="font-bold text-foreground tracking-tight leading-none" style={{ fontSize: 24, fontWeight: 700 }}>{title}</h1>
        {subtitle && <p className="text-[13px] text-muted-foreground mt-1 font-medium">{subtitle}</p>}
      </div>

      {/* Search */}
      <div className="flex-1 flex justify-center">
        <div className="relative" style={{ width: 450 }}>
          <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search..."
            style={{ height: 44, background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: 12 }}
            className="w-full pl-11 pr-20 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-md">
            Ctrl+K
          </kbd>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center shrink-0" style={{ gap: 12 }}>
        <div
          style={{ width: 44, height: 44, borderRadius: 12, background: "var(--card-bg)", border: "1px solid var(--border-color)" }}
          className="flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors"
        >
          <ThemeToggle />
        </div>
        <button
          style={{ width: 44, height: 44, borderRadius: 12 }}
          className="bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors"
          aria-label="Add"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div
          style={{ height: 44, borderRadius: 12, background: "var(--card-bg)", border: "1px solid var(--border-color)" }}
          className="px-4 flex items-center gap-2 text-[13px] font-semibold text-foreground"
        >
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-num">{time.toLocaleTimeString("en-US", { hour12: true })}</span>
        </div>
        <button
          style={{ width: 44, height: 44, borderRadius: 12, background: "var(--card-bg)", border: "1px solid var(--border-color)" }}
          className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-blue-500" />
        </button>
        <div style={{ height: 44, borderRadius: 12, background: "var(--card-bg)", border: "1px solid var(--border-color)" }} className="flex items-center px-1.5 cursor-pointer hover:bg-muted/50 transition-colors gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-500 flex items-center justify-center font-bold text-sm">
            {initial}
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground mr-1" />
        </div>
      </div>
    </header>
  );
}
