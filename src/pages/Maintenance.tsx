import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wrench, AlertTriangle, Clock, TrendingDown, Calendar, Activity, Shield,
  CheckCircle2, Filter, ChevronDown, ChevronUp, Settings2, FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mockMaintenanceAlerts, type MaintenanceAlert } from "@/data/extendedMockData";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";

const riskConfig = {
  critical: { label: "Critical", color: "bg-destructive/10 text-destructive border-destructive/30", barColor: "hsl(0 72% 51%)", dotColor: "bg-destructive" },
  warning: { label: "Warning", color: "bg-warning/10 text-warning border-warning/30", barColor: "hsl(38 92% 50%)", dotColor: "bg-warning" },
  watch: { label: "Watch", color: "bg-primary/10 text-primary border-primary/30", barColor: "hsl(172 66% 50%)", dotColor: "bg-primary" },
};

type WorkOrderStatus = "open" | "scheduled" | "completed";

interface WorkOrder {
  id: string;
  alertId: string;
  equipment: string;
  scheduledDate: string;
  assignee: string;
  notes: string;
  status: WorkOrderStatus;
  createdAt: string;
}

const Maintenance = () => {
  const [alerts, setAlerts] = useState<(MaintenanceAlert & { acknowledged?: boolean })[]>(mockMaintenanceAlerts);
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"risk" | "probability">("risk");
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([
    { id: "WO-001", alertId: "PM-001", equipment: "Conveyor Belt – Line 1", scheduledDate: "2026-04-03", assignee: "Ravi Mehta", notes: "Belt tension and bearing replacement", status: "scheduled", createdAt: "2026-03-28" },
  ]);
  const [showWorkOrderForm, setShowWorkOrderForm] = useState(false);
  const [workOrderAlert, setWorkOrderAlert] = useState<MaintenanceAlert | null>(null);
  const [woForm, setWoForm] = useState({ scheduledDate: "", assignee: "", notes: "" });

  const zones = useMemo(() => [...new Set(alerts.map(a => a.zone))], [alerts]);

  const filteredAlerts = useMemo(() => {
    let result = [...alerts];
    if (riskFilter !== "all") result = result.filter(a => a.riskLevel === riskFilter);
    if (zoneFilter !== "all") result = result.filter(a => a.zone === zoneFilter);
    const riskOrder = { critical: 0, warning: 1, watch: 2 };
    if (sortBy === "risk") result.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);
    else result.sort((a, b) => b.failureProbability - a.failureProbability);
    return result;
  }, [alerts, riskFilter, zoneFilter, sortBy]);

  // Computed stats
  const criticalCount = alerts.filter(a => a.riskLevel === "critical").length;
  const warningCount = alerts.filter(a => a.riskLevel === "warning").length;
  const watchCount = alerts.filter(a => a.riskLevel === "watch").length;
  const avgHealth = Math.round(alerts.reduce((sum, a) => sum + a.trendData[a.trendData.length - 1].health, 0) / alerts.length);
  const avgFailure = Math.round(alerts.reduce((sum, a) => sum + a.failureProbability, 0) / alerts.length);

  const pieData = [
    { name: "Critical", value: criticalCount, color: "hsl(0 72% 51%)" },
    { name: "Warning", value: warningCount, color: "hsl(38 92% 50%)" },
    { name: "Watch", value: watchCount, color: "hsl(172 66% 50%)" },
  ];

  const healthBarData = alerts.map(a => ({
    name: a.equipment.split("–")[0].trim().substring(0, 12),
    health: a.trendData[a.trendData.length - 1].health,
    risk: a.failureProbability,
  }));

  const handleAcknowledge = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    toast({ title: "Alert Acknowledged", description: `Maintenance alert ${id} has been acknowledged.` });
  };

  const handleCreateWorkOrder = () => {
    if (!workOrderAlert || !woForm.scheduledDate || !woForm.assignee) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    const newWO: WorkOrder = {
      id: `WO-${String(workOrders.length + 1).padStart(3, "0")}`,
      alertId: workOrderAlert.id,
      equipment: workOrderAlert.equipment,
      scheduledDate: woForm.scheduledDate,
      assignee: woForm.assignee,
      notes: woForm.notes,
      status: "scheduled",
      createdAt: new Date().toISOString().split("T")[0],
    };
    setWorkOrders(prev => [...prev, newWO]);
    setShowWorkOrderForm(false);
    setWoForm({ scheduledDate: "", assignee: "", notes: "" });
    setWorkOrderAlert(null);
    toast({ title: "Work Order Created", description: `${newWO.id} scheduled for ${newWO.scheduledDate}` });
  };

  const handleCompleteWorkOrder = (id: string) => {
    setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, status: "completed" as WorkOrderStatus } : wo));
    toast({ title: "Work Order Completed", description: `${id} marked as completed.` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="w-6 h-6 text-primary" /> Predictive Maintenance
          </h1>
          <p className="text-sm text-muted-foreground">AI-detected equipment degradation patterns and failure predictions</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Activity className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Equipment</p>
            <p className="text-2xl font-bold text-foreground">{alerts.length}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Critical</p>
            <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
          </CardContent>
        </Card>
        <Card className="border-warning/30">
          <CardContent className="p-4 text-center">
            <Shield className="w-5 h-5 text-warning mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Warnings</p>
            <p className="text-2xl font-bold text-warning">{warningCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <TrendingDown className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Avg Health</p>
            <p className={cn("text-2xl font-bold", avgHealth > 70 ? "text-primary" : avgHealth > 50 ? "text-warning" : "text-destructive")}>{avgHealth}%</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Clock className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Avg Failure Risk</p>
            <p className={cn("text-2xl font-bold", avgFailure > 60 ? "text-destructive" : avgFailure > 40 ? "text-warning" : "text-primary")}>{avgFailure}%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="workorders">Work Orders ({workOrders.length})</TabsTrigger>
        </TabsList>

        {/* ========== ALERTS TAB ========== */}
        <TabsContent value="alerts" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filters:</span>
            </div>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Risk Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="watch">Watch</SelectItem>
              </SelectContent>
            </Select>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as "risk" | "probability")}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="risk">Sort by Risk</SelectItem>
                <SelectItem value="probability">Sort by Probability</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredAlerts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-primary" />
              <p className="text-lg font-medium">No alerts match your filters</p>
            </div>
          )}

          {filteredAlerts.map((alert) => {
            const risk = riskConfig[alert.riskLevel];
            const hasWorkOrder = workOrders.some(wo => wo.alertId === alert.id && wo.status !== "completed");
            return (
              <Card key={alert.id} className={cn("border-border transition-all", alert.acknowledged && "opacity-60")}>
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row gap-5">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", risk.dotColor)} />
                        <h3 className="text-sm font-semibold text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => navigate("/app/maintenance/" + alert.id)}>
                          {alert.equipment}
                        </h3>
                        <Badge variant="outline" className={cn("text-xs", risk.color)}>{risk.label}</Badge>
                        <Badge variant="outline" className="text-xs">{alert.zone}</Badge>
                        {alert.acknowledged && <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">Acknowledged</Badge>}
                        {hasWorkOrder && <Badge variant="outline" className="text-xs bg-accent text-accent-foreground">WO Scheduled</Badge>}
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Failure Probability</span>
                          <span className={cn("text-xs font-bold", alert.failureProbability > 70 ? "text-destructive" : alert.failureProbability > 50 ? "text-warning" : "text-primary")}>
                            {alert.failureProbability}%
                          </span>
                        </div>
                        <Progress value={alert.failureProbability} className="h-2" />
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-warning" />
                          <span className="text-muted-foreground text-xs">Est. Failure:</span>
                          <span className="text-foreground text-xs font-medium">{alert.estimatedTimeToFailure}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingDown className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground text-xs">Anomaly:</span>
                          <span className="text-foreground text-xs">{alert.anomalyType}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground text-xs">Last Service:</span>
                          <span className="text-foreground text-xs">{alert.lastMaintenance}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground text-xs">Current Health:</span>
                          <span className="text-foreground text-xs font-medium">{alert.trendData[alert.trendData.length - 1].health}%</span>
                        </div>
                      </div>

                      <div className="bg-primary/5 border border-primary/15 rounded-lg p-3 mb-3">
                        <p className="text-xs font-semibold text-primary mb-1">🔧 Recommendation</p>
                        <p className="text-xs text-foreground">{alert.recommendation}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {!alert.acknowledged && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAcknowledge(alert.id)}>
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Acknowledge
                          </Button>
                        )}
                        {!hasWorkOrder && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setWorkOrderAlert(alert); setShowWorkOrderForm(true); }}>
                            <Settings2 className="w-3 h-3 mr-1" /> Schedule Maintenance
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate("/app/maintenance/" + alert.id)}>
                          <FileText className="w-3 h-3 mr-1" /> Details
                        </Button>
                      </div>
                    </div>

                    <div className="w-full lg:w-56 shrink-0">
                      <p className="text-xs text-muted-foreground mb-2 font-medium">Health Trend (7-day)</p>
                      <ResponsiveContainer width="100%" height={110}>
                        <LineChart data={alert.trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                          <Line type="monotone" dataKey="health" stroke={risk.barColor} strokeWidth={2} dot={{ fill: risk.barColor, r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ========== ANALYTICS TAB ========== */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Risk Distribution</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Equipment Health Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={healthBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                    <Bar dataKey="health" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Health %" />
                    <Bar dataKey="risk" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} name="Failure Risk %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========== WORK ORDERS TAB ========== */}
        <TabsContent value="workorders" className="space-y-4 mt-4">
          {workOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Settings2 className="w-12 h-12 mx-auto mb-3" />
              <p>No work orders yet. Schedule maintenance from an alert.</p>
            </div>
          ) : (
            workOrders.map(wo => (
              <Card key={wo.id} className={cn("border-border", wo.status === "completed" && "opacity-60")}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">{wo.id}</span>
                      <Badge variant="outline" className={cn("text-xs",
                        wo.status === "completed" ? "bg-primary/10 text-primary border-primary/30" :
                        wo.status === "scheduled" ? "bg-warning/10 text-warning border-warning/30" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {wo.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground">{wo.equipment}</p>
                    <p className="text-xs text-muted-foreground">Assignee: {wo.assignee} · Scheduled: {wo.scheduledDate}</p>
                    {wo.notes && <p className="text-xs text-muted-foreground mt-1">Notes: {wo.notes}</p>}
                  </div>
                  {wo.status !== "completed" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => handleCompleteWorkOrder(wo.id)}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>



      {/* ========== WORK ORDER FORM ========== */}
      <Dialog open={showWorkOrderForm} onOpenChange={setShowWorkOrderForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Schedule Maintenance</DialogTitle>
          </DialogHeader>
          {workOrderAlert && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Equipment: <span className="text-foreground font-medium">{workOrderAlert.equipment}</span></p>
              <div className="space-y-2">
                <Label className="text-xs">Scheduled Date *</Label>
                <Input type="date" value={woForm.scheduledDate} onChange={e => setWoForm(f => ({ ...f, scheduledDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Assignee *</Label>
                <Input placeholder="Technician name" value={woForm.assignee} onChange={e => setWoForm(f => ({ ...f, assignee: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Notes</Label>
                <Textarea placeholder="Work details..." value={woForm.notes} onChange={e => setWoForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWorkOrderForm(false)}>Cancel</Button>
            <Button onClick={handleCreateWorkOrder}>Create Work Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Maintenance;
