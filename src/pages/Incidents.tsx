import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { AlertOctagon, CheckCircle2, Clock, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import PageHeader from "@/components/app/PageHeader";
import ResolutionWorkflowDialog from "@/components/app/ResolutionWorkflowDialog";

interface Incident {
  id: string;
  tenant_id: string;
  alert_id: string | null;
  title: string;
  status: string;
  severity: string | null;
  assigned_to: string | null;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
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
};

const statusIcon = (s: string) => {
  if (s === "resolved" || s === "closed") return <CheckCircle2 className="w-4 h-4 text-success" />;
  if (s === "investigating") return <Clock className="w-4 h-4 text-primary" />;
  return <AlertOctagon className="w-4 h-4 text-warning" />;
};

export default function Incidents() {
  const { activeTenantId, activeTenant } = useTenants();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Incident | null>(null);

  const load = async () => {
    if (!activeTenantId) { setIncidents([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("incidents").select("*").eq("tenant_id", activeTenantId)
      .order("opened_at", { ascending: false }).limit(200);
    if (error) toast.error(error.message);
    setIncidents((data ?? []) as Incident[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!activeTenantId) return;
    const channel = supabase
      .channel(`incidents:${activeTenantId}`)
      .on(
        "postgres_changes",
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

  const filtered = useMemo(() => incidents.filter((i) => {
    if (status !== "all" && i.status !== status) return false;
    if (search.trim() && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [incidents, status, search]);

  const stats = useMemo(() => ({
    total: incidents.length,
    open: incidents.filter((i) => i.status === "open" || i.status === "investigating").length,
    resolved: incidents.filter((i) => i.status === "resolved" || i.status === "closed").length,
  }), [incidents]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Case Management"
        icon={ShieldCheck}
        title="Incidents"
        description={activeTenant ? `${stats.open} active · ${stats.resolved} resolved · ${activeTenant.name}` : "Select a tenant"}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search incidents…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44 bg-card border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Incident</th>
              <th className="text-left px-4 py-3">Severity</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Opened</th>
              <th className="text-left px-4 py-3">Closed</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No incidents.</td></tr>
            )}
            {filtered.map((i) => (
              <tr key={i.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {statusIcon(i.status)}
                    <span className="font-medium">{i.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {i.severity && <Badge variant="outline" className={cn("text-xs", severityColors[i.severity] || "")}>{i.severity}</Badge>}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={cn("text-xs capitalize", statusColors[i.status] || "")}>{i.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(i.opened_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{i.closed_at ? new Date(i.closed_at).toLocaleString() : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setSelected(i)}>Manage</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && activeTenantId && (
        <ResolutionWorkflowDialog
          open={!!selected}
          onOpenChange={(v) => !v && setSelected(null)}
          tenantId={activeTenantId}
          incidentId={selected.id}
          alertId={selected.alert_id}
          title={selected.title}
          onResolved={load}
        />
      )}
    </div>
  );
}
