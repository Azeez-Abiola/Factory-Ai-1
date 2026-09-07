import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { auditLog } from "@/lib/audit";
import { downloadCSV } from "@/lib/exporters";
import {
  AlertOctagon, Bell, CheckCircle2, Clock, Search, ShieldCheck, Download, History, XCircle, UserCheck, Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import PageHeader from "@/components/app/PageHeader";
import ResolutionWorkflowDialog from "@/components/app/ResolutionWorkflowDialog";
import IncidentAuditTimeline from "@/components/app/IncidentAuditTimeline";
import ComplianceExportDialog from "@/components/app/ComplianceExportDialog";

interface Incident {
  id: string; tenant_id: string; alert_id: string | null;
  title: string; status: string; severity: string | null;
  assigned_to: string | null; notes: string | null;
  opened_at: string; closed_at: string | null;
}

const severityColors: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-warning/10 text-warning border-warning/30",
  medium: "bg-primary/10 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
};
const statusColors: Record<string, string> = {
  open: "bg-warning/10 text-warning border-warning/30",
  investigating: "bg-primary/10 text-primary border-primary/30",
  resolved: "bg-success/10 text-success border-success/30",
  closed: "bg-muted text-muted-foreground",
  false_positive: "bg-destructive/10 text-destructive border-destructive/30",
};

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const isOpenCase = (s: string) => s === "open" || s === "investigating";
const isClosedCase = (s: string) => s === "resolved" || s === "closed" || s === "false_positive";

const statusIcon = (s: string) => {
  if (s === "resolved" || s === "closed") return <CheckCircle2 className="w-4 h-4 text-success" />;
  if (s === "investigating") return <Clock className="w-4 h-4 text-primary" />;
  if (s === "false_positive") return <XCircle className="w-4 h-4 text-destructive" />;
  return <AlertOctagon className="w-4 h-4 text-warning" />;
};

const StatTile = ({ label, value, tone }: { label: string; value: string | number; tone?: string }) => (
  <div className="glass rounded-xl border border-border p-4">
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone ?? "text-foreground")}>{value}</p>
  </div>
);

export default function Investigations() {
  const { activeTenantId, activeTenant } = useTenants();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [members, setMembers] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [sort, setSort] = useState("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Incident | null>(null);
  const [timelineFor, setTimelineFor] = useState<Incident | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState<string>("");

  const load = async () => {
    if (!activeTenantId) { setIncidents([]); setLoading(false); return; }
    setLoading(true);
    const [{ data, error }, mem] = await Promise.all([
      supabase.from("incidents").select("*").eq("tenant_id", activeTenantId).order("opened_at", { ascending: false }).limit(200),
      supabase.from("tenant_members").select("user_id").eq("tenant_id", activeTenantId),
    ]);
    if (error) toast.error(error.message);
    setIncidents((data ?? []) as Incident[]);
    const memberIds = ((mem.data ?? []) as any[]).map((m) => m.user_id);
    let nameMap: Record<string, string | null> = {};
    if (memberIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", memberIds);
      nameMap = Object.fromEntries(((profs ?? []) as any[]).map((p) => [p.id, p.display_name]));
    }
    setMembers(memberIds.map((id) => ({ user_id: id, display_name: nameMap[id] ?? null })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!activeTenantId) return;
    const channel = supabase
      .channel(`incidents:${activeTenantId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "incidents", filter: `tenant_id=eq.${activeTenantId}` },
        (payload) => {
          setIncidents((prev) => {
            if (payload.eventType === "INSERT") return [payload.new as Incident, ...prev];
            if (payload.eventType === "UPDATE") return prev.map((i) => i.id === (payload.new as Incident).id ? payload.new as Incident : i);
            if (payload.eventType === "DELETE") return prev.filter((i) => i.id !== (payload.old as Incident).id);
            return prev;
          });
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId]);

  // Deep link from Alerts: /app/investigations?incident=<id> opens that case.
  useEffect(() => {
    const id = searchParams.get("incident");
    if (!id || incidents.length === 0) return;
    const match = incidents.find((i) => i.id === id);
    if (match) {
      setSelected(match);
      searchParams.delete("incident");
      setSearchParams(searchParams, { replace: true });
    }
  }, [incidents, searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const list = incidents.filter((i) => {
      if (status !== "all" && i.status !== status) return false;
      if (severity !== "all" && i.severity !== severity) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (![i.title, i.notes ?? "", i.id].some((v) => v.toLowerCase().includes(q))) return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "oldest") return +new Date(a.opened_at) - +new Date(b.opened_at);
      if (sort === "severity") return (SEVERITY_RANK[b.severity ?? ""] ?? 0) - (SEVERITY_RANK[a.severity ?? ""] ?? 0)
        || +new Date(b.opened_at) - +new Date(a.opened_at);
      return +new Date(b.opened_at) - +new Date(a.opened_at);
    });
  }, [incidents, status, severity, search, sort]);

  const stats = useMemo(() => {
    const open = incidents.filter((i) => isOpenCase(i.status));
    const closed = incidents.filter((i) => isClosedCase(i.status) && i.closed_at);
    const unassigned = open.filter((i) => !i.assigned_to).length;
    const mttr = closed.length
      ? closed.reduce((s, i) => s + (+new Date(i.closed_at!) - +new Date(i.opened_at)), 0) / closed.length / 3600_000
      : null;
    const oldest = open.length
      ? Math.max(...open.map((i) => Date.now() - +new Date(i.opened_at))) / 3600_000
      : null;
    return { open: open.length, unassigned, mttr, oldest };
  }, [incidents]);

  const memberName = (id: string | null) =>
    id ? (members.find((m) => m.user_id === id)?.display_name || id.slice(0, 8)) : null;

  const exportCSV = () => {
    downloadCSV(`investigations-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["ID", "Title", "Severity", "Status", "Assigned to", "Opened", "Closed", "Source alert"],
      ...filtered.map((i) => [
        i.id, i.title, i.severity ?? "", i.status, memberName(i.assigned_to) ?? "",
        new Date(i.opened_at).toISOString(), i.closed_at ?? "", i.alert_id ?? "",
      ]),
    ]);
  };

  const toggle = (id: string) => setSelectedIds((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleAll = () => setSelectedIds((s) => s.size === filtered.length ? new Set() : new Set(filtered.map((i) => i.id)));

  const bulkUpdate = async (patch: Partial<Incident>, action: string) => {
    if (!activeTenantId || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const applyPatch: Record<string, unknown> = { ...patch };
    if (patch.status === "closed" || patch.status === "false_positive" || patch.status === "resolved") {
      applyPatch.closed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("incidents").update(applyPatch as never).in("id", ids);
    if (error) return toast.error(error.message);
    await Promise.all(ids.map((id) =>
      auditLog({ tenantId: activeTenantId, action, entityType: "incident", entityId: id, metadata: applyPatch as Record<string, unknown> })
    ));
    toast.success(`${ids.length} investigation${ids.length > 1 ? "s" : ""} updated`);
    setSelectedIds(new Set());
    setAssignOpen(false); setAssignTo("");
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Case Management"
        icon={ShieldCheck}
        title="Investigations"
        description={activeTenant
          ? `Escalated alerts under formal review · ${stats.open} active · ${activeTenant.name}`
          : "Select a tenant"}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/app/alerts")}>
              <Bell className="w-4 h-4" /> Alert queue
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV} disabled={filtered.length === 0}>
              <Download className="w-4 h-4" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setExportOpen(true)}>
              <ShieldCheck className="w-4 h-4" /> Compliance Export
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active cases" value={stats.open} tone="text-warning" />
        <StatTile label="Unassigned" value={stats.unassigned} tone={stats.unassigned ? "text-destructive" : undefined} />
        <StatTile label="Avg. time to close" value={stats.mttr == null ? "—" : `${stats.mttr.toFixed(1)}h`} />
        <StatTile label="Oldest open case" value={stats.oldest == null ? "—" : `${stats.oldest.toFixed(1)}h`} tone="text-primary" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search title, notes, id…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44 bg-card border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="false_positive">False Positive</SelectItem>
          </SelectContent>
        </Select>
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
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-40 bg-card border-border"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="severity">Severity</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <div className="glass border border-primary/30 rounded-xl px-4 py-2.5 flex items-center gap-2 flex-wrap sticky top-16 z-20">
          <Badge className="bg-primary text-primary-foreground">{selectedIds.size} selected</Badge>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => bulkUpdate({ status: "investigating" }, "incident.bulk.acknowledge")}>
            <Eye className="w-3.5 h-3.5 mr-1" /> Acknowledge
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
            <UserCheck className="w-3.5 h-3.5 mr-1" /> Assign
          </Button>
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
            onClick={() => bulkUpdate({ status: "false_positive" }, "incident.bulk.false_positive")}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> False Positive
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Cancel</Button>
        </div>
      )}

      <div className="glass rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 w-10">
                <Checkbox checked={filtered.length > 0 && selectedIds.size === filtered.length} onCheckedChange={toggleAll} />
              </th>
              <th className="text-left px-4 py-3">Investigation</th>
              <th className="text-left px-4 py-3">Severity</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Owner</th>
              <th className="text-left px-4 py-3">Opened</th>
              <th className="text-left px-4 py-3">Closed</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                No investigations. Escalate an alert from the alert queue to open one.
              </td></tr>
            )}
            {filtered.map((i) => (
              <tr key={i.id} className={cn("border-t border-border hover:bg-muted/20", selectedIds.has(i.id) && "bg-primary/5")}>
                <td className="px-4 py-3">
                  <Checkbox checked={selectedIds.has(i.id)} onCheckedChange={() => toggle(i.id)} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {statusIcon(i.status)}
                    <span className="font-medium">{i.title}</span>
                  </div>
                  {i.alert_id && (
                    <button
                      onClick={() => navigate(`/app/alerts?alert=${i.alert_id}`)}
                      className="mt-1 text-xs text-primary hover:underline"
                    >
                      View source alert
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  {i.severity && <Badge variant="outline" className={cn("text-xs", severityColors[i.severity] || "")}>{i.severity}</Badge>}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={cn("text-xs capitalize", statusColors[i.status] || "")}>{i.status.replace("_", " ")}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{memberName(i.assigned_to) ?? "Unassigned"}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(i.opened_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{i.closed_at ? new Date(i.closed_at).toLocaleString() : "—"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => setTimelineFor(i)}><History className="w-3.5 h-3.5 mr-1" />Timeline</Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(i)}>Manage</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && activeTenantId && (
        <ResolutionWorkflowDialog
          open={!!selected} onOpenChange={(v) => !v && setSelected(null)}
          tenantId={activeTenantId} incidentId={selected.id} alertId={selected.alert_id}
          title={selected.title} onResolved={load}
        />
      )}

      {timelineFor && activeTenantId && (
        <IncidentAuditTimeline
          open={!!timelineFor} onOpenChange={(v) => !v && setTimelineFor(null)}
          incidentId={timelineFor.id} alertId={timelineFor.alert_id} tenantId={activeTenantId} title={timelineFor.title}
        />
      )}

      <ComplianceExportDialog open={exportOpen} onOpenChange={setExportOpen} />

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Assign {selectedIds.size} investigation{selectedIds.size > 1 ? "s" : ""}</DialogTitle></DialogHeader>
          <Select value={assignTo} onValueChange={setAssignTo}>
            <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select supervisor" /></SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.display_name || m.user_id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button disabled={!assignTo} onClick={() => bulkUpdate({ assigned_to: assignTo, status: "investigating" }, "incident.bulk.assign")}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
