import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Target, Plus, Pencil, Trash2, CheckCircle, AlertTriangle,
  TrendingUp, TrendingDown, Minus, BarChart3, Shield, Zap, Loader2, Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import PageHeader from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { complianceScore, fetchAnalyzedFrames, isRealChangeAlert, ppePerThousandFrames } from "@/lib/gatedMetrics";

// ── Types ──
type KpiCategory = "safety" | "quality" | "efficiency" | "cost";
type ThresholdDirection = "higher_is_better" | "lower_is_better";
type KpiStatus = "on_track" | "at_risk" | "off_track";

interface Kpi {
  id: string;
  name: string;
  category: KpiCategory;
  unit: string;
  target: number;
  warningThreshold: number;
  criticalThreshold: number;
  direction: ThresholdDirection;
  current: number;
  enabled: boolean;
  description: string;
  formula?: string;
}

interface KpiRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  target: number;
  warning_threshold: number;
  critical_threshold: number;
  direction: string;
  current_value: number;
  enabled: boolean;
  description: string | null;
  formula: string | null;
}

const rowToKpi = (r: KpiRow): Kpi => ({
  id: r.id,
  name: r.name,
  category: (r.category as KpiCategory) ?? "safety",
  unit: r.unit,
  target: Number(r.target),
  warningThreshold: Number(r.warning_threshold),
  criticalThreshold: Number(r.critical_threshold),
  direction: (r.direction as ThresholdDirection) ?? "higher_is_better",
  current: Number(r.current_value),
  enabled: r.enabled,
  description: r.description ?? "",
  formula: r.formula ?? "",
});

const kpiToRow = (k: Omit<Kpi, "id">, tenantId: string) => ({
  tenant_id: tenantId,
  name: k.name,
  category: k.category,
  unit: k.unit,
  target: k.target,
  warning_threshold: k.warningThreshold,
  critical_threshold: k.criticalThreshold,
  direction: k.direction,
  current_value: k.current,
  enabled: k.enabled,
  description: k.description,
  formula: k.formula || null,
});

// ── Standard starter set (only inserted on explicit request) ──
const standardKpis: Omit<Kpi, "id">[] = [
  { name: "Compliance Score", category: "safety", unit: "%", target: 95, warningThreshold: 90, criticalThreshold: 80, direction: "higher_is_better", current: 0, enabled: true, description: "Percentage of safety compliance checks passed across all zones", formula: "(Compliant Observations / Total Observations) × 100" },
  { name: "PPE Violation Rate", category: "safety", unit: "per shift", target: 2, warningThreshold: 5, criticalThreshold: 10, direction: "lower_is_better", current: 0, enabled: true, description: "Average PPE violations detected per shift", formula: "Total Violations / Number of Shifts" },
  { name: "OEE", category: "efficiency", unit: "%", target: 85, warningThreshold: 75, criticalThreshold: 65, direction: "higher_is_better", current: 0, enabled: true, description: "Overall Equipment Effectiveness", formula: "Availability × Performance × Quality" },
  { name: "Defect Rate", category: "quality", unit: "ppm", target: 50, warningThreshold: 100, criticalThreshold: 200, direction: "lower_is_better", current: 0, enabled: true, description: "Defective parts per million produced", formula: "(Defective Units / Total Units) × 1,000,000" },
  { name: "MTTR", category: "efficiency", unit: "hours", target: 2, warningThreshold: 4, criticalThreshold: 8, direction: "lower_is_better", current: 0, enabled: true, description: "Mean Time To Repair", formula: "Total Repair Time / Number of Repairs" },
  { name: "Alert Response Time", category: "safety", unit: "min", target: 5, warningThreshold: 10, criticalThreshold: 15, direction: "lower_is_better", current: 0, enabled: true, description: "Average time to acknowledge and respond to critical alerts", formula: "Σ(Acknowledged − Detected) / Alerts" },
];

// ── Helpers ──
const categoryConfig: Record<KpiCategory, { icon: React.ReactNode; color: string; label: string }> = {
  safety: { icon: <Shield className="w-4 h-4" />, color: "bg-destructive/10 text-destructive border-destructive/30", label: "Safety" },
  quality: { icon: <CheckCircle className="w-4 h-4" />, color: "bg-blue-500/10 text-blue-500 border-blue-500/30", label: "Quality" },
  efficiency: { icon: <Zap className="w-4 h-4" />, color: "bg-amber-500/10 text-amber-500 border-amber-500/30", label: "Efficiency" },
  cost: { icon: <BarChart3 className="w-4 h-4" />, color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30", label: "Cost" },
};

function getKpiStatus(kpi: Kpi): KpiStatus {
  if (kpi.direction === "higher_is_better") {
    if (kpi.current >= kpi.target) return "on_track";
    if (kpi.current >= kpi.warningThreshold) return "at_risk";
    return "off_track";
  }
  if (kpi.current <= kpi.target) return "on_track";
  if (kpi.current <= kpi.warningThreshold) return "at_risk";
  return "off_track";
}

const statusStyles: Record<KpiStatus, { icon: React.ReactNode; color: string; label: string }> = {
  on_track: { icon: <TrendingUp className="w-4 h-4" />, color: "text-emerald-500", label: "On Track" },
  at_risk: { icon: <Minus className="w-4 h-4" />, color: "text-amber-500", label: "At Risk" },
  off_track: { icon: <TrendingDown className="w-4 h-4" />, color: "text-destructive", label: "Off Track" },
};

function progressFor(kpi: Kpi) {
  if (kpi.target === 0) return kpi.current === 0 ? 100 : 0;
  if (kpi.direction === "higher_is_better") return Math.min(100, Math.max(0, Math.round((kpi.current / kpi.target) * 100)));
  if (kpi.current <= kpi.target) return 100;
  return Math.max(0, Math.round((1 - (kpi.current - kpi.target) / kpi.target) * 100));
}

const emptyKpi: Omit<Kpi, "id"> = {
  name: "", category: "safety", unit: "%", target: 0, warningThreshold: 0,
  criticalThreshold: 0, direction: "higher_is_better", current: 0, enabled: true,
  description: "", formula: "",
};

// ── Live measurements from real tenant data ──
interface LiveMetrics {
  complianceScore: number;
  ppePerShift: number;
  responseMinutes: number;
  openCritical: number;
  windowDays: number;
  analyzedFrames: number;
  ppePerThousandFrames: number;
}

const KpiConfig = () => {
  const { activeTenant, activeTenantId } = useTenants();
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [filter, setFilter] = useState<KpiCategory | "all">("all");
  const [editingKpi, setEditingKpi] = useState<Kpi | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Omit<Kpi, "id">>(emptyKpi);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeTenantId) { setKpis([]); setLoading(false); return; }
    setLoading(true);
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [kpiRes, alertRes] = await Promise.all([
      supabase.from("tenant_kpis").select("*").eq("tenant_id", activeTenantId).order("created_at"),
      supabase
        .from("alerts")
        .select("id,type,severity,status,detected_at,acknowledged_at,metadata")
        .eq("tenant_id", activeTenantId)
        .gte("detected_at", since),
    ]);

    if (kpiRes.error) {
      console.error(kpiRes.error);
      toast.error("Could not load KPI configuration");
      setKpis([]);
    } else {
      setKpis(((kpiRes.data ?? []) as KpiRow[]).map(rowToKpi));
    }

    // Frame gating: only alerts raised from a genuinely changed frame count as
    // observations, and the denominator is the number of analysed frames.
    const alerts = (alertRes.data ?? []).filter((a) => isRealChangeAlert((a as any).metadata));
    const analyzedFrames = await fetchAnalyzedFrames(activeTenantId, since);
    const total = alerts.length;
    const violations = alerts.filter((a) => a.severity === "critical" || a.severity === "high").length;
    const ppe = alerts.filter((a) => (a.type ?? "").toLowerCase().includes("ppe")).length;
    const acked = alerts.filter((a) => a.acknowledged_at);
    const avgMinutes = acked.length
      ? acked.reduce((s, a) => s + (new Date(a.acknowledged_at as string).getTime() - new Date(a.detected_at).getTime()), 0) /
        acked.length / 60000
      : 0;

    setMetrics({
      complianceScore: complianceScore(analyzedFrames, violations, total),
      ppePerShift: Math.round((ppe / (30 * 3)) * 100) / 100, // 3 shifts/day over 30 days
      responseMinutes: Math.round(avgMinutes * 10) / 10,
      openCritical: alerts.filter((a) => a.severity === "critical" && a.status !== "resolved").length,
      windowDays: 30,
      analyzedFrames,
      ppePerThousandFrames: ppePerThousandFrames(analyzedFrames, ppe),
    });
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => { load(); }, [load]);

  // Map live measurements onto matching KPIs so "current" reflects actual usage
  const measuredKpis = useMemo(() => {
    if (!metrics) return kpis;
    return kpis.map((k) => {
      const n = k.name.toLowerCase();
      if (n.includes("compliance")) return { ...k, current: metrics.complianceScore };
      if (n.includes("ppe")) return { ...k, current: metrics.ppePerShift };
      if (n.includes("response")) return { ...k, current: metrics.responseMinutes };
      return k;
    });
  }, [kpis, metrics]);

  const filteredKpis = filter === "all" ? measuredKpis : measuredKpis.filter((k) => k.category === filter);

  const handleSave = async () => {
    if (!activeTenantId) { toast.error("Select a tenant first"); return; }
    if (!formData.name.trim()) { toast.error("KPI name is required"); return; }
    setSaving(true);
    if (editingKpi) {
      const { error } = await supabase.from("tenant_kpis").update(kpiToRow(formData, activeTenantId)).eq("id", editingKpi.id);
      if (error) toast.error(error.message); else toast.success(`"${formData.name}" updated`);
    } else {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("tenant_kpis").insert({ ...kpiToRow(formData, activeTenantId), created_by: userRes.user?.id ?? null });
      if (error) toast.error(error.message); else toast.success(`"${formData.name}" created`);
    }
    setSaving(false);
    setEditingKpi(null);
    setIsCreating(false);
    setFormData(emptyKpi);
    load();
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const { error } = await supabase.from("tenant_kpis").delete().eq("id", deleteConfirmId);
    if (error) toast.error(error.message); else toast.success("KPI deleted");
    setDeleteConfirmId(null);
    load();
  };

  const toggleEnabled = async (kpi: Kpi, enabled: boolean) => {
    setKpis((prev) => prev.map((k) => (k.id === kpi.id ? { ...k, enabled } : k)));
    const { error } = await supabase.from("tenant_kpis").update({ enabled }).eq("id", kpi.id);
    if (error) { toast.error(error.message); load(); }
  };

  const loadStandardSet = async () => {
    if (!activeTenantId) return;
    setSaving(true);
    const { error } = await supabase.from("tenant_kpis").insert(standardKpis.map((k) => kpiToRow(k, activeTenantId)));
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Standard KPI set added"); load(); }
  };

  const openEdit = (kpi: Kpi) => {
    setEditingKpi(kpi);
    const { id, ...rest } = kpi;
    setFormData(rest);
    setIsCreating(true);
  };

  const openCreate = () => {
    setEditingKpi(null);
    setFormData(emptyKpi);
    setIsCreating(true);
  };

  const enabled = measuredKpis.filter((k) => k.enabled);
  const onTrack = enabled.filter((k) => getKpiStatus(k) === "on_track").length;
  const atRisk = enabled.filter((k) => getKpiStatus(k) === "at_risk").length;
  const offTrack = enabled.filter((k) => getKpiStatus(k) === "off_track").length;

  // Objectives derived from real KPI groupings
  const objectives = useMemo(() => {
    const groups: Record<string, Kpi[]> = {};
    enabled.forEach((k) => { (groups[k.category] ||= []).push(k); });
    return Object.entries(groups).map(([cat, items]) => ({
      category: cat as KpiCategory,
      items,
      progress: Math.round(items.reduce((s, k) => s + progressFor(k), 0) / items.length),
    }));
  }, [enabled]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Performance"
        icon={Target}
        title="KPI & OKR Configuration"
        description={activeTenant ? `Targets and thresholds for ${activeTenant.name}` : "Select a tenant to configure targets and thresholds."}
        actions={
          <a href="/admin/rules" className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 transition">
            <Shield className="w-3.5 h-3.5" /> Rules & Policy
          </a>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 border border-border">
          <p className="text-xs text-muted-foreground">Active KPIs</p>
          <p className="text-2xl font-bold text-foreground">{enabled.length}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-500" /> On Track</p>
          <p className="text-2xl font-bold text-emerald-500">{onTrack}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> At Risk</p>
          <p className="text-2xl font-bold text-amber-500">{atRisk}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="w-3 h-3 text-destructive" /> Off Track</p>
          <p className="text-2xl font-bold text-destructive">{offTrack}</p>
        </div>
      </div>

      {metrics && (
        <div className="glass rounded-xl p-4 border border-border text-xs text-muted-foreground">
          Live measurement window: last {metrics.windowDays} days · {metrics.analyzedFrames.toLocaleString()} changed frames analysed · Compliance {metrics.complianceScore}% ·
          {" "}PPE events {metrics.ppePerShift}/shift · Avg response {metrics.responseMinutes} min · {metrics.openCritical} open critical alerts
        </div>
      )}

      <Tabs defaultValue="kpis">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="kpis" className="gap-2"><BarChart3 className="w-4 h-4" /> KPI Thresholds</TabsTrigger>
          <TabsTrigger value="okrs" className="gap-2"><Target className="w-4 h-4" /> Objectives</TabsTrigger>
        </TabsList>

        {/* ─── KPIs Tab ─── */}
        <TabsContent value="kpis" className="space-y-4 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {(["all", "safety", "quality", "efficiency", "cost"] as const).map((cat) => (
                <Button key={cat} size="sm" variant={filter === cat ? "default" : "outline"}
                  className={cn(filter === cat && "bg-destructive hover:bg-destructive/90")}
                  onClick={() => setFilter(cat)}>
                  {cat === "all" ? "All" : categoryConfig[cat].label}
                </Button>
              ))}
            </div>
            <Button size="sm" className="bg-destructive hover:bg-destructive/90 gap-2" onClick={openCreate} disabled={!activeTenantId}>
              <Plus className="w-4 h-4" /> Add KPI
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading KPIs…
            </div>
          ) : filteredKpis.length === 0 ? (
            <div className="glass rounded-xl border border-border p-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {activeTenantId ? "No KPIs configured for this tenant yet." : "Select a tenant to configure KPIs."}
              </p>
              {activeTenantId && (
                <Button size="sm" variant="outline" className="gap-2" onClick={loadStandardSet} disabled={saving}>
                  <Sparkles className="w-4 h-4" /> Load standard KPI set
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredKpis.map((kpi) => {
                const status = getKpiStatus(kpi);
                const sStyle = statusStyles[status];
                const cat = categoryConfig[kpi.category] ?? categoryConfig.safety;
                const pct = progressFor(kpi);

                return (
                  <div key={kpi.id} className={cn("glass rounded-xl p-4 border border-border transition-opacity", !kpi.enabled && "opacity-50")}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground">{kpi.name}</h3>
                          <Badge variant="outline" className={cn("text-xs gap-1", cat.color)}>{cat.icon} {cat.label}</Badge>
                          <span className={cn("flex items-center gap-1 text-xs font-medium", sStyle.color)}>{sStyle.icon} {sStyle.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{kpi.description}</p>
                        {kpi.formula && <p className="text-xs font-mono text-muted-foreground/70 mt-1">Formula: {kpi.formula}</p>}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Switch checked={kpi.enabled} onCheckedChange={(checked) => toggleEnabled(kpi, checked)} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(kpi)}><Pencil className="w-4 h-4" /></Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteConfirmId(kpi.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-0 sm:min-w-[140px]">
                        <Progress value={pct} className="h-2" />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground whitespace-nowrap">
                        <span>Current: <strong className={sStyle.color}>{kpi.current}{kpi.unit}</strong></span>
                        <span className="text-emerald-500">Target: {kpi.target}{kpi.unit}</span>
                        <span className="text-amber-500">Warn: {kpi.warningThreshold}{kpi.unit}</span>
                        <span className="text-destructive">Crit: {kpi.criticalThreshold}{kpi.unit}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── Objectives Tab ─── */}
        <TabsContent value="okrs" className="space-y-4 mt-4">
          {objectives.length === 0 ? (
            <p className="text-sm text-muted-foreground">Enable KPIs to see objective progress.</p>
          ) : (
            <div className="space-y-4">
              {objectives.map((obj) => {
                const cat = categoryConfig[obj.category] ?? categoryConfig.safety;
                return (
                  <div key={obj.category} className="glass rounded-xl p-5 border border-border">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{cat.label} objectives</h3>
                        <p className="text-xs text-muted-foreground mt-1">{obj.items.length} key results tracked from live data</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-foreground">{obj.progress}%</p>
                        <p className="text-xs text-muted-foreground">Overall</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {obj.items.map((kpi) => (
                        <div key={kpi.id} className="bg-muted/30 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs text-foreground font-medium">{kpi.name}</p>
                            <span className="text-xs text-muted-foreground ml-2">{kpi.current} / {kpi.target} {kpi.unit}</span>
                          </div>
                          <Progress value={progressFor(kpi)} className="h-1.5" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create / Edit dialog */}
      <Dialog open={isCreating} onOpenChange={(open) => { if (!open) { setIsCreating(false); setEditingKpi(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingKpi ? "Edit KPI" : "Create New KPI"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">KPI Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-1" placeholder="e.g. Compliance Score" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="mt-1" placeholder="What does this KPI measure?" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v as KpiCategory })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="safety">Safety</SelectItem>
                    <SelectItem value="quality">Quality</SelectItem>
                    <SelectItem value="efficiency">Efficiency</SelectItem>
                    <SelectItem value="cost">Cost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Unit</Label>
                <Input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="mt-1" placeholder="%, hours, ppm" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Direction</Label>
              <Select value={formData.direction} onValueChange={(v) => setFormData({ ...formData, direction: v as ThresholdDirection })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="higher_is_better">Higher is Better (e.g. OEE, Compliance)</SelectItem>
                  <SelectItem value="lower_is_better">Lower is Better (e.g. Defect Rate, MTTR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="glass rounded-lg p-4 border border-border space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Threshold Configuration</h4>
              <p className="text-xs text-muted-foreground">
                {formData.direction === "higher_is_better"
                  ? "Target ≥ Warning > Critical (values below warning trigger alerts)"
                  : "Target ≤ Warning < Critical (values above warning trigger alerts)"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-emerald-500 font-medium">Target</Label>
                  <Input type="number" value={formData.target} onChange={(e) => setFormData({ ...formData, target: Number(e.target.value) })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-amber-500 font-medium">Warning</Label>
                  <Input type="number" value={formData.warningThreshold} onChange={(e) => setFormData({ ...formData, warningThreshold: Number(e.target.value) })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-destructive font-medium">Critical</Label>
                  <Input type="number" value={formData.criticalThreshold} onChange={(e) => setFormData({ ...formData, criticalThreshold: Number(e.target.value) })} className="mt-1" />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Baseline / Current Value</Label>
              <Input type="number" value={formData.current} onChange={(e) => setFormData({ ...formData, current: Number(e.target.value) })} className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Compliance, PPE and response KPIs are recalculated from live alert data, measured only against frames where the scene actually changed.</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Formula (optional)</Label>
              <Input value={formData.formula || ""} onChange={(e) => setFormData({ ...formData, formula: e.target.value })} className="mt-1 font-mono text-xs" placeholder="e.g. (Compliant / Total) × 100" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button className="bg-destructive hover:bg-destructive/90" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingKpi ? "Update KPI" : "Create KPI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the KPI and its thresholds for this tenant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default KpiConfig;
