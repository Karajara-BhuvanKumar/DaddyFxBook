import * as React from "react";

type SidebarContextValue = {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  closeMobile: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const closeMobile = React.useCallback(() => setMobileOpen(false), []);

  const value = React.useMemo(
    () => ({ mobileOpen, setMobileOpen, closeMobile }),
    [mobileOpen, closeMobile],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
