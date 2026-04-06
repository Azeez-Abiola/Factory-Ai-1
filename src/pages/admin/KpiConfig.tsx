import { useState } from "react";
import {
  Target, Plus, Pencil, Trash2, CheckCircle, AlertTriangle,
  TrendingUp, TrendingDown, Minus, BarChart3, Shield, Zap, Factory, Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
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

interface Okr {
  id: string;
  objective: string;
  quarter: string;
  owner: string;
  keyResults: {
    id: string;
    description: string;
    target: number;
    current: number;
    unit: string;
  }[];
}

// ── Mock Data ──
const initialKpis: Kpi[] = [
  { id: "KPI-001", name: "Compliance Score", category: "safety", unit: "%", target: 95, warningThreshold: 90, criticalThreshold: 80, direction: "higher_is_better", current: 92.4, enabled: true, description: "Percentage of safety compliance checks passed across all zones", formula: "(Compliant Observations / Total Observations) × 100" },
  { id: "KPI-002", name: "PPE Violation Rate", category: "safety", unit: "per shift", target: 2, warningThreshold: 5, criticalThreshold: 10, direction: "lower_is_better", current: 3.1, enabled: true, description: "Average PPE violations detected per shift", formula: "Total Violations / Number of Shifts" },
  { id: "KPI-003", name: "OEE", category: "efficiency", unit: "%", target: 85, warningThreshold: 75, criticalThreshold: 65, direction: "higher_is_better", current: 78.6, enabled: true, description: "Overall Equipment Effectiveness", formula: "Availability × Performance × Quality" },
  { id: "KPI-004", name: "Defect Rate", category: "quality", unit: "ppm", target: 50, warningThreshold: 100, criticalThreshold: 200, direction: "lower_is_better", current: 72, enabled: true, description: "Defective parts per million produced", formula: "(Defective Units / Total Units) × 1,000,000" },
  { id: "KPI-005", name: "MTBF", category: "efficiency", unit: "hours", target: 500, warningThreshold: 350, criticalThreshold: 200, direction: "higher_is_better", current: 420, enabled: true, description: "Mean Time Between Failures", formula: "Total Operating Time / Number of Failures" },
  { id: "KPI-006", name: "MTTR", category: "efficiency", unit: "hours", target: 2, warningThreshold: 4, criticalThreshold: 8, direction: "lower_is_better", current: 2.8, enabled: true, description: "Mean Time To Repair", formula: "Total Repair Time / Number of Repairs" },
  { id: "KPI-007", name: "Energy Cost per Unit", category: "cost", unit: "₹", target: 12, warningThreshold: 15, criticalThreshold: 20, direction: "lower_is_better", current: 13.5, enabled: true, description: "Energy consumption cost per unit produced" },
  { id: "KPI-008", name: "Alert Response Time", category: "safety", unit: "min", target: 5, warningThreshold: 10, criticalThreshold: 15, direction: "lower_is_better", current: 6.2, enabled: true, description: "Average time to acknowledge and respond to critical alerts" },
  { id: "KPI-009", name: "First Pass Yield", category: "quality", unit: "%", target: 98, warningThreshold: 95, criticalThreshold: 90, direction: "higher_is_better", current: 96.8, enabled: true, description: "Percentage of products passing quality inspection on first attempt" },
  { id: "KPI-010", name: "Shift Handover Score", category: "efficiency", unit: "%", target: 90, warningThreshold: 80, criticalThreshold: 70, direction: "higher_is_better", current: 85, enabled: false, description: "Completeness score of shift handover reports" },
];

const initialOkrs: Okr[] = [
  {
    id: "OKR-001", objective: "Achieve Zero Lost-Time Incidents", quarter: "Q2 2026", owner: "Safety Team",
    keyResults: [
      { id: "KR-001", description: "Reduce PPE violations below 2 per shift", target: 2, current: 3.1, unit: "per shift" },
      { id: "KR-002", description: "Achieve 95%+ compliance score across all zones", target: 95, current: 92.4, unit: "%" },
      { id: "KR-003", description: "Alert response time under 5 minutes", target: 5, current: 6.2, unit: "min" },
    ],
  },
  {
    id: "OKR-002", objective: "Improve Production Efficiency by 15%", quarter: "Q2 2026", owner: "Operations",
    keyResults: [
      { id: "KR-004", description: "Raise OEE to 85%", target: 85, current: 78.6, unit: "%" },
      { id: "KR-005", description: "Increase MTBF to 500 hours", target: 500, current: 420, unit: "hours" },
      { id: "KR-006", description: "Reduce MTTR to under 2 hours", target: 2, current: 2.8, unit: "hours" },
    ],
  },
  {
    id: "OKR-003", objective: "Reduce Cost per Unit by 10%", quarter: "Q2 2026", owner: "Finance",
    keyResults: [
      { id: "KR-007", description: "Energy cost per unit below ₹12", target: 12, current: 13.5, unit: "₹" },
      { id: "KR-008", description: "Defect rate below 50 ppm", target: 50, current: 72, unit: "ppm" },
    ],
  },
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
  } else {
    if (kpi.current <= kpi.target) return "on_track";
    if (kpi.current <= kpi.warningThreshold) return "at_risk";
    return "off_track";
  }
}

const statusStyles: Record<KpiStatus, { icon: React.ReactNode; color: string; label: string }> = {
  on_track: { icon: <TrendingUp className="w-4 h-4" />, color: "text-emerald-500", label: "On Track" },
  at_risk: { icon: <Minus className="w-4 h-4" />, color: "text-amber-500", label: "At Risk" },
  off_track: { icon: <TrendingDown className="w-4 h-4" />, color: "text-destructive", label: "Off Track" },
};

function krProgress(kr: { target: number; current: number }, direction: "higher_is_better" | "lower_is_better" = "higher_is_better") {
  if (direction === "lower_is_better") {
    if (kr.current <= kr.target) return 100;
    return Math.max(0, Math.round((1 - (kr.current - kr.target) / kr.target) * 100));
  }
  return Math.min(100, Math.round((kr.current / kr.target) * 100));
}

// ── Empty KPI form ──
const emptyKpi: Omit<Kpi, "id"> = {
  name: "", category: "safety", unit: "%", target: 0, warningThreshold: 0,
  criticalThreshold: 0, direction: "higher_is_better", current: 0, enabled: true,
  description: "", formula: "",
};

// ── Component ──
const KpiConfig = () => {
  const [kpis, setKpis] = useState<Kpi[]>(initialKpis);
  const [okrs] = useState<Okr[]>(initialOkrs);
  const [filter, setFilter] = useState<KpiCategory | "all">("all");
  const [editingKpi, setEditingKpi] = useState<Kpi | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Omit<Kpi, "id">>(emptyKpi);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmType, setDeleteConfirmType] = useState<"kpi" | "okr">("kpi");

  const filteredKpis = filter === "all" ? kpis : kpis.filter((k) => k.category === filter);

  const handleSave = () => {
    if (!formData.name.trim()) { toast.error("KPI name is required"); return; }
    if (editingKpi) {
      setKpis((prev) => prev.map((k) => (k.id === editingKpi.id ? { ...formData, id: editingKpi.id } : k)));
      toast.success(`"${formData.name}" updated`);
    } else {
      const newId = `KPI-${String(kpis.length + 1).padStart(3, "0")}`;
      setKpis((prev) => [...prev, { ...formData, id: newId }]);
      toast.success(`"${formData.name}" created`);
    }
    setEditingKpi(null);
    setIsCreating(false);
    setFormData(emptyKpi);
  };

  const handleDelete = () => {
    if (!deleteConfirmId) return;
    
    if (deleteConfirmType === "kpi") {
      setKpis((prev) => prev.filter((k) => k.id !== deleteConfirmId));
      toast.success("KPI deleted successfully");
    } else {
      // Mock deletion for OKRs if needed
      toast.success("Objective removed");
    }
    setDeleteConfirmId(null);
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

  // ── Stats ──
  const onTrack = kpis.filter((k) => k.enabled && getKpiStatus(k) === "on_track").length;
  const atRisk = kpis.filter((k) => k.enabled && getKpiStatus(k) === "at_risk").length;
  const offTrack = kpis.filter((k) => k.enabled && getKpiStatus(k) === "off_track").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-destructive" /> KPI & OKR Configuration
          </h1>
          <p className="text-sm text-muted-foreground">Define business metrics, set thresholds, and track objectives</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 border border-border">
          <p className="text-xs text-muted-foreground">Total KPIs</p>
          <p className="text-2xl font-bold text-foreground">{kpis.filter((k) => k.enabled).length}</p>
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

      <Tabs defaultValue="kpis">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="kpis" className="gap-2"><BarChart3 className="w-4 h-4" /> KPI Thresholds</TabsTrigger>
          <TabsTrigger value="okrs" className="gap-2"><Target className="w-4 h-4" /> OKRs</TabsTrigger>
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
            <Dialog open={isCreating} onOpenChange={(open) => { if (!open) { setIsCreating(false); setEditingKpi(null); } }}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-destructive hover:bg-destructive/90 gap-2" onClick={openCreate}>
                  <Plus className="w-4 h-4" /> Add KPI
                </Button>
              </DialogTrigger>
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
                  <div className="grid grid-cols-2 gap-3">
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
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-emerald-500 font-medium">🟢 Target</Label>
                        <Input type="number" value={formData.target} onChange={(e) => setFormData({ ...formData, target: Number(e.target.value) })} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-amber-500 font-medium">🟡 Warning</Label>
                        <Input type="number" value={formData.warningThreshold} onChange={(e) => setFormData({ ...formData, warningThreshold: Number(e.target.value) })} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-destructive font-medium">🔴 Critical</Label>
                        <Input type="number" value={formData.criticalThreshold} onChange={(e) => setFormData({ ...formData, criticalThreshold: Number(e.target.value) })} className="mt-1" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Current Value</Label>
                    <Input type="number" value={formData.current} onChange={(e) => setFormData({ ...formData, current: Number(e.target.value) })} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Formula (optional)</Label>
                    <Input value={formData.formula || ""} onChange={(e) => setFormData({ ...formData, formula: e.target.value })} className="mt-1 font-mono text-xs" placeholder="e.g. (Compliant / Total) × 100" />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button className="bg-destructive hover:bg-destructive/90" onClick={handleSave}>
                    {editingKpi ? "Update KPI" : "Create KPI"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* KPI Cards */}
          <div className="space-y-3">
            {filteredKpis.map((kpi) => {
              const status = getKpiStatus(kpi);
              const sStyle = statusStyles[status];
              const cat = categoryConfig[kpi.category];
              const pct = kpi.direction === "higher_is_better"
                ? Math.min(100, Math.round((kpi.current / kpi.target) * 100))
                : kpi.current <= kpi.target ? 100 : Math.max(0, Math.round((1 - (kpi.current - kpi.target) / kpi.target) * 100));

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
                      <Switch checked={kpi.enabled} onCheckedChange={(checked) => setKpis((prev) => prev.map((k) => k.id === kpi.id ? { ...k, enabled: checked } : k))} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(kpi)}><Pencil className="w-4 h-4" /></Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" 
                        onClick={() => {
                          setDeleteConfirmId(kpi.id);
                          setDeleteConfirmType("kpi");
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
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
        </TabsContent>

        {/* ─── OKRs Tab ─── */}
        <TabsContent value="okrs" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">{okrs.length} active objectives for the current quarter</p>
          <div className="space-y-4">
            {okrs.map((okr) => {
              const avgProgress = Math.round(okr.keyResults.reduce((sum, kr) => sum + krProgress(kr), 0) / okr.keyResults.length);
              return (
                <div key={okr.id} className="glass rounded-xl p-5 border border-border">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{okr.objective}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {okr.owner}</span>
                        <span>{okr.quarter}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="w-4 h-4" /></Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setDeleteConfirmId(okr.id);
                            setDeleteConfirmType("okr");
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-foreground">{avgProgress}%</p>
                        <p className="text-xs text-muted-foreground">Overall</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {okr.keyResults.map((kr) => {
                      const pct = krProgress(kr);
                      return (
                        <div key={kr.id} className="bg-muted/30 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs text-foreground font-medium">{kr.description}</p>
                            <span className="text-xs text-muted-foreground ml-2">{kr.current} / {kr.target} {kr.unit}</span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {deleteConfirmType === "kpi" ? "KPI" : "Objective"} 
              and remove its data from our servers.
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
