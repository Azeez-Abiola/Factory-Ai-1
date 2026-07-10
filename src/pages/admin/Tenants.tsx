import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Search, Plus, MoreHorizontal, Pencil, Ban, RotateCcw, GitBranch, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import TenantForm, { type TenantFormValues } from "@/components/admin/TenantForm";
import PageHeader from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { auditLog } from "@/lib/audit";
import type { TenantRow } from "@/hooks/useTenants";

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-[hsl(var(--success))] border-success/20",
  trial: "bg-primary/10 text-primary border-primary/20",
  suspended: "bg-destructive/10 text-destructive border-destructive/20",
};

const planLabels: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

const Tenants = () => {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantRow | null>(null);
  const [parentForSubTenant, setParentForSubTenant] = useState<TenantRow | null>(null);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [cameraCounts, setCameraCounts] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  const { user } = useAuth();

  const loadTenants = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("tenants").select("*").order("created_at", { ascending: true });
    if (error) { toast.error("Failed to load tenants: " + error.message); setLoading(false); return; }
    const rows = (data ?? []) as TenantRow[];
    setTenants(rows);

    // Load member + camera counts in parallel (RLS-scoped)
    const [{ data: members }, { data: cams }] = await Promise.all([
      supabase.from("tenant_members").select("tenant_id"),
      supabase.from("cameras").select("tenant_id"),
    ]);
    const mc: Record<string, number> = {};
    (members ?? []).forEach((m: { tenant_id: string }) => { mc[m.tenant_id] = (mc[m.tenant_id] ?? 0) + 1; });
    const cc: Record<string, number> = {};
    (cams ?? []).forEach((c: { tenant_id: string }) => { cc[c.tenant_id] = (cc[c.tenant_id] ?? 0) + 1; });
    setMemberCounts(mc);
    setCameraCounts(cc);
    setLoading(false);
  };

  useEffect(() => { loadTenants(); }, []);

  const filtered = tenants.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.industry ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const parentTenants = filtered.filter((t) => !t.parent_id);
  const getChildren = (parentId: string) => filtered.filter((t) => t.parent_id === parentId);

  const handleFormSubmit = async (data: TenantFormValues & { parent_id?: string | null; id?: string }) => {
    if (data.id) {
      const { error } = await supabase.from("tenants").update({
        name: data.name, slug: data.slug, industry: data.industry || null,
        plan: data.plan, status: data.status, contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null, address: data.address || null,
        timezone: data.timezone || "UTC", parent_id: data.parent_id ?? null,
      }).eq("id", data.id);
      if (error) { toast.error("Update failed: " + error.message); return; }
      await auditLog({ tenantId: data.id, action: "tenant.update", entityType: "tenant", entityId: data.id, metadata: { name: data.name } });
      toast.success(`${data.name} updated`);
    } else {
      const insertPayload = {
        name: data.name, slug: data.slug, industry: data.industry || null,
        plan: data.plan, status: data.status, contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null, address: data.address || null,
        timezone: data.timezone || "UTC", parent_id: data.parent_id ?? null,
        created_by: user?.id ?? null,
      };
      const { data: created, error } = await supabase.from("tenants").insert(insertPayload).select().single();
      if (error) { toast.error("Create failed: " + error.message); return; }
      // Auto-add creator as owner member
      if (user?.id && created) {
        await supabase.from("tenant_members").insert({ tenant_id: created.id, user_id: user.id, role: "owner" });
      }
      await auditLog({ tenantId: created?.id, action: "tenant.create", entityType: "tenant", entityId: created?.id, metadata: { name: data.name, parent_id: data.parent_id } });
      toast.success(data.parent_id ? `Sub-tenant "${data.name}" created` : `${data.name} added`);
    }
    setEditingTenant(null); setParentForSubTenant(null);
    await loadTenants();
  };

  const handleToggleSuspend = async (tenant: TenantRow) => {
    const newStatus = tenant.status === "suspended" ? "active" : "suspended";
    const { error } = await supabase.from("tenants").update({ status: newStatus }).eq("id", tenant.id);
    if (error) { toast.error(error.message); return; }
    await auditLog({ tenantId: tenant.id, action: `tenant.${newStatus === "suspended" ? "suspend" : "reactivate"}`, entityType: "tenant", entityId: tenant.id });
    toast.success(`${tenant.name} ${newStatus === "suspended" ? "suspended" : "reactivated"}`);
    await loadTenants();
  };

  const openAdd = () => { setEditingTenant(null); setParentForSubTenant(null); setFormOpen(true); };
  const openEdit = (t: TenantRow, e?: React.MouseEvent) => { e?.stopPropagation(); setEditingTenant(t); setParentForSubTenant(null); setFormOpen(true); };
  const openAddSub = (parent: TenantRow, e?: React.MouseEvent) => { e?.stopPropagation(); setEditingTenant(null); setParentForSubTenant(parent); setFormOpen(true); };

  const renderRow = (tenant: TenantRow, isChild = false) => {
    const children = getChildren(tenant.id);
    const parent = tenants.find((p) => p.id === tenant.parent_id);
    return (
      <>
        <TableRow key={tenant.id} className="border-border cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => navigate(`/admin/tenants/${tenant.id}`)}>
          <TableCell>
            <div className={cn("flex items-center gap-3", isChild && "pl-6")}>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isChild ? "bg-accent" : "bg-secondary")}>
                {isChild ? <GitBranch className="w-4 h-4 text-muted-foreground" /> : <Building2 className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div>
                <p className="font-medium text-foreground">{tenant.name}</p>
                <p className="text-xs text-muted-foreground">
                  {parent ? `Sub-tenant of ${parent.name} · ` : ""}{tenant.slug}
                </p>
              </div>
            </div>
          </TableCell>
          <TableCell className="text-muted-foreground text-sm">{tenant.industry ?? "—"}</TableCell>
          <TableCell><Badge variant="outline" className="text-xs font-mono border-border">{planLabels[tenant.plan] ?? tenant.plan}</Badge></TableCell>
          <TableCell><Badge variant="outline" className={cn("text-xs capitalize", statusColors[tenant.status])}>{tenant.status}</Badge></TableCell>
          <TableCell className="text-right text-sm text-foreground">{cameraCounts[tenant.id] ?? 0}</TableCell>
          <TableCell className="text-right text-sm text-foreground">{memberCounts[tenant.id] ?? 0}</TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => openEdit(tenant, e as never)}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                {!isChild && <DropdownMenuItem onClick={(e) => openAddSub(tenant, e as never)}><GitBranch className="w-4 h-4 mr-2" /> Add Sub-Tenant</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleSuspend(tenant); }}
                  className={tenant.status === "suspended" ? "text-primary" : "text-destructive"}>
                  {tenant.status === "suspended"
                    ? <><RotateCcw className="w-4 h-4 mr-2" /> Reactivate</>
                    : <><Ban className="w-4 h-4 mr-2" /> Suspend</>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
        {children.map((c) => renderRow(c, true))}
      </>
    );
  };

  const totalCameras = Object.values(cameraCounts).reduce((a, b) => a + b, 0);
  const totalUsers = Object.values(memberCounts).reduce((a, b) => a + b, 0);
  const activeCount = tenants.filter((t) => t.status === "active").length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Organizations" icon={Building2} title="Tenant Management"
        description="Manage every organization on the platform — hierarchy, membership, and camera deployments."
        actions={<Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" /> Add Tenant</Button>} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Tenants", value: tenants.length, sub: `${activeCount} active` },
          { label: "Sub-tenants", value: tenants.filter((t) => t.parent_id).length, sub: "Child organizations" },
          { label: "Cameras Deployed", value: totalCameras, sub: "Across all tenants" },
          { label: "Platform Users", value: totalUsers, sub: "All members" },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search tenants…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-background border-border" />
      </div>

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
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading tenants…
              </TableCell></TableRow>
            ) : tenants.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                No tenants yet. Click <span className="text-foreground">Add Tenant</span> to create the first one.
              </TableCell></TableRow>
            ) : parentTenants.map((t) => renderRow(t))}
          </TableBody>
        </Table>
      </div>

      <TenantForm
        key={editingTenant?.id ?? parentForSubTenant?.id ?? "new"}
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) { setEditingTenant(null); setParentForSubTenant(null); } }}
        tenant={editingTenant}
        parentTenant={parentForSubTenant}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
};

export default Tenants;
