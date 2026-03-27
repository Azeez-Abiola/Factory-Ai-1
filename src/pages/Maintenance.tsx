import { Wrench, AlertTriangle, Clock, TrendingDown, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mockMaintenanceAlerts } from "@/data/extendedMockData";
import { cn } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const riskConfig = {
  critical: { label: "Critical Risk", color: "bg-destructive/10 text-destructive border-destructive/30", barColor: "hsl(0 72% 51%)" },
  warning: { label: "Warning", color: "bg-warning/10 text-warning border-warning/30", barColor: "hsl(38 92% 50%)" },
  watch: { label: "Watch", color: "bg-primary/10 text-primary border-primary/30", barColor: "hsl(172 66% 50%)" },
};

const Maintenance = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Wrench className="w-6 h-6 text-primary" /> Predictive Maintenance
        </h1>
        <p className="text-sm text-muted-foreground">AI-detected equipment degradation patterns and failure predictions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4 border border-border text-center">
          <p className="text-xs text-muted-foreground mb-1">Equipment Monitored</p>
          <p className="text-2xl font-bold text-foreground">24</p>
        </div>
        <div className="glass rounded-xl p-4 border border-border text-center">
          <p className="text-xs text-muted-foreground mb-1">Active Alerts</p>
          <p className="text-2xl font-bold text-destructive">{mockMaintenanceAlerts.filter(a => a.riskLevel === "critical").length}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-border text-center">
          <p className="text-xs text-muted-foreground mb-1">Avg Health Score</p>
          <p className="text-2xl font-bold text-primary">78%</p>
        </div>
      </div>

      <div className="space-y-4">
        {mockMaintenanceAlerts.map((alert) => {
          const risk = riskConfig[alert.riskLevel];
          return (
            <div key={alert.id} className="glass rounded-xl p-5 border border-border">
              <div className="flex flex-col lg:flex-row gap-5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">{alert.equipment}</h3>
                    <Badge variant="outline" className={cn("text-xs", risk.color)}>{risk.label}</Badge>
                    <Badge variant="outline" className="text-xs">{alert.zone}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <span className="text-muted-foreground">Failure Risk:</span>
                      <span className={cn("font-bold", alert.failureProbability > 70 ? "text-destructive" : alert.failureProbability > 50 ? "text-warning" : "text-primary")}>
                        {alert.failureProbability}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-warning" />
                      <span className="text-muted-foreground">Est. Failure:</span>
                      <span className="text-foreground font-medium">{alert.estimatedTimeToFailure}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingDown className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Anomaly:</span>
                      <span className="text-foreground">{alert.anomalyType}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Last Service:</span>
                      <span className="text-foreground">{alert.lastMaintenance}</span>
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
                    <p className="text-xs font-semibold text-primary mb-1">🔧 Recommendation</p>
                    <p className="text-sm text-foreground">{alert.recommendation}</p>
                  </div>
                </div>

                <div className="w-full lg:w-64 shrink-0">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Health Trend (7-day)</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={alert.trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 16%)" />
                      <XAxis dataKey="day" tick={{ fill: "hsl(215 12% 50%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: "hsl(215 12% 50%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "hsl(220 18% 8%)", border: "1px solid hsl(220 14% 16%)", borderRadius: 8, color: "hsl(210 20% 92%)" }} />
                      <Line type="monotone" dataKey="health" stroke={risk.barColor} strokeWidth={2} dot={{ fill: risk.barColor, r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Maintenance;
