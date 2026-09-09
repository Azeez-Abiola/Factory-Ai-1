import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenants } from "@/hooks/useTenants";
import { cn } from "@/lib/utils";

/**
 * Global site (tenant) selector. Everything scoped to a tenant — cameras,
 * alerts, budgets — follows whatever is picked here.
 */
const TenantSwitcher = () => {
  const { tenants, activeTenant, activeTenantId, setActiveTenantId, loading } = useTenants();

  const label = loading ? "Loading sites…" : activeTenant?.name ?? "No site selected";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-2 max-w-[240px] justify-between"
          aria-label="Switch site"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate text-xs font-medium">{label}</span>
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">Active site</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants.length === 0 && (
          <DropdownMenuItem disabled className="text-xs">No sites available</DropdownMenuItem>
        )}
        {tenants.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => setActiveTenantId(t.id)}
            className={cn("gap-2", t.parent_id && "pl-6")}
          >
            <Check className={cn("w-3.5 h-3.5", t.id === activeTenantId ? "opacity-100 text-primary" : "opacity-0")} />
            <span className="truncate">{t.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TenantSwitcher;
