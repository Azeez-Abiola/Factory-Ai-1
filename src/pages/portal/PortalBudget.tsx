import { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { cn } from "@/lib/utils";

const money = (n: number) => `$${n.toFixed(2)}`;
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

interface UsageRow {
  camera_id: string | null;
  cost_usd: number;
  scene_changed: boolean;
  created_at: string;
}

const PortalBudget = () => {
  const { activeTenant, activeTenantId, loading: tenantsLoading } = useTenants();
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [cameras, setCameras] = useState<Record<string, string>>({});
  const [budget, setBudget] = useState({ limit: 50, threshold: 80, hardStop: true });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeTenantId) { setLoading(false); return; }
    setLoading(true);
    const [usageRes, budgetRes, camRes] = await Promise.all([
      supabase.from("ai_usage_events")
        .select("camera_id,cost_usd,scene_changed,created_at")
        .eq("tenant_id", activeTenantId)
        .gte("created_at", monthStart().toISOString())
        .limit(20000),
      supabase.from("tenant_ai_budgets")
        .select("monthly_limit_usd,alert_threshold_pct,hard_stop")
        .eq("tenant_id", activeTenantId)
        .maybeSingle(),
      supabase.from("cameras").select("id,name").eq("tenant_id", activeTenantId),
    ]);
    setUsage((usageRes.data ?? []) as UsageRow[]);
    setBudget({
      limit: Number(budgetRes.data?.monthly_limit_usd ?? 50),
      threshold: Number(budgetRes.data?.alert_threshold_pct ?? 80),
      hardStop: budgetRes.data?.hard_stop ?? true,
    });
    setCameras(Object.fromEntries((camRes.data ?? []).map((c) => [c.id, c.name])));
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => { if (!tenantsLoading) load(); }, [tenantsLoading, load]);

  const derived = useMemo(() => {
    const spend = usage.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
    const analyzed = usage.filter((r) => r.scene_changed).length;
    const skipped = usage.length - analyzed;
    const pct = budget.limit > 0 ? (spend / budget.limit) * 100 : 0;

    const start = monthStart().getTime();
    const elapsedDays = Math.max(1, (Date.now() - start) / 86_400_000);
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const projected = (spend / elapsedDays) * daysInMonth;

    const perCamera = Object.entries(
      usage.reduce<Record<string, { spend: number; frames: number }>>((acc, r) => {
        const key = r.camera_id ?? "unassigned";
        acc[key] = acc[key] ?? { spend: 0, frames: 0 };
        acc[key].spend += Number(r.cost_usd ?? 0);
        if (r.scene_changed) acc[key].frames += 1;
        return acc;
      }, {}),
    )
      .map(([id, v]) => ({ id, name: cameras[id] ?? "Unassigned", ...v }))
      .sort((a, b) => b.spend - a.spend);

    return { spend, analyzed, skipped, pct, projected, perCamera };
  }, [usage, budget.limit, cameras]);

  if (tenantsLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const overThreshold = derived.pct >= budget.threshold;

  return (
    <>
      <PageHeader
        eyebrow="Manager portal"
        icon={Wallet}
        title="AI budget"
        description={`Analysis spend for ${activeTenant?.name ?? "your site"} this month. Only frames where the scene actually changed are analysed.`}
        actions={
          <Button variant="outline" onClick={load} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      {overThreshold && (
        <Card className="p-4 border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold">This site has used {derived.pct.toFixed(0)}% of its monthly cap.</div>
            <p className="text-muted-foreground mt-0.5">
              {budget.hardStop
                ? "Analysis pauses automatically when the cap is reached. Ask your administrator to raise it if you need more."
                : "Analysis continues past the cap. Your administrator controls the limit."}
            </p>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Spent this month", value: money(derived.spend) },
          { label: "Monthly cap", value: money(budget.limit) },
          { label: "Projected month end", value: money(derived.projected) },
          { label: "Frames analysed", value: derived.analyzed.toLocaleString() },
        ].map((t) => (
          <Card key={t.label} className="p-5">
            <div className="text-[11px] font-bold uppercase text-muted-foreground">{t.label}</div>
            <div className="font-display text-3xl font-bold mt-2">{t.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold">Cap usage</h2>
          <Badge variant="outline" className={cn(overThreshold && "border-[hsl(var(--warning))]/30 text-[hsl(var(--warning))]")}>
            {derived.pct.toFixed(1)}%
          </Badge>
        </div>
        <Progress value={Math.min(100, derived.pct)} className="mt-4" />
        <p className="text-xs text-muted-foreground mt-3">
          {derived.skipped.toLocaleString()} unchanged frames were skipped before reaching the model — that is the saving from scene-change gating.
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="font-display font-bold mb-4">Spend by camera</h2>
        {derived.perCamera.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No analysis recorded this month.</p>
        ) : (
          <div className="divide-y divide-border">
            {derived.perCamera.map((c) => (
              <div key={c.id} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.frames.toLocaleString()} frames analysed</div>
                </div>
                <div className="font-display font-bold shrink-0">{money(c.spend)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
};

export default PortalBudget;
