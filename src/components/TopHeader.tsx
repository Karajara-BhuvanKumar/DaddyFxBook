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
    <header className="flex items-center gap-4 mb-8 sticky top-0 z-50 backdrop-blur-xl" style={{ height: 70, background: "var(--bg-secondary)" }}>
      {/* Title block */}
      <div className="shrink-0 min-w-[200px]">
        <h1 className="font-bold text-foreground tracking-tight leading-none" style={{ fontSize: 24, fontWeight: 700 }}>{title}</h1>
        {subtitle && <p className="text-[13px] text-muted-foreground mt-1 font-medium">{subtitle}</p>}
      </div>

      {/* Search */}
      <div className="flex-1 flex justify-center">
        <div className="relative" style={{ width: 450 }}>
          <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search..."
            style={{ height: 44, background: "#0B0B0B", borderRadius: 12 }}
            className="w-full pl-11 pr-20 text-[13px] text-zinc-300 placeholder:text-zinc-600 focus:outline-none transition-colors border-0"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium bg-[#1A1A1A] text-zinc-500 px-2 py-0.5 rounded-md">
            Ctrl+K
          </kbd>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center shrink-0" style={{ gap: 12 }}>
        <div
          style={{ width: 44, height: 44, borderRadius: 12, background: "#0B0B0B" }}
          className="flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.02] cursor-pointer transition-colors"
        >
          <ThemeToggle />
        </div>
        <button
          style={{ width: 44, height: 44, borderRadius: 12 }}
          className="bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-colors"
          aria-label="Add"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div
          style={{ height: 44, borderRadius: 12, background: "#0B0B0B" }}
          className="px-4 flex items-center gap-2 text-[13px] font-semibold text-zinc-300"
        >
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-num">{time.toLocaleTimeString("en-US", { hour12: true })}</span>
        </div>
        <button
          style={{ width: 44, height: 44, borderRadius: 12, background: "#0B0B0B" }}
          className="flex items-center justify-center text-zinc-400 hover:text-white transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>
        <div style={{ height: 44, borderRadius: 12, background: "#0B0B0B" }} className="flex items-center px-1.5 cursor-pointer hover:bg-white/[0.02] transition-colors gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2A2A2A] text-zinc-400 flex items-center justify-center font-bold text-sm">
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}
