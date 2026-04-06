import { NavLink, useLocation } from "react-router-dom";
import {
  Building2, Users, Activity, CreditCard,
  Factory, ChevronLeft, ChevronRight, ArrowLeft,
  ScrollText, Rocket, Settings2, Target
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", icon: Building2, label: "Tenants", end: true },
  { to: "/admin/users", icon: Users, label: "User Management" },
  { to: "/admin/system", icon: Activity, label: "System Monitoring" },
  { to: "/admin/billing", icon: CreditCard, label: "Billing & Plans" },
  { to: "/admin/audit-log", icon: ScrollText, label: "Audit Log" },
  { to: "/admin/onboarding", icon: Rocket, label: "Onboarding" },
  { to: "/admin/kpi-config", icon: Target, label: "KPI & OKRs" },
  { to: "/admin/settings", icon: Settings2, label: "Settings" },
];

const AdminSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-destructive flex items-center justify-center shrink-0">
          <Factory className="w-4 h-4 text-destructive-foreground" />
        </div>
        {!collapsed && (
          <span className="font-display font-bold text-foreground text-lg tracking-tight">
            Factory<span className="text-destructive">AI</span>
            <span className="text-xs font-normal text-muted-foreground ml-1.5">Admin</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-destructive/10 text-destructive"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {isActive && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-destructive" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <NavLink
          to="/app"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Back to App</span>}
        </NavLink>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
