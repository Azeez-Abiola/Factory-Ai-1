import { LogOut, User as UserIcon, Settings as SettingsIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const roleLabel = (r: string) =>
  ({ super_admin: "Super Admin", tenant_admin: "Tenant Admin", operator: "Operator", viewer: "Viewer" } as Record<string, string>)[r] ?? r;

const UserMenu = () => {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const initials = (user.user_metadata?.display_name || user.email || "U")
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out.");
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 text-primary font-bold text-sm">
          {initials}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="text-sm font-semibold truncate">{user.user_metadata?.display_name ?? user.email}</div>
          <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          {roles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {roles.map((r) => (
                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/25">
                  {roleLabel(r)}
                </span>
              ))}
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/app")}>
          <UserIcon className="w-4 h-4 mr-2" /> Operational app
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/admin")}>
          <SettingsIcon className="w-4 h-4 mr-2" /> Admin panel
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
