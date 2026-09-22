import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Building2, Users, Activity, CreditCard,
  Factory, ChevronLeft, ChevronRight, ArrowLeft, LogOut,
  ScrollText, Settings2, Target, Camera, ShieldCheck, Timer, Bell, Sparkles, Wallet, MapPinPlus, Database, UsersRound
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTenantPermissions } from "@/hooks/useTenantPermissions";
import type { PermissionKey } from "@/lib/permissions";

const navGroups: { label: string; items: { to: string; icon: typeof Users; label: string; end?: boolean; platformOnly?: boolean; permission?: PermissionKey }[] }[] = [
  {
    label: "Organizations",
    items: [
      { to: "/admin", icon: Building2, label: "Sites & Tenants", end: true, permission: "admin_sites.manage" },
      { to: "/admin/users", icon: Users, label: "User Management", permission: "users.manage" },
      { to: "/admin/platform-users", icon: UsersRound, label: "All Users", platformOnly: true },
      { to: "/admin/sites", icon: Factory, label: "Site Overview", permission: "admin_sites.manage" },
      { to: "/admin/site-requests", icon: MapPinPlus, label: "Site Requests", permission: "admin_sites.manage" },
    ],
  },
  {
    label: "Platform",
    items: [
      { to: "/admin/system", icon: Activity, label: "System Monitoring", platformOnly: true },
      { to: "/admin/cameras", icon: Camera, label: "IP Cameras & AI", permission: "admin_ai.manage" },
      { to: "/admin/ai-config", icon: Sparkles, label: "AI Model & Categories", permission: "admin_ai.manage" },
      { to: "/admin/quality-dataset", icon: Database, label: "Quality Dataset", permission: "admin_ai.manage" },
      { to: "/admin/kpi-config", icon: Target, label: "KPI & OKRs", permission: "kpis.manage" },
      { to: "/admin/ai-budget", icon: Wallet, label: "AI Budget", permission: "budget.manage" },
    ],
  },
  {
    label: "Governance",
    items: [
      { to: "/admin/rules", icon: ShieldCheck, label: "Rules & Policy", permission: "rules.manage" },
      { to: "/admin/escalation", icon: Timer, label: "Escalation Policies", permission: "escalation.manage" },
      { to: "/admin/notifications", icon: Bell, label: "Notifications", permission: "notifications.manage" },
      { to: "/admin/billing", icon: CreditCard, label: "Billing & Plans", platformOnly: true },
      { to: "/admin/audit-log", icon: ScrollText, label: "Audit Log", permission: "audit.view" },
      { to: "/admin/settings", icon: Settings2, label: "Settings", permission: "settings.manage" },
    ],
  },
];

const AdminSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { hasRole, signOut } = useAuth();
  const isSuperAdmin = hasRole("super_admin");
  const { can } = useTenantPermissions();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out.");
    navigate("/");
  };

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 z-30",
        collapsed ? "w-16" : "w-16 md:w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border">
        <div className="relative w-9 h-9 rounded-md bg-primary flex items-center justify-center shrink-0 shadow-sm">
          <Factory className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="hidden min-w-0 md:block">
            <div className="font-display font-bold text-foreground text-[15px] tracking-tight leading-tight">
              Factory<span className="text-primary">AI</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Platform Admin</div>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <div className="flex items-center justify-center md:justify-end px-3 h-10 border-b border-sidebar-border shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center justify-center h-7 w-7 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {!collapsed && (
              <div className="hidden px-3 mb-1.5 text-[10px] font-semibold uppercase text-muted-foreground/70 md:block">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.filter((item) => (isSuperAdmin || !item.platformOnly) && (!item.permission || can(item.permission))).map((item) => {
                const isActive = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={cn(
                      "group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />
                    )}
                    <item.icon className={cn("w-5 h-5 shrink-0 transition-colors", isActive && "text-primary")} />
                    {!collapsed && <span className="hidden truncate md:inline">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <NavLink
          to="/app"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="hidden md:inline">Back to App</span>}
        </NavLink>
        <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="justify-start gap-3 px-3 h-9 text-sm font-normal text-destructive hover:bg-destructive/10 hover:text-destructive w-full"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="hidden md:inline">Sign out</span>}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out?</AlertDialogTitle>
              <AlertDialogDescription>
                You'll need to sign in again to access the admin panel.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sign out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </aside>
  );
};

export default AdminSidebar;
