import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Search, Plus, MoreHorizontal, Pencil, Ban, RotateCcw, GitBranch,
  Loader2, Rocket, ChevronRight, ChevronDown, Factory, ArrowUpRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Onboarding from "./Onboarding";
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
import { buildTenantTree, flattenTree, rollup, tenantPath, descendantIds } from "@/lib/tenantTree";

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

const isQualityDefect = (type: string, title: string) =>
  /quality|defect|damag|misalign|label|packag|contamin|scratch|dent|leak/.test(
    `${type} ${title}`.toLowerCase(),
  );

const Tenants = () => {
  const [tab, setTab] = useState("directory");
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantRow | null>(null);
  const [parentForSubTenant, setParentForSubTenant] = useState<TenantRow | null>(null);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [cameraCounts, setCameraCounts] = useState<Record<string, number>>({});
  const [defectCounts, setDefectCounts] = useState<Record<string, number>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin");

  const loadTenants = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("tenants").select("*").order("created_at", { ascending: true });
    if (error) { toast.error("Failed to load tenants: " + error.message); setLoading(false); return; }
    const rows = (data ?? []) as TenantRow[];
    setTenants(rows);

    const [{ data: members }, { data: cams }, { data: alerts }] = await Promise.all([
      supabase.from("tenant_members").select("tenant_id"),
      supabase.from("cameras").select("tenant_id"),
      supabase.from("alerts").select("tenant_id,type,title"),
    ]);
    const mc: Record<string, number> = {};
    (members ?? []).forEach((m: { tenant_id: string }) => { mc[m.tenant_id] = (mc[m.tenant_id] ?? 0) + 1; });
    const cc: Record<string, number> = {};
    (cams ?? []).forEach((c: { tenant_id: string }) => { cc[c.tenant_id] = (cc[c.tenant_id] ?? 0) + 1; });
    const dc: Record<string, number> = {};
    (alerts ?? []).forEach((a: { tenant_id: string; type: string | null; title: string | null }) => {
      if (isQualityDefect(a.type ?? "", a.title ?? "")) dc[a.tenant_id] = (dc[a.tenant_id] ?? 0) + 1;
    });
    setMemberCounts(mc);
    setCameraCounts(cc);
    setDefectCounts(dc);
    setLoading(false);
  };

  useEffect(() => { loadTenants(); }, []);

  // Search keeps ancestors visible so matched sub-sites never lose their branch.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    const matches = tenants.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      (t.industry ?? "").toLowerCase().includes(q),
    );
    const keep = new Set<string>();
    const byId = new Map(tenants.map((t) => [t.id, t]));
    matches.forEach((m) => {
      keep.add(m.id);
      let cur = m.parent_id ? byId.get(m.parent_id) : undefined;
      while (cur && !keep.has(cur.id)) { keep.add(cur.id); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
      descendantIds(tenants, m.id).forEach((d) => keep.add(d));
    });
    return tenants.filter((t) => keep.has(t.id));
  }, [tenants, search]);

  const rows = useMemo(
    () => flattenTree(buildTenantTree(visible), search.trim() ? new Set<string>() : collapsed),
    [visible, collapsed, search],
  );

  const toggle = (id: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleFormSubmit = async (data: TenantFormValues & { parent_id?: string | null; id?: string }) => {
    if (data.id) {
      const blocked = new Set([data.id, ...descendantIds(tenants, data.id)]);
      if (data.parent_id && blocked.has(data.parent_id)) {
        toast.error("A site cannot sit under itself or one of its own sub-sites.");
        return;
      }
      const { error } = await supabase.from("tenants").update({
        name: data.name, slug: data.slug, industry: data.industry || null,
        plan: data.plan, status: data.status, contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null, address: data.address || null,
        timezone: data.timezone || "UTC", parent_id: data.parent_id ?? null,
      }).eq("id", data.id);
      if (error) { toast.error("Update failed: " + error.message); return; }
      await auditLog({ tenantId: data.id, action: "tenant.update", entityType: "tenant", entityId: data.id, metadata: { name: data.name, parent_id: data.parent_id ?? null } });
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
      if (user?.id && created) {
        await supabase.from("tenant_members").insert({ tenant_id: created.id, user_id: user.id, role: "owner" });
      }
      await auditLog({ tenantId: created?.id, action: "tenant.create", entityType: "tenant", entityId: created?.id, metadata: { name: data.name, parent_id: data.parent_id } });
      toast.success(data.parent_id ? `Sub-site "${data.name}" created` : `${data.name} added`);
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

  const totalCameras = Object.values(cameraCounts).reduce((a, b) => a + b, 0);
  const totalUsers = Object.values(memberCounts).reduce((a, b) => a + b, 0);
  const totalDefects = Object.values(defectCounts).reduce((a, b) => a + b, 0);
  const activeCount = tenants.filter((t) => t.status === "active").length;
  const maxDepth = useMemo(() => {
    const roots = buildTenantTree(tenants);
    return flattenTree(roots, new Set()).reduce((m, n) => Math.max(m, n.depth + 1), 0);
  }, [tenants]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Organizations" icon={Building2} title="Sites & Tenants"
        description="Parent groups, factory sites and their sub-sites — each owning its own cameras, defects and team."
        actions={isSuperAdmin ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTab("setup")} className="gap-2">
              <Rocket className="w-4 h-4" /> Set up new site
            </Button>
            <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" /> Add Tenant</Button>
          </div>
        ) : undefined} />

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="directory">Hierarchy ({tenants.length})</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="setup" className="gap-1.5"><Rocket className="w-3.5 h-3.5" /> Set up new site</TabsTrigger>}
        </TabsList>

        {isSuperAdmin && <TabsContent value="setup">
          <div className="rounded-xl border border-border p-4 md:p-5">
            <p className="text-sm text-muted-foreground mb-4">
              Guided setup for a brand new factory site — organization details, cameras, floor areas,
              AI spend cap and team invites. The site appears in the hierarchy as soon as you finish.
            </p>
            <Onboarding embedded />
          </div>
        </TabsContent>}

        <TabsContent value="directory" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { label: "Total Sites", value: tenants.length, sub: `${activeCount} active` },
              { label: "Sub-sites", value: tenants.filter((t) => t.parent_id).length, sub: `${maxDepth} level${maxDepth === 1 ? "" : "s"} deep` },
              { label: "Cameras Deployed", value: totalCameras, sub: "Across all sites" },
              { label: "Quality Defects", value: totalDefects, sub: "All time, all sites" },
              { label: "Platform Users", value: totalUsers, sub: "All members" },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl p-4 border border-border">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search sites…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-background border-border" />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}>Expand all</Button>
            <Button variant="ghost" size="sm"
              onClick={() => setCollapsed(new Set(tenants.filter((t) => tenants.some((c) => c.parent_id === t.id)).map((t) => t.id)))}>
              Collapse all
            </Button>
          </div>

          <div className="glass rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Site</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Cameras</TableHead>
                  <TableHead className="text-right">Defects</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading sites…
                  </TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    {tenants.length === 0
                      ? <>No sites yet. Click <span className="text-foreground">Add Tenant</span> to create the first one.</>
                      : "No sites match your search."}
                  </TableCell></TableRow>
                ) : rows.map(({ tenant, depth, children }) => {
                  const cams = rollup(tenants, tenant.id, cameraCounts);
                  const defects = rollup(tenants, tenant.id, defectCounts);
                  const users = rollup(tenants, tenant.id, memberCounts);
                  const hasChildren = children.length > 0;
                  const isOpen = !collapsed.has(tenant.id) || !!search.trim();
                  return (
                    <TableRow key={tenant.id} className="border-border cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => navigate(`/admin/tenants/${tenant.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-2" style={{ paddingLeft: depth * 22 }}>
                          {hasChildren ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggle(tenant.id); }}
                              aria-label={isOpen ? `Collapse ${tenant.name}` : `Expand ${tenant.name}`}
                              className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground"
                            >
                              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          ) : <span className="w-6" />}
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center",
                            depth === 0 ? "bg-secondary" : "bg-accent")}>
                            {depth === 0
                              ? <Building2 className="w-4 h-4 text-muted-foreground" />
                              : <Factory className="w-4 h-4 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground flex items-center gap-2">
                              {tenant.name}
                              {hasChildren && (
                                <Badge variant="outline" className="text-[10px] border-border gap-1">
                                  <GitBranch className="w-3 h-3" /> {children.length} sub-site{children.length === 1 ? "" : "s"}
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {depth > 0 ? tenantPath(tenants, tenant.id) : tenant.slug}
                              {tenant.industry ? ` · ${tenant.industry}` : ""}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs font-mono border-border">{planLabels[tenant.plan] ?? tenant.plan}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={cn("text-xs capitalize", statusColors[tenant.status])}>{tenant.status}</Badge></TableCell>
                      <TableCell className="text-right text-sm text-foreground">
                        {cams.own}
                        {cams.total !== cams.own && <span className="text-xs text-muted-foreground"> / {cams.total}</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm text-foreground">
                        {defects.own}
                        {defects.total !== defects.own && <span className="text-xs text-muted-foreground"> / {defects.total}</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm text-foreground">
                        {users.own}
                        {users.total !== users.own && <span className="text-xs text-muted-foreground"> / {users.total}</span>}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${tenant.name}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/tenants/${tenant.id}`); }}>
                              <ArrowUpRight className="w-4 h-4 mr-2" /> Open site
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => openEdit(tenant, e as never)}><Pencil className="w-4 h-4 mr-2" /> Edit / move</DropdownMenuItem>
                            {isSuperAdmin && <DropdownMenuItem onClick={(e) => openAddSub(tenant, e as never)}><GitBranch className="w-4 h-4 mr-2" /> Add sub-site</DropdownMenuItem>}
                            {isSuperAdmin && <DropdownMenuSeparator />}
                            {isSuperAdmin && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleSuspend(tenant); }}
                              className={tenant.status === "suspended" ? "text-primary" : "text-destructive"}>
                              {tenant.status === "suspended"
                                ? <><RotateCcw className="w-4 h-4 mr-2" /> Reactivate</>
                                : <><Ban className="w-4 h-4 mr-2" /> Suspend</>}
                            </DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Counts show this site's own total, then the rolled-up total including every sub-site.
          </p>
        </TabsContent>
      </Tabs>

      <TenantForm
        key={editingTenant?.id ?? parentForSubTenant?.id ?? "new"}
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) { setEditingTenant(null); setParentForSubTenant(null); } }}
        tenant={editingTenant}
        parentTenant={parentForSubTenant}
        allTenants={tenants}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
};

export default Tenants;
