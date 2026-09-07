import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenants } from "@/hooks/useTenants";
import { auditLog } from "@/lib/audit";
import { downloadCSV } from "@/lib/exporters";
import {
  AlertTriangle, Bell, Camera, CheckCircle, Clock, Download, Search, ShieldCheck, Timer, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import PageHeader from "@/components/app/PageHeader";
import AlertEvidence from "@/components/app/AlertEvidence";
import ResolutionWorkflowDialog from "@/components/app/ResolutionWorkflowDialog";

interface AlertRow {
  id: string;
  tenant_id: string;
  camera_id: string | null;
  type: string;
  severity: string;
  title: string;
  description: string | null;
  status: string;
  zone: string | null;
  risk_score: number | null;
  detected_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown> | null;
}

const severityColors: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-warning/10 text-warning border-warning/30",
  medium: "bg-primary/10 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
};

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

// Alerts may arrive from inference, camera gateways or manual entry with
// slightly different status vocabularies — normalise them for the UI.
const OPEN_STATUSES = ["open", "new", "active"];
const ACK_STATUSES = ["acknowledged", "assigned", "investigating"];
const isOpen = (s: string) => OPEN_STATUSES.includes(s);
const isResolved = (s: string) => s === "resolved" || s === "closed";

const statusIcon = (status: string) => {
  if (isResolved(status)) return <CheckCircle className="w-4 h-4 text-success" />;
  if (ACK_STATUSES.includes(status)) return <Clock className="w-4 h-4 text-primary" />;
  return <AlertTriangle className="w-4 h-4 text-warning" />;
};

const RANGE_HOURS: Record<string, number | null> = {
  "24h": 24, "7d": 168, "30d": 720, all: null,
};

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const StatTile = ({ label, value, tone }: { label: string; value: string | number; tone?: string }) => (
  <div className="glass rounded-xl border border-border p-4">
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone ?? "text-foreground")}>{value}</p>
  </div>
);

export default function Alerts() {
  const { user } = useAuth();
  const { activeTenantId, activeTenant } = useTenants();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [cameras, setCameras] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<AlertRow | null>(null);

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [cameraFilter, setCameraFilter] = useState<string>("all");
  const [range, setRange] = useState<string>("7d");
  const [sort, setSort] = useState<string>("newest");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [workflowIncidentId, setWorkflowIncidentId] = useState<string | null>(null);

  const load = async () => {
    if (!activeTenantId) { setAlerts([]); setLoading(false); return; }
    setLoading(true);
    const [{ data, error }, { data: cams }] = await Promise.all([
      supabase.from("alerts").select("*").eq("tenant_id", activeTenantId)
        .order("detected_at", { ascending: false }).limit(300),
      supabase.from("cameras").select("id, name").eq("tenant_id", activeTenantId).order("name"),
    ]);
    if (error) toast.error(error.message);
    setAlerts((data ?? []) as AlertRow[]);
    setCameras((cams ?? []) as { id: string; name: string }[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!activeTenantId) return;
    const channel = supabase
      .channel(`alerts:${activeTenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts", filter: `tenant_id=eq.${activeTenantId}` },
        (payload) => {
          setAlerts((prev) => {
            if (payload.eventType === "INSERT") return [payload.new as AlertRow, ...prev];
            if (payload.eventType === "UPDATE") return prev.map((a) => a.id === (payload.new as AlertRow).id ? payload.new as AlertRow : a);
            if (payload.eventType === "DELETE") return prev.filter((a) => a.id !== (payload.old as AlertRow).id);
            return prev;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId]);

  // Deep link support: /app/alerts?alert=<id> opens that alert directly.
  useEffect(() => {
    const id = searchParams.get("alert");
    if (!id || alerts.length === 0) return;
    const match = alerts.find((a) => a.id === id);
    if (match) {
      setSelected(match);
      searchParams.delete("alert");
      setSearchParams(searchParams, { replace: true });
    }
  }, [alerts, searchParams, setSearchParams]);

  const cameraName = (id: string | null) => cameras.find((c) => c.id === id)?.name ?? null;

  const filtered = useMemo(() => {
    const hours = RANGE_HOURS[range];
    const cutoff = hours ? Date.now() - hours * 3600_000 : null;
    const list = alerts.filter((a) => {
      if (severity !== "all" && a.severity !== severity) return false;
      if (status === "open" && !isOpen(a.status)) return false;
      if (status === "acknowledged" && !ACK_STATUSES.includes(a.status)) return false;
      if (status === "resolved" && !isResolved(a.status)) return false;
      if (cameraFilter !== "all" && a.camera_id !== cameraFilter) return false;
      if (cutoff && new Date(a.detected_at).getTime() < cutoff) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        if (![a.title, a.zone ?? "", a.type, a.id, cameraName(a.camera_id) ?? ""]
          .some((v) => v.toLowerCase().includes(q))) return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "oldest") return +new Date(a.detected_at) - +new Date(b.detected_at);
      if (sort === "severity") return (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
        || +new Date(b.detected_at) - +new Date(a.detected_at);
      if (sort === "risk") return (b.risk_score ?? 0) - (a.risk_score ?? 0);
      return +new Date(b.detected_at) - +new Date(a.detected_at);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, severity, status, search, cameraFilter, range, sort, cameras]);

  // Operational KPIs on the current filtered window.
  const stats = useMemo(() => {
    const open = filtered.filter((a) => isOpen(a.status));
    const critical = filtered.filter((a) => a.severity === "critical" && !isResolved(a.status));
    const acked = filtered.filter((a) => a.acknowledged_at);
    const mtta = acked.length
      ? acked.reduce((sum, a) => sum + (+new Date(a.acknowledged_at!) - +new Date(a.detected_at)), 0) / acked.length / 60000
      : null;
    const withEvidence = filtered.filter((a) => (a.metadata as any)?.evidence_path).length;
    return { open: open.length, critical: critical.length, mtta, withEvidence };
  }, [filtered]);

  const toggleCheck = (id: string) => setChecked((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const acknowledgeMany = async (ids: string[]) => {
    if (!user || !activeTenantId || ids.length === 0) return;
    const patch = {
      status: "acknowledged",
      acknowledged_by: user.id,
      acknowledged_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("alerts").update(patch).in("id", ids);
    if (error) return toast.error(error.message);
    setAlerts((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, ...patch } : x)));
    setSelected((prev) => (prev && ids.includes(prev.id) ? { ...prev, ...patch } : prev));
    await Promise.all(ids.map((id) => auditLog({
      tenantId: activeTenantId, action: "alert.acknowledge", entityType: "alert", entityId: id,
    })));
    setChecked(new Set());
    toast.success(ids.length > 1 ? `${ids.length} alerts acknowledged` : "Alert acknowledged");
  };

  const exportCSV = () => {
    downloadCSV(`alerts-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["ID", "Detected", "Title", "Type", "Severity", "Status", "Zone", "Camera", "Risk", "Acknowledged", "Resolved", "Evidence"],
      ...filtered.map((a) => [
        a.id, new Date(a.detected_at).toISOString(), a.title, a.type, a.severity, a.status,
        a.zone ?? "", cameraName(a.camera_id) ?? "", a.risk_score ?? "",
        a.acknowledged_at ?? "", a.resolved_at ?? "",
        (a.metadata as any)?.evidence_path ? "yes" : "no",
      ]),
    ]);
  };

  const openResolutionWorkflow = async (a: AlertRow) => {
    if (!user || !activeTenantId) return;
    // Find or create matching incident
    const { data: existing } = await supabase
      .from("incidents").select("id").eq("alert_id", a.id).limit(1).maybeSingle();
    let incidentId = existing?.id ?? null;
    if (!incidentId) {
      const { data: created, error } = await supabase.from("incidents").insert({
        tenant_id: activeTenantId,
        alert_id: a.id,
        title: a.title,
        severity: a.severity,
        status: "investigating",
        created_by: user.id,
        timeline: [{ ts: new Date().toISOString(), event: "opened", actor: user.id }],
      }).select("id").single();
      if (error) return toast.error(error.message);
      incidentId = created.id;
      await auditLog({ tenantId: activeTenantId, action: "incident.open", entityType: "incident", entityId: incidentId, metadata: { alert_id: a.id, title: a.title } });
    }
    setWorkflowIncidentId(incidentId);
    setSelected(a);
    setWorkflowOpen(true);
  };

  const recommended = (selected?.metadata as any)?.recommended_actions as string[] | undefined;
  const policiesApplied = (selected?.metadata as any)?.policies_applied as string[] | undefined;
  const aiSummary = (selected?.metadata as any)?.summary as string | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Live Feed"
        icon={Bell}
        title="Alerts & Incidents"
        description={
          activeTenant
            ? `${filtered.length} of ${alerts.length} live incidents · ${activeTenant.name}`
            : "Select a tenant to view alerts"
        }
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Open" value={stats.open} tone="text-warning" />
        <StatTile label="Critical unresolved" value={stats.critical} tone="text-destructive" />
        <StatTile label="Avg. time to acknowledge" value={stats.mtta == null ? "—" : `${stats.mtta.toFixed(1)}m`} />
        <StatTile label="With camera evidence" value={stats.withEvidence} tone="text-primary" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search title, zone, camera, id…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-40 bg-card border-border"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40 bg-card border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cameraFilter} onValueChange={setCameraFilter}>
          <SelectTrigger className="w-44 bg-card border-border"><SelectValue placeholder="Camera" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cameras</SelectItem>
            {cameras.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-36 bg-card border-border"><SelectValue placeholder="Period" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-40 bg-card border-border"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="severity">Severity</SelectItem>
            <SelectItem value="risk">Risk score</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {checked.size > 0 && (
        <div className="glass flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 p-3">
          <span className="text-sm text-foreground">{checked.size} selected</span>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => acknowledgeMany([...checked])}>
            <Clock className="h-4 w-4" /> Acknowledge
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setChecked(new Set())}>
            <X className="h-4 w-4" /> Clear
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading alerts…</p>}
        {!loading && filtered.length === 0 && (
          <div className="glass rounded-xl p-8 text-center border border-border">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No alerts match the current filters.</p>
          </div>
        )}
        {filtered.map((a) => (
          <div key={a.id} onClick={() => setSelected(a)}
            className="glass rounded-xl p-4 border border-border hover:border-primary/30 cursor-pointer transition-all">
            <div className="flex items-start gap-4">
              <div onClick={(e) => e.stopPropagation()} className="pt-1">
                <Checkbox checked={checked.has(a.id)} onCheckedChange={() => toggleCheck(a.id)} aria-label={`Select ${a.title}`} />
              </div>
              <AlertEvidence metadata={a.metadata} cameraId={a.camera_id} variant="thumb" title={a.title} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {statusIcon(a.status)}
                  <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
                  <Badge variant="outline" className={cn("text-xs", severityColors[a.severity] || "")}>{a.severity}</Badge>
                  <Badge variant="outline" className="text-xs">{a.type}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{a.status}</Badge>
                </div>
                {a.description && <p className="text-xs text-muted-foreground line-clamp-1">{a.description}</p>}
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Camera className="w-3 h-3" /> {cameraName(a.camera_id) ?? a.zone ?? "—"}</span>
                  <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> {timeAgo(a.detected_at)}</span>
                  {a.risk_score != null && <span>Risk {a.risk_score}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-[10px] text-muted-foreground font-mono">{a.id.slice(0, 8)}</span>
                {isOpen(a.status) && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => acknowledgeMany([a.id])}>
                    Acknowledge
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!selected && !workflowOpen} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">{statusIcon(selected.status)} {selected.title}</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className={severityColors[selected.severity] || ""}>{selected.severity}</Badge>
                <Badge variant="outline">{selected.type}</Badge>
                <Badge variant="outline" className="capitalize">{selected.status}</Badge>
              </div>

              <AlertEvidence metadata={selected.metadata} cameraId={selected.camera_id} title={selected.title} />

              {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
              {aiSummary && (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">AI scene summary</p>
                  <p className="mt-1 text-sm text-foreground">{aiSummary}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Camera</p><p className="text-foreground">{cameraName(selected.camera_id) ?? "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Zone</p><p className="text-foreground">{selected.zone || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Detected</p><p className="text-foreground">{new Date(selected.detected_at).toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs">Risk score</p><p className="text-foreground">{selected.risk_score ?? "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Acknowledged</p><p className="text-foreground">{selected.acknowledged_at ? new Date(selected.acknowledged_at).toLocaleString() : "No"}</p></div>
                <div><p className="text-muted-foreground text-xs">Resolved</p><p className="text-foreground">{selected.resolved_at ? new Date(selected.resolved_at).toLocaleString() : "No"}</p></div>
              </div>
              {recommended && recommended.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Recommended actions</p>
                  <ul className="list-disc pl-5 text-sm text-foreground space-y-0.5">
                    {recommended.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {policiesApplied && policiesApplied.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {policiesApplied.map((p) => <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>)}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                {isOpen(selected.status) && (
                  <Button variant="outline" onClick={() => acknowledgeMany([selected.id])}><Clock className="w-4 h-4 mr-1" /> Acknowledge</Button>
                )}
                {!isResolved(selected.status) && (
                  <Button onClick={() => openResolutionWorkflow(selected)} className="ml-auto">
                    <ShieldCheck className="w-4 h-4 mr-1" /> Open Resolution Workflow
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {selected && activeTenantId && (
        <ResolutionWorkflowDialog
          open={workflowOpen}
          onOpenChange={(v) => { setWorkflowOpen(v); if (!v) setWorkflowIncidentId(null); }}
          tenantId={activeTenantId}
          alertId={selected.id}
          incidentId={workflowIncidentId}
          title={selected.title}
          onResolved={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
