import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { Building2, ArrowLeft, Pencil, GitBranch, Ban, RotateCcw, Calendar, Mail, MapPin, Shield, Users, Camera, LayoutPanelTop, DollarSign, Globe } from "lucide-react";
import { mockTenants as initialTenants, type Tenant, type TenantStatus, type TenantPlan } from "@/data/adminMockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const TenantDetail = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [parentForSubTenant, setParentForSubTenant] = useState<Tenant | null>(null);

  const tenant = useMemo(() => {
    return tenants.find((t) => t.id === tenantId) || null;
  }, [tenantId, tenants]);

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Tenant Not Found</h2>
        <p className="text-muted-foreground mb-6">The tenant you're looking for doesn't exist.</p>
        <Button onClick={() => navigate("/admin")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Tenants
        </Button>
      </div>
    );
  }

  const subTenants = tenants.filter((t) => t.parentId === tenant.id);

  const handleToggleSuspend = () => {
    const newStatus: TenantStatus = tenant.status === "suspended" ? "active" : "suspended";
    setTenants((prev) =>
      prev.map((t) =>
        t.id === tenant.id
          ? { ...t, status: newStatus, mrr: newStatus === "suspended" ? 0 : t.mrr }
          : t
      )
    );
    toast.success(`${tenant.name} ${newStatus === "suspended" ? "suspended" : "reactivated"}`);
  };

  const openEdit = () => {
    setEditingTenant(tenant);
    setParentForSubTenant(null);
    setFormOpen(true);
  };

  const openAddSubTenant = () => {
    setEditingTenant(null);
    setParentForSubTenant(tenant);
    setFormOpen(true);
  };

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
    setFormOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit -ml-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/admin")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Tenants
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{tenant.name}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge variant="outline" className={cn("text-xs capitalize", statusColors[tenant.status])}>
                  {tenant.status}
                </Badge>
                <Badge variant="outline" className="text-xs font-mono border-border">
                  {planLabels[tenant.plan]}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{tenant.id}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button variant="outline" size="sm" className="border-border" onClick={openEdit}>
              <Pencil className="w-4 h-4 mr-2" /> Edit Tenant
            </Button>
            {!tenant.parentId && (
              <Button variant="outline" size="sm" className="border-border" onClick={openAddSubTenant}>
                <GitBranch className="w-4 h-4 mr-2" /> Add Sub-Tenant
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className={cn("border-border", tenant.status !== "suspended" ? "text-destructive hover:bg-destructive/10" : "text-success hover:bg-success/10")}
              onClick={handleToggleSuspend}
            >
              {tenant.status === "suspended" ? (
                <><RotateCcw className="w-4 h-4 mr-2" /> Reactivate</>
              ) : (
                <><Ban className="w-4 h-4 mr-2" /> Suspend Tenant</>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* General Information */}
          <Card className="border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Organization Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 sm:grid-cols-2">
                {[
                  { icon: Building2, label: "Industry", value: tenant.industry },
                  { icon: MapPin, label: "Region", value: tenant.region },
                  { icon: Mail, label: "Contact Email", value: tenant.contactEmail },
                  { icon: Calendar, label: "Created Date", value: new Date(tenant.createdAt).toLocaleDateString() },
                  { icon: Globe, label: "Parent Company", value: tenant.parentName ?? "None (Master Tenant)" },
                  { icon: DollarSign, label: "Monthly Revenue", value: tenant.mrr > 0 ? `$${tenant.mrr.toLocaleString()}` : "Trial Account" },
                ].map((item, i) => (
                  <div key={i} className="p-4 border-b border-r border-border last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <item.icon className="w-3.5 h-3.5" />
                      {item.label}
                    </div>
                    <p className="text-sm font-medium text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Usage Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Camera, label: "Cameras", value: tenant.cameras, sub: "Devices active" },
              { icon: Users, label: "Users", value: tenant.users, sub: "Team members" },
              { icon: LayoutPanelTop, label: "Zones", value: tenant.zones, sub: "Factory areas" },
            ].map((metric, i) => (
              <Card key={i} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <metric.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">{metric.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{metric.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Sub-Tenants Table */}
          {!tenant.parentId && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-primary" /> Sub-Tenants
                  </div>
                  <Badge variant="outline" className="text-[10px]">{subTenants.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {subTenants.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-border rounded-xl">
                    <p className="text-sm text-muted-foreground italic">No sub-tenants found for this organization.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {subTenants.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/admin/tenants/${sub.id}`)}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                            <GitBranch className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{sub.name}</p>
                            <p className="text-xs text-muted-foreground">{sub.region}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs font-medium text-foreground">{sub.cameras} Cameras</p>
                            <p className="text-[10px] text-muted-foreground">{sub.users} Users</p>
                          </div>
                          <Badge variant="outline" className={cn("text-[10px] capitalize", statusColors[sub.status])}>
                            {sub.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Quick Actions / Summary Card */}
          <Card className="border-border bg-muted/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Activity Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Recent Logins</span>
                  <span className="text-foreground font-medium">124 (24h)</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Alerts Triggered</span>
                  <span className="text-foreground font-medium">42 (24h)</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Downtime Incidents</span>
                  <span className="text-foreground font-medium">3</span>
                </div>
              </div>
              <Button className="w-full text-xs h-8 bg-primary/10 text-primary hover:bg-primary/20 border-none" onClick={() => navigate("/admin/audit-log")}>
                View Full Audit Trail
              </Button>
            </CardContent>
          </Card>

          {/* Plan Details */}
          <Card className="border-border border-l-4" style={{ borderColor: tenant.plan === 'enterprise' ? 'hsl(var(--primary))' : tenant.plan === 'professional' ? 'hsl(var(--warning))' : 'hsl(var(--muted-foreground))' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Current Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-lg py-1 px-4 border-border font-bold">
                  {planLabels[tenant.plan]}
                </Badge>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Renewal Date</p>
                  <p className="text-sm font-medium text-foreground">July 15, 2026</p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-border/50">
                {[
                  "Unlimited AI Detections",
                  "24/7 Priority Support",
                  "Standard Audit Retention (30 days)",
                  "Multi-factory Dashboard",
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-success" />
                    {feature}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <TenantForm
        key={editingTenant?.id ?? parentForSubTenant?.id ?? "detail-form"}
        open={formOpen}
        onOpenChange={setFormOpen}
        tenant={editingTenant}
        parentTenant={parentForSubTenant}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
};

// Helper component for checkmarks
const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="m9 11 3 3L22 4" />
  </svg>
);

export default TenantDetail;
