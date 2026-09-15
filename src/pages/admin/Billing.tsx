import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { auditLog } from "@/lib/audit";
import { cn } from "@/lib/utils";

type PlanKey = "starter" | "professional" | "enterprise";
type TenantStatus = "active" | "trial" | "suspended";

const RATE_CARD: Record<PlanKey, { base: number; perCamera: number; label: string; allowance: string }> = {
  starter: { base: 0, perCamera: 15, label: "Starter", allowance: "Up to 5 cameras" },
  professional: { base: 499, perCamera: 25, label: "Professional", allowance: "Up to 50 cameras" },
  enterprise: { base: 1499, perCamera: 40, label: "Enterprise", allowance: "Unlimited cameras" },
};

const PLAN_KEYS = Object.keys(RATE_CARD) as PlanKey[];
const STATUSES: TenantStatus[] = ["active", "trial", "suspended"];
const rateFor = (plan: string) => RATE_CARD[plan as PlanKey] ?? RATE_CARD.starter;
const estimatedCharge = (plan: string, status: string, cameras: number) => {
  if (status !== "active") return 0;
  const rate = rateFor(plan);
  return rate.base + cameras * rate.perCamera;
};

interface TenantBilling {
  id: string;
  name: string;
  plan: PlanKey;
  status: TenantStatus;
  cameras: number;
  members: number;
  estimatedMonthly: number;
}

const statusColors: Record<TenantStatus, string> = {
  active: "bg-success/10 text-[hsl(var(--success))] border-success/20",
  trial: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20",
  suspended: "bg-destructive/10 text-destructive border-destructive/20",
};

const money = (amount: number) => `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const Billing = () => {
  const [rows, setRows] = useState<TenantBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<TenantBilling | null>(null);
  const [draftPlan, setDraftPlan] = useState<PlanKey>("starter");
  const [draftStatus, setDraftStatus] = useState<TenantStatus>("trial");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const tenantRes = await supabase
      .from("tenants")
      .select("id,name,plan,status")
      .order("name", { ascending: true });

    if (tenantRes.error) {
      setRows([]);
      setLoadError(tenantRes.error.message);
      setLoading(false);
      return;
    }

    const tenants = tenantRes.data ?? [];
    const usage = await Promise.all(
      tenants.map(async (tenant) => {
        const [cameraRes, memberRes] = await Promise.all([
          supabase.from("cameras").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
          supabase.from("tenant_members").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
        ]);
        return { tenant, cameraRes, memberRes };
      }),
    );

    const failedCounts = usage.some(({ cameraRes, memberRes }) => cameraRes.error || memberRes.error);
    if (failedCounts) setLoadError("Some usage counts could not be loaded. Estimated charges may be incomplete.");

    setRows(usage.map(({ tenant, cameraRes, memberRes }) => {
      const cameras = cameraRes.count ?? 0;
      const plan = (PLAN_KEYS.includes(tenant.plan as PlanKey) ? tenant.plan : "starter") as PlanKey;
      const status = (STATUSES.includes(tenant.status as TenantStatus) ? tenant.status : "suspended") as TenantStatus;
      return {
        id: tenant.id,
        name: tenant.name,
        plan,
        status,
        cameras,
        members: memberRes.count ?? 0,
        estimatedMonthly: estimatedCharge(plan, status, cameras),
      };
    }));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openManager = (row: TenantBilling) => {
    setSelected(row);
    setDraftPlan(row.plan);
    setDraftStatus(row.status);
  };

  const savePlan = async () => {
    if (!selected) return;
    if (draftPlan === selected.plan && draftStatus === selected.status) {
      setSelected(null);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({ plan: draftPlan, status: draftStatus })
      .eq("id", selected.id);
    if (error) {
      setSaving(false);
      toast.error("Plan update failed", { description: error.message });
      return;
    }
    await auditLog({
      tenantId: selected.id,
      action: "tenant.billing_plan.updated",
      entityType: "tenant",
      entityId: selected.id,
      metadata: {
        previous_plan: selected.plan,
        plan: draftPlan,
        previous_status: selected.status,
        status: draftStatus,
      },
    });
    setSaving(false);
    setSelected(null);
    toast.success(`${selected.name} updated`);
    await load();
  };

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => (
      (!term || row.name.toLowerCase().includes(term))
      && (planFilter === "all" || row.plan === planFilter)
      && (statusFilter === "all" || row.status === statusFilter)
    ));
  }, [rows, query, planFilter, statusFilter]);

  const totalEstimate = rows.reduce((sum, row) => sum + row.estimatedMonthly, 0);
  const activeSubscriptions = rows.filter((row) => row.status === "active").length;
  const totalCameras = rows.reduce((sum, row) => sum + row.cameras, 0);
  const totalMembers = rows.reduce((sum, row) => sum + row.members, 0);
  const draftEstimate = selected ? estimatedCharge(draftPlan, draftStatus, selected.cameras) : 0;
  const filtersActive = query || planFilter !== "all" || statusFilter !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Commercial operations"
        icon={CreditCard}
        title="Billing & Plans"
        description="Review subscription status, current usage, and estimated monthly platform charges."
        actions={
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        }
      />

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="font-medium text-foreground">Planning estimates, not collected revenue</p>
          <p className="mt-0.5 text-muted-foreground">
            Charges use the current plan and camera count. Payment collection, tax, credits, invoices, and historical revenue are not connected here.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{loadError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={load}>Try again</Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Estimated monthly charges", value: money(totalEstimate), icon: DollarSign, sub: `${activeSubscriptions} active subscriptions` },
          { label: "Active subscriptions", value: activeSubscriptions.toLocaleString(), icon: CheckCircle2, sub: `${rows.length} accessible tenants` },
          { label: "Cameras provisioned", value: totalCameras.toLocaleString(), icon: Camera, sub: "Current billable usage input" },
          { label: "Seats provisioned", value: totalMembers.toLocaleString(), icon: Users, sub: "Informational, not charged" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <stat.icon className="h-4 w-4 shrink-0 text-primary" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground">{loading ? "—" : stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Rate card</h2>
          <p className="text-xs text-muted-foreground">The active pricing rules used by the estimates below.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PLAN_KEYS.map((key) => {
            const rate = RATE_CARD[key];
            const count = rows.filter((row) => row.plan === key).length;
            return (
              <div key={key} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{rate.label}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{rate.allowance}</p>
                  </div>
                  <Badge variant="outline">{count} {count === 1 ? "tenant" : "tenants"}</Badge>
                </div>
                <div className="mt-4 flex items-baseline gap-1 text-sm">
                  <span className="text-xl font-bold tabular-nums">{money(rate.base)}</span>
                  <span className="text-muted-foreground">base + {money(rate.perCamera)}/camera/month</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Tenant subscriptions</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Open a tenant to change its plan or lifecycle status.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(220px,1fr)_160px_160px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tenants" className="pl-9" aria-label="Search tenants" />
              </div>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger aria-label="Filter by plan"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  {PLAN_KEYS.map((key) => <SelectItem key={key} value={key}>{RATE_CARD[key].label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map((status) => <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading subscriptions…
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center">
            <CreditCard className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">{filtersActive ? "No subscriptions match these filters" : "No tenants found"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{filtersActive ? "Clear the filters to see all accessible tenants." : "Tenant subscriptions appear here after onboarding."}</p>
            {filtersActive && <Button variant="link" className="mt-2" onClick={() => { setQuery(""); setPlanFilter("all"); setStatusFilter("all"); }}>Clear filters</Button>}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Tenant</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Cameras</TableHead>
                    <TableHead className="text-right">Seats</TableHead>
                    <TableHead className="text-right">Estimated monthly</TableHead>
                    <TableHead><span className="sr-only">Manage</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.id} className="group cursor-pointer" onClick={() => openManager(row)}>
                      <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                      <TableCell>{RATE_CARD[row.plan].label}</TableCell>
                      <TableCell><Badge variant="outline" className={cn("capitalize", statusColors[row.status])}>{row.status}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{row.cameras}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.members}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{money(row.estimatedMonthly)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); openManager(row); }}>
                          <Settings2 className="mr-2 h-4 w-4" /> Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {filteredRows.map((row) => (
                <button key={row.id} type="button" onClick={() => openManager(row)} className="w-full p-4 text-left transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{RATE_CARD[row.plan].label} · {row.cameras} cameras · {row.members} seats</p>
                    </div>
                    <Badge variant="outline" className={cn("shrink-0 capitalize", statusColors[row.status])}>{row.status}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                    <span className="text-muted-foreground">Estimated monthly</span>
                    <span className="font-semibold tabular-nums text-foreground">{money(row.estimatedMonthly)}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open && !saving) setSelected(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage subscription</DialogTitle>
            <DialogDescription>{selected?.name}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="billing-plan">Plan</Label>
                  <Select value={draftPlan} onValueChange={(value) => setDraftPlan(value as PlanKey)} disabled={saving}>
                    <SelectTrigger id="billing-plan"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLAN_KEYS.map((key) => <SelectItem key={key} value={key}>{RATE_CARD[key].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing-status">Subscription status</Label>
                  <Select value={draftStatus} onValueChange={(value) => setDraftStatus(value as TenantStatus)} disabled={saving}>
                    <SelectTrigger id="billing-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((status) => <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Base fee</span>
                  <span className="text-sm font-medium tabular-nums">{money(RATE_CARD[draftPlan].base)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">{selected.cameras} cameras × {money(RATE_CARD[draftPlan].perCamera)}</span>
                  <span className="text-sm font-medium tabular-nums">{money(selected.cameras * RATE_CARD[draftPlan].perCamera)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-4 border-t border-border pt-3">
                  <span className="text-sm font-semibold text-foreground">Estimated monthly charge</span>
                  <span className="text-lg font-bold tabular-nums text-foreground">{money(draftEstimate)}</span>
                </div>
                {draftStatus !== "active" && <p className="mt-2 text-xs text-muted-foreground">Trial and suspended tenants are treated as non-billable in this estimate.</p>}
              </div>

              {draftStatus === "suspended" && selected.status !== "suspended" && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p>Suspending this tenant may prevent its users from operating the site. Confirm this is intentional.</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={saving}>Cancel</Button>
            <Button onClick={savePlan} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings2 className="mr-2 h-4 w-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Billing;