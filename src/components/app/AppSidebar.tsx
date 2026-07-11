import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Bell, Camera, FileText,
  Shield, Factory, ChevronLeft, ChevronRight,
  ClipboardList, Sparkles, Wrench, HelpCircle, ShieldCheck
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navGroups: { label: string; items: { to: string; icon: typeof Bell; label: string; end?: boolean }[] }[] = [
  {
    label: "Operate",
    items: [
      { to: "/app", icon: LayoutDashboard, label: "Dashboard", end: true },
      { to: "/app/alerts", icon: Bell, label: "Alerts" },
      { to: "/app/incidents", icon: ShieldCheck, label: "Incidents" },
      { to: "/app/cameras", icon: Camera, label: "Camera Feeds" },
    ],
  },
  {
    label: "Analyze",
    items: [
      { to: "/app/insights", icon: Sparkles, label: "AI Insights" },
      { to: "/app/reports", icon: FileText, label: "Reports" },
      { to: "/app/shift-reports", icon: ClipboardList, label: "Shift Handover" },
      { to: "/app/maintenance", icon: Wrench, label: "Maintenance" },
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

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 flex flex-col bg-sidebar/80 backdrop-blur-xl border-r border-sidebar-border transition-all duration-300 z-30",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-[hsl(190_80%_55%)] flex items-center justify-center shrink-0 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.6)]">
          <Factory className="w-5 h-5 text-primary-foreground" />
          <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-display font-bold text-foreground text-[15px] tracking-tight leading-tight">
              Factory<span className="text-gradient">AI</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Operator Console</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {!collapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
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
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-gradient-to-b from-primary to-[hsl(190_80%_55%)]" />
                    )}
                    <item.icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-110", isActive && "text-primary")} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
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
          to="/admin"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
        >
          <Shield className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Admin Panel</span>}
        </NavLink>
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
