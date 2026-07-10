import { Shield, Activity } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/app/UserMenu";

const AdminHeader = () => {
  return (
    <header className="h-16 border-b border-border/70 bg-background/70 backdrop-blur-xl flex items-center justify-between gap-4 px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1">
          <Shield className="w-3 h-3 text-destructive" />
          <span className="text-[11px] font-semibold tracking-wider uppercase text-destructive">Platform Admin</span>
        </div>
        <span className="hidden md:inline text-sm text-muted-foreground truncate">Control plane · tenant, security &amp; observability</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden lg:flex items-center gap-2 mr-1 px-2.5 py-1 rounded-full border border-border/70 bg-muted/40">
          <Activity className="w-3 h-3 text-success" />
          <span className="text-[11px] font-medium text-muted-foreground">All systems nominal</span>
        </div>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
};

export default AdminHeader;
