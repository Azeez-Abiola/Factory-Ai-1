import { useCallback, useEffect, useMemo, useState } from "react";
import { Shield, AlertTriangle, Camera, Activity, LayoutDashboard, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, CartesianGrid } from "recharts";
import { Link } from "react-router-dom";
import StatCard from "@/components/app/StatCard";
import PageHeader from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { complianceScore, fetchAnalyzedFrames, isRealChangeAlert } from "@/lib/gatedMetrics";
import { cn } from "@/lib/utils";

interface AlertRow {
  id: string;
  type: string;
  severity: string;
  title: string;
  status: string;
  zone: string | null;
  camera_id: string | null;
  detected_at: string;
  resolved_at: string | null;
}

interface CameraRow {
  id: string;
  name: string;
  status: string;
  last_seen_at: string | null;
}

const OPEN_STATUSES = ["open", "new", "active", "acknowledged", "assigned"];

const categoryOf = (type: string) => {
  const t = (type || "").toLowerCase();
  if (t.includes("ppe") || t.includes("safety") || t.includes("zone") || t.includes("hazard")) return "safety";
  if (t.includes("quality") || t.includes("defect") || t.includes("pack")) return "quality";
  if (t.includes("downtime") || t.includes("idle") || t.includes("stop")) return "downtime";
  return "productivity";
};

const Dashboard = () => {
  const { activeTenantId, activeTenant } = useTenants();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [cameras, setCameras] = useState<CameraRow[]>([]);
  const [openIncidents, setOpenIncidents] = useState(0);
  const [analyzedFrames, setAnalyzedFrames] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeTenantId) {
      setAlerts([]); setCameras([]); setOpenIncidents(0); setLoading(false);
      return;
    }
    setLoading(true);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [a, c, i] = await Promise.all([
      supabase.from("alerts")
        .select("id,type,severity,title,status,zone,camera_id,detected_at,resolved_at,metadata")
        .eq("tenant_id", activeTenantId)
        .gte("detected_at", since)
        .order("detected_at", { ascending: false })
        .limit(1000),
      supabase.from("cameras")
        .select("id,name,status,last_seen_at")
        .eq("tenant_id", activeTenantId),
      supabase.from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", activeTenantId)
        .in("status", ["open", "investigating"]),
    ]);
    setAlerts((a.data ?? []) as AlertRow[]);
    setCameras((c.data ?? []) as CameraRow[]);
    setOpenIncidents(i.count ?? 0);
    setAnalyzedFrames(await fetchAnalyzedFrames(activeTenantId, since));
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    load();
    if (!activeTenantId) return;
    const channel = supabase
      .channel(`dashboard:${activeTenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `tenant_id=eq.${activeTenantId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTenantId, load]);

  const cameraNames = useMemo(
    () => Object.fromEntries(cameras.map((c) => [c.id, c.name])),
    [cameras]
  );

  const stats = useMemo(() => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const open = alerts.filter((a) => OPEN_STATUSES.includes(a.status)).length;
    const resolvedToday = alerts.filter(
      (a) => a.resolved_at && new Date(a.resolved_at) >= startOfToday
    ).length;
    const online = cameras.filter((c) => c.status === "online").length;
    // Only frames the model actually analysed (real scene changes) count as
    // observations, so a static camera cannot inflate the compliance score.
    const realAlerts = alerts.filter((a) => isRealChangeAlert((a as any).metadata));
    const safetyAlerts = realAlerts.filter((a) => categoryOf(a.type) === "safety").length;
    const compliance = complianceScore(analyzedFrames, safetyAlerts, realAlerts.length);
    const uptime = cameras.length === 0 ? 0 : Math.round((online / cameras.length) * 1000) / 10;
    return { open, resolvedToday, online, compliance, uptime };
  }, [alerts, cameras, analyzedFrames]);

  const hourlyAlerts = useMemo(() => {
    const buckets: Record<string, { hour: string; safety: number; quality: number; downtime: number; productivity: number }> = {};
    for (let h = 23; h >= 0; h--) {
      const d = new Date(Date.now() - h * 3600_000);
      const key = `${String(d.getHours()).padStart(2, "0")}:00`;
      buckets[key] = { hour: key, safety: 0, quality: 0, downtime: 0, productivity: 0 };
    }
    const cutoff = Date.now() - 24 * 3600_000;
    alerts.forEach((a) => {
      const t = new Date(a.detected_at).getTime();
      if (t < cutoff) return;
      const key = `${String(new Date(t).getHours()).padStart(2, "0")}:00`;
      const b = buckets[key];
      if (b) b[categoryOf(a.type) as "safety"]++;
    });
    return Object.values(buckets);
  }, [alerts]);

  const weeklyTrend = useMemo(() => {
    const days: { day: string; alerts: number; critical: number }[] = [];
    for (let d = 6; d >= 0; d--) {
      const day = new Date(Date.now() - d * 86400_000);
      const label = day.toLocaleDateString([], { weekday: "short" });
      const from = new Date(day); from.setHours(0, 0, 0, 0);
      const to = new Date(day); to.setHours(23, 59, 59, 999);
      const inDay = alerts.filter((a) => {
        const t = new Date(a.detected_at).getTime();
        return t >= from.getTime() && t <= to.getTime();
      });
      days.push({
        day: label,
        alerts: inDay.length,
        critical: inDay.filter((a) => a.severity === "critical").length,
      });
    }
    return days;
  }, [alerts]);

  const alertsByZone = useMemo(() => {
    const map: Record<string, number> = {};
    alerts.forEach((a) => {
      const z = a.zone || "Unzoned";
      map[z] = (map[z] ?? 0) + 1;
    });
    return Object.entries(map)
      .map(([zone, count]) => ({ zone, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [alerts]);

  const resolutionTrend = useMemo(() => {
    return weeklyTrend.map((d, idx) => {
      const day = new Date(Date.now() - (6 - idx) * 86400_000);
      const from = new Date(day); from.setHours(0, 0, 0, 0);
      const to = new Date(day); to.setHours(23, 59, 59, 999);
      const inDay = alerts.filter((a) => {
        const t = new Date(a.detected_at).getTime();
        return t >= from.getTime() && t <= to.getTime();
      });
      const resolved = inDay.filter((a) => a.resolved_at).length;
      return { day: d.day, rate: inDay.length ? Math.round((resolved / inDay.length) * 100) : 0 };
    });
  }, [alerts, weeklyTrend]);

  const recentAlerts = alerts.slice(0, 5);
  const tooltipStyle = {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    color: "hsl(var(--popover-foreground))",
    boxShadow: "0 12px 24px hsl(var(--foreground) / 0.12)",
  };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Live"
        icon={LayoutDashboard}
        title="Operations Dashboard"
        description={
          activeTenant
            ? `Live factory intelligence for ${activeTenant.name} — last 7 days`
            : "Select a tenant to view live operations"
        }
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
        <StatCard
          title="Alerts (7 days)"
          value={alerts.length}
          subtitle={`${stats.open} open · ${stats.resolvedToday} resolved today`}
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Cameras Online"
          value={`${stats.online}/${cameras.length}`}
          subtitle={cameras.length ? `${cameras.length - stats.online} offline` : "No cameras configured"}
          icon={Camera}
          variant="default"
        />
        <StatCard
          title="Compliance Score"
          value={`${stats.compliance}%`}
          subtitle="Derived from safety alert ratio"
          icon={Shield}
          variant="success"
        />
        <StatCard
          title="Open Incidents"
          value={openIncidents}
          subtitle={`Camera uptime ${stats.uptime}%`}
          icon={Activity}
          variant={openIncidents > 0 ? "warning" : "success"}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="app-panel p-5 lg:p-6">
          <h3 className="app-section-title mb-5">Alerts by Hour (24h)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourlyAlerts} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="safety" fill="hsl(0 72% 51%)" radius={[3, 3, 0, 0]} name="Safety" />
              <Bar dataKey="quality" fill="hsl(38 92% 50%)" radius={[3, 3, 0, 0]} name="Quality" />
              <Bar dataKey="downtime" fill="hsl(172 66% 50%)" radius={[3, 3, 0, 0]} name="Downtime" />
              <Bar dataKey="productivity" fill="hsl(215 12% 50%)" radius={[3, 3, 0, 0]} name="Productivity" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="app-panel p-5 lg:p-6">
          <h3 className="app-section-title mb-5">Weekly Alert Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="alerts" stroke="hsl(172 66% 50%)" fill="hsl(172 66% 50% / 0.12)" strokeWidth={2} name="All alerts" />
              <Area type="monotone" dataKey="critical" stroke="hsl(0 72% 51%)" fill="hsl(0 72% 51% / 0.12)" strokeWidth={2} name="Critical" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="app-panel p-5 lg:p-6">
          <h3 className="app-section-title mb-5">Alerts by Zone</h3>
          {alertsByZone.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">No alerts in the last 7 days.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={alertsByZone} layout="vertical">
                <XAxis type="number" allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="zone" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="hsl(172 66% 50%)" radius={[0, 4, 4, 0]} name="Alerts" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="app-panel p-5 lg:p-6">
          <h3 className="app-section-title mb-5">Resolution Rate (%)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={resolutionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="rate" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ fill: "hsl(142 71% 45%)", r: 3 }} name="Resolved %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="app-panel p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="app-section-title">Recent Alerts</h3>
            <Link to="/app/alerts" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && recentAlerts.length === 0 && (
              <p className="text-sm text-muted-foreground">No alerts recorded yet.</p>
            )}
            {recentAlerts.map((alert) => (
              <Link
                key={alert.id}
                to="/app/alerts"
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full mt-1.5 shrink-0",
                    alert.severity === "critical" && "bg-destructive",
                    alert.severity === "high" && "bg-warning",
                    alert.severity === "medium" && "bg-primary",
                    alert.severity === "low" && "bg-muted-foreground"
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {alert.zone || "—"}
                    {alert.camera_id && cameraNames[alert.camera_id] ? ` · ${cameraNames[alert.camera_id]}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-auto">
                  {new Date(alert.detected_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
