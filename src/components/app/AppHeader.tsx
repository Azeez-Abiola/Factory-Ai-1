import { useEffect, useState } from "react";
import { Search, Command } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/app/UserMenu";
import NotificationBell from "@/components/app/NotificationBell";
import GlobalSearch from "@/components/app/GlobalSearch";
import { cn } from "@/lib/utils";

const AppHeader = () => {
  const { activeTenantId } = useTenants();
  const [searchOpen, setSearchOpen] = useState(false);
  const [live, setLive] = useState(false);

  // Cmd/Ctrl + K opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // "Live" reflects the actual realtime connection for this tenant.
  useEffect(() => {
    if (!activeTenantId) return setLive(false);
    const channel = supabase
      .channel(`header-presence:${activeTenantId}`)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { setLive(false); supabase.removeChannel(channel); };
  }, [activeTenantId]);

  return (
    <header className="h-20 border-b border-border bg-card/95 backdrop-blur-md flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 sticky top-0 z-20">
      <div className="relative hidden sm:block w-full max-w-lg group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input
          readOnly
          role="button"
          aria-label="Search alerts, cameras, reports"
          placeholder="Search alerts, cameras, reports…"
          onFocus={() => setSearchOpen(true)}
          onClick={() => setSearchOpen(true)}
          className="pl-10 pr-16 h-10 bg-background border-border shadow-none cursor-pointer focus-visible:border-primary/50 focus-visible:ring-primary/20"
        />
        <kbd className="pointer-events-none hidden md:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center gap-1 rounded border border-border/60 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          <Command className="w-3 h-3" />K
        </kbd>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          className="sm:hidden inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-muted transition-colors"
        >
          <Search className="w-5 h-5" />
        </button>
        <div
          className={cn(
            "hidden lg:flex items-center gap-2 mr-2 px-2.5 py-1 rounded-md border",
            live ? "border-success/25 bg-success/10" : "border-border bg-muted/50",
          )}
          title={live ? "Realtime connection active" : "Reconnecting to realtime updates"}
        >
          <span className="relative flex h-2 w-2">
            {live && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-70" />}
            <span className={cn("relative inline-flex rounded-full h-2 w-2", live ? "bg-success" : "bg-muted-foreground")} />
          </span>
          <span className={cn("text-[11px] font-bold uppercase", live ? "text-success" : "text-muted-foreground")}>
            {live ? "Live" : "Offline"}
          </span>
        </div>
        <ThemeToggle />
        <NotificationBell />
        <UserMenu />
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
};

export default AppHeader;
