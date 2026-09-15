import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Wallet, Save, Loader2, AlertTriangle, Gauge, Camera, Sparkles, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import PageHeader from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { auditLog } from "@/lib/audit";
import { cn } from "@/lib/utils";

interface Budget {
  tenant_id: string;
  monthly_limit_usd: number;
  alert_threshold_pct: number;
  hard_stop: boolean;
  enabled: boolean;
}

interface UsageRow {
  id: string;
  camera_id: string | null;
  source: string;
  model: string | null;
  media: string;
  scene_changed: boolean;
  cost_usd: number;
  created_at: string;
}

const DEFAULTS = (tenantId: string): Budget => ({
  tenant_id: tenantId,
  monthly_limit_usd: 50,
  alert_threshold_pct: 80,
  hard_stop: true,
  enabled: true,
});

const money = (n: number) => `$${n.toFixed(2)}`;

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

const AIBudget = () => {
  const { tenantId: paramTenantId } = useParams();
  const { activeTenantId, activeTenant, tenants } = useTenants();
  
  const effectiveTenantId = paramTenantId || activeTenantId;
  const effectiveTenant = useMemo(() => 
    tenants.find(t => t.id === effectiveTenantId) || (effectiveTenantId === activeTenantId ? activeTenant : null),
    [tenants, effectiveTenantId, activeTenantId, activeTenant]
  );

  const [budget, setBudget] = useState<Budget | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [cameraNames, setCameraNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!effectiveTenantId) { 
      setBudget(null); 
      setUsage([]); 
      setLoading(false); 
      return; 
    }
    setLoading(true);
    const [b, u, c] = await Promise.all([
      supabase.from("tenant_ai_budgets").select("*").eq("tenant_id", effectiveTenantId).maybeSingle(),
      supabase.from("ai_usage_events")
        .select("id,camera_id,source,model,media,scene_changed,cost_usd,created_at")
        .eq("tenant_id", effectiveTenantId)
        .gte("created_at", monthStart())
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("cameras").select("id,name").eq("tenant_id", effectiveTenantId),
    ]);
    
    if (b.error) toast.error(b.error.message);
    
    setBudget((b.data as unknown as Budget) ?? DEFAULTS(effectiveTenantId));
    setUsage((u.data ?? []) as UsageRow[]);
    setCameraNames(Object.fromEntries((c.data ?? []).map((r: any) => [r.id, r.name])));
    setLoading(false);
  }, [effectiveTenantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!effectiveTenantId) return;
    const channel = supabase
      .channel(`ai-usage:${effectiveTenantId}`)
      .on("postgres_changes", { 
        event: "INSERT", 
        schema: "public", 
        table: "ai_usage_events", 
        filter: `tenant_id=eq.${effectiveTenantId}` 
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [effectiveTenantId, load]);

  const stats = useMemo(() => {
    const spend = usage.reduce((s, r) => s + Number(r.cost_usd), 0);
    const limit = Number(budget?.monthly_limit_usd ?? 0);
    const pct = limit > 0 ? (spend / limit) * 100 : 0;
    const analyzed = usage.filter((r) => r.scene_changed).length;
    const byCamera = new Map<string, { calls: number; spend: number }>();
    usage.forEach((r) => {
      const key = r.camera_id ?? "manual";
      const cur = byCamera.get(key) ?? { calls: 0, spend: 0 };
      byCamera.set(key, { calls: cur.calls + 1, spend: cur.spend + Number(r.cost_usd) });
    });
    const days = Math.max(1, new Date().getDate());
    const projected = (spend / days) * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    return {
      spend, limit, pct, analyzed, projected,
      remaining: Math.max(0, limit - spend),
      cameras: [...byCamera.entries()].sort((a, b) => b[1].spend - a[1].spend).slice(0, 8),
    };
  }, [usage, budget]);

  const state = stats.pct >= 100 ? "over" : stats.pct >= (budget?.alert_threshold_pct ?? 80) ? "near" : "ok";

  const save = async () => {
    if (!budget || !effectiveTenantId) return;
    if (!(budget.monthly_limit_usd > 0)) { toast.error("Monthly budget must be greater than zero"); return; }
    if (budget.alert_threshold_pct < 10 || budget.alert_threshold_pct > 99) {
      toast.error("Alert threshold must be between 10% and 99%"); return;
    }
    setSaving(true);
    const { error } = await supabase.from("tenant_ai_budgets").upsert({
      ...budget,
      tenant_id: effectiveTenantId,
    }, { onConflict: "tenant_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("AI budget saved");
    auditLog({
      tenantId: effectiveTenantId,
      action: "ai_budget.updated",
      entityType: "tenant",
      entityId: effectiveTenantId,
      metadata: {
        monthly_limit_usd: budget.monthly_limit_usd,
        alert_threshold_pct: budget.alert_threshold_pct,
        hard_stop: budget.hard_stop,
      },
    });
    load();
  };

  if (!effectiveTenantId) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Budget" description="Cap and monitor AI analysis spend per site" icon={Wallet} />
        <p className="text-sm text-muted-foreground">Select a tenant to configure its AI budget.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Budget"
        description={`Monthly AI analysis spend cap for ${effectiveTenant?.name ?? "this site"}`}
        icon={Wallet}
      />

      {loading || !budget ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading budget…
        </div>
      ) : (
        <>
          {/* Spend summary */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-primary" />
                <h2 className="font-semibold">This month</h2>
              </div>
              <Badge variant={state === "over" ? "destructive" : state === "near" ? "secondary" : "outline"}>
                {state === "over" ? "Budget exhausted" : state === "near" ? "Nearing limit" : "Within budget"}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-2xl font-semibold tabular-nums">{money(stats.spend)}</span>
                <span className="text-muted-foreground">of {money(stats.limit)} · {stats.pct.toFixed(1)}% used</span>
              </div>
              <Progress
                value={Math.min(100, stats.pct)}
                className={cn(state === "over" && "[&>div]:bg-destructive", state === "near" && "[&>div]:bg-amber-500")}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: "Remaining", value: money(stats.remaining) },
                { label: "Projected month end", value: money(stats.projected) },
                { label: "Frames analysed", value: stats.analyzed.toLocaleString() },
                { label: "Avg cost / frame", value: stats.analyzed ? `$${(stats.spend / stats.analyzed).toFixed(4)}` : "—" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
                  <div className="text-base font-semibold tabular-nums mt-0.5">{s.value}</div>
                </div>
              ))}
            </div>

            {state !== "ok" && (
              <div className={cn(
                "flex items-start gap-2 rounded-lg border p-3 text-sm",
                state === "over" ? "border-destructive/40 bg-destructive/10" : "border-amber-500/40 bg-amber-500/10"
              )}>
                {state === "over" ? <ShieldOff className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                <p>
                  {state === "over"
                    ? budget.hard_stop
                      ? "Live AI analysis is paused for this site until the budget is raised or the month resets."
                      : "This site is over budget. Analysis is still running because automatic pause is off."
                    : `Spend has passed the ${budget.alert_threshold_pct}% alert threshold. An alert has been raised for the operations team.`}
                </p>
              </div>
            )}
          </section>

          {/* Controls */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Budget controls</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="limit">Monthly budget (USD)</Label>
                <Input
                  id="limit"
                  type="number"
                  min={1}
                  step="1"
                  value={budget.monthly_limit_usd}
                  onChange={(e) => setBudget({ ...budget, monthly_limit_usd: Number(e.target.value) })}
                />
                <p className="text-[11px] text-muted-foreground">Resets on the first day of each month.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="threshold">Alert me at (% of budget)</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={10}
                  max={99}
                  step="5"
                  value={budget.alert_threshold_pct}
                  onChange={(e) => setBudget({ ...budget, alert_threshold_pct: Number(e.target.value) })}
                />
                <p className="text-[11px] text-muted-foreground">Raises a high-severity alert once crossed, routed through your notification settings.</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
                <span>
                  <span className="text-sm font-medium block">Pause AI analysis at the cap</span>
                  <span className="text-[11px] text-muted-foreground">Stops all camera analysis for this site once the budget is spent.</span>
                </span>
                <Switch checked={budget.hard_stop} onCheckedChange={(v) => setBudget({ ...budget, hard_stop: v })} />
              </label>
              <label className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
                <span>
                  <span className="text-sm font-medium block">Budget enforcement enabled</span>
                  <span className="text-[11px] text-muted-foreground">Turn off to meter spend without capping or alerting.</span>
                </span>
                <Switch checked={budget.enabled} onCheckedChange={(v) => setBudget({ ...budget, enabled: v })} />
              </label>
            </div>

            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save budget
            </Button>
          </section>

          {/* Spend by camera */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Spend by camera</h2>
            </div>
            {stats.cameras.length === 0 ? (
              <p className="text-sm text-muted-foreground">No AI analysis recorded yet this month.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {stats.cameras.map(([id, v]) => (
                  <div key={id} className="flex items-center justify-between py-2 text-sm">
                    <span className="truncate">{id === "manual" ? "Manual / test analysis" : cameraNames[id] ?? "Removed camera"}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {v.calls.toLocaleString()} frames · {money(v.spend)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Only frames where the scene actually changed are analysed and billed — unchanged frames are filtered out before the model runs.
            </p>
          </section>
        </>
      )}
    </div>
  );
};

export default AIBudget;
