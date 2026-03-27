import { Shield, AlertTriangle, CheckCircle, Camera, Activity, TrendingDown, Clock, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, CartesianGrid } from "recharts";
import StatCard from "@/components/app/StatCard";
import { dashboardStats, hourlyAlerts, weeklyDefects, downtimeByZone, productivityData, mockAlerts } from "@/data/mockData";
import { cn } from "@/lib/utils";
import LiveAlertSimulator from "@/components/app/LiveAlertSimulator";

const Dashboard = () => {
  const recentAlerts = mockAlerts.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time factory intelligence overview</p>
        </div>
        <LiveAlertSimulator />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Safety Score"
          value={`${dashboardStats.safetyScore}%`}
          subtitle="Across all zones"
          icon={Shield}
          variant="success"
          trend={{ value: 3, positive: true }}
        />
        <StatCard
          title="Open Alerts"
          value={dashboardStats.openAlerts}
          subtitle={`${dashboardStats.resolvedToday} resolved today`}
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Uptime"
          value={`${dashboardStats.uptime}%`}
          subtitle="Production lines"
          icon={Activity}
          variant="default"
          trend={{ value: 1.2, positive: true }}
        />
        <StatCard
          title="Defect Rate"
          value={`${dashboardStats.defectRate}%`}
          subtitle="Below 1% target"
          icon={CheckCircle}
          variant="success"
          trend={{ value: 0.3, positive: true }}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts by Hour */}
        <div className="glass rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Alerts by Hour</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourlyAlerts} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 16%)" />
              <XAxis dataKey="hour" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "hsl(220 18% 8%)", border: "1px solid hsl(220 14% 16%)", borderRadius: 8, color: "hsl(210 20% 92%)" }}
              />
              <Bar dataKey="safety" fill="hsl(0 72% 51%)" radius={[3, 3, 0, 0]} name="Safety" />
              <Bar dataKey="quality" fill="hsl(38 92% 50%)" radius={[3, 3, 0, 0]} name="Quality" />
              <Bar dataKey="downtime" fill="hsl(172 66% 50%)" radius={[3, 3, 0, 0]} name="Downtime" />
              <Bar dataKey="productivity" fill="hsl(215 12% 50%)" radius={[3, 3, 0, 0]} name="Productivity" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Defect Trend */}
        <div className="glass rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Weekly Defect Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={weeklyDefects}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 16%)" />
              <XAxis dataKey="day" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "hsl(220 18% 8%)", border: "1px solid hsl(220 14% 16%)", borderRadius: 8, color: "hsl(210 20% 92%)" }}
              />
              <Area type="monotone" dataKey="defects" stroke="hsl(0 72% 51%)" fill="hsl(0 72% 51% / 0.1)" strokeWidth={2} name="Defects" />
              <Line type="monotone" dataKey="target" stroke="hsl(172 66% 50%)" strokeDasharray="5 5" strokeWidth={1.5} dot={false} name="Target" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Downtime by Zone */}
        <div className="glass rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Downtime by Zone (min)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={downtimeByZone} layout="vertical">
              <XAxis type="number" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="zone" type="category" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
              <Tooltip
                contentStyle={{ background: "hsl(220 18% 8%)", border: "1px solid hsl(220 14% 16%)", borderRadius: 8, color: "hsl(210 20% 92%)" }}
              />
              <Bar dataKey="minutes" fill="hsl(172 66% 50%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Productivity */}
        <div className="glass rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Productivity Efficiency</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={productivityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 16%)" />
              <XAxis dataKey="hour" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[50, 100]} tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "hsl(220 18% 8%)", border: "1px solid hsl(220 14% 16%)", borderRadius: 8, color: "hsl(210 20% 92%)" }}
              />
              <Line type="monotone" dataKey="efficiency" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ fill: "hsl(142 71% 45%)", r: 3 }} name="Efficiency %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Alerts */}
        <div className="glass rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Recent Alerts</h3>
          <div className="space-y-3">
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
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
                  <p className="text-xs text-muted-foreground">{alert.zone} · {alert.cameraName}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-auto">
                  {new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
