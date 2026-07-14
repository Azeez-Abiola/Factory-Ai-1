import { useEffect, useState } from "react";
import { Activity, Server, HardDrive, Cpu, AlertTriangle, RefreshCw, Video, Bell, Users, Building2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Health {
  generated_at: string;
  counts: {
    audit_24h: number;
    audit_prev_24h: number;
    alerts_24h: number;
    alerts_prev_24h: number;
    incidents_24h: number;
    cameras_total: number;
    cameras_online: number;
    tenants_total: number;
    notifications_24h: number;
    notifications_failed_24h: number;
  };
  traffic: { time: string; events: number; alerts: number }[];
  tenant_usage: { name: string; alerts: number; incidents: number; cameras: number }[];
  recent_log: {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    tenant_id: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
    ip_address: string | null;
  }[];
  inference_status: Record<string, number>;
}

const trendPct = (curr: number, prev: number) => {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
};

const severityForAction = (action: string): "info" | "warn" | "error" => {
  const a = action.toLowerCase();
  if (a.includes("delete") || a.includes("fail") || a.includes("error")) return "error";
  if (a.includes("escalat") || a.includes("update") || a.includes("suspend")) return "warn";
  return "info";
};

const logLevelColors = {
  error: "bg-destructive/10 text-destructive border-destructive/20",
  warn: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20",
  info: "bg-primary/10 text-primary border-primary/20",
};

const SystemMonitoring = () => {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    const { data, error } = await supabase.functions.invoke("system-health");
    if (error) {
      toast.error("Failed to load system health");
      console.error(error);
    } else {
      setHealth(data as Health);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    // realtime audit_log stream
    const channel = supabase
      .channel("system-audit")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_log" }, () => load())
      .subscribe();
    return () => {
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading || !health) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Observability" icon={Activity} title="System Monitoring" description="Loading live platform signals…" />
        <div className="glass rounded-xl p-8 border border-border text-center text-muted-foreground">Fetching live health…</div>
      </div>
    );
  }

  const c = health.counts;
  const cameraUptime = c.cameras_total ? Math.round((c.cameras_online / c.cameras_total) * 100) : 0;
  const notifSuccess = c.notifications_24h
    ? Math.round(((c.notifications_24h - c.notifications_failed_24h) / c.notifications_24h) * 100)
    : 100;

  const metrics = [
    { label: "Events (24h)", value: c.audit_24h.toLocaleString(), icon: Activity, sub: `${trendPct(c.audit_24h, c.audit_prev_24h)}% vs prior day` },
    { label: "Alerts (24h)", value: c.alerts_24h.toLocaleString(), icon: AlertTriangle, sub: `${trendPct(c.alerts_24h, c.alerts_prev_24h)}% vs prior day` },
    { label: "Incidents (24h)", value: c.incidents_24h.toLocaleString(), icon: Bell, sub: "New tickets opened" },
    { label: "Camera Uptime", value: `${cameraUptime}%`, icon: Video, sub: `${c.cameras_online}/${c.cameras_total} online` },
    { label: "Notification Success", value: `${notifSuccess}%`, icon: Server, sub: `${c.notifications_failed_24h} failed / ${c.notifications_24h} sent` },
    { label: "Tenants", value: c.tenants_total.toLocaleString(), icon: Building2, sub: "Active organizations" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Observability"
        icon={Activity}
        title="System Monitoring"
        description="Live platform health from audit, alerts, cameras and notifications."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
            <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="glass rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <metric.icon className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{metric.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{metric.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Platform Traffic (24h)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={health.traffic}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 16%)" />
              <XAxis dataKey="time" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(220 18% 8%)", border: "1px solid hsl(220 14% 16%)", borderRadius: 8, color: "hsl(210 20% 92%)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="events" stroke="hsl(172 66% 50%)" fill="hsl(172 66% 50% / 0.15)" strokeWidth={2} name="Audit events" />
              <Area type="monotone" dataKey="alerts" stroke="hsl(38 92% 50%)" fill="hsl(38 92% 50% / 0.15)" strokeWidth={2} name="Alerts" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Usage by Tenant (24h)</h3>
          {health.tenant_usage.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">No tenant activity yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={health.tenant_usage} layout="vertical">
                <XAxis type="number" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={{ background: "hsl(220 18% 8%)", border: "1px solid hsl(220 14% 16%)", borderRadius: 8, color: "hsl(210 20% 92%)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="alerts" fill="hsl(0 72% 51%)" radius={[0, 3, 3, 0]} name="Alerts" />
                <Bar dataKey="incidents" fill="hsl(38 92% 50%)" radius={[0, 3, 3, 0]} name="Incidents" />
                <Bar dataKey="cameras" fill="hsl(172 66% 50%)" radius={[0, 3, 3, 0]} name="Cameras" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-xl p-5 border border-border lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Live Audit Stream</h3>
            <Badge variant="outline" className="text-[10px]">Realtime</Badge>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-auto">
            {health.recent_log.length === 0 && (
              <p className="text-sm text-muted-foreground p-3">No recent audit events.</p>
            )}
            {health.recent_log.map((log) => {
              const level = severityForAction(log.action);
              return (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-sm">
                  <Badge variant="outline" className={cn("text-[10px] font-mono uppercase shrink-0 mt-0.5", logLevelColors[level])}>
                    {level}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate">
                      <span className="font-medium">{log.action}</span>
                      <span className="text-muted-foreground"> · {log.entity_type}</span>
                      {log.entity_id && <span className="text-muted-foreground/70 font-mono text-xs"> · {log.entity_id.slice(0, 8)}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.ip_address ?? "internal"} · {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Inference Workers</h3>
          <div className="space-y-3">
            {Object.keys(health.inference_status).length === 0 && (
              <p className="text-sm text-muted-foreground">No cameras configured.</p>
            )}
            {Object.entries(health.inference_status).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm capitalize">{status}</span>
                </div>
                <span className="text-sm font-semibold">{count}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-4">
            Snapshot as of {new Date(health.generated_at).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SystemMonitoring;
