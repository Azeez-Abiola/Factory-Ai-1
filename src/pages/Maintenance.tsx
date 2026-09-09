import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wrench, AlertTriangle, Clock, TrendingDown, Calendar, Activity, Shield,
  CheckCircle2, Filter, Settings2, FileText, Plus, RefreshCw, Download, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import PageHeader from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { useAuth } from "@/hooks/useAuth";
import { downloadCSV } from "@/lib/exporters";
import {
  RISK_CONFIG, computeAssetHealth, nextWorkOrderReference,
  type AssetHealth, type EquipmentAssetRow, type MaintenanceAlertLike, type WorkOrderRow,
} from "@/lib/maintenance";

const LOOKBACK_DAYS = 14;

const Maintenance = () => {
  const navigate = useNavigate();
  const { activeTenantId, activeTenant } = useTenants();
  const { user } = useAuth();

  const [assets, setAssets] = useState<EquipmentAssetRow[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);
  const [alerts, setAlerts] = useState<MaintenanceAlertLike[]>([]);
  const [cameras, setCameras] = useState<{ id: string; name: string; zone: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const [riskFilter, setRiskFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"risk" | "probability">("risk");

  const [assetDialog, setAssetDialog] = useState(false);
  const [assetForm, setAssetForm] = useState({ name: "", zone: "", asset_type: "machine", camera_id: "none", last_service_at: "" });
  const [saving, setSaving] = useState(false);

  const [woDialog, setWoDialog] = useState(false);
  const [woAsset, setWoAsset] = useState<EquipmentAssetRow | null>(null);
  const [woForm, setWoForm] = useState({ scheduledDate: "", assignee: "", priority: "medium", notes: "" });

  const load = useCallback(async () => {
    if (!activeTenantId) {
      setAssets([]); setWorkOrders([]); setAlerts([]); setCameras([]); setLoading(false);
      return;
    }
    setLoading(true);
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
    const [a, w, al, c] = await Promise.all([
      supabase.from("equipment_assets").select("*").eq("tenant_id", activeTenantId).order("created_at", { ascending: true }),
      supabase.from("work_orders").select("*").eq("tenant_id", activeTenantId).order("created_at", { ascending: false }),
      supabase.from("alerts").select("id,type,severity,zone,camera_id,detected_at").eq("tenant_id", activeTenantId).gte("detected_at", since).limit(2000),
      supabase.from("cameras").select("id,name,zone").eq("tenant_id", activeTenantId).order("name"),
    ]);
    if (a.error || w.error) toast.error("Could not load maintenance data");
    setAssets((a.data ?? []) as EquipmentAssetRow[]);
    setWorkOrders((w.data ?? []) as WorkOrderRow[]);
    setAlerts((al.data ?? []) as MaintenanceAlertLike[]);
    setCameras((c.data ?? []) as { id: string; name: string; zone: string | null }[]);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeTenantId) return;
    const channel = supabase
      .channel(`maintenance-${activeTenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "equipment_assets", filter: `tenant_id=eq.${activeTenantId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders", filter: `tenant_id=eq.${activeTenantId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTenantId, load]);

  const enriched = useMemo(
    () => assets.map((asset) => ({ asset, health: computeAssetHealth(asset, alerts) as AssetHealth })),
    [assets, alerts],
  );

  const zones = useMemo(() => [...new Set(assets.map((a) => a.zone).filter(Boolean) as string[])], [assets]);

  const filtered = useMemo(() => {
    let result = [...enriched];
    if (riskFilter !== "all") result = result.filter((r) => r.health.riskLevel === riskFilter);
    if (zoneFilter !== "all") result = result.filter((r) => r.asset.zone === zoneFilter);
    const order = { critical: 0, warning: 1, watch: 2 };
    result.sort((a, b) =>
      sortBy === "risk"
        ? order[a.health.riskLevel] - order[b.health.riskLevel] || b.health.failureProbability - a.health.failureProbability
        : b.health.failureProbability - a.health.failureProbability,
    );
    return result;
  }, [enriched, riskFilter, zoneFilter, sortBy]);

  const criticalCount = enriched.filter((e) => e.health.riskLevel === "critical").length;
  const warningCount = enriched.filter((e) => e.health.riskLevel === "warning").length;
  const watchCount = enriched.filter((e) => e.health.riskLevel === "watch").length;
  const avgHealth = enriched.length ? Math.round(enriched.reduce((s, e) => s + e.health.health, 0) / enriched.length) : 0;
  const avgFailure = enriched.length ? Math.round(enriched.reduce((s, e) => s + e.health.failureProbability, 0) / enriched.length) : 0;

  const pieData = [
    { name: "Critical", value: criticalCount, color: "hsl(0 72% 51%)" },
    { name: "Warning", value: warningCount, color: "hsl(38 92% 50%)" },
    { name: "Watch", value: watchCount, color: "hsl(172 66% 50%)" },
  ].filter((d) => d.value > 0);

  const healthBarData = enriched.map((e) => ({
    name: e.asset.name.length > 12 ? `${e.asset.name.slice(0, 11)}…` : e.asset.name,
    health: e.health.health,
    risk: e.health.failureProbability,
  }));

  const openWorkOrders = workOrders.filter((w) => w.status !== "completed" && w.status !== "cancelled");

  const handleAddAsset = async () => {
    if (!activeTenantId || !assetForm.name.trim()) return toast.error("Give the equipment a name");
    setSaving(true);
    const { error } = await supabase.from("equipment_assets").insert({
      tenant_id: activeTenantId,
      name: assetForm.name.trim(),
      zone: assetForm.zone.trim() || null,
      asset_type: assetForm.asset_type,
      camera_id: assetForm.camera_id === "none" ? null : assetForm.camera_id,
      last_service_at: assetForm.last_service_at ? new Date(assetForm.last_service_at).toISOString() : null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error("Could not add that equipment");
    toast.success("Equipment added");
    setAssetDialog(false);
    setAssetForm({ name: "", zone: "", asset_type: "machine", camera_id: "none", last_service_at: "" });
    load();
  };

  const handleDeleteAsset = async (id: string) => {
    const { error } = await supabase.from("equipment_assets").delete().eq("id", id);
    if (error) return toast.error("Could not remove that equipment");
    toast.success("Equipment removed");
    load();
  };

  const handleAcknowledge = async (asset: EquipmentAssetRow) => {
    const { error } = await supabase
      .from("equipment_assets")
      .update({ acknowledged_by: user?.id ?? null, acknowledged_at: new Date().toISOString() })
      .eq("id", asset.id);
    if (error) return toast.error("Could not acknowledge");
    toast.success(`${asset.name} acknowledged`);
    load();
  };

  const handleCreateWorkOrder = async () => {
    if (!activeTenantId || !woAsset) return;
    if (!woForm.scheduledDate || !woForm.assignee.trim()) return toast.error("Add a date and who is doing the work");
    setSaving(true);
    const reference = nextWorkOrderReference(workOrders.length);
    const { error } = await supabase.from("work_orders").insert({
      tenant_id: activeTenantId,
      asset_id: woAsset.id,
      reference,
      title: `Maintenance – ${woAsset.name}`,
      priority: woForm.priority,
      status: "scheduled",
      assignee_name: woForm.assignee.trim(),
      scheduled_date: woForm.scheduledDate,
      notes: woForm.notes.trim() || null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error("Could not create the work order");
    toast.success(`${reference} scheduled for ${woForm.scheduledDate}`);
    setWoDialog(false);
    setWoAsset(null);
    setWoForm({ scheduledDate: "", assignee: "", priority: "medium", notes: "" });
    load();
  };

  const updateWorkOrder = async (wo: WorkOrderRow, patch: Partial<WorkOrderRow>) => {
    const { error } = await supabase.from("work_orders").update(patch).eq("id", wo.id);
    if (error) return toast.error("Could not update that work order");
    load();
  };

  const handleCompleteWorkOrder = async (wo: WorkOrderRow) => {
    await updateWorkOrder(wo, { status: "completed", completed_at: new Date().toISOString() });
    if (wo.asset_id) {
      await supabase.from("equipment_assets").update({ last_service_at: new Date().toISOString() }).eq("id", wo.asset_id);
    }
    toast.success(`${wo.reference} marked complete`);
  };

  const handleExport = () => {
    if (!enriched.length) return toast.info("No equipment to export");
    downloadCSV(`maintenance-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Equipment", "Zone", "Type", "Risk", "Health %", "Failure risk %", "Events (14d)", "Detected issue", "Last service"],
      ...enriched.map((e) => [
        e.asset.name, e.asset.zone ?? "", e.asset.asset_type, e.health.riskLevel, e.health.health,
        e.health.failureProbability, e.health.eventCount, e.health.anomalyType,
        e.asset.last_service_at?.slice(0, 10) ?? "",
      ]),
    ]);
    toast.success("Maintenance list exported");
  };

  const todayISO = new Date().toISOString().slice(0, 10);
  const assetName = (id: string | null) => assets.find((a) => a.id === id)?.name ?? "Unassigned equipment";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Predictive"
        icon={Wrench}
        title="Predictive Maintenance"
        description={
          loading
            ? "Loading equipment…"
            : `${assets.length} tracked asset${assets.length === 1 ? "" : "s"} for ${activeTenant?.name ?? "this site"} · condition scored from the last ${LOOKBACK_DAYS} days of camera activity.`
        }
        actions={
          <>
            <Button onClick={() => setAssetDialog(true)} disabled={!activeTenantId}>
              <Plus className="w-4 h-4 mr-2" /> Add Equipment
            </Button>
            <Button variant="outline" className="border-border" onClick={load}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Refresh
            </Button>
            <Button variant="outline" className="border-border" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Activity className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Equipment</p>
            <p className="text-2xl font-bold text-foreground">{assets.length}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Critical</p>
            <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
          </CardContent>
        </Card>
        <Card className="border-warning/30">
          <CardContent className="p-4 text-center">
            <Shield className="w-5 h-5 text-warning mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Warnings</p>
            <p className="text-2xl font-bold text-warning">{warningCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <TrendingDown className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Avg Health</p>
            <p className={cn("text-2xl font-bold", avgHealth > 70 ? "text-primary" : avgHealth > 50 ? "text-warning" : "text-destructive")}>{avgHealth}%</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Clock className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Avg Failure Risk</p>
            <p className={cn("text-2xl font-bold", avgFailure > 60 ? "text-destructive" : avgFailure > 40 ? "text-warning" : "text-primary")}>{avgFailure}%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="alerts">Equipment</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="workorders">Work Orders ({openWorkOrders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filters:</span>
            </div>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Risk Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="watch">Watch</SelectItem>
              </SelectContent>
            </Select>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as "risk" | "probability")}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="risk">Sort by Risk</SelectItem>
                <SelectItem value="probability">Sort by Probability</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading && <div className="text-center py-12 text-muted-foreground text-sm">Loading equipment…</div>}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-primary" />
              <p className="text-lg font-medium">
                {assets.length === 0 ? "No equipment tracked yet" : "No equipment matches your filters"}
              </p>
              <p className="text-sm mt-1">
                {assets.length === 0
                  ? "Add a machine and link it to a camera or zone to start scoring its condition."
                  : "Try clearing the filters."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => (assets.length === 0 ? setAssetDialog(true) : (setRiskFilter("all"), setZoneFilter("all")))}
              >
                {assets.length === 0 ? "Add equipment" : "Clear filters"}
              </Button>
            </div>
          )}

          {filtered.map(({ asset, health }) => {
            const risk = RISK_CONFIG[health.riskLevel];
            const hasWorkOrder = openWorkOrders.some((wo) => wo.asset_id === asset.id);
            return (
              <Card key={asset.id} className={cn("border-border transition-all", asset.acknowledged_at && "opacity-70")}>
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row gap-5">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", risk.dotColor)} />
                        <button
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                          onClick={() => navigate(`/app/maintenance/${asset.id}`)}
                        >
                          {asset.name}
                        </button>
                        <Badge variant="outline" className={cn("text-xs", risk.color)}>{risk.label}</Badge>
                        {asset.zone && <Badge variant="outline" className="text-xs">{asset.zone}</Badge>}
                        {asset.acknowledged_at && <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">Acknowledged</Badge>}
                        {hasWorkOrder && <Badge variant="outline" className="text-xs bg-accent text-accent-foreground">Work order open</Badge>}
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Failure Probability</span>
                          <span className={cn("text-xs font-bold", health.failureProbability > 70 ? "text-destructive" : health.failureProbability > 50 ? "text-warning" : "text-primary")}>
                            {health.failureProbability}%
                          </span>
                        </div>
                        <Progress value={health.failureProbability} className="h-2" />
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-warning" />
                          <span className="text-muted-foreground text-xs">Est. Failure:</span>
                          <span className="text-foreground text-xs font-medium">{health.estimatedTimeToFailure}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingDown className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground text-xs">Detected issue:</span>
                          <span className="text-foreground text-xs truncate">{health.anomalyType}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground text-xs">Last Service:</span>
                          <span className="text-foreground text-xs">{asset.last_service_at?.slice(0, 10) ?? "Not recorded"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground text-xs">Events ({LOOKBACK_DAYS}d):</span>
                          <span className="text-foreground text-xs font-medium">{health.eventCount}</span>
                        </div>
                      </div>

                      <div className="bg-primary/5 border border-primary/15 rounded-lg p-3 mb-3">
                        <p className="text-xs font-semibold text-primary mb-1">Recommendation</p>
                        <p className="text-xs text-foreground">{health.recommendation}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {!asset.acknowledged_at && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAcknowledge(asset)}>
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Acknowledge
                          </Button>
                        )}
                        {!hasWorkOrder && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setWoAsset(asset); setWoDialog(true); }}>
                            <Settings2 className="w-3 h-3 mr-1" /> Schedule Maintenance
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate(`/app/maintenance/${asset.id}`)}>
                          <FileText className="w-3 h-3 mr-1" /> Details
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${asset.name}`}
                          onClick={() => handleDeleteAsset(asset.id)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>

                    <div className="w-full lg:w-56 shrink-0">
                      <p className="text-xs text-muted-foreground mb-2 font-medium">Condition trend (7-day)</p>
                      <ResponsiveContainer width="100%" height={110}>
                        <LineChart data={health.trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                          <Line type="monotone" dataKey="health" stroke={risk.barColor} strokeWidth={2} dot={{ fill: risk.barColor, r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 mt-4">
          {enriched.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Add equipment to see condition analytics.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-foreground">Risk Distribution</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-foreground">Equipment Health Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={healthBarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                      <Bar dataKey="health" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Health %" />
                      <Bar dataKey="risk" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} name="Failure Risk %" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="workorders" className="space-y-4 mt-4">
          {workOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Settings2 className="w-12 h-12 mx-auto mb-3" />
              <p>No work orders yet. Schedule maintenance from a piece of equipment.</p>
            </div>
          ) : (
            workOrders.map((wo) => (
              <Card key={wo.id} className={cn("border-border", wo.status === "completed" && "opacity-70")}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-foreground font-mono">{wo.reference}</span>
                      <Badge variant="outline" className={cn("text-xs",
                        wo.status === "completed" ? "bg-success/10 text-success border-success/30" :
                        wo.status === "in_progress" ? "bg-primary/10 text-primary border-primary/30" :
                        wo.status === "cancelled" ? "bg-muted text-muted-foreground" :
                        "bg-warning/10 text-warning border-warning/30")}>
                        {wo.status.replace("_", " ")}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{wo.priority}</Badge>
                    </div>
                    <p className="text-sm text-foreground">{assetName(wo.asset_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      Assignee: {wo.assignee_name} · Scheduled: {wo.scheduled_date ?? "unscheduled"}
                      {wo.completed_at ? ` · Completed ${wo.completed_at.slice(0, 10)}` : ""}
                    </p>
                    {wo.notes && <p className="text-xs text-muted-foreground mt-1">Notes: {wo.notes}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {wo.status === "scheduled" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateWorkOrder(wo, { status: "in_progress" })}>
                        Start
                      </Button>
                    )}
                    {wo.status !== "completed" && wo.status !== "cancelled" && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleCompleteWorkOrder(wo)}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => updateWorkOrder(wo, { status: "cancelled" })}>
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={assetDialog} onOpenChange={setAssetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Equipment</DialogTitle>
            <DialogDescription>
              Link a machine to a camera or zone so its condition is scored from real activity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Equipment name *</Label>
              <Input placeholder="Conveyor Belt – Line 1" value={assetForm.name} onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Zone</Label>
              <Input placeholder="Packaging" value={assetForm.zone} onChange={(e) => setAssetForm((f) => ({ ...f, zone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Linked camera</Label>
              <Select value={assetForm.camera_id} onValueChange={(v) => setAssetForm((f) => ({ ...f, camera_id: v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No camera</SelectItem>
                  {cameras.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Type</Label>
                <Select value={assetForm.asset_type} onValueChange={(v) => setAssetForm((f) => ({ ...f, asset_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="machine">Machine</SelectItem>
                    <SelectItem value="conveyor">Conveyor</SelectItem>
                    <SelectItem value="robot">Robot</SelectItem>
                    <SelectItem value="hvac">HVAC</SelectItem>
                    <SelectItem value="utility">Utility</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Last service</Label>
                <Input type="date" max={todayISO} value={assetForm.last_service_at} onChange={(e) => setAssetForm((f) => ({ ...f, last_service_at: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetDialog(false)}>Cancel</Button>
            <Button onClick={handleAddAsset} disabled={saving}>Add equipment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={woDialog} onOpenChange={setWoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Schedule Maintenance</DialogTitle>
            <DialogDescription>Creates a tracked work order for this equipment.</DialogDescription>
          </DialogHeader>
          {woAsset && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Equipment: <span className="text-foreground font-medium">{woAsset.name}</span></p>
              <div className="space-y-2">
                <Label className="text-xs">Scheduled date *</Label>
                <Input type="date" min={todayISO} value={woForm.scheduledDate} onChange={(e) => setWoForm((f) => ({ ...f, scheduledDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Assignee *</Label>
                <Input placeholder="Technician name" value={woForm.assignee} onChange={(e) => setWoForm((f) => ({ ...f, assignee: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Priority</Label>
                <Select value={woForm.priority} onValueChange={(v) => setWoForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Notes</Label>
                <Textarea placeholder="Work details..." value={woForm.notes} onChange={(e) => setWoForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWoDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateWorkOrder} disabled={saving}>Create work order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Maintenance;
