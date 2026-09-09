import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  PackageSearch, RefreshCw, Download, Camera as CameraIcon, CheckCircle2, AlertTriangle, Percent,
} from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import StatCard from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { downloadCSV } from "@/lib/exporters";
import { cn } from "@/lib/utils";
import { DEFAULT_DEFECT_TYPES, matchesDefectType, type DefectType } from "@/lib/defectTypes";

interface AlertRow {
  id: string;
  camera_id: string | null;
  type: string;
  title: string;
  severity: string;
  status: string;
  zone: string | null;
  detected_at: string;
  resolved_at: string | null;
  metadata: Record<string, any> | null;
}

const RANGE_HOURS: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };
const OPEN = ["open", "new", "active"];
const ACK = ["acknowledged", "assigned", "investigating"];
const isResolved = (s: string) => s === "resolved" || s === "closed";

/** A quality alert is anything the vision model attributed to the quality category. */
const isQualityAlert = (a: AlertRow) => {
  const hay = `${a.type} ${a.title}`.toLowerCase();
  if (/quality|defect|damag|misalign|label|packag|contamin|scratch|dent|leak/.test(hay)) return true;
  const dets = a.metadata?.detections;
  return Array.isArray(dets) && dets.some((d: any) => String(d?.category).toLowerCase() === "quality");
};

const prettify = (s: string) =>
  s.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());

const SEVERITY_COLOR: Record<string, string> = {
  critical: "hsl(var(--destructive))",
  high: "hsl(var(--warning))",
  medium: "hsl(var(--primary))",
  low: "hsl(var(--muted-foreground))",
};

const matchesDefect = (a: AlertRow, d: DefectType) => matchesDefectType(a, d);


const Quality = () => {
  const { activeTenantId } = useTenants();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [cameras, setCameras] = useState<{ id: string; name: string; zone: string | null }[]>([]);
  const [defectTypes, setDefectTypes] = useState<DefectType[]>([]);
  const [defectFilter, setDefectFilter] = useState<string>("all");
  const [range, setRange] = useState<keyof typeof RANGE_HOURS>("7d");
  const [loading, setLoading] = useState(true);


  const load = useCallback(async () => {
    if (!activeTenantId) { setLoading(false); return; }
    setLoading(true);
    const since = new Date(Date.now() - RANGE_HOURS[range] * 3600 * 1000).toISOString();
    const [a, c, cfg] = await Promise.all([
      supabase.from("alerts")
        .select("id,camera_id,type,title,severity,status,zone,detected_at,resolved_at,metadata")
        .eq("tenant_id", activeTenantId)
        .gte("detected_at", since)
        .order("detected_at", { ascending: false })
        .limit(5000),
      supabase.from("cameras").select("id,name,zone").eq("tenant_id", activeTenantId),
      supabase.from("ai_analysis_config").select("defect_types").eq("tenant_id", activeTenantId).maybeSingle(),
    ]);
    setAlerts(((a.data ?? []) as AlertRow[]).filter(isQualityAlert));
    setCameras((c.data ?? []) as any);
    const defs = Array.isArray((cfg.data as any)?.defect_types) ? ((cfg.data as any).defect_types as DefectType[]) : [];
    const enabled = defs.filter((d) => d?.label && d.enabled !== false);
    setDefectTypes(enabled.length ? enabled : DEFAULT_DEFECT_TYPES);
    setLoading(false);
  }, [activeTenantId, range]);


  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeTenantId) return;
    const ch = supabase
      .channel(`quality:${activeTenantId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "alerts", filter: `tenant_id=eq.${activeTenantId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeTenantId, load]);

  const cameraName = (id: string | null) =>
    cameras.find((c) => c.id === id)?.name ?? (id ? `Camera ${id.slice(0, 8)}` : "Unassigned");

  /** Counts per configured defect type (drives the filter labels). */
  const defectCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of defectTypes) map[d.id] = alerts.filter((a) => matchesDefect(a, d)).length;
    map.__other = alerts.filter((a) => !defectTypes.some((d) => matchesDefect(a, d))).length;
    return map;
  }, [alerts, defectTypes]);

  const visible = useMemo(() => {
    if (defectFilter === "all") return alerts;
    if (defectFilter === "__other") return alerts.filter((a) => !defectTypes.some((d) => matchesDefect(a, d)));
    const d = defectTypes.find((x) => x.id === defectFilter);
    return d ? alerts.filter((a) => matchesDefect(a, d)) : alerts;
  }, [alerts, defectFilter, defectTypes]);

  const stats = useMemo(() => {
    const total = visible.length;
    const open = visible.filter((a) => OPEN.includes(a.status)).length;
    const inProgress = visible.filter((a) => ACK.includes(a.status)).length;
    const resolved = visible.filter((a) => isResolved(a.status)).length;
    const times = visible
      .filter((a) => a.resolved_at)
      .map((a) => (new Date(a.resolved_at!).getTime() - new Date(a.detected_at).getTime()) / 60000);
    const mttr = times.length ? Math.round(times.reduce((s, n) => s + n, 0) / times.length) : 0;
    return {
      total, open, inProgress, resolved, mttr,
      resolutionRate: total ? Math.round((resolved / total) * 100) : 100,
    };
  }, [visible]);

  const perCamera = useMemo(() => {
    const map = new Map<string, { name: string; total: number; open: number; resolved: number; critical: number }>();
    for (const a of visible) {
      const key = a.camera_id ?? "unassigned";
      const row = map.get(key) ?? { name: cameraName(a.camera_id), total: 0, open: 0, resolved: 0, critical: 0 };

      row.total++;
      if (isResolved(a.status)) row.resolved++;
      else row.open++;
      if (a.severity === "critical") row.critical++;
      map.set(key, row);
    }
    return [...map.values()].sort((x, y) => y.total - x.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, cameras]);

  const perType = useMemo(() => {
    const map = new Map<string, { type: string; count: number; severity: string }>();
    for (const a of visible) {
      const configured = defectTypes.find((d) => matchesDefect(a, d));
      const key = configured ? configured.label : prettify(a.type || "Unclassified defect");
      const row = map.get(key) ?? { type: key, count: 0, severity: configured?.severity_hint || a.severity };
      row.count++;
      if (["critical", "high"].includes(a.severity)) row.severity = a.severity;
      map.set(key, row);
    }
    return [...map.values()].sort((x, y) => y.count - x.count).slice(0, 8);
  }, [visible, defectTypes]);

  const exportCsv = () => {
    downloadCSV(`quality-defects-${range}.csv`, [
      ["Detected", "Camera", "Zone", "Defect type", "Severity", "Status", "Resolved at"],
      ...visible.map((a) => [
        new Date(a.detected_at).toLocaleString(),
        cameraName(a.camera_id),
        a.zone ?? "—",
        defectTypes.find((d) => matchesDefect(a, d))?.label ?? prettify(a.type),
        a.severity,
        a.status,
        a.resolved_at ? new Date(a.resolved_at).toLocaleString() : "",
      ]),
    ]);
  };


  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quality"
        icon={PackageSearch}
        title="Quality Control"
        description="Defects detected per camera, the defect types driving them, and how quickly your team is closing them out."
        actions={
          <>
            <Select value={defectFilter} onValueChange={setDefectFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All defect types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All defect types ({alerts.length})</SelectItem>
                {defectTypes.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label} ({defectCounts[d.id] ?? 0})
                  </SelectItem>
                ))}
                <SelectItem value="__other">Uncategorised ({defectCounts.__other ?? 0})</SelectItem>
              </SelectContent>
            </Select>
            <Select value={range} onValueChange={(v) => setRange(v as keyof typeof RANGE_HOURS)}>
              <SelectTrigger className="w-full sm:w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2" onClick={load} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={!visible.length}>
              <Download className="w-4 h-4" /> Export
            </Button>
          </>
        }
      />

      {defectTypes.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No defect types configured yet — set them up under Admin → AI Model &amp; Categories to filter by your own product defects.
        </p>
      )}


      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Defects detected" value={stats.total} subtitle={`Across ${perCamera.length} camera${perCamera.length === 1 ? "" : "s"}`} icon={PackageSearch} />
        <StatCard title="Awaiting action" value={stats.open} subtitle={`${stats.inProgress} being worked on`} icon={AlertTriangle} variant={stats.open ? "warning" : "success"} />
        <StatCard title="Closed out" value={stats.resolved} subtitle={`${stats.resolutionRate}% of all defects`} icon={CheckCircle2} variant="success" />
        <StatCard title="Avg time to close" value={stats.mttr ? `${stats.mttr}m` : "—"} subtitle="From detection to resolution" icon={Percent} />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Resolution progress</h2>
            <p className="text-xs text-muted-foreground mt-1">How the defects found in this period are moving through triage.</p>
          </div>
          <Badge variant="outline">{stats.resolutionRate}% closed</Badge>
        </div>
        <Progress value={stats.resolutionRate} className="h-2.5" />
        <div className="grid gap-3 sm:grid-cols-3 mt-4">
          {[
            { label: "New", value: stats.open, tone: "text-warning" },
            { label: "In progress", value: stats.inProgress, tone: "text-primary" },
            { label: "Resolved", value: stats.resolved, tone: "text-success" },
          ].map((s) => (
            <div key={s.label} className="rounded-md border border-border bg-background/50 px-4 py-3">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">{s.label}</p>
              <p className={cn("font-display text-2xl font-bold mt-1 tabular-nums", s.tone)}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold text-foreground mb-4">Defects by camera</h2>
          {perCamera.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">No quality defects detected in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={perCamera.slice(0, 8)} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                    borderRadius: 8, fontSize: 12,
                  }}
                />
                <Bar dataKey="total" name="Defects" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold text-foreground mb-4">Defect types</h2>
          {perType.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Nothing to categorise yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={perType} margin={{ left: 4, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="type" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                    borderRadius: 8, fontSize: 12,
                  }}
                />
                <Bar dataKey="count" name="Detections" radius={[4, 4, 0, 0]}>
                  {perType.map((t) => (
                    <Cell key={t.type} fill={SEVERITY_COLOR[t.severity] ?? "hsl(var(--primary))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display text-lg font-bold text-foreground">Camera breakdown</h2>
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/app/cameras")}>
            <CameraIcon className="w-4 h-4" /> Camera feeds
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-2.5">Camera</th>
                <th className="text-right px-5 py-2.5">Defects</th>
                <th className="text-right px-5 py-2.5">Critical</th>
                <th className="text-right px-5 py-2.5">Outstanding</th>
                <th className="text-right px-5 py-2.5">Closed</th>
                <th className="text-right px-5 py-2.5 w-[180px]">Progress</th>
              </tr>
            </thead>
            <tbody>
              {perCamera.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  No quality defects recorded for this period.
                </td></tr>
              )}
              {perCamera.map((r) => {
                const pct = r.total ? Math.round((r.resolved / r.total) * 100) : 0;
                return (
                  <tr key={r.name} className="border-t border-border hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium text-foreground">{r.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{r.total}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {r.critical ? <Badge variant="destructive">{r.critical}</Badge> : "—"}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{r.open}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{r.resolved}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Progress value={pct} className="h-1.5 w-24" />
                        <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Quality;
