import { useParams, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2, ArrowLeft, Pencil, GitBranch, Ban, RotateCcw, Calendar, Mail, MapPin,
  Shield, Users, Camera, LayoutPanelTop, DollarSign, Globe, Loader2, AlertTriangle, PackageSearch,
  Wallet, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import TenantForm, { type TenantFormValues } from "@/components/admin/TenantForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { auditLog } from "@/lib/audit";
import type { TenantRow } from "@/hooks/useTenants";
import { tenantPath, descendantIds } from "@/lib/tenantTree";

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

interface Metrics {
  cameras: number;
  camerasOnline: number;
  users: number;
  zones: number;
  alerts24h: number;
  openAlerts: number;
  defects: number;
  spend: number;
  budget: number;
}

const EMPTY: Metrics = {
  cameras: 0, camerasOnline: 0, users: 0, zones: 0,
  alerts24h: 0, openAlerts: 0, defects: 0, spend: 0, budget: 50,
};

const TenantDetail = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantRow | null>(null);
  const [parentForSubTenant, setParentForSubTenant] = useState<TenantRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("tenants").select("*").order("created_at", { ascending: true });
    if (error) {
      toast.error("Failed to load sites: " + error.message);
      setTenants([]);
      setLoading(false);
      return;
    }
    setTenants((data ?? []) as TenantRow[]);

    if (tenantId) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [cams, members, zones, alerts, usage, budget] = await Promise.all([
        supabase.from("cameras").select("id,status").eq("tenant_id", tenantId),
        supabase.from("tenant_members").select("id").eq("tenant_id", tenantId),
        supabase.from("site_zones").select("id").eq("tenant_id", tenantId),
        supabase.from("alerts").select("type,title,status,detected_at").eq("tenant_id", tenantId).limit(5000),
        supabase.from("ai_usage_events").select("cost_usd").eq("tenant_id", tenantId).gte("created_at", monthStart),
        supabase.from("tenant_ai_budgets").select("monthly_limit_usd").eq("tenant_id", tenantId).maybeSingle(),
      ]);
      const alertRows = (alerts.data ?? []) as { type: string | null; title: string | null; status: string; detected_at: string }[];
      setMetrics({
        cameras: cams.data?.length ?? 0,
        camerasOnline: (cams.data ?? []).filter((c: { status: string }) => c.status === "online").length,
        users: members.data?.length ?? 0,
        zones: zones.data?.length ?? 0,
        alerts24h: alertRows.filter((a) => a.detected_at >= since).length,
        openAlerts: alertRows.filter((a) => ["open", "new", "active"].includes(a.status)).length,
        defects: alertRows.filter((a) => isQualityDefect(a.type ?? "", a.title ?? "")).length,
        spend: (usage.data ?? []).reduce((s: number, r: { cost_usd: number | string }) => s + Number(r.cost_usd || 0), 0),
        budget: Number(budget.data?.monthly_limit_usd ?? 50),
      });
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const tenant = useMemo(() => tenants.find((t) => t.id === tenantId) ?? null, [tenants, tenantId]);
  const subTenants = useMemo(() => tenants.filter((t) => t.parent_id === tenantId), [tenants, tenantId]);
  const parent = useMemo(
    () => (tenant?.parent_id ? tenants.find((t) => t.id === tenant.parent_id) ?? null : null),
    [tenant, tenants],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading site…
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Site not found</h2>
        <p className="text-muted-foreground mb-6">
          This site no longer exists, or your account doesn't have access to it.
        </p>
        <Button onClick={() => navigate("/admin")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sites &amp; Tenants
        </Button>
      </div>
    );
  }

  const handleToggleSuspend = async () => {
    const newStatus = tenant.status === "suspended" ? "active" : "suspended";
    const { error } = await supabase.from("tenants").update({ status: newStatus }).eq("id", tenant.id);
    if (error) { toast.error(error.message); return; }
    await auditLog({
      tenantId: tenant.id,
      action: `tenant.${newStatus === "suspended" ? "suspend" : "reactivate"}`,
      entityType: "tenant",
      entityId: tenant.id,
    });
    toast.success(`${tenant.name} ${newStatus === "suspended" ? "suspended" : "reactivated"}`);
    await load();
  };

  const openEdit = () => { setEditingTenant(tenant); setParentForSubTenant(null); setFormOpen(true); };
  const openAddSubTenant = () => { setEditingTenant(null); setParentForSubTenant(tenant); setFormOpen(true); };

  const handleFormSubmit = async (data: TenantFormValues & { parent_id?: string | null; id?: string }) => {
    const payload = {
      name: data.name, slug: data.slug, industry: data.industry || null,
      plan: data.plan, status: data.status, contact_email: data.contact_email || null,
      contact_phone: data.contact_phone || null, address: data.address || null,
      timezone: data.timezone || "UTC", parent_id: data.parent_id ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("tenants").update(payload).eq("id", data.id);
      if (error) { toast.error("Update failed: " + error.message); return; }
      await auditLog({ tenantId: data.id, action: "tenant.update", entityType: "tenant", entityId: data.id, metadata: { name: data.name } });
      toast.success(`${data.name} updated`);
    } else {
      const { data: created, error } = await supabase
        .from("tenants").insert({ ...payload, created_by: user?.id ?? null }).select().single();
      if (error) { toast.error("Create failed: " + error.message); return; }
      if (user?.id && created) {
        await supabase.from("tenant_members").insert({ tenant_id: created.id, user_id: user.id, role: "owner" });
      }
      await auditLog({ tenantId: created?.id, action: "tenant.create", entityType: "tenant", entityId: created?.id, metadata: { name: data.name, parent_id: data.parent_id } });
      toast.success(`Sub-site "${data.name}" created`);
    }
    setFormOpen(false);
    setEditingTenant(null);
    setParentForSubTenant(null);
    await load();
  };

  const rolledUp = descendantIds(tenants, tenant.id).length;
  const budgetPct = metrics.budget > 0 ? (metrics.spend / metrics.budget) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit -ml-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/admin")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sites &amp; Tenants
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{tenant.name}</h1>
              <p className="text-xs text-muted-foreground mt-1">{tenantPath(tenants, tenant.id)}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge variant="outline" className={cn("text-xs capitalize", statusColors[tenant.status])}>
                  {tenant.status}
                </Badge>
                <Badge variant="outline" className="text-xs font-mono border-border">
                  {planLabels[tenant.plan] ?? tenant.plan}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{tenant.slug}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button variant="outline" size="sm" className="border-border" onClick={openEdit}>
              <Pencil className="w-4 h-4 mr-2" /> Edit site
            </Button>
            <Button variant="outline" size="sm" className="border-border" onClick={openAddSubTenant}>
              <GitBranch className="w-4 h-4 mr-2" /> Add sub-site
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn("border-border", tenant.status !== "suspended" ? "text-destructive hover:bg-destructive/10" : "text-success hover:bg-success/10")}
              onClick={handleToggleSuspend}
            >
              {tenant.status === "suspended"
                ? <><RotateCcw className="w-4 h-4 mr-2" /> Reactivate</>
                : <><Ban className="w-4 h-4 mr-2" /> Suspend site</>}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Organization profile
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 sm:grid-cols-2">
                {[
                  { icon: Building2, label: "Industry", value: tenant.industry || "—" },
                  { icon: MapPin, label: "Address", value: tenant.address || "—" },
                  { icon: Mail, label: "Contact email", value: tenant.contact_email || "—" },
                  { icon: Calendar, label: "Created", value: new Date(tenant.created_at).toLocaleDateString() },
                  { icon: Globe, label: "Parent site", value: parent?.name ?? "None (top-level)" },
                  { icon: DollarSign, label: "AI spend this month", value: `$${metrics.spend.toFixed(2)}` },
                ].map((item, i) => (
                  <div key={i} className="p-4 border-b border-r border-border last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <item.icon className="w-3.5 h-3.5" />
                      {item.label}
                    </div>
                    <p className="text-sm font-medium text-foreground break-words">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Camera, label: "Cameras", value: metrics.cameras, sub: `${metrics.camerasOnline} online` },
              { icon: Users, label: "Users", value: metrics.users, sub: "Team members" },
              { icon: LayoutPanelTop, label: "Zones", value: metrics.zones, sub: "Mapped floor areas" },
              { icon: AlertTriangle, label: "Alerts (24h)", value: metrics.alerts24h, sub: `${metrics.openAlerts} still open` },
              { icon: PackageSearch, label: "Quality defects", value: metrics.defects, sub: "All time" },
              { icon: GitBranch, label: "Sub-sites", value: subTenants.length, sub: `${rolledUp} below in total` },
            ].map((metric, i) => (
              <Card key={i} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <metric.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">{metric.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{metric.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{metric.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary" /> Sub-sites
                </div>
                <Badge variant="outline" className="text-[10px]">{subTenants.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subTenants.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-border rounded-xl">
                  <p className="text-sm text-muted-foreground italic">No sub-sites under this organization yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {subTenants.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/tenants/${sub.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                          <GitBranch className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{sub.name}</p>
                          <p className="text-xs text-muted-foreground">{sub.industry || sub.slug}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] capitalize", statusColors[sub.status])}>
                        {sub.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border bg-muted/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Activity summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Alerts triggered (24h)</span>
                  <span className="text-foreground font-medium tabular-nums">{metrics.alerts24h}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Open alerts</span>
                  <span className="text-foreground font-medium tabular-nums">{metrics.openAlerts}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Cameras offline</span>
                  <span className="text-foreground font-medium tabular-nums">{metrics.cameras - metrics.camerasOnline}</span>
                </div>
              </div>
              <Button className="w-full text-xs h-8 bg-primary/10 text-primary hover:bg-primary/20 border-none" onClick={() => navigate("/admin/audit-log")}>
                View full audit trail
              </Button>
            </CardContent>
          </Card>

          <Card
            className="border-border border-l-4"
            style={{ borderColor: tenant.plan === "enterprise" ? "hsl(var(--primary))" : tenant.plan === "professional" ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))" }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Current plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-lg py-1 px-4 border-border font-bold">
                  {planLabels[tenant.plan] ?? tenant.plan}
                </Badge>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Timezone</p>
                  <p className="text-sm font-medium text-foreground">{tenant.timezone || "UTC"}</p>
                </div>
              </div>
              <Button variant="outline" className="w-full text-xs h-8" onClick={() => navigate("/admin/billing")}>
                View billing & revenue
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" /> AI Budget
              </CardTitle>
              <Badge variant={budgetPct >= 100 ? "destructive" : budgetPct >= 80 ? "secondary" : "outline"} className="text-[10px]">
                {budgetPct.toFixed(0)}% used
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Spent this month</span>
                  <span className="text-foreground font-medium tabular-nums">${metrics.spend.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Monthly limit</span>
                  <span className="text-foreground font-medium tabular-nums">${metrics.budget}</span>
                </div>
                <Progress value={Math.min(100, budgetPct)} className="h-1.5" />
              </div>
              <Button 
                variant="secondary" 
                className="w-full text-xs h-8 gap-2" 
                onClick={() => navigate(`/admin/ai-budget/${tenant.id}`)}
              >
                Manage AI budget <ExternalLink className="w-3 h-3" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {formOpen && (
        <TenantForm
          open={formOpen}
          onOpenChange={setFormOpen}
          tenant={editingTenant}
          parentTenant={parentForSubTenant}
          allTenants={tenants}
          onSubmit={handleFormSubmit}
        />
      )}
    </div>
  );
};

export default TenantDetail;
