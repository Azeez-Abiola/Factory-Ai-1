import { Activity, Server, HardDrive, Cpu, AlertTriangle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { systemMetrics, apiTrafficData, tenantUsageData, systemLogs } from "@/data/adminMockData";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const logLevelColors = {
  error: "bg-destructive/10 text-destructive border-destructive/20",
  warn: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20",
  info: "bg-primary/10 text-primary border-primary/20",
};

const SystemMonitoring = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">System Monitoring</h1>
        <p className="text-sm text-muted-foreground">Platform health, usage, and infrastructure metrics</p>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "API Calls (24h)", value: (systemMetrics.totalApiCalls / 1_000_000).toFixed(1) + "M", icon: Activity, sub: `+${systemMetrics.apiCallsTrend}% vs yesterday` },
          { label: "Avg Response", value: systemMetrics.avgResponseTime + "ms", icon: Server, sub: "P95 latency" },
          { label: "Error Rate", value: systemMetrics.errorRate + "%", icon: AlertTriangle, sub: "Last 24 hours" },
          { label: "GPU Utilization", value: systemMetrics.gpuUtilization + "%", icon: Cpu, sub: `${systemMetrics.inferenceQueue} in queue` },
          { label: "Storage", value: `${systemMetrics.storageUsed}/${systemMetrics.storageTotal} TB`, icon: HardDrive, sub: `${Math.round((systemMetrics.storageUsed / systemMetrics.storageTotal) * 100)}% used` },
        ].map((metric) => (
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Traffic */}
        <div className="glass rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">API Traffic (24h)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={apiTrafficData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 16%)" />
              <XAxis dataKey="time" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(220 18% 8%)", border: "1px solid hsl(220 14% 16%)", borderRadius: 8, color: "hsl(210 20% 92%)" }} />
              <Area type="monotone" dataKey="calls" stroke="hsl(172 66% 50%)" fill="hsl(172 66% 50% / 0.1)" strokeWidth={2} name="API Calls" />
              <Area type="monotone" dataKey="errors" stroke="hsl(0 72% 51%)" fill="hsl(0 72% 51% / 0.1)" strokeWidth={2} name="Errors" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Tenant Usage */}
        <div className="glass rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Usage by Tenant</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={tenantUsageData} layout="vertical">
              <XAxis type="number" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
              <Tooltip contentStyle={{ background: "hsl(220 18% 8%)", border: "1px solid hsl(220 14% 16%)", borderRadius: 8, color: "hsl(210 20% 92%)" }} />
              <Bar dataKey="api" fill="hsl(172 66% 50%)" radius={[0, 3, 3, 0]} name="API Calls" />
              <Bar dataKey="inference" fill="hsl(38 92% 50%)" radius={[0, 3, 3, 0]} name="Inferences" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* System Logs */}
      <div className="glass rounded-xl p-5 border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-4">System Logs</h3>
        <div className="space-y-2">
          {systemLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-sm">
              <Badge variant="outline" className={cn("text-[10px] font-mono uppercase shrink-0 mt-0.5", logLevelColors[log.level])}>
                {log.level}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-foreground">{log.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {log.service} · {log.tenant} · {new Date(log.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SystemMonitoring;
