import { useEffect, useState, memo } from "react";
import { Search, Plus, Clock3, Bell, Menu, ChevronDown, LayoutDashboard, BriefcaseBusiness, BookOpen, Scale, BarChart3, BrainCircuit, Activity, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSidebar } from "@/contexts/SidebarContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from "@/components/ui/command";

const searchPages = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Trades", path: "/trades", icon: BriefcaseBusiness },
  { label: "Journal", path: "/journal", icon: BookOpen },
  { label: "Rules", path: "/rules", icon: Scale },
  { label: "Analysis", path: "/analysis", icon: BarChart3 },
  { label: "Performance Coach", path: "/ai-report", icon: BrainCircuit },
  { label: "Backtesting", path: "/backtesting", icon: Activity },
  { label: "Settings", path: "/settings", icon: Settings },
];

function TopHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const { setMobileOpen } = useSidebar();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [time, setTime] = useState(new Date());
  const [searchOpen, setSearchOpen] = useState(false);
  const initial = (settings?.display_name || user?.email || "D").slice(0, 1);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function goTo(path: string) {
    setSearchOpen(false);
    navigate(path === "/" && pathname === "/preview" ? "/preview" : path);
  }

  return (
    <>
      <header className="app-header">
        <button onClick={() => setMobileOpen(true)} className="app-icon-button app-menu-button" aria-label="Open navigation menu"><Menu /></button>
        <div className="app-header-title">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="app-header-search" onClick={() => setSearchOpen(true)} aria-label="Search pages and actions">
          <Search aria-hidden="true" /><span>Search...</span><kbd>Ctrl+K</kbd>
        </button>
        <div className="app-header-actions">
          <ThemeToggle />
          <button onClick={() => navigate("/trades?add=true")} className="app-icon-button app-add-trade" aria-label="Add trade" title="Add trade"><Plus /></button>
          <div className="app-header-clock"><Clock3 aria-hidden="true" /><time suppressHydrationWarning>{time.toLocaleTimeString("en-US", { hour12: true })}</time></div>
          <Popover>
            <PopoverTrigger asChild><button className="app-icon-button app-notifications" aria-label="Notifications"><Bell /></button></PopoverTrigger>
            <PopoverContent align="end" className="app-notification-popover">
              <h2>Notifications</h2>
              <div className="app-notification-empty"><Bell aria-hidden="true" /><p>You’re all caught up</p><span>No new notifications to show.</span></div>
            </PopoverContent>
          </Popover>
          <button onClick={() => navigate("/settings")} className="app-header-profile" aria-label="Open profile settings">
            <Avatar className="app-header-avatar"><AvatarImage src={settings?.avatar_url ?? undefined} alt="" /><AvatarFallback>{initial}</AvatarFallback></Avatar>
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
      </header>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="app-search-dialog">
          <DialogTitle className="sr-only">Search your workspace</DialogTitle>
          <DialogDescription className="sr-only">Find a page or quickly add a trade. Use the arrow keys to select a result.</DialogDescription>
          <Command>
            <CommandInput placeholder="Search pages and actions..." />
            <CommandList>
              <CommandEmpty>No matching pages or actions.</CommandEmpty>
              <CommandGroup heading="Pages">
                {searchPages.map(({ label, path, icon: Icon }) => <CommandItem key={path} value={label} onSelect={() => goTo(path)}><Icon /><span>{label}</span></CommandItem>)}
              </CommandGroup>
              <CommandGroup heading="Quick actions"><CommandItem value="Add new trade" onSelect={() => goTo("/trades?add=true")}><Plus /><span>Add trade</span></CommandItem></CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default memo(TopHeader);
