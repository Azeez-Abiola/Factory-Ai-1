import { useParams, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import {
  ArrowLeft, Wrench, AlertTriangle, Clock, TrendingDown, Calendar,
  Activity, CheckCircle2, FileText, Share2, Settings2, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { mockMaintenanceAlerts } from "@/data/extendedMockData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area
} from "recharts";

const riskConfig = {
  critical: { label: "Critical", color: "bg-destructive/10 text-destructive border-destructive/30", barColor: "hsl(0 72% 51%)", dotColor: "bg-destructive" },
  warning: { label: "Warning", color: "bg-warning/10 text-warning border-warning/30", barColor: "hsl(38 92% 50%)", dotColor: "bg-warning" },
  watch: { label: "Watch", color: "bg-primary/10 text-primary border-primary/30", barColor: "hsl(172 66% 50%)", dotColor: "bg-primary" },
};

const MaintenanceDetail = () => {
  const { alertId } = useParams<{ alertId: string }>();
  const navigate = useNavigate();

  const alert = useMemo(() => {
    return mockMaintenanceAlerts.find((a) => a.id === alertId) || null;
  }, [alertId]);

  if (!alert) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Wrench className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Equipment Alert Not Found</h2>
        <p className="text-muted-foreground mb-6">The maintenance alert you're looking for doesn't exist.</p>
        <Button onClick={() => navigate("/app/maintenance")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to predictive maintenance
        </Button>
      </div>
    );
  }

  const risk = riskConfig[alert.riskLevel];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit -ml-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/app/maintenance")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Maintenance
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center shrink-0", risk.color)}>
              <Wrench className={cn("w-7 h-7")} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{alert.equipment}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge variant="outline" className={cn("text-xs", risk.color)}>{risk.label}</Badge>
                <Badge variant="outline" className="text-xs">{alert.zone}</Badge>
                <span className="text-xs text-muted-foreground font-mono">{alert.id}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => toast.success("Shared maintenance details")}>
              <Share2 className="w-4 h-4 mr-2" /> Share Details
            </Button>
            <Button onClick={() => toast.success("Opening Work Order Form")}>
              <Settings2 className="w-4 h-4 mr-2" /> Schedule Maintenance
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={cn("border-border", alert.riskLevel === "critical" ? "border-destructive/30" : "")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", risk.color)}>
                <AlertTriangle className={cn("w-5 h-5")} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Failure Probability</p>
                <p className={cn("text-2xl font-bold", alert.failureProbability > 70 ? "text-destructive" : alert.failureProbability > 50 ? "text-warning" : "text-primary")}>
                  {alert.failureProbability}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Est. Failure</p>
                <p className="text-xl font-bold text-foreground">{alert.estimatedTimeToFailure}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Service</p>
                <p className="text-lg font-bold text-foreground">{alert.lastMaintenance}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Health</p>
                <p className="text-lg font-bold text-foreground">{alert.trendData[alert.trendData.length - 1].health}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border">
             <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-primary" /> Equipment Health Trend (7-day)
                </CardTitle>
             </CardHeader>
             <CardContent>
               <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={alert.trendData}>
                    <defs>
                      <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={risk.barColor} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={risk.barColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                    <Area type="monotone" dataKey="health" stroke={risk.barColor} strokeWidth={2} fill="url(#colorHealth)" dot={{ fill: risk.barColor, r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
             </CardContent>
          </Card>

          <Card className="border-border">
             <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" /> Predictive Analysis
                </CardTitle>
             </CardHeader>
             <CardContent>
                <div className="space-y-4">
                   <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
                     <p className="text-xs font-semibold text-primary mb-1">⚡ Detected Anomaly</p>
                     <p className="text-sm text-foreground mb-4">{alert.anomalyType}</p>
                     <p className="text-xs font-semibold text-primary mb-1">🔧 Recommendation</p>
                     <p className="text-sm text-foreground">{alert.recommendation}</p>
                   </div>
                   
                   <div className="flex flex-col gap-2">
                     <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Failure Risk Gauge</p>
                     <Progress value={alert.failureProbability} className={cn("h-3", alert.failureProbability > 70 ? "bg-muted [&>div]:bg-destructive" : alert.failureProbability > 50 ? "bg-muted [&>div]:bg-warning" : "bg-muted [&>div]:bg-primary")} />
                     <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                        <span>Safe (0%)</span>
                        <span className={cn(alert.failureProbability > 70 ? "text-destructive font-medium" : "")}>Critical (&gt;70%)</span>
                     </div>
                   </div>
                </div>
             </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
           <Card className="border-border">
              <CardHeader className="pb-3">
                 <CardTitle className="text-sm font-semibold text-foreground">Equipment Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                 <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span className="text-muted-foreground">Equipment</span>
                    <span className="font-medium text-foreground">{alert.equipment}</span>
                 </div>
                 <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span className="text-muted-foreground">Location</span>
                    <span className="text-foreground">{alert.zone}</span>
                 </div>
                 <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span className="text-muted-foreground">Alert ID</span>
                    <span className="font-mono text-foreground text-xs">{alert.id}</span>
                 </div>
                 <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className={cn("text-[10px]", risk.color)}>{risk.label}</Badge>
                 </div>
              </CardContent>
           </Card>

           <Card className="border-border">
              <CardHeader className="pb-3">
                 <CardTitle className="text-sm font-semibold text-foreground">Service History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                 <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    <div>
                       <p className="text-xs font-semibold text-foreground">Routine Inspection</p>
                       <p className="text-xs text-muted-foreground mb-1">Checked bearings and belt tension.</p>
                       <p className="text-[10px] text-muted-foreground">{alert.lastMaintenance}</p>
                    </div>
                 </div>
                 <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    <div>
                       <p className="text-xs font-semibold text-foreground">Part Replacement</p>
                       <p className="text-xs text-muted-foreground mb-1">Replaced drive motor brushes.</p>
                       <p className="text-[10px] text-muted-foreground">2025-11-12</p>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceDetail;
