import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ThemeToggle from "@/components/ThemeToggle";

const AdminHeader = () => {
  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <Badge variant="destructive" className="text-xs font-mono">
          <Shield className="w-3 h-3 mr-1" />
          SUPER ADMIN
        </Badge>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Platform Control Plane</span>
        <ThemeToggle />
        <div className="w-8 h-8 rounded-full bg-destructive/20 border border-destructive/30 flex items-center justify-center text-sm font-bold text-destructive">
          OD
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
