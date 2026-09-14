import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck, Bell, Camera as CameraIcon, Wallet, RefreshCw, Loader2,
  TrendingUp, ArrowRight, Gauge,
} from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { complianceScore, isRealChangeAlert } from "@/lib/gatedMetrics";
import { cn } from "@/lib/utils";

const OPEN_STATUSES = ["open", "new", "active", "acknowledged", "assigned"];
const money = (n: number) => `$${n.toFixed(2)}`;
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

interface AlertRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  detected_at: string;
  zone: string | null;
  metadata: unknown;
}

interface KpiRow {
  id: string;
  name: string;
  unit: string;
  target: number;
  current_value: number;
  warning_threshold: number;
  critical_threshold: number;
  direction: string;
  category: string;
}

const PortalOverview = () => {
  const { activeTenant, activeTenantId, loading: tenantsLoading } = useTenants();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [spend, setSpend] = useState(0);
  const [budgetLimit, setBudgetLimit] = useState(50);
  const [analyzedFrames, setAnalyzedFrames] = useState(0);
  const [cameras, setCameras] = useState<{ status: string; last_seen_at: string | null; heartbeat_interval_seconds: number | null }[]>([]);

  const load = useCallback(async () => {
    if (!activeTenantId) { setLoading(false); return; }
    setLoading(true);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [alertsRes, kpiRes, usageRes, budgetRes, camRes] = await Promise.all([
      supabase.from("alerts")
        .select("id,title,severity,status,detected_at,zone,metadata")
        .eq("tenant_id", activeTenantId)
        .gte("detected_at", since)
        .order("detected_at", { ascending: false })
        .limit(500),
      supabase.from("tenant_kpis")
        .select("id,name,unit,target,current_value,warning_threshold,critical_threshold,direction,category")
        .eq("tenant_id", activeTenantId)
        .eq("enabled", true)
        .order("name"),
      supabase.from("ai_usage_events")
        .select("cost_usd,scene_changed")
        .eq("tenant_id", activeTenantId)
        .gte("created_at", monthStart())
        .limit(20000),
      supabase.from("tenant_ai_budgets")
        .select("monthly_limit_usd")
        .eq("tenant_id", activeTenantId)
        .maybeSingle(),
      supabase.from("cameras")
        .select("status,last_seen_at,heartbeat_interval_seconds")
        .eq("tenant_id", activeTenantId),
    ]);

    setAlerts((alertsRes.data ?? []) as AlertRow[]);
    setKpis((kpiRes.data ?? []) as KpiRow[]);
    const usage = usageRes.data ?? [];
    setSpend(usage.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0));
    setAnalyzedFrames(usage.filter((r) => r.scene_changed).length);
    setBudgetLimit(Number(budgetRes.data?.monthly_limit_usd ?? 50));
    setCameras(camRes.data ?? []);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => { if (!tenantsLoading) load(); }, [tenantsLoading, load]);

  useEffect(() => {
    if (!activeTenantId) return;
    const channel = supabase
      .channel(`portal-overview:${activeTenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `tenant_id=eq.${activeTenantId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTenantId, load]);

  const stats = useMemo(() => {
    const real = alerts.filter((a) => isRealChangeAlert(a.metadata));
    const violations = real.filter((a) => a.severity === "critical" || a.severity === "high").length;
    const online = cameras.filter((c) => {
      if (c.status === "maintenance" || c.status === "offline") return false;
      const beat = (c.heartbeat_interval_seconds ?? 60) * 3 * 1000;
      const seen = c.last_seen_at ? new Date(c.last_seen_at).getTime() : 0;
      return seen > 0 && Date.now() - seen < beat;
    }).length;
    return {
      compliance: complianceScore(analyzedFrames, violations, real.length),
      open: alerts.filter((a) => OPEN_STATUSES.includes(a.status)).length,
      critical: alerts.filter((a) => a.severity === "critical").length,
      camerasOnline: online,
      camerasTotal: cameras.length,
      pctBudget: budgetLimit > 0 ? Math.min(100, (spend / budgetLimit) * 100) : 0,
    };
  }, [alerts, cameras, analyzedFrames, budgetLimit, spend]);

  const kpiState = (k: KpiRow) => {
    const worseWhenLower = k.direction === "higher_is_better" || k.direction === "up";
    const bad = worseWhenLower ? k.current_value <= k.critical_threshold : k.current_value >= k.critical_threshold;
    const warn = worseWhenLower ? k.current_value <= k.warning_threshold : k.current_value >= k.warning_threshold;
    if (bad) return { label: "Critical", cls: "bg-destructive/10 text-destructive border-destructive/20" };
    if (warn) return { label: "At risk", cls: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20" };
    return { label: "On track", cls: "bg-success/10 text-success border-success/20" };
  };

  if (tenantsLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeTenantId) {
    return (
      <Card className="p-10 text-center">
        <p className="text-muted-foreground">
          You are not attached to a site yet. Ask your administrator for an invitation.
        </p>
      </Card>
    );
  }

  const tiles = [
    { label: "Compliance score", value: `${stats.compliance}%`, icon: ShieldCheck, hint: `${analyzedFrames.toLocaleString()} frames analysed this month` },
    { label: "Open alerts", value: String(stats.open), icon: Bell, hint: `${stats.critical} critical in last 7 days` },
    { label: "Cameras online", value: `${stats.camerasOnline}/${stats.camerasTotal}`, icon: CameraIcon, hint: "Live heartbeat" },
    { label: "AI spend this month", value: money(spend), icon: Wallet, hint: `of ${money(budgetLimit)} cap` },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Manager portal"
        icon={Gauge}
        title={activeTenant?.name ?? "My site"}
        description="Your site's safety score, live alerts and AI spend — updated in real time."
        actions={
          <Button variant="outline" onClick={load} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase text-muted-foreground">{t.label}</div>
                <div className="font-display text-3xl font-bold mt-2">{t.value}</div>
                <div className="text-xs text-muted-foreground mt-1.5">{t.hint}</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <t.icon className="w-5 h-5 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold">Monthly AI budget</h2>
            <Badge variant="outline">{stats.pctBudget.toFixed(0)}% used</Badge>
          </div>
          <Progress value={stats.pctBudget} className="mt-4" />
          <div className="flex justify-between text-sm mt-3">
            <span className="text-muted-foreground">{money(spend)} spent</span>
            <span className="font-semibold">{money(Math.max(0, budgetLimit - spend))} left</span>
          </div>
          <Button asChild variant="outline" className="w-full mt-5 gap-2">
            <Link to="/portal/budget">Budget details <ArrowRight className="w-4 h-4" /></Link>
          </Button>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold">Performance scores</h2>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
          {kpis.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No performance targets configured for this site yet.
            </p>
          ) : (
            <div className="space-y-3">
              {kpis.slice(0, 6).map((k) => {
                const state = kpiState(k);
                return (
                  <div key={k.id} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{k.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{k.category}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display font-bold">{k.current_value}{k.unit}</div>
                      <div className="text-[11px] text-muted-foreground">Target {k.target}{k.unit}</div>
                    </div>
                    <Badge variant="outline" className={cn("shrink-0", state.cls)}>{state.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold">Recent alerts</h2>
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/portal/alerts">View all <ArrowRight className="w-4 h-4" /></Link>
          </Button>
        </div>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No alerts in the last 7 days.</p>
        ) : (
          <div className="divide-y divide-border">
            {alerts.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-3">
                <span className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  a.severity === "critical" ? "bg-destructive"
                    : a.severity === "high" ? "bg-[hsl(var(--warning))]" : "bg-primary",
                )} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.zone ? `${a.zone} · ` : ""}{new Date(a.detected_at).toLocaleString()}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize shrink-0">{a.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
};

export default PortalOverview;
