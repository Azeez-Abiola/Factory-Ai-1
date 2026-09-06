import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenants } from "@/hooks/useTenants";
import { auditLog } from "@/lib/audit";
import { AlertTriangle, Bell, Camera, CheckCircle, Clock, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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


export default function Alerts() {
  const { user } = useAuth();
  const { activeTenantId, activeTenant } = useTenants();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AlertRow | null>(null);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [workflowIncidentId, setWorkflowIncidentId] = useState<string | null>(null);

  const load = async () => {
    if (!activeTenantId) { setAlerts([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .eq("tenant_id", activeTenantId)
      .order("detected_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setAlerts((data ?? []) as AlertRow[]);
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

  const filtered = useMemo(() => alerts.filter((a) => {
    if (severity !== "all" && a.severity !== severity) return false;
    if (status === "open" && !isOpen(a.status)) return false;
    if (status === "acknowledged" && !ACK_STATUSES.includes(a.status)) return false;
    if (status === "resolved" && !isResolved(a.status)) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      if (![a.title, a.zone ?? "", a.type, a.id].some((v) => v.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [alerts, severity, status, search]);

  const acknowledge = async (a: AlertRow) => {
    if (!user || !activeTenantId) return;
    const { error } = await supabase.from("alerts").update({
      status: "acknowledged", acknowledged_by: user.id, acknowledged_at: new Date().toISOString(),
    }).eq("id", a.id);
    if (error) return toast.error(error.message);
    await auditLog({ tenantId: activeTenantId, action: "alert.acknowledge", entityType: "alert", entityId: a.id, metadata: { title: a.title } });
    toast.success("Alert acknowledged");
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
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search title, zone, id…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
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
      </div>

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
              <div className="mt-0.5">{statusIcon(a.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
                  <Badge variant="outline" className={cn("text-xs", severityColors[a.severity] || "")}>{a.severity}</Badge>
                  <Badge variant="outline" className="text-xs">{a.type}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{a.status}</Badge>
                </div>
                {a.description && <p className="text-xs text-muted-foreground line-clamp-1">{a.description}</p>}
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Camera className="w-3 h-3" /> {a.zone || "—"}</span>
                  <span>{new Date(a.detected_at).toLocaleString()}</span>
                  {a.risk_score != null && <span>Risk {a.risk_score}</span>}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">{a.id.slice(0, 8)}</span>
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
              {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Zone</p><p className="text-foreground">{selected.zone || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Detected</p><p className="text-foreground">{new Date(selected.detected_at).toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs">Risk score</p><p className="text-foreground">{selected.risk_score ?? "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Acknowledged</p><p className="text-foreground">{selected.acknowledged_at ? new Date(selected.acknowledged_at).toLocaleString() : "No"}</p></div>
              </div>
              <div className="flex gap-2 pt-2">
                {isOpen(selected.status) && (
                  <Button variant="outline" onClick={() => acknowledge(selected)}><Clock className="w-4 h-4 mr-1" /> Acknowledge</Button>
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
