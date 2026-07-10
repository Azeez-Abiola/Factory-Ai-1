import { useState } from "react";
import { Camera, Plus, Trash2, Wifi, Edit2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface IPCamera {
  id: string;
  name: string;
  zone: string;
  ipAddress: string;
  rtspUrl: string;
  onvifPort: number;
  username: string;
  password: string;
  resolution: "720p" | "1080p" | "2K" | "4K";
  fps: number;
  ptzEnabled: boolean;
  recordingEnabled: boolean;
  retentionDays: number;
  aiModels: {
    ppe: boolean;
    intrusion: boolean;
    downtime: boolean;
    quality: boolean;
    ergonomics: boolean;
  };
  confidenceThreshold: number;
  status: "online" | "offline" | "configuring";
}

const seed: IPCamera[] = [
  {
    id: "IPC-01", name: "Main Entrance", zone: "Zone A",
    ipAddress: "192.168.1.101", rtspUrl: "rtsp://192.168.1.101:554/stream1",
    onvifPort: 80, username: "admin", password: "••••••",
    resolution: "1080p", fps: 25, ptzEnabled: false,
    recordingEnabled: true, retentionDays: 30,
    aiModels: { ppe: true, intrusion: true, downtime: false, quality: false, ergonomics: false },
    confidenceThreshold: 75, status: "online",
  },
  {
    id: "IPC-02", name: "Zone B – Assembly", zone: "Zone B",
    ipAddress: "192.168.1.104", rtspUrl: "rtsp://192.168.1.104:554/live/ch0",
    onvifPort: 80, username: "admin", password: "••••••",
    resolution: "2K", fps: 30, ptzEnabled: true,
    recordingEnabled: true, retentionDays: 60,
    aiModels: { ppe: true, intrusion: false, downtime: true, quality: false, ergonomics: true },
    confidenceThreshold: 80, status: "online",
  },
];

const emptyCam = (): IPCamera => ({
  id: `IPC-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`,
  name: "", zone: "", ipAddress: "", rtspUrl: "",
  onvifPort: 80, username: "admin", password: "",
  resolution: "1080p", fps: 25, ptzEnabled: false,
  recordingEnabled: true, retentionDays: 30,
  aiModels: { ppe: true, intrusion: false, downtime: false, quality: false, ergonomics: false },
  confidenceThreshold: 75, status: "configuring",
});

const CameraConfig = () => {
  const [cameras, setCameras] = useState<IPCamera[]>(seed);
  const [editing, setEditing] = useState<IPCamera | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const save = () => {
    if (!editing) return;
    if (!editing.name || !editing.rtspUrl) {
      toast.error("Name and RTSP URL are required");
      return;
    }
    setCameras((prev) => {
      const exists = prev.find((c) => c.id === editing.id);
      return exists ? prev.map((c) => c.id === editing.id ? editing : c) : [...prev, editing];
    });
    toast.success(`Camera "${editing.name}" saved`);
    setEditing(null);
  };

  const testConnection = (cam: IPCamera) => {
    setTesting(cam.id);
    setTimeout(() => {
      setTesting(null);
      const ok = cam.rtspUrl.startsWith("rtsp://");
      if (ok) toast.success(`Connected to ${cam.name} · ${cam.resolution} @ ${cam.fps}fps`);
      else toast.error(`Failed to connect to ${cam.name}. Check RTSP URL.`);
    }, 1200);
  };

  const remove = (id: string) => {
    setCameras((prev) => prev.filter((c) => c.id !== id));
    toast.success("Camera removed");
  };

  const activeModels = (cam: IPCamera) =>
    Object.entries(cam.aiModels).filter(([, v]) => v).map(([k]) => k);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vision"
        icon={Camera}
        title="IP Camera Configuration"
        description="Manage RTSP feeds, ONVIF credentials, and per-camera AI models."
        actions={
          <Button onClick={() => setEditing(emptyCam())} className="gap-2">
            <Plus className="w-4 h-4" /> Add Camera
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cameras.map((cam) => (
          <div key={cam.id} className="glass rounded-xl border border-border p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{cam.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{cam.id} · {cam.zone}</p>
                </div>
              </div>
              <Badge variant="outline" className={cam.status === "online" ? "text-success" : "text-muted-foreground"}>
                {cam.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">IP Address</p>
                <p className="font-mono text-foreground">{cam.ipAddress}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Resolution</p>
                <p className="text-foreground">{cam.resolution} @ {cam.fps}fps</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">RTSP</p>
                <p className="font-mono text-foreground text-[11px] truncate">{cam.rtspUrl}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Active AI Models</p>
              <div className="flex flex-wrap gap-1.5">
                {activeModels(cam).length === 0 && (
                  <span className="text-xs text-muted-foreground">None enabled</span>
                )}
                {activeModels(cam).map((m) => (
                  <Badge key={m} variant="outline" className="text-[10px] capitalize border-primary/30 text-primary">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button size="sm" variant="outline" onClick={() => testConnection(cam)} disabled={testing === cam.id} className="gap-1.5">
                <Wifi className="w-3.5 h-3.5" />
                {testing === cam.id ? "Testing..." : "Test"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(cam)} className="gap-1.5">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(cam.id)} className="gap-1.5 text-destructive hover:text-destructive ml-auto">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              {cameras.find((c) => c.id === editing?.id) ? "Edit Camera" : "Add IP Camera"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Camera Name *</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Zone B – Assembly" />
                </div>
                <div className="space-y-1.5">
                  <Label>Zone</Label>
                  <Input value={editing.zone} onChange={(e) => setEditing({ ...editing, zone: e.target.value })} placeholder="Zone B" />
                </div>
                <div className="space-y-1.5">
                  <Label>IP Address</Label>
                  <Input value={editing.ipAddress} onChange={(e) => setEditing({ ...editing, ipAddress: e.target.value })} placeholder="192.168.1.100" />
                </div>
                <div className="space-y-1.5">
                  <Label>ONVIF Port</Label>
                  <Input type="number" value={editing.onvifPort} onChange={(e) => setEditing({ ...editing, onvifPort: +e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>RTSP URL *</Label>
                  <Input value={editing.rtspUrl} onChange={(e) => setEditing({ ...editing, rtspUrl: e.target.value })} placeholder="rtsp://192.168.1.100:554/stream1" className="font-mono text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input value={editing.username} onChange={(e) => setEditing({ ...editing, username: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input type="password" value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Resolution</Label>
                  <Select value={editing.resolution} onValueChange={(v: IPCamera["resolution"]) => setEditing({ ...editing, resolution: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="720p">720p HD</SelectItem>
                      <SelectItem value="1080p">1080p Full HD</SelectItem>
                      <SelectItem value="2K">2K QHD</SelectItem>
                      <SelectItem value="4K">4K UHD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Frame Rate: {editing.fps} fps</Label>
                  <Slider value={[editing.fps]} min={5} max={60} step={5} onValueChange={(v) => setEditing({ ...editing, fps: v[0] })} />
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/20">
                <h4 className="text-sm font-semibold">AI Vision Models</h4>
                <p className="text-xs text-muted-foreground">
                  Enable models to process frames from this camera. Powered by Gemini 2.5 Pro Vision.
                </p>
                {[
                  { key: "ppe", label: "PPE Compliance", desc: "Hard hats, vests, gloves, goggles" },
                  { key: "intrusion", label: "Restricted Zone Intrusion", desc: "Unauthorized personnel detection" },
                  { key: "downtime", label: "Downtime & Idle Detection", desc: "Machine idle, unattended stations" },
                  { key: "quality", label: "Quality Defect Detection", desc: "Label, color, alignment anomalies" },
                  { key: "ergonomics", label: "Ergonomic Risk", desc: "Unsafe postures, lifting hazards" },
                ].map((m) => (
                  <div key={m.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </div>
                    <Switch
                      checked={editing.aiModels[m.key as keyof IPCamera["aiModels"]]}
                      onCheckedChange={(v) => setEditing({ ...editing, aiModels: { ...editing.aiModels, [m.key]: v } })}
                    />
                  </div>
                ))}
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <Label>Confidence Threshold: {editing.confidenceThreshold}%</Label>
                  <Slider value={[editing.confidenceThreshold]} min={50} max={99} step={1} onValueChange={(v) => setEditing({ ...editing, confidenceThreshold: v[0] })} />
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">PTZ Control</p>
                    <p className="text-xs text-muted-foreground">Pan / Tilt / Zoom support</p>
                  </div>
                  <Switch checked={editing.ptzEnabled} onCheckedChange={(v) => setEditing({ ...editing, ptzEnabled: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Continuous Recording</p>
                    <p className="text-xs text-muted-foreground">Retain frames for review</p>
                  </div>
                  <Switch checked={editing.recordingEnabled} onCheckedChange={(v) => setEditing({ ...editing, recordingEnabled: v })} />
                </div>
                {editing.recordingEnabled && (
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    <Label>Retention: {editing.retentionDays} days</Label>
                    <Slider value={[editing.retentionDays]} min={7} max={365} step={1} onValueChange={(v) => setEditing({ ...editing, retentionDays: v[0] })} />
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} className="gap-2"><X className="w-4 h-4" /> Cancel</Button>
            <Button onClick={save} className="gap-2"><Save className="w-4 h-4" /> Save Camera</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CameraConfig;
