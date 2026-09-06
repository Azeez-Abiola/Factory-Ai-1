import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock, Shield, AlertTriangle, CheckCircle, TrendingUp, ChevronRight, FileText, ArrowRight,
  Search, ClipboardList, Play, LogOut, UserCheck, Loader2, Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import PageHeader from "@/components/app/PageHeader";
import HandoverDialog, { HandoverDraft } from "@/components/app/HandoverDialog";
import { downloadCSV, downloadTablePDF } from "@/lib/exporters";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenants } from "@/hooks/useTenants";
import { auditLog } from "@/lib/audit";

interface ShiftRow {
  id: string;
  tenant_id: string;
  name: string;
  supervisor_id: string;
  incoming_supervisor_id: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  opening_notes: string | null;
  handover_notes: string | null;
  acceptance_notes: string | null;
  key_events: string[];
  unresolved_issues: string[];
  recommendations: string[];
  metrics: Record<string, number>;
}

interface Member { user_id: string; display_name: string }

const SHIFT_PRESETS = [
  { name: "Morning Shift", hint: "06:00 – 14:00" },
  { name: "Afternoon Shift", hint: "14:00 – 22:00" },
  { name: "Night Shift", hint: "22:00 – 06:00" },
];

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const asMetrics = (v: unknown): Record<string, number> =>
  v && typeof v === "object" ? (v as Record<string, number>) : {};

const fmtDuration = (fromISO: string, toISO?: string | null) => {
  const ms = new Date(toISO ?? Date.now()).getTime() - new Date(fromISO).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

const ShiftReports = () => {
  const { user } = useAuth();
  const { activeTenantId, activeTenant } = useTenants();

  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [startOpen, setStartOpen] = useState(false);
  const [startName, setStartName] = useState(SHIFT_PRESETS[0].name);
  const [openingNotes, setOpeningNotes] = useState("");

  const [handoverOpen, setHandoverOpen] = useState(false);
  const [draft, setDraft] = useState<HandoverDraft>({ keyEvents: [], unresolvedIssues: [], recommendations: [], notes: "" });
  const [liveCounts, setLiveCounts] = useState({ alerts: 0, critical: 0, incidents: 0, resolved: 0 });

  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptanceNotes, setAcceptanceNotes] = useState("");

  const [selected, setSelected] = useState<ShiftRow | null>(null);
  const [search, setSearch] = useState("");
  const [filterShift, setFilterShift] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "safety" | "efficiency">("date");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const nameOf = useCallback(
    (id: string | null) => (id ? members.find((m) => m.user_id === id)?.display_name ?? "Team member" : "—"),
    [members],
  );

  const load = useCallback(async () => {
    if (!activeTenantId) { setShifts([]); setLoading(false); return; }
    setLoading(true);
    const [{ data, error }, mem] = await Promise.all([
      supabase.from("shifts").select("*").eq("tenant_id", activeTenantId).order("started_at", { ascending: false }).limit(100),
      supabase.from("tenant_members").select("user_id").eq("tenant_id", activeTenantId),
    ]);
    if (error) toast.error(error.message);
    setShifts(((data ?? []) as Record<string, unknown>[]).map((r) => ({
      ...(r as unknown as ShiftRow),
      key_events: asList(r.key_events),
      unresolved_issues: asList(r.unresolved_issues),
      recommendations: asList(r.recommendations),
      metrics: asMetrics(r.metrics),
    })));

    const ids = ((mem.data ?? []) as { user_id: string }[]).map((m) => m.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      const map = Object.fromEntries(((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name]));
      setMembers(ids.map((id) => ({ user_id: id, display_name: map[id] ?? "Team member" })));
    } else setMembers([]);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => { load(); }, [load]);

  // Keep every supervisor's board in sync while shifts change hands.
  useEffect(() => {
    if (!activeTenantId) return;
    const channel = supabase
      .channel(`shifts:${activeTenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `tenant_id=eq.${activeTenantId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTenantId, load]);

  const activeShift = shifts.find((s) => s.status === "active") ?? null;
  const pendingHandover = shifts.find((s) => s.status === "pending_handover") ?? null;
  const history = useMemo(() => shifts.filter((s) => s.status === "accepted"), [shifts]);

  /** Pull what actually happened between the shift start and now. */
  const gatherShiftActivity = useCallback(async (shift: ShiftRow) => {
    const [alertsRes, incidentsRes] = await Promise.all([
      supabase.from("alerts").select("id,title,severity,status,zone,detected_at")
        .eq("tenant_id", shift.tenant_id).gte("detected_at", shift.started_at).order("detected_at", { ascending: false }),
      supabase.from("incidents").select("id,title,status,severity,opened_at")
        .eq("tenant_id", shift.tenant_id).gte("opened_at", shift.started_at),
    ]);
    const alerts = (alertsRes.data ?? []) as { id: string; title: string; severity: string; status: string; zone: string | null; detected_at: string }[];
    const incidents = (incidentsRes.data ?? []) as { id: string; title: string; status: string; severity: string | null }[];
    const openStatuses = ["open", "new", "active", "investigating"];
    const unresolvedAlerts = alerts.filter((a) => openStatuses.includes(a.status));
    const openIncidents = incidents.filter((i) => openStatuses.includes(i.status));
    const critical = alerts.filter((a) => a.severity === "critical").length;
    const resolved = alerts.length - unresolvedAlerts.length;
    const safetyScore = alerts.length === 0 ? 100 : Math.max(0, Math.round(100 - (critical * 8 + unresolvedAlerts.length * 4)));
    return {
      alerts, incidents, unresolvedAlerts, openIncidents, critical, resolved,
      metrics: {
        alerts: alerts.length,
        critical,
        incidents: incidents.length,
        resolved,
        unresolved: unresolvedAlerts.length,
        safetyScore,
        resolutionRate: alerts.length ? Math.round((resolved / alerts.length) * 100) : 100,
      },
    };
  }, []);

  // Live counters for the running shift.
  useEffect(() => {
    if (!activeShift) { setLiveCounts({ alerts: 0, critical: 0, incidents: 0, resolved: 0 }); return; }
    let cancelled = false;
    gatherShiftActivity(activeShift).then((a) => {
      if (!cancelled) setLiveCounts({ alerts: a.metrics.alerts, critical: a.critical, incidents: a.metrics.incidents, resolved: a.resolved });
    });
    return () => { cancelled = true; };
  }, [activeShift, gatherShiftActivity, now]);

  const startShift = async () => {
    if (!activeTenantId || !user) return;
    if (activeShift) return toast.error("A shift is already running. End it before starting a new one.");
    setBusy(true);
    const { data, error } = await supabase.from("shifts").insert({
      tenant_id: activeTenantId, name: startName, supervisor_id: user.id,
      opening_notes: openingNotes.trim() || null,
    }).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    await auditLog({ tenantId: activeTenantId, action: "shift.start", entityType: "shift", entityId: data.id, metadata: { name: startName } });
    setStartOpen(false);
    setOpeningNotes("");
    toast.success(`${startName} started — you are the supervisor on duty.`);
    load();
  };

  const openHandover = async () => {
    if (!activeShift) return;
    setBusy(true);
    const a = await gatherShiftActivity(activeShift);
    setBusy(false);
    setDraft({
      keyEvents: a.alerts.slice(0, 8).map((x) => `${x.severity.toUpperCase()} · ${x.title}${x.zone ? ` (${x.zone})` : ""} at ${fmtTime(x.detected_at)}`),
      unresolvedIssues: [
        ...a.unresolvedAlerts.map((x) => `Open alert: ${x.title}${x.zone ? ` (${x.zone})` : ""}`),
        ...a.openIncidents.map((x) => `Open incident: ${x.title}`),
      ],
      recommendations: a.critical > 0
        ? [`Follow up on ${a.critical} critical alert${a.critical > 1 ? "s" : ""} raised this shift`]
        : [],
      notes: "",
    });
    setHandoverOpen(true);
  };

  const submitHandover = async (payload: HandoverDraft & { incomingSupervisorId: string | null }) => {
    if (!activeShift || !activeTenantId) return;
    const a = await gatherShiftActivity(activeShift);
    const { error } = await supabase.from("shifts").update({
      status: "pending_handover",
      ended_at: new Date().toISOString(),
      incoming_supervisor_id: payload.incomingSupervisorId,
      handover_notes: payload.notes,
      key_events: payload.keyEvents,
      unresolved_issues: payload.unresolvedIssues,
      recommendations: payload.recommendations,
      metrics: a.metrics,
    }).eq("id", activeShift.id);
    if (error) { toast.error(error.message); return; }
    await auditLog({
      tenantId: activeTenantId, action: "shift.handover", entityType: "shift", entityId: activeShift.id,
      metadata: { name: activeShift.name, unresolved: payload.unresolvedIssues.length },
    });
    toast.success("Shift ended — handover is waiting to be accepted.");
    load();
  };

  const acceptHandover = async () => {
    if (!pendingHandover || !user || !activeTenantId) return;
    setBusy(true);
    const { error } = await supabase.from("shifts").update({
      status: "accepted", accepted_at: new Date().toISOString(),
      accepted_by: user.id, acceptance_notes: acceptanceNotes.trim() || null,
    }).eq("id", pendingHandover.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await auditLog({ tenantId: activeTenantId, action: "shift.accept", entityType: "shift", entityId: pendingHandover.id, metadata: { name: pendingHandover.name } });
    setAcceptOpen(false);
    setAcceptanceNotes("");
    toast.success("Handover accepted — you can now start your shift.");
    load();
  };

  const shiftNames = useMemo(() => Array.from(new Set(history.map((r) => r.name))), [history]);

  const filtered = useMemo(() => {
    let result = [...history];
    if (filterShift !== "all") result = result.filter((r) => r.name === filterShift);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        nameOf(r.supervisor_id).toLowerCase().includes(q) ||
        fmtDate(r.started_at).includes(q));
    }
    result.sort((a, b) => {
      if (sortBy === "safety") return (b.metrics.safetyScore ?? 0) - (a.metrics.safetyScore ?? 0);
      if (sortBy === "efficiency") return (b.metrics.resolutionRate ?? 0) - (a.metrics.resolutionRate ?? 0);
      return b.started_at.localeCompare(a.started_at);
    });
    return result;
  }, [history, filterShift, search, sortBy, nameOf]);

  const handleExportAll = () => {
    if (filtered.length === 0) return toast.info("No completed shifts to export");
    const rows: (string | number)[][] = [
      ["Shift", "Date", "Start", "End", "Outgoing supervisor", "Accepted by", "Safety %", "Resolution %", "Alerts", "Unresolved"],
      ...filtered.map((r) => [
        r.name, fmtDate(r.started_at), fmtTime(r.started_at), r.ended_at ? fmtTime(r.ended_at) : "—",
        nameOf(r.supervisor_id), nameOf(r.accepted_by),
        r.metrics.safetyScore ?? 0, r.metrics.resolutionRate ?? 0, r.metrics.alerts ?? 0, r.metrics.unresolved ?? 0,
      ]),
    ];
    downloadCSV(`shift-handovers-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success(`Exported ${filtered.length} shift${filtered.length > 1 ? "s" : ""}`);
  };

  const exportShiftPDF = (r: ShiftRow) => {
    downloadTablePDF({
      filename: `shift-${fmtDate(r.started_at).replace(/\//g, "-")}.pdf`,
      title: `${r.name} — ${fmtDate(r.started_at)}`,
      subtitle: `${activeTenant?.name ?? ""} · Supervisor: ${nameOf(r.supervisor_id)} · ${fmtTime(r.started_at)}–${r.ended_at ? fmtTime(r.ended_at) : "—"}`,
      head: ["Item", "Detail"],
      body: [
        ["Safety score", `${r.metrics.safetyScore ?? 0}%`],
        ["Alerts raised", r.metrics.alerts ?? 0],
        ["Critical alerts", r.metrics.critical ?? 0],
        ["Incidents", r.metrics.incidents ?? 0],
        ["Resolution rate", `${r.metrics.resolutionRate ?? 0}%`],
        ["Accepted by", `${nameOf(r.accepted_by)}${r.accepted_at ? ` at ${fmtTime(r.accepted_at)}` : ""}`],
        ["Handover note", r.handover_notes ?? "—"],
        ["Key events", r.key_events.join("; ") || "—"],
        ["Unresolved issues", r.unresolved_issues.join("; ") || "—"],
        ["Recommendations", r.recommendations.join("; ") || "—"],
      ],
      orientation: "portrait",
    });
    toast.success("Handover PDF downloaded");
  };

  const isMyShift = activeShift?.supervisor_id === user?.id;
  const canAccept = pendingHandover &&
    (!pendingHandover.incoming_supervisor_id || pendingHandover.incoming_supervisor_id === user?.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Handover"
        icon={ClipboardList}
        title="Shift Handover"
        description="Start a shift, capture what happened, and hand the floor over with an auditable sign-off."
        actions={
          <Button variant="outline" className="border-border" onClick={handleExportAll}>
            <FileText className="w-4 h-4 mr-2" /> Export All
          </Button>
        }
      />

      {/* ── Live shift console ───────────────────────────────────────── */}
      <div className="glass rounded-xl border border-border p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading shift status…
          </div>
        ) : pendingHandover ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Awaiting acceptance</Badge>
              <div>
                <h3 className="font-semibold">{pendingHandover.name} handed over by {nameOf(pendingHandover.supervisor_id)}</h3>
                <p className="text-xs text-muted-foreground">
                  {fmtTime(pendingHandover.started_at)}–{pendingHandover.ended_at ? fmtTime(pendingHandover.ended_at) : "—"} ·{" "}
                  {pendingHandover.incoming_supervisor_id
                    ? `For ${nameOf(pendingHandover.incoming_supervisor_id)}`
                    : "Open to the next supervisor on duty"}
                </p>
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" onClick={() => setSelected(pendingHandover)}>Review</Button>
                <Button onClick={() => setAcceptOpen(true)} disabled={!canAccept}>
                  <UserCheck className="w-4 h-4 mr-2" /> Accept handover
                </Button>
              </div>
            </div>
            {pendingHandover.handover_notes && (
              <p className="text-sm text-muted-foreground border-l-2 border-primary/40 pl-3">{pendingHandover.handover_notes}</p>
            )}
            {pendingHandover.unresolved_issues.length > 0 && (
              <p className="text-sm text-warning">
                {pendingHandover.unresolved_issues.length} issue(s) carried over — review before accepting.
              </p>
            )}
            {!canAccept && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" /> Only {nameOf(pendingHandover.incoming_supervisor_id)} can accept this handover.
              </p>
            )}
          </div>
        ) : activeShift ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-70" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
              </span>
              <div>
                <h3 className="font-semibold">{activeShift.name} in progress</h3>
                <p className="text-xs text-muted-foreground">
                  Supervisor on duty: {nameOf(activeShift.supervisor_id)} · started {fmtTime(activeShift.started_at)} · running {fmtDuration(activeShift.started_at)}
                </p>
              </div>
              <div className="ml-auto">
                <Button onClick={openHandover} disabled={busy || !isMyShift}>
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                  End shift &amp; hand over
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Alerts this shift", value: liveCounts.alerts, tone: "text-foreground" },
                { label: "Critical", value: liveCounts.critical, tone: liveCounts.critical ? "text-destructive" : "text-foreground" },
                { label: "Incidents", value: liveCounts.incidents, tone: "text-foreground" },
                { label: "Alerts closed", value: liveCounts.resolved, tone: "text-success" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={cn("text-2xl font-bold", s.tone)}>{s.value}</p>
                </div>
              ))}
            </div>
            {!isMyShift && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" /> Only the supervisor on duty can end this shift.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h3 className="font-semibold">No shift running</h3>
              <p className="text-sm text-muted-foreground">
                Start a shift to take ownership of the floor. Everything detected from that moment is captured for your handover.
              </p>
            </div>
            <Button className="ml-auto" onClick={() => setStartOpen(true)} disabled={!activeTenantId}>
              <Play className="w-4 h-4 mr-2" /> Start shift
            </Button>
          </div>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by shift, supervisor, date…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={filterShift} onValueChange={setFilterShift}>
          <SelectTrigger className="w-44 bg-card border-border"><SelectValue placeholder="Shift" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Shifts</SelectItem>
            {shiftNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-44 bg-card border-border"><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Newest First</SelectItem>
            <SelectItem value="safety">Highest Safety</SelectItem>
            <SelectItem value="efficiency">Highest Resolution</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── History ──────────────────────────────────────────────────── */}
      {!loading && filtered.length === 0 && (
        <div className="glass rounded-xl p-12 border border-border text-center text-muted-foreground text-sm">
          No completed handovers yet. Once a shift is ended and accepted it appears here.
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((report) => (
          <div
            key={report.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(report)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(report); } }}
            className="glass rounded-xl p-5 border border-border hover:border-primary/30 cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{report.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(report.started_at)} · {fmtTime(report.started_at)}–{report.ended_at ? fmtTime(report.ended_at) : "—"} ·{" "}
                    {nameOf(report.supervisor_id)} → {nameOf(report.accepted_by)}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Safety:</span>
                <span className={cn("font-semibold",
                  (report.metrics.safetyScore ?? 0) >= 90 ? "text-success" : (report.metrics.safetyScore ?? 0) >= 80 ? "text-warning" : "text-destructive")}>
                  {report.metrics.safetyScore ?? 0}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-muted-foreground">Alerts:</span>
                <span className="text-foreground font-semibold">{report.metrics.alerts ?? 0}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-muted-foreground">Closed:</span>
                <span className="text-foreground font-semibold">{report.metrics.resolved ?? 0}/{report.metrics.alerts ?? 0}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Resolution:</span>
                <span className="text-foreground font-semibold">{report.metrics.resolutionRate ?? 0}%</span>
              </div>
            </div>

            {report.unresolved_issues.length > 0 && (
              <div className="mt-3">
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                  {report.unresolved_issues.length} carried over
                </Badge>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Start shift ──────────────────────────────────────────────── */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a shift</DialogTitle>
            <DialogDescription>
              You become the supervisor on duty. Alerts and incidents from now until you hand over are recorded against this shift.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Shift <span className="text-destructive">*</span></Label>
              <Select value={startName} onValueChange={setStartName}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHIFT_PRESETS.map((p) => (
                    <SelectItem key={p.name} value={p.name}>{p.name} · {p.hint}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="opening-notes">Opening notes</Label>
              <Textarea
                id="opening-notes" rows={3} value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
                placeholder="Anything you are picking up from the previous shift…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>Cancel</Button>
            <Button onClick={startShift} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Start shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Accept handover ──────────────────────────────────────────── */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept handover</DialogTitle>
            <DialogDescription>
              Confirm you have read the outgoing supervisor's notes and are taking responsibility for the open issues.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="acceptance-notes">Acceptance notes</Label>
            <Textarea
              id="acceptance-notes" rows={3} value={acceptanceNotes}
              onChange={(e) => setAcceptanceNotes(e.target.value)}
              placeholder="Optional — anything you queried or disagreed with."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptOpen(false)}>Cancel</Button>
            <Button onClick={acceptHandover} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Sign off &amp; accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeShift && (
        <HandoverDialog
          open={handoverOpen}
          onOpenChange={setHandoverOpen}
          shiftName={activeShift.name}
          draft={draft}
          members={members}
          currentUserId={user?.id}
          metricsSummary={[
            { label: "Duration", value: fmtDuration(activeShift.started_at) },
            { label: "Alerts", value: String(liveCounts.alerts) },
            { label: "Critical", value: String(liveCounts.critical) },
            { label: "Incidents", value: String(liveCounts.incidents) },
          ]}
          onSubmit={submitHandover}
        />
      )}

      {/* ── Detail ───────────────────────────────────────────────────── */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  {selected.name} – {fmtDate(selected.started_at)}
                </DialogTitle>
                <DialogDescription>
                  {nameOf(selected.supervisor_id)} → {selected.accepted_by ? nameOf(selected.accepted_by) : "awaiting acceptance"} ·{" "}
                  {fmtTime(selected.started_at)}–{selected.ended_at ? fmtTime(selected.ended_at) : "—"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Safety Score", value: `${selected.metrics.safetyScore ?? 0}%` },
                    { label: "Alerts", value: `${selected.metrics.alerts ?? 0}` },
                    { label: "Closed", value: `${selected.metrics.resolved ?? 0}/${selected.metrics.alerts ?? 0}` },
                    { label: "Resolution", value: `${selected.metrics.resolutionRate ?? 0}%` },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                      <p className="text-lg font-bold">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {selected.handover_notes && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Handover note</h4>
                    <p className="text-sm text-muted-foreground">{selected.handover_notes}</p>
                  </div>
                )}

                {selected.key_events.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Key events</h4>
                    <ul className="space-y-2">
                      {selected.key_events.map((evt, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <ArrowRight className="w-3 h-3 mt-1 shrink-0 text-primary" />{evt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.unresolved_issues.length > 0 && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-destructive mb-2">Carried over</h4>
                    <ul className="space-y-1">
                      {selected.unresolved_issues.map((issue, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <AlertTriangle className="w-3 h-3 mt-1 shrink-0 text-destructive" />{issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.recommendations.length > 0 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-primary mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {selected.recommendations.map((rec, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <CheckCircle className="w-3 h-3 mt-1 shrink-0 text-primary" />{rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.acceptance_notes && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Acceptance notes</h4>
                    <p className="text-sm text-muted-foreground">{selected.acceptance_notes}</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => exportShiftPDF(selected)}>
                    <FileText className="w-4 h-4" /> Export PDF
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftReports;
