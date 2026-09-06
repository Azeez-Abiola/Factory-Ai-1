import { Bell, Search, Command } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { mockAlerts } from "@/data/mockData";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/app/UserMenu";

const AppHeader = () => {
  const openAlerts = mockAlerts.filter((a) => a.status === "open").length;

  return (
    <header className="h-20 border-b border-border bg-card/95 backdrop-blur-md flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 sticky top-0 z-20">
      <div className="relative hidden sm:block w-full max-w-lg group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input
          aria-label="Search alerts, cameras, reports"
          placeholder="Search alerts, cameras, reports…"
          className="pl-10 pr-16 h-10 bg-background border-border shadow-none focus-visible:border-primary/50 focus-visible:ring-primary/20"
        />
        <kbd className="pointer-events-none hidden md:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center gap-1 rounded border border-border/60 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          <Command className="w-3 h-3" />K
        </kbd>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <div className="hidden lg:flex items-center gap-2 mr-2 px-2.5 py-1 rounded-md border border-success/25 bg-success/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-70" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span className="text-[11px] font-bold uppercase text-success">Live</span>
        </div>
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${openAlerts} open alerts`}>
          <Bell className="w-5 h-5" />
          {openAlerts > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-[18px] w-[18px] min-w-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold ring-2 ring-background">
              {openAlerts}
            </span>
          )}
        </Button>
        <UserMenu />
      </div>
    </header>
  );
};

export default AppHeader;
