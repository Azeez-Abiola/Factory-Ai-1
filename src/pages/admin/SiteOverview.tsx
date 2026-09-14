import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, RefreshCw, Loader2, AlertTriangle, Camera as CameraIcon, Wallet, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { complianceScore, isRealChangeAlert } from "@/lib/gatedMetrics";
import { cn } from "@/lib/utils";

interface SiteStats {
  id: string;
  name: string;
  plan: string;
  status: string;
  spend: number;
  limit: number;
  pctBudget: number;
  analyzedFrames: number;
  openAlerts: number;
  criticalAlerts: number;
  compliance: number;
  camerasTotal: number;
  camerasOnline: number;
}

const OPEN_STATUSES = ["open", "new", "active", "acknowledged", "assigned"];
const money = (n: number) => `$${n.toFixed(2)}`;

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

const SiteOverview = () => {
  const { tenants, activeTenantId, setActiveTenantId, loading: tenantsLoading } = useTenants();
  const navigate = useNavigate();
  const [sites, setSites] = useState<SiteStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (tenants.length === 0) { setSites([]); setLoading(false); return; }
    setLoading(true);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const ids = tenants.map((t) => t.id);

    const [usage, budgets, alerts, cameras] = await Promise.all([
      supabase.from("ai_usage_events")
        .select("tenant_id,cost_usd,scene_changed,created_at")
        .in("tenant_id", ids)
        .gte("created_at", monthStart())
        .limit(20000),
      supabase.from("tenant_ai_budgets").select("tenant_id,monthly_limit_usd").in("tenant_id", ids),
      supabase.from("alerts")
        .select("tenant_id,severity,status,metadata,detected_at")
        .in("tenant_id", ids)
        .gte("detected_at", since)
        .limit(5000),
      supabase.from("cameras")
        .select("tenant_id,status,last_seen_at,heartbeat_interval_seconds")
        .in("tenant_id", ids),
    ]);

    const rows: SiteStats[] = tenants.map((t) => {
      const u = (usage.data ?? []).filter((r: any) => r.tenant_id === t.id);
      const spend = u.reduce((s: number, r: any) => s + Number(r.cost_usd ?? 0), 0);
      const analyzedFrames = u.filter((r: any) => r.scene_changed).length;
      const limit = Number(
        (budgets.data ?? []).find((b: any) => b.tenant_id === t.id)?.monthly_limit_usd ?? 50,
      );

      const a = (alerts.data ?? []).filter((r: any) => r.tenant_id === t.id);
      const real = a.filter((r: any) => isRealChangeAlert(r.metadata));
      const violations = real.filter((r: any) => r.severity === "critical" || r.severity === "high").length;

      const cams = (cameras.data ?? []).filter((r: any) => r.tenant_id === t.id);
      const online = cams.filter((r: any) => {
        if (r.status === "maintenance" || r.status === "offline") return false;
        const beat = (r.heartbeat_interval_seconds ?? 60) * 3 * 1000;
        const seen = r.last_seen_at ? new Date(r.last_seen_at).getTime() : 0;
        return seen > 0 && Date.now() - seen < beat;
      }).length;

      return {
        id: t.id,
        name: t.name,
        plan: t.plan,
        status: t.status,
        spend,
        limit,
        pctBudget: limit > 0 ? (spend / limit) * 100 : 0,
        analyzedFrames,
        openAlerts: a.filter((r: any) => OPEN_STATUSES.includes(r.status)).length,
        criticalAlerts: a.filter((r: any) => r.severity === "critical").length,
        compliance: complianceScore(analyzedFrames, violations, real.length),
        camerasTotal: cams.length,
        camerasOnline: online,
      };
    });

    setSites(rows.sort((x, y) => y.spend - x.spend));
    setLoading(false);
  }, [tenants]);

  useEffect(() => { if (!tenantsLoading) load(); }, [tenantsLoading, load]);

  const filtered = useMemo(
    () => sites.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())),
    [sites, query],
  );

  const totals = useMemo(() => ({
    spend: sites.reduce((s, r) => s + r.spend, 0),
    limit: sites.reduce((s, r) => s + r.limit, 0),
    alerts: sites.reduce((s, r) => s + r.openAlerts, 0),
    cameras: sites.reduce((s, r) => s + r.camerasTotal, 0),
    online: sites.reduce((s, r) => s + r.camerasOnline, 0),
  }), [sites]);

  const openSite = (id: string) => {
    setActiveTenantId(id);
    navigate(`/admin/tenants/${id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site Overview"
        description="Every factory site's own AI spend, alert load and compliance — side by side."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Building2} label="Sites" value={String(sites.length)} sub={`${totals.alerts} open alerts`} />
        <SummaryCard icon={Wallet} label="AI spend this month" value={money(totals.spend)} sub={`of ${money(totals.limit)} combined cap`} />
        <SummaryCard icon={CameraIcon} label="Cameras online" value={`${totals.online}/${totals.cameras}`} sub="across all sites" />
        <SummaryCard
          icon={ShieldCheck}
          label="Weakest compliance"
          value={sites.length ? `${Math.min(...sites.map((s) => s.compliance)).toFixed(1)}%` : "—"}
          sub={sites.length ? sites.reduce((a, b) => (a.compliance <= b.compliance ? a : b)).name : "no sites yet"}
        />
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search sites…"
        className="max-w-xs"
        aria-label="Search sites"
      />

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading site metrics…
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No sites match this search.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((s) => {
            const budgetState = s.pctBudget >= 100 ? "over" : s.pctBudget >= 80 ? "near" : "ok";
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => openSite(s.id)}
                className={cn(
                  "rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/50 hover:bg-accent/40",
                  s.id === activeTenantId && "border-primary/60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{s.plan} · {s.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.criticalAlerts > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> {s.criticalAlerts} critical
                      </Badge>
                    )}
                    <Badge variant="outline">{s.camerasOnline}/{s.camerasTotal} cameras</Badge>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <Metric label="AI spend" value={money(s.spend)} />
                  <Metric label="Frames analysed" value={s.analyzedFrames.toLocaleString()} />
                  <Metric label="Compliance" value={`${s.compliance.toFixed(1)}%`} />
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Budget used</span>
                    <span className={cn(
                      budgetState === "over" && "text-destructive",
                      budgetState === "near" && "text-amber-500",
                    )}>
                      {s.pctBudget.toFixed(0)}% of {money(s.limit)}
                    </span>
                  </div>
                  <Progress value={Math.min(100, s.pctBudget)} className="h-1.5" />
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  {s.openAlerts} open alerts in the last 7 days
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ icon: Icon, label, value, sub }: { icon: typeof Building2; label: string; value: string; sub: string }) => (
  <div className="rounded-xl border bg-card p-4">
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
    <p className="mt-2 text-2xl font-semibold">{value}</p>
    <p className="text-xs text-muted-foreground">{sub}</p>
  </div>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-semibold">{value}</p>
  </div>
);

export default SiteOverview;
