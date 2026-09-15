import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Bell, Camera, FileText,
  Shield, Factory, ChevronLeft, ChevronRight,
  ClipboardList, Sparkles, Wrench, HelpCircle, ShieldCheck, Map, Gauge, PackageSearch
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTenantPermissions } from "@/hooks/useTenantPermissions";
import type { PermissionKey } from "@/lib/permissions";

const navGroups: { label: string; items: { to: string; icon: typeof Bell; label: string; end?: boolean; permission?: PermissionKey }[] }[] = [
  {
    label: "Operate",
    items: [
      { to: "/app", icon: LayoutDashboard, label: "Dashboard", end: true, permission: "dashboard.view" },
      { to: "/app/shift-reports", icon: ClipboardList, label: "Shift & Handover", permission: "shift.view" },
      { to: "/app/alerts", icon: Bell, label: "Alerts", permission: "alerts.view" },
      { to: "/app/investigations", icon: ShieldCheck, label: "Investigations", permission: "investigations.view" },
      { to: "/app/cameras", icon: Camera, label: "Camera Feeds", permission: "cameras.view" },
      { to: "/app/floor-plan", icon: Map, label: "Floor Plan", permission: "floor_plan.view" },
    ],
  },
  {
    label: "Analyze",
    items: [
      { to: "/app/quality", icon: PackageSearch, label: "Quality", permission: "quality.view" },
      { to: "/app/insights", icon: Sparkles, label: "AI Insights", permission: "insights.view" },
      { to: "/app/reports", icon: FileText, label: "Reports", permission: "reports.view" },
      { to: "/app/maintenance", icon: Wrench, label: "Maintenance", permission: "maintenance.view" },
    ],
  },
  {
    label: "Support",
    items: [
      { to: "/app/help", icon: HelpCircle, label: "Help & Docs" },
    ],
  },
];

const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { roles } = useAuth();
  const { can } = useTenantPermissions();
  const canAdmin = roles.includes("super_admin") || roles.includes("tenant_admin");

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-[width] duration-200 z-30 max-md:w-[68px]",
        collapsed ? "w-[68px]" : "w-[272px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-3 h-20 border-b border-sidebar-border", collapsed ? "px-3.5" : "px-6")}>
        <div className="relative w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm">
          <Factory className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0 max-md:hidden">
            <div className="font-display font-bold text-foreground text-base leading-tight">
              Factory<span className="text-primary">AI</span>
            </div>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground mt-0.5">Operator Console</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-5 px-2.5 overflow-y-auto">
        {navGroups.map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || can(item.permission)) })).filter((group) => group.items.length).map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {!collapsed && (
              <div className="px-3 mb-2 text-[10px] font-bold uppercase text-muted-foreground/70 max-md:hidden">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={cn(
                      "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-150",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-primary")} />
                    {!collapsed && <span className="truncate max-md:hidden">{item.label}</span>}
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
          to="/portal"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
        >
          <Gauge className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="max-md:hidden">Manager Portal</span>}
        </NavLink>
        {canAdmin && (
          <NavLink
            to="/admin"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
          >
            <Shield className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="max-md:hidden">Admin Panel</span>}
          </NavLink>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="justify-start gap-3 px-3 h-10 text-sm font-normal text-sidebar-foreground hover:bg-sidebar-accent w-full"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span className="max-md:hidden">Collapse</span>}
        </Button>
      </div>
    </aside>
  );
};

export default AppSidebar;
