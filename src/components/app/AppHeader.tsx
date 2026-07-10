import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { mockAlerts } from "@/data/mockData";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/app/UserMenu";

const AppHeader = () => {
  const openAlerts = mockAlerts.filter((a) => a.status === "open").length;

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search alerts, cameras, reports…"
          className="pl-10 bg-background border-border"
        />
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {openAlerts > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
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
