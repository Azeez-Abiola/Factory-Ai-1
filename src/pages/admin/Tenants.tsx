import { Building2, Search, Plus, MoreHorizontal, Pencil, Ban, RotateCcw, GitBranch } from "lucide-react";
import { useState } from "react";
import { mockTenants as initialTenants, type Tenant, type TenantStatus, type TenantPlan } from "@/data/adminMockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import TenantForm from "@/components/admin/TenantForm";

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
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [search, setSearch] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [parentForSubTenant, setParentForSubTenant] = useState<Tenant | null>(null);

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.industry.toLowerCase().includes(search.toLowerCase())
  );

  // Group: parent tenants first, then their children underneath
  const parentTenants = filtered.filter((t) => !t.parentId);
  const getChildren = (parentId: string) => filtered.filter((t) => t.parentId === parentId);

  const totalMRR = tenants.reduce((sum, t) => sum + t.mrr, 0);
  const totalCameras = tenants.reduce((sum, t) => sum + t.cameras, 0);
  const totalUsers = tenants.reduce((sum, t) => sum + t.users, 0);

  const handleFormSubmit = (data: any) => {
    if (data.id) {
      setTenants((prev) =>
        prev.map((t) => (t.id === data.id ? { ...t, ...data } : t))
      );
      toast.success(`${data.name} updated successfully`);
    } else {
      const newTenant: Tenant = {
        ...data,
        id: `TEN-${String(tenants.length + 1).padStart(3, "0")}`,
        createdAt: new Date().toISOString().split("T")[0],
        parentId: data.parentId ?? null,
        parentName: data.parentName ?? null,
      };
      setTenants((prev) => [...prev, newTenant]);
      toast.success(
        data.parentId
          ? `Sub-tenant "${data.name}" created under ${data.parentName}`
          : `${data.name} added successfully`
      );
    }
    setEditingTenant(null);
    setParentForSubTenant(null);
  };

  const handleToggleSuspend = (tenant: Tenant) => {
    const newStatus: TenantStatus = tenant.status === "suspended" ? "active" : "suspended";
    setTenants((prev) =>
      prev.map((t) =>
        t.id === tenant.id
          ? { ...t, status: newStatus, mrr: newStatus === "suspended" ? 0 : t.mrr }
          : t
      )
    );
    setSelectedTenant(null);
    toast.success(`${tenant.name} ${newStatus === "suspended" ? "suspended" : "reactivated"}`);
  };

  const openAdd = () => {
    setEditingTenant(null);
    setParentForSubTenant(null);
    setFormOpen(true);
  };

  const openEdit = (tenant: Tenant, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingTenant(tenant);
    setParentForSubTenant(null);
    setFormOpen(true);
    setSelectedTenant(null);
  };

  const openAddSubTenant = (parent: Tenant, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingTenant(null);
    setParentForSubTenant(parent);
    setFormOpen(true);
    setSelectedTenant(null);
  };

  const renderTenantRow = (tenant: Tenant, isChild = false) => {
    const children = getChildren(tenant.id);
    return (
      <>
        <TableRow
          key={tenant.id}
          className="border-border cursor-pointer"
          onClick={() => setSelectedTenant(tenant)}
        >
          <TableCell>
            <div className={cn("flex items-center gap-3", isChild && "pl-6")}>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isChild ? "bg-accent" : "bg-secondary")}>
                {isChild ? <GitBranch className="w-4 h-4 text-muted-foreground" /> : <Building2 className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div>
                <p className="font-medium text-foreground">{tenant.name}</p>
                <p className="text-xs text-muted-foreground">
                  {tenant.parentName ? `Sub-tenant of ${tenant.parentName} · ` : ""}{tenant.region}
                </p>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => openEdit(tenant, e as any)}>
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>
                {!isChild && (
                  <DropdownMenuItem onClick={(e) => openAddSubTenant(tenant, e as any)}>
                    <GitBranch className="w-4 h-4 mr-2" /> Add Sub-Tenant
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); handleToggleSuspend(tenant); }}
                  className={tenant.status === "suspended" ? "text-primary" : "text-destructive"}
                >
                  {tenant.status === "suspended" ? (
                    <><RotateCcw className="w-4 h-4 mr-2" /> Reactivate</>
                  ) : (
                    <><Ban className="w-4 h-4 mr-2" /> Suspend</>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
        {children.map((child) => renderTenantRow(child, true))}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tenant Management</h1>
          <p className="text-sm text-muted-foreground">Manage organizations across the platform</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" /> Add Tenant
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Tenants", value: tenants.length, sub: `${tenants.filter(t => t.status === "active").length} active` },
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
            {parentTenants.map((tenant) => renderTenantRow(tenant))}
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
              {selectedTenant.parentName && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border">
                  <GitBranch className="w-3.5 h-3.5" />
                  Sub-tenant of <span className="font-medium text-foreground">{selectedTenant.parentName}</span>
                </div>
              )}
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
              {/* Sub-tenants list */}
              {(() => {
                const subs = tenants.filter((t) => t.parentId === selectedTenant.id);
                if (subs.length === 0) return null;
                return (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Sub-Tenants ({subs.length})</p>
                    <div className="space-y-1.5">
                      {subs.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2">
                            <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm text-foreground">{sub.name}</span>
                          </div>
                          <Badge variant="outline" className={cn("text-xs capitalize", statusColors[sub.status])}>{sub.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <div className="flex gap-2 pt-2 flex-wrap">
                <Button variant="outline" size="sm" className="border-border" onClick={() => openEdit(selectedTenant)}>
                  <Pencil className="w-3 h-3 mr-1" /> Edit
                </Button>
                {!selectedTenant.parentId && (
                  <Button variant="outline" size="sm" className="border-border" onClick={() => openAddSubTenant(selectedTenant)}>
                    <GitBranch className="w-3 h-3 mr-1" /> Add Sub-Tenant
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("border-border", selectedTenant.status !== "suspended" && "text-destructive hover:text-destructive")}
                  onClick={() => handleToggleSuspend(selectedTenant)}
                >
                  {selectedTenant.status === "suspended" ? "Reactivate" : "Suspend"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / Edit / Sub-Tenant Form */}
      <TenantForm
        key={editingTenant?.id ?? parentForSubTenant?.id ?? "new"}
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) { setEditingTenant(null); setParentForSubTenant(null); } }}
        tenant={editingTenant}
        parentTenant={parentForSubTenant}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
};

export default Tenants;
