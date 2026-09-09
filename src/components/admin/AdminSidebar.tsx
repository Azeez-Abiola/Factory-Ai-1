import { NavLink, useLocation } from "react-router-dom";
import {
  Building2, Users, Activity, CreditCard,
  Factory, ChevronLeft, ChevronRight, ArrowLeft,
  ScrollText, Settings2, Target, Camera, ShieldCheck, Timer, Bell, Sparkles, Wallet, MapPinPlus, Database
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navGroups: { label: string; items: { to: string; icon: typeof Users; label: string; end?: boolean }[] }[] = [
  {
    label: "Organizations",
    items: [
      { to: "/admin", icon: Building2, label: "Sites & Tenants", end: true },
      { to: "/admin/users", icon: Users, label: "User Management" },
      { to: "/admin/sites", icon: Factory, label: "Site Overview" },
      { to: "/admin/site-requests", icon: MapPinPlus, label: "Site Requests" },
    ],
  },
  {
    label: "Platform",
    items: [
      { to: "/admin/system", icon: Activity, label: "System Monitoring" },
      { to: "/admin/cameras", icon: Camera, label: "IP Cameras & AI" },
      { to: "/admin/ai-config", icon: Sparkles, label: "AI Model & Categories" },
      { to: "/admin/quality-dataset", icon: Database, label: "Quality Dataset" },
      { to: "/admin/kpi-config", icon: Target, label: "KPI & OKRs" },
      { to: "/admin/ai-budget", icon: Wallet, label: "AI Budget" },
    ],
  },
  {
    label: "Governance",
    items: [
      { to: "/admin/rules", icon: ShieldCheck, label: "Rules & Policy" },
      { to: "/admin/escalation", icon: Timer, label: "Escalation Policies" },
      { to: "/admin/notifications", icon: Bell, label: "Notifications" },
      { to: "/admin/billing", icon: CreditCard, label: "Billing & Plans" },
      { to: "/admin/audit-log", icon: ScrollText, label: "Audit Log" },
      { to: "/admin/settings", icon: Settings2, label: "Settings" },
    ],
  },
];

const AdminSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 z-30",
        collapsed ? "w-16" : "w-16 md:w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
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
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span className="hidden md:inline">Collapse</span>}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
