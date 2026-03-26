import { Building2, Search, Plus, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { mockTenants, type Tenant, type TenantStatus, type TenantPlan } from "@/data/adminMockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const statusColors: Record<TenantStatus, string> = {
  active: "bg-success/10 text-[hsl(var(--success))] border-success/20",
  trial: "bg-primary/10 text-primary border-primary/20",
  suspended: "bg-destructive/10 text-destructive border-destructive/20",
};

const planLabels: Record<TenantPlan, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

const Tenants = () => {
  const [search, setSearch] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const filtered = mockTenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.industry.toLowerCase().includes(search.toLowerCase())
  );

  const totalMRR = mockTenants.reduce((sum, t) => sum + t.mrr, 0);
  const totalCameras = mockTenants.reduce((sum, t) => sum + t.cameras, 0);
  const totalUsers = mockTenants.reduce((sum, t) => sum + t.users, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tenant Management</h1>
          <p className="text-sm text-muted-foreground">Manage organizations across the platform</p>
        </div>
        <Button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
          <Plus className="w-4 h-4 mr-2" /> Add Tenant
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Tenants", value: mockTenants.length, sub: `${mockTenants.filter(t => t.status === "active").length} active` },
          { label: "Total MRR", value: `$${totalMRR.toLocaleString()}`, sub: "Monthly recurring" },
          { label: "Cameras Deployed", value: totalCameras, sub: "Across all tenants" },
          { label: "Platform Users", value: totalUsers, sub: "All roles" },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search tenants…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-background border-border"
        />
      </div>

      {/* Table */}
      <div className="glass rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Organization</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cameras</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="text-right">MRR</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((tenant) => (
              <TableRow
                key={tenant.id}
                className="border-border cursor-pointer"
                onClick={() => setSelectedTenant(tenant)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{tenant.name}</p>
                      <p className="text-xs text-muted-foreground">{tenant.region}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{tenant.industry}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs font-mono border-border">
                    {planLabels[tenant.plan]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-xs capitalize", statusColors[tenant.status])}>
                    {tenant.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm text-foreground">{tenant.cameras}</TableCell>
                <TableCell className="text-right text-sm text-foreground">{tenant.users}</TableCell>
                <TableCell className="text-right text-sm font-medium text-foreground">
                  {tenant.mrr > 0 ? `$${tenant.mrr.toLocaleString()}` : "—"}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedTenant} onOpenChange={() => setSelectedTenant(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">{selectedTenant?.name}</DialogTitle>
          </DialogHeader>
          {selectedTenant && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                {[
                  ["Industry", selectedTenant.industry],
                  ["Region", selectedTenant.region],
                  ["Plan", planLabels[selectedTenant.plan]],
                  ["Status", selectedTenant.status],
                  ["Cameras", selectedTenant.cameras],
                  ["Users", selectedTenant.users],
                  ["Zones", selectedTenant.zones],
                  ["MRR", selectedTenant.mrr > 0 ? `$${selectedTenant.mrr}` : "Trial"],
                  ["Contact", selectedTenant.contactEmail],
                  ["Created", new Date(selectedTenant.createdAt).toLocaleDateString()],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-muted-foreground">{label}</p>
                    <p className="font-medium text-foreground capitalize">{String(value)}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="border-border">Edit Tenant</Button>
                <Button variant="outline" size="sm" className="border-border text-destructive hover:text-destructive">
                  {selectedTenant.status === "suspended" ? "Reactivate" : "Suspend"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tenants;
