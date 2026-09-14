import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Loader2, RefreshCw, Search, Download } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { cn } from "@/lib/utils";

interface AlertRow {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  type: string;
  zone: string | null;
  detected_at: string;
  camera_id: string | null;
}

const severityCls = (s: string) =>
  s === "critical" ? "bg-destructive/10 text-destructive border-destructive/20"
    : s === "high" ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20"
      : "bg-primary/10 text-primary border-primary/20";

const PortalAlerts = () => {
  const { activeTenantId, loading: tenantsLoading } = useTenants();
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [cameras, setCameras] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("7");

  const load = useCallback(async () => {
    if (!activeTenantId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const since = new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000).toISOString();
    const [alertsRes, camRes] = await Promise.all([
      supabase.from("alerts")
        .select("id,title,description,severity,status,type,zone,detected_at,camera_id")
        .eq("tenant_id", activeTenantId)
        .gte("detected_at", since)
        .order("detected_at", { ascending: false })
        .limit(1000),
      supabase.from("cameras").select("id,name").eq("tenant_id", activeTenantId),
    ]);
    setRows((alertsRes.data ?? []) as AlertRow[]);
    setCameras(Object.fromEntries((camRes.data ?? []).map((c) => [c.id, c.name])));
    setLoading(false);
  }, [activeTenantId, range]);

  useEffect(() => { if (!tenantsLoading) load(); }, [tenantsLoading, load]);

  useEffect(() => {
    if (!activeTenantId) return;
    const channel = supabase
      .channel(`portal-alerts:${activeTenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `tenant_id=eq.${activeTenantId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTenantId, load]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (severity !== "all" && r.severity !== severity) return false;
    if (status !== "all" && r.status !== status) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [r.title, r.description, r.zone, cameras[r.camera_id ?? ""]]
      .some((v) => (v ?? "").toLowerCase().includes(q));
  }), [rows, severity, status, query, cameras]);

  const exportCsv = () => {
    const header = ["Detected", "Title", "Severity", "Status", "Camera", "Zone"];
    const body = filtered.map((r) => [
      new Date(r.detected_at).toISOString(), r.title, r.severity, r.status,
      cameras[r.camera_id ?? ""] ?? "", r.zone ?? "",
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `site-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        eyebrow="Manager portal"
        icon={Bell}
        title="Site alerts"
        description="Everything the AI flagged at your site. Read-only — operators triage and resolve from the console."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} className="gap-2" disabled={filtered.length === 0}>
              <Download className="w-4 h-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={load} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </>
        }
      />

      <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search alerts, cameras or zones…"
            className="pl-10 h-10"
            aria-label="Search alerts"
          />
        </div>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-10 w-full sm:w-[150px]" aria-label="Severity"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 w-full sm:w-[150px]" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-10 w-full sm:w-[150px]" aria-label="Time range"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">No alerts match these filters.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm">{r.title}</div>
                  {r.description && (
                    <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.description}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {cameras[r.camera_id ?? ""] ?? "Unassigned camera"}
                    {r.zone ? ` · ${r.zone}` : ""} · {new Date(r.detected_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={cn("capitalize", severityCls(r.severity))}>{r.severity}</Badge>
                  <Badge variant="outline" className="capitalize">{r.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
};

export default PortalAlerts;
