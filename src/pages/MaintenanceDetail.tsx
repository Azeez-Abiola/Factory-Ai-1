import { useParams, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Wrench, AlertTriangle, Clock, TrendingDown, Calendar,
  Activity, CheckCircle2, Shield, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  RISK_CONFIG, assetAlerts, computeAssetHealth,
  type EquipmentAssetRow, type MaintenanceAlertLike, type WorkOrderRow,
} from "@/lib/maintenance";

const LOOKBACK_DAYS = 14;

const MaintenanceDetail = () => {
  const { alertId: assetId } = useParams<{ alertId: string }>();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<EquipmentAssetRow | null>(null);
  const [alerts, setAlerts] = useState<MaintenanceAlertLike[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);
  const [cameraName, setCameraName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    const { data } = await supabase.from("equipment_assets").select("*").eq("id", assetId).maybeSingle();
    const row = (data ?? null) as EquipmentAssetRow | null;
    setAsset(row);
    if (row) {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
      const [al, wo, cam] = await Promise.all([
        supabase.from("alerts").select("id,type,severity,zone,camera_id,detected_at")
          .eq("tenant_id", row.tenant_id).gte("detected_at", since).limit(2000),
        supabase.from("work_orders").select("*").eq("asset_id", row.id).order("created_at", { ascending: false }),
        row.camera_id
          ? supabase.from("cameras").select("name").eq("id", row.camera_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setAlerts((al.data ?? []) as MaintenanceAlertLike[]);
      setWorkOrders((wo.data ?? []) as WorkOrderRow[]);
      setCameraName((cam?.data as { name: string } | null)?.name ?? null);
    }
    setLoading(false);
  }, [assetId]);

  useEffect(() => { load(); }, [load]);

  const health = useMemo(() => (asset ? computeAssetHealth(asset, alerts) : null), [asset, alerts]);
  const related = useMemo(() => (asset ? assetAlerts(asset, alerts).slice(0, 8) : []), [asset, alerts]);

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground text-sm">Loading equipment…</div>;
  }

  if (!asset || !health) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Wrench className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Equipment not found</h2>
        <p className="text-muted-foreground mb-6">This equipment record no longer exists for your site.</p>
        <Button onClick={() => navigate("/app/maintenance")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to predictive maintenance
        </Button>
      </div>
    );
  }

  const risk = RISK_CONFIG[health.riskLevel];

  const acknowledge = async () => {
    const { error } = await supabase
      .from("equipment_assets")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", asset.id);
    if (error) return toast.error("Could not acknowledge");
    toast.success("Equipment acknowledged");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit -ml-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/app/maintenance")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Maintenance
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center shrink-0", risk.color)}>
              <Wrench className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{asset.name}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge variant="outline" className={cn("text-xs", risk.color)}>{risk.label}</Badge>
                {asset.zone && <Badge variant="outline" className="text-xs">{asset.zone}</Badge>}
                <Badge variant="outline" className="text-xs">{asset.asset_type}</Badge>
                {cameraName && <Badge variant="outline" className="text-xs">{cameraName}</Badge>}
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={load}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            {!asset.acknowledged_at && (
              <Button onClick={acknowledge}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Acknowledge
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={cn("border-border", health.riskLevel === "critical" && "border-destructive/30")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", risk.color)}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Failure Probability</p>
                <p className={cn("text-2xl font-bold", health.failureProbability > 70 ? "text-destructive" : health.failureProbability > 50 ? "text-warning" : "text-primary")}>
                  {health.failureProbability}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Est. Failure</p>
                <p className="text-lg font-bold text-foreground">{health.estimatedTimeToFailure}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Service</p>
                <p className="text-lg font-bold text-foreground">{asset.last_service_at?.slice(0, 10) ?? "Not recorded"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Health</p>
                <p className="text-lg font-bold text-foreground">{health.health}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-primary" /> Condition trend (7-day)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={health.trendData}>
                  <defs>
                    <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={risk.barColor} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={risk.barColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                  <Area type="monotone" dataKey="health" stroke={risk.barColor} strokeWidth={2} fill="url(#colorHealth)" dot={{ fill: risk.barColor, r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Predictive analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
                <p className="text-xs font-semibold text-primary mb-1">Detected issue</p>
                <p className="text-sm text-foreground mb-4">{health.anomalyType}</p>
                <p className="text-xs font-semibold text-primary mb-1">Recommendation</p>
                <p className="text-sm text-foreground">{health.recommendation}</p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Failure risk gauge</p>
                <Progress value={health.failureProbability} className={cn("h-3", health.failureProbability > 70 ? "bg-muted [&>div]:bg-destructive" : health.failureProbability > 50 ? "bg-muted [&>div]:bg-warning" : "bg-muted [&>div]:bg-primary")} />
                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                  <span>Safe (0%)</span>
                  <span className={cn(health.failureProbability > 70 && "text-destructive font-medium")}>Critical (&gt;70%)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Recent events feeding this score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {related.length === 0 && (
                <p className="text-sm text-muted-foreground">No camera events linked to this equipment in the last {LOOKBACK_DAYS} days.</p>
              )}
              {related.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{a.type ?? "Event"}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(a.detected_at).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{a.severity ?? "low"}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Equipment info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Equipment</span>
                <span className="font-medium text-foreground">{asset.name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Location</span>
                <span className="text-foreground">{asset.zone ?? "Unassigned"}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Camera</span>
                <span className="text-foreground">{cameraName ?? "Not linked"}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={cn("text-[10px]", risk.color)}>{risk.label}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Acknowledged</span>
                <span className="text-foreground">{asset.acknowledged_at ? asset.acknowledged_at.slice(0, 10) : "No"}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Work order history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {workOrders.length === 0 && <p className="text-sm text-muted-foreground">No work orders raised yet.</p>}
              {workOrders.map((wo) => (
                <div key={wo.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <CheckCircle2 className={cn("w-4 h-4 mt-0.5 shrink-0", wo.status === "completed" ? "text-success" : "text-muted-foreground")} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{wo.reference} · {wo.status.replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground mb-1">{wo.notes ?? wo.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {wo.assignee_name} · {wo.scheduled_date ?? "unscheduled"}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceDetail;
