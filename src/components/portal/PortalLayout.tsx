import { NavLink, Outlet } from "react-router-dom";
import { Factory, LayoutDashboard, Bell, Wallet, MapPinPlus, ArrowLeftRight } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/app/UserMenu";
import { useTenants } from "@/hooks/useTenants";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const navItems = [
  { to: "/portal", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/portal/alerts", label: "Alerts", icon: Bell },
  { to: "/portal/budget", label: "AI Budget", icon: Wallet },
  { to: "/portal/requests", label: "Request a Site", icon: MapPinPlus },
];

/**
 * Read-mostly workspace for factory managers: their own site's scores,
 * alerts and spend, plus the ability to request new sites. No admin tooling.
 */
const PortalLayout = () => {
  const { tenants, activeTenantId, setActiveTenantId } = useTenants();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-20 border-b border-border bg-card/95 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto w-full max-w-[1400px] h-full px-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm">
              <Factory className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0 hidden sm:block">
              <div className="font-display font-bold text-base leading-tight">
                Factory<span className="text-primary">AI</span>
              </div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground mt-0.5">
                Manager Portal
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {tenants.length > 0 && (
              <Select value={activeTenantId ?? undefined} onValueChange={setActiveTenantId}>
                <SelectTrigger className="h-10 w-[150px] sm:w-[220px]" aria-label="Select site">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <NavLink
              to="/app"
              className="hidden md:inline-flex items-center gap-2 h-10 px-3 rounded-md text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
              Operator console
            </NavLink>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <nav className="border-b border-border bg-card/60 sticky top-20 z-10">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 flex gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-2 px-3 py-3.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1400px] space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default PortalLayout;
