import { useEffect, useState, memo } from "react";
import { Search, Plus, Clock, Bell, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

function TopHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const { setMobileOpen } = useSidebar();
  const [time, setTime] = useState(new Date());
  const [searchOpen, setSearchOpen] = useState(false);
  const initial = (settings?.display_name || user?.email || "U").slice(0, 2).toUpperCase();

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = time.toLocaleTimeString("en-US", { hour12: true });
  const shortTime = time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <header className="sticky top-0 z-40 mb-4 md:mb-6 lg:mb-8 backdrop-blur-xl bg-background/95 border-b border-border/40 lg:border-0">
      {/* Mobile brand row */}
      <div className="flex lg:hidden items-center gap-3 py-3 min-h-[56px]">
        <button
          onClick={() => setMobileOpen(true)}
          className="touch-target flex items-center justify-center rounded-xl bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <img src="/daddyfxbook-logo.png" alt="DaddyFxBook" className="w-8 h-8 object-contain shrink-0" />
          <span className="font-extrabold tracking-tight text-foreground truncate text-sm">DaddyFxBook</span>
        </div>
        <div className="h-9 rounded-lg bg-card border border-border flex items-center px-1 shrink-0">
          <Avatar className="w-7 h-7 rounded-md">
            <AvatarImage src={settings?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px] rounded-md">
              {initial}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Main header row */}
      <div className="flex flex-col gap-3 pb-3 lg:pb-0 lg:flex-row lg:items-center lg:gap-4 min-h-[44px] lg:min-h-[70px]">
        {/* Title block — hidden on mobile (shown in page content) */}
        <div className="hidden lg:block shrink-0 min-w-0 lg:min-w-[160px] xl:min-w-[200px]">
          <h1 className="font-bold text-foreground tracking-tight leading-none text-xl xl:text-2xl">{title}</h1>
          {subtitle && <p className="text-xs xl:text-[13px] text-muted-foreground mt-1 font-medium truncate">{subtitle}</p>}
        </div>

        {/* Search */}
        <div className="flex-1 flex justify-center min-w-0 order-3 lg:order-none w-full lg:w-auto">
          {/* Mobile: collapsible search */}
          <div className="w-full lg:hidden">
            {searchOpen ? (
              <div className="relative animate-in fade-in duration-200">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search..."
                  autoFocus
                  onBlur={() => setSearchOpen(false)}
                  className="w-full h-11 pl-10 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none rounded-xl bg-secondary border border-border"
                />
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="touch-target w-full flex items-center justify-center gap-2 rounded-xl bg-secondary text-muted-foreground text-sm font-medium"
              >
                <Search className="w-4 h-4" />
                Search...
              </button>
            )}
          </div>

          {/* Desktop search */}
          <div className="relative hidden lg:block w-full max-w-[450px]">
            <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full h-11 pl-11 pr-20 text-[13px] text-zinc-300 placeholder:text-zinc-600 focus:outline-none transition-colors border-0 rounded-xl bg-[#0B0B0B]"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium bg-[#1A1A1A] text-zinc-500 px-2 py-0.5 rounded-md hidden xl:inline">
              Ctrl+K
            </kbd>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center shrink-0 gap-2 md:gap-3 order-2 lg:order-none ml-auto lg:ml-0">
          <div className="touch-target flex items-center justify-center rounded-xl bg-[#0B0B0B] text-zinc-400 hover:text-white transition-colors">
            <ThemeToggle />
          </div>
          <button
            className="touch-target bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-colors rounded-xl"
            aria-label="Add"
          >
            <Plus className="w-4 h-4" />
          </button>
          <div className="hidden sm:flex h-11 rounded-xl bg-[#0B0B0B] px-3 md:px-4 items-center gap-2 text-[13px] font-semibold text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="text-num hidden md:inline">{timeStr}</span>
            <span className="text-num md:hidden text-xs">{shortTime}</span>
          </div>
          <button
            className="touch-target flex items-center justify-center rounded-xl bg-[#0B0B0B] text-zinc-400 hover:text-white transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>
          <div className="hidden lg:flex h-11 rounded-xl bg-card border border-border items-center px-1.5 cursor-pointer hover:bg-muted/50 transition-colors">
            <Avatar className="w-8 h-8 rounded-lg">
              <AvatarImage src={settings?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs rounded-lg">
                {initial}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>

      {/* Mobile page title */}
      <div className="lg:hidden pb-2">
        <h1 className="font-bold text-foreground tracking-tight leading-tight text-xl">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5 font-medium">{subtitle}</p>}
      </div>
    </header>
  );
}

export default memo(TopHeader);
