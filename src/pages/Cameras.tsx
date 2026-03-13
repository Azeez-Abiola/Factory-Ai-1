import { useState } from "react";
import { Camera as CameraIcon, Wifi, WifiOff, Wrench, Eye, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mockCameras, Camera } from "@/data/mockData";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusConfig = {
  online: { color: "bg-success", icon: Wifi, label: "Online", text: "text-success" },
  offline: { color: "bg-destructive", icon: WifiOff, label: "Offline", text: "text-destructive" },
  maintenance: { color: "bg-warning", icon: Wrench, label: "Maintenance", text: "text-warning" },
};

const Cameras = () => {
  const [selected, setSelected] = useState<Camera | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? mockCameras : mockCameras.filter((c) => c.status === filter);
  const online = mockCameras.filter((c) => c.status === "online").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Camera Feeds</h1>
          <p className="text-sm text-muted-foreground">{online}/{mockCameras.length} cameras online</p>
        </div>
        <div className="flex gap-2">
          {["all", "online", "offline", "maintenance"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize",
                filter === s ? "bg-primary/10 text-primary border border-primary/30" : "bg-card text-muted-foreground border border-border hover:bg-muted"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((cam) => {
          const config = statusConfig[cam.status];
          return (
            <div
              key={cam.id}
              onClick={() => setSelected(cam)}
              className="glass rounded-xl border border-border hover:border-primary/30 cursor-pointer transition-all duration-200 overflow-hidden group"
            >
              {/* Camera View */}
              <div className="relative h-40 bg-muted/30 overflow-hidden">
                <div className="absolute inset-0 grid-bg opacity-20" />

                {/* Simulated feed */}
                {cam.status === "online" ? (
                  <>
                    {/* Scan line effect */}
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="w-full h-px bg-primary/40 animate-scan-line" />
                    </div>

                    {/* AI overlay boxes */}
                    {cam.detections > 0 && (
                      <>
                        <div className="absolute top-6 left-8 w-14 h-12 border border-primary/60 rounded" />
                        <div className="absolute top-4 left-7 bg-primary/80 text-primary-foreground text-[9px] px-1 py-0.5 rounded font-mono">
                          {cam.lastDetection}
                        </div>
                        {cam.detections > 1 && (
                          <div className="absolute bottom-12 right-10 w-12 h-10 border border-warning/60 rounded" />
                        )}
                      </>
                    )}

                    {/* Recording indicator */}
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-destructive animate-pulse-glow" />
                      <span className="text-[9px] text-destructive font-mono">REC</span>
                    </div>

                    {/* Camera ID */}
                    <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground font-mono">
                      {cam.id} • {new Date().toLocaleTimeString()}
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <config.icon className={cn("w-6 h-6 mx-auto mb-1", config.text)} />
                      <p className={cn("text-xs font-mono", config.text)}>{config.label}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-foreground truncate">{cam.name}</h3>
                  <div className={cn("w-2 h-2 rounded-full", config.color)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{cam.zone}</span>
                  {cam.detections > 0 && (
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                      {cam.detections} detection{cam.detections > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Camera Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CameraIcon className="w-5 h-5 text-primary" />
                  {selected.name}
                  <Badge variant="outline" className={cn("text-xs", statusConfig[selected.status].text)}>
                    {selected.status}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Large camera view */}
                <div className="relative h-72 bg-muted/30 rounded-lg overflow-hidden border border-border">
                  <div className="absolute inset-0 grid-bg opacity-20" />
                  {selected.status === "online" && (
                    <>
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="w-full h-px bg-primary/40 animate-scan-line" />
                      </div>
                      {/* Multiple AI detection boxes */}
                      <div className="absolute top-12 left-16 w-24 h-20 border-2 border-primary/60 rounded">
                        <div className="absolute -top-5 left-0 bg-primary/80 text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-mono">
                          Worker #1 – PPE ✓
                        </div>
                      </div>
                      {selected.detections > 0 && (
                        <div className="absolute top-20 right-24 w-20 h-16 border-2 border-destructive/60 rounded">
                          <div className="absolute -top-5 left-0 bg-destructive/80 text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded font-mono">
                            {selected.lastDetection}
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-16 left-1/3 w-16 h-14 border border-success/50 rounded">
                        <div className="absolute -top-5 left-0 bg-success/80 text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-mono">
                          Machine OK
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse-glow" />
                        <span className="text-[10px] text-destructive font-mono">LIVE</span>
                      </div>
                      <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground font-mono">
                        {selected.id} • {selected.zone} • {new Date().toLocaleString()}
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="glass rounded-lg p-3 border border-border">
                    <p className="text-xs text-muted-foreground">Camera ID</p>
                    <p className="font-mono text-foreground">{selected.id}</p>
                  </div>
                  <div className="glass rounded-lg p-3 border border-border">
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="text-foreground">{selected.type}</p>
                  </div>
                  <div className="glass rounded-lg p-3 border border-border">
                    <p className="text-xs text-muted-foreground">Active Detections</p>
                    <p className="text-foreground">{selected.detections}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cameras;
