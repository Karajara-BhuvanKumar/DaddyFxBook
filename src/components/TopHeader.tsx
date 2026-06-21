import { useEffect, useState } from "react";
import { Search, Moon, Plus, Clock, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function TopHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());
  const initial = (user?.email?.[0] ?? "u").toUpperCase();

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center gap-4 mb-8" style={{ height: 72 }}>
      {/* Title block */}
      <div className="shrink-0 min-w-[200px]">
        <h1 className="font-bold text-foreground tracking-tight leading-none" style={{ fontSize: 32, fontWeight: 700 }}>{title}</h1>
        {subtitle && <p className="text-[13px] text-muted-foreground mt-2 font-medium">{subtitle}</p>}
      </div>

      {/* Search */}
      <div className="flex-1 relative mx-auto" style={{ maxWidth: 600 }}>
        <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search..."
          style={{ height: 48, background: "#0B1220", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 18 }}
          className="w-full pl-11 pr-20 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 badge-pill bg-muted/60 text-muted-foreground border border-border/60">
          Ctrl+K
        </kbd>
      </div>

      {/* Actions */}
      <div className="flex items-center shrink-0" style={{ gap: 16 }}>
        <button
          style={{ width: 44, height: 44, borderRadius: 16, background: "#0B1220", border: "1px solid rgba(255,255,255,0.05)" }}
          className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
          aria-label="Toggle theme"
        >
          <Moon className="w-4 h-4" />
        </button>
        <button
          style={{ width: 44, height: 44, borderRadius: 16 }}
          className="btn-premium flex items-center justify-center text-primary-foreground transition-colors"
          aria-label="Add"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div
          style={{ height: 44, borderRadius: 16, background: "#0B1220", border: "1px solid rgba(255,255,255,0.05)" }}
          className="px-4 flex items-center gap-2 text-[13px] font-semibold text-foreground"
        >
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-num">{time.toLocaleTimeString("en-US", { hour12: true })}</span>
        </div>
        <button
          style={{ width: 44, height: 44, borderRadius: 16, background: "#0B1220", border: "1px solid rgba(255,255,255,0.05)" }}
          className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>
        <div style={{ width: 44, height: 44, borderRadius: 16 }} className="bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">
          {initial}
        </div>
      </div>
    </header>
  );
}
