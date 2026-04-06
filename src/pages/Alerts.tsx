import { useState } from "react";
import { AlertTriangle, CheckCircle, Clock, User, Filter, ChevronDown, X, Camera, History, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { mockAlerts, mockTeam, Alert, AlertSeverity, AlertStatus, AlertCategory } from "@/data/mockData";
import { cn } from "@/lib/utils";
import IncidentTimeline from "@/components/app/IncidentTimeline";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const severityColors: Record<AlertSeverity, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-warning/10 text-warning border-warning/30",
  medium: "bg-primary/10 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
};

const statusIcons: Record<AlertStatus, React.ReactNode> = {
  open: <AlertTriangle className="w-4 h-4 text-warning" />,
  assigned: <Clock className="w-4 h-4 text-primary" />,
  resolved: <CheckCircle className="w-4 h-4 text-success" />,
};

const Alerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = alerts.filter((a) => {
    if (filterCategory !== "all" && a.category !== filterCategory) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterSeverity !== "all" && a.severity !== filterSeverity) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !a.title.toLowerCase().includes(q) &&
        !a.zone.toLowerCase().includes(q) &&
        !a.cameraName.toLowerCase().includes(q) &&
        !a.cameraId.toLowerCase().includes(q) &&
        !a.id.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const handleAssign = (alertId: string, assignee: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: "assigned" as AlertStatus, assignedTo: assignee } : a))
    );
    if (selectedAlert?.id === alertId) {
      setSelectedAlert((prev) => prev ? { ...prev, status: "assigned", assignedTo: assignee } : null);
    }
  };

  const handleResolve = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: "resolved" as AlertStatus, resolution: "Resolved by operator." } : a))
    );
    if (selectedAlert?.id === alertId) {
      setSelectedAlert((prev) => prev ? { ...prev, status: "resolved", resolution: "Resolved by operator." } : null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alerts & Incidents</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {alerts.length} alerts shown</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by keyword, camera, zone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="safety">Safety</SelectItem>
            <SelectItem value="downtime">Downtime</SelectItem>
            <SelectItem value="quality">Quality</SelectItem>
            <SelectItem value="productivity">Productivity</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 bg-card border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {filtered.map((alert) => (
          <div
            key={alert.id}
            onClick={() => setSelectedAlert(alert)}
            className="glass rounded-xl p-4 border border-border hover:border-primary/30 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-start gap-4">
              <div className="mt-0.5">{statusIcons[alert.status]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-foreground">{alert.title}</h3>
                  <Badge variant="outline" className={cn("text-xs", severityColors[alert.severity])}>
                    {alert.severity}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {alert.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{alert.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Camera className="w-3 h-3" /> {alert.cameraName}
                  </span>
                  <span>{alert.zone}</span>
                  <span>{new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {alert.assignedTo && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> {alert.assignedTo}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-mono">{alert.id}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Alert Detail Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          {selectedAlert && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {statusIcons[selectedAlert.status]}
                  {selectedAlert.title}
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="details">
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="timeline" className="gap-1">
                    <History className="w-3 h-3" /> Timeline
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 mt-3">
                  <div className="flex gap-2">
                    <Badge variant="outline" className={cn(severityColors[selectedAlert.severity])}>
                      {selectedAlert.severity}
                    </Badge>
                    <Badge variant="outline">{selectedAlert.category}</Badge>
                    <Badge variant="outline">{selectedAlert.status}</Badge>
                  </div>

                  <p className="text-sm text-muted-foreground">{selectedAlert.description}</p>

                  {/* Simulated camera snapshot */}
                  <div className="w-full h-48 rounded-lg bg-muted/50 border border-border flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 grid-bg opacity-30" />
                    <div className="text-center z-10">
                      <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">{selectedAlert.cameraName}</p>
                      <p className="text-xs text-primary font-mono mt-1">AI Detection Snapshot</p>
                    </div>
                    <div className="absolute top-8 left-12 w-20 h-16 border-2 border-destructive/60 rounded" />
                    <div className="absolute top-6 left-10 bg-destructive/80 text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded font-mono">
                      VIOLATION
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-muted-foreground text-xs">Camera</p><p className="text-foreground">{selectedAlert.cameraId} – {selectedAlert.cameraName}</p></div>
                    <div><p className="text-muted-foreground text-xs">Zone</p><p className="text-foreground">{selectedAlert.zone}</p></div>
                    <div><p className="text-muted-foreground text-xs">Time</p><p className="text-foreground">{new Date(selectedAlert.timestamp).toLocaleString()}</p></div>
                    <div><p className="text-muted-foreground text-xs">Assigned To</p><p className="text-foreground">{selectedAlert.assignedTo || "Unassigned"}</p></div>
                  </div>

                  {selectedAlert.resolution && (
                    <div className="bg-success/5 border border-success/20 rounded-lg p-3">
                      <p className="text-xs text-success font-medium mb-1">Resolution</p>
                      <p className="text-sm text-foreground">{selectedAlert.resolution}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {selectedAlert.status === "open" && (
                      <Select onValueChange={(val) => handleAssign(selectedAlert.id, val)}>
                        <SelectTrigger className="flex-1 bg-background border-border"><SelectValue placeholder="Assign to…" /></SelectTrigger>
                        <SelectContent>
                          {mockTeam.map((m) => (
                            <SelectItem key={m.id} value={m.name}>{m.name} – {m.role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {selectedAlert.status !== "resolved" && (
                      <Button onClick={() => handleResolve(selectedAlert.id)} className="bg-success hover:bg-success/90 text-primary-foreground">
                        <CheckCircle className="w-4 h-4 mr-1" /> Resolve
                      </Button>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="mt-3">
                  <IncidentTimeline alertId={selectedAlert.id} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Alerts;
