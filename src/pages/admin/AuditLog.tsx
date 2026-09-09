import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollText, Search, Filter, Download, RefreshCw, Shield, Lock,
  Calendar as CalendarIcon, ChevronDown, User, ExternalLink, FileText,
  AlertTriangle, CheckCircle2, X, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { toast } from "sonner";
import { downloadCSV, downloadTablePDF } from "@/lib/exporters";

interface AuditRow {
  id: string;
  tenant_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

type ProfileMap = Record<string, { display_name: string | null; avatar_url: string | null }>;

const PAGE_SIZE = 200;

const RANGES: { key: string; label: string; hours: number | null }[] = [
  { key: "24h", label: "Last 24 hours", hours: 24 },
  { key: "7d", label: "Last 7 days", hours: 24 * 7 },
  { key: "30d", label: "Last 30 days", hours: 24 * 30 },
  { key: "90d", label: "Last 90 days", hours: 24 * 90 },
  { key: "all", label: "All time", hours: null },
];

const actionTone = (action: string) => {
  if (action.includes("delete") || action.includes("suspend") || action.includes("remove") || action.includes("revoke"))
    return "bg-destructive/10 text-destructive border-destructive/20";
  if (action.includes("create") || action.includes("invite") || action.includes("accept"))
    return "bg-success/10 text-[hsl(var(--success))] border-success/20";
  if (action.includes("update") || action.includes("role_change") || action.includes("configure"))
    return "bg-primary/10 text-primary border-primary/20";
  if (action.includes("resolve") || action.includes("acknowledge")) return "bg-success/10 text-[hsl(var(--success))] border-success/20";
  return "bg-muted text-muted-foreground border-border";
};

const AuditLog = () => {
  const { activeTenant, activeTenantId, tenants } = useTenants();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("7d");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [tenantScope, setTenantScope] = useState<"active" | "all">("active");

  const load = useCallback(async () => {
    if (!activeTenantId && tenantScope === "active") return;
    setLoading(true);
    let q = supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (tenantScope === "active" && activeTenantId) q = q.eq("tenant_id", activeTenantId);
    const r = RANGES.find((x) => x.key === range);
    if (r?.hours) q = q.gte("created_at", new Date(Date.now() - r.hours * 3600_000).toISOString());

    const { data, error } = await q;
    if (error) {
      toast.error("Failed to load audit log: " + error.message);
      setLoading(false);
      return;
    }
    const data_ = (data ?? []) as AuditRow[];
    setRows(data_);
    // Resolve actor profiles
    const ids = Array.from(new Set(data_.map((r) => r.actor_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: pRows } = await supabase.from("profiles").select("id,display_name,avatar_url").in("id", ids);
      setProfiles(Object.fromEntries((pRows ?? []).map((p) => [p.id, p])));
    } else {
      setProfiles({});
    }
    setLoading(false);
  }, [activeTenantId, range, tenantScope]);

  useEffect(() => { load(); }, [load]);

  // Realtime append
  useEffect(() => {
    if (!activeTenantId) return;
    const chan = supabase
      .channel(`audit-${activeTenantId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_log", filter: `tenant_id=eq.${activeTenantId}` },
        (payload) => {
          setRows((prev) => [payload.new as AuditRow, ...prev].slice(0, PAGE_SIZE));
        })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [activeTenantId]);

  const entityTypes = useMemo(() => Array.from(new Set(rows.map((r) => r.entity_type))).sort(), [rows]);
  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))).sort(), [rows]);
  const actors = useMemo(() => Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[], [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (entityFilter !== "all" && r.entity_type !== entityFilter) return false;
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (actorFilter !== "all" && r.actor_id !== actorFilter) return false;
      if (!q) return true;
      const hay = `${r.action} ${r.entity_type} ${r.entity_id ?? ""} ${JSON.stringify(r.metadata ?? {})} ${profiles[r.actor_id ?? ""]?.display_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, entityFilter, actionFilter, actorFilter, profiles]);

  const tenantName = (id: string | null) => tenants.find((t) => t.id === id)?.name ?? "—";
  const actorName = (id: string | null) => (id ? profiles[id]?.display_name ?? `${id.slice(0, 8)}…` : "System");

  const clearFilters = () => {
    setSearch(""); setEntityFilter("all"); setActionFilter("all"); setActorFilter("all"); setRange("7d");
  };
  const filtersActive =
    !!search || entityFilter !== "all" || actionFilter !== "all" || actorFilter !== "all" || range !== "7d";

  const exportCSV = () => {
    downloadCSV(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Record ID", "Timestamp (UTC)", "Actor", "Action", "Entity Type", "Entity ID", "Tenant", "IP", "Metadata"],
      ...filtered.map((r) => [
        `AUD-${r.id.slice(0, 8).toUpperCase()}`,
        new Date(r.created_at).toISOString(),
        actorName(r.actor_id),
        r.action,
        r.entity_type,
        r.entity_id ?? "",
        tenantName(r.tenant_id),
        r.ip_address ?? "",
        JSON.stringify(r.metadata ?? {}),
      ]),
    ]);
    toast.success(`Exported ${filtered.length} audit records`);
  };

  const exportPDF = () => {
    downloadTablePDF({
      filename: `audit-log-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "Compliance Audit Trail",
      subtitle: `${activeTenant?.name ?? "All tenants"} · ${filtered.length} records · Generated ${new Date().toLocaleString()}`,
      head: ["Timestamp", "Actor", "Action", "Entity", "Record ID"],
      body: filtered.map((r) => [
        new Date(r.created_at).toLocaleString(),
        actorName(r.actor_id),
        r.action,
        `${r.entity_type}${r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}`,
        `AUD-${r.id.slice(0, 8).toUpperCase()}`,
      ]),
    });
    toast.success("PDF export ready");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance"
        icon={ScrollText}
        title="Audit Trail"
        description={activeTenant ? `Immutable activity ledger · ${activeTenant.name}` : "Immutable, append-only activity ledger"}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} /> Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm"><Download className="w-4 h-4 mr-1.5" /> Export <ChevronDown className="w-3 h-3 ml-1" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCSV}><FileText className="w-4 h-4 mr-2" /> CSV (full metadata)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF}><FileText className="w-4 h-4 mr-2" /> PDF (compliance report)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Compliance banner */}
      <div className="glass rounded-xl border border-border p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Append-only ledger</p>
            <p className="text-xs text-muted-foreground">Rows cannot be modified or deleted from the app; retention 7 years.</p>
          </div>
        </div>
        <div className="hidden md:block h-8 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Standards</p>
            <p className="text-xs text-muted-foreground">SOC 2 CC7.2 · ISO 27001 A.12.4 · 29 CFR 1904 · GDPR Art. 30</p>
          </div>
        </div>
        <div className="hidden md:block h-8 w-px bg-border" />
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
          <div>
            <p className="text-sm font-medium">Tamper evidence</p>
            <p className="text-xs text-muted-foreground">Every write includes actor, IP, tenant scope & timestamp (UTC).</p>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Events (window)", value: filtered.length },
          { label: "Unique actors", value: new Set(filtered.map((r) => r.actor_id)).size },
          { label: "Entity types", value: new Set(filtered.map((r) => r.entity_type)).size },
          { label: "Distinct actions", value: new Set(filtered.map((r) => r.action)).size },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass rounded-xl border border-border p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-full sm:w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search actions, entities, metadata, actor…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-44"><CalendarIcon className="w-4 h-4 mr-1.5" /><SelectValue /></SelectTrigger>
          <SelectContent>{RANGES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Entity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {entityTypes.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actorFilter} onValueChange={setActorFilter}>
          <SelectTrigger className="w-44"><User className="w-4 h-4 mr-1.5" /><SelectValue placeholder="Actor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actors</SelectItem>
            {actors.map((a) => <SelectItem key={a} value={a}>{profiles[a]?.display_name ?? a.slice(0, 8)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tenantScope} onValueChange={(v) => setTenantScope(v as never)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active tenant</SelectItem>
            <SelectItem value="all">All my tenants</SelectItem>
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters}><X className="w-4 h-4 mr-1" /> Clear</Button>
        )}
      </div>

      {/* Table */}
      <div className="glass rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                <th className="p-3 text-xs font-medium text-muted-foreground w-40">Timestamp (UTC)</th>
                <th className="p-3 text-xs font-medium text-muted-foreground">Actor</th>
                <th className="p-3 text-xs font-medium text-muted-foreground">Action</th>
                <th className="p-3 text-xs font-medium text-muted-foreground">Entity</th>
                <th className="p-3 text-xs font-medium text-muted-foreground">Record ID</th>
                <th className="p-3 text-xs font-medium text-muted-foreground">Tenant</th>
                <th className="p-3 text-xs font-medium text-muted-foreground text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading audit trail…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  No audit events for the current filters.
                </td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id}
                  onClick={() => setSelected(r)}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer">
                  <td className="p-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toISOString().slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                        {(actorName(r.actor_id) ?? "?").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm text-foreground truncate max-w-full sm:w-[160px]">{actorName(r.actor_id)}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={cn("text-xs font-mono", actionTone(r.action))}>{r.action}</Badge>
                  </td>
                  <td className="p-3 text-sm text-foreground">{r.entity_type}</td>
                  <td className="p-3 text-xs font-mono text-muted-foreground">AUD-{r.id.slice(0, 8).toUpperCase()}</td>
                  <td className="p-3 text-xs text-muted-foreground truncate max-w-full sm:w-[140px]">{tenantName(r.tenant_id)}</td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" className="h-7"><ExternalLink className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length >= PAGE_SIZE && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t border-border">
            Showing latest {PAGE_SIZE} events. Narrow filters or export for a fuller trail.
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ScrollText className="w-5 h-5 text-primary" /> Audit Record
                </SheetTitle>
                <SheetDescription className="font-mono text-xs">AUD-{selected.id.slice(0, 8).toUpperCase()} · immutable</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Action"><Badge variant="outline" className={cn("text-xs font-mono", actionTone(selected.action))}>{selected.action}</Badge></Field>
                  <Field label="Entity type"><code className="text-xs">{selected.entity_type}</code></Field>
                  <Field label="Entity ID"><code className="text-xs break-all">{selected.entity_id ?? "—"}</code></Field>
                  <Field label="Timestamp (UTC)"><span className="font-mono text-xs">{new Date(selected.created_at).toISOString()}</span></Field>
                  <Field label="Actor"><span>{actorName(selected.actor_id)}</span></Field>
                  <Field label="IP"><span className="font-mono text-xs">{selected.ip_address ?? "—"}</span></Field>
                  <Field label="Tenant"><span>{tenantName(selected.tenant_id)}</span></Field>
                  <Field label="Record hash"><span className="font-mono text-[10px] break-all">{selected.id}</span></Field>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Metadata</p>
                  <pre className="text-[11px] font-mono bg-muted/40 border border-border rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(selected.metadata ?? {}, null, 2)}
                  </pre>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-primary mb-1"><Lock className="w-3.5 h-3.5" /> Chain of custody</div>
                  <p className="text-muted-foreground">This record is protected by RLS append-only policy and retained for 7 years for SOC 2, ISO 27001 and OSHA 29 CFR 1904.33 compliance.</p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
    <div>{children}</div>
  </div>
);

export default AuditLog;
