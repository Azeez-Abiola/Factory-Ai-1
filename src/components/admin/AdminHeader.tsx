import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/app/UserMenu";

const AdminHeader = () => {
  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <Badge variant="destructive" className="text-xs font-mono">
          <Shield className="w-3 h-3 mr-1" />
          PLATFORM ADMIN
        </Badge>
        <span className="text-sm text-muted-foreground hidden md:inline">Platform Control Plane</span>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
};

export default AdminHeader;
