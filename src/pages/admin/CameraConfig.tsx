import { useEffect, useMemo, useState } from "react";
import {
  Camera, Plus, Trash2, Wifi, Edit2, Save, X, RefreshCw, Copy, CheckCircle2,
  AlertCircle, Radio, Terminal, Settings2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import PageHeader from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";

type StreamType = "hls" | "webrtc" | "mjpeg";

interface CameraRow {
  id: string;
  tenant_id: string;
  name: string;
  zone: string | null;
  type: string | null;
  status: string;
  resolution: string | null;
  rtsp_url: string | null;
  stream_url: string | null;
  stream_type: StreamType;
  retention_days: number;
  heartbeat_interval_seconds: number;
  ingest_token: string | null;
  ai_models: Record<string, boolean>;
  confidence_threshold: number;
  credentials: { username?: string; password?: string; onvif_port?: number };
  fps: number;
  ptz_enabled: boolean;
  recording_enabled: boolean;
  last_seen_at: string | null;
}

const AI_MODEL_DEFS = [
  { key: "ppe", label: "PPE Compliance", desc: "Hard hats, vests, gloves, goggles" },
  { key: "intrusion", label: "Restricted Zone Intrusion", desc: "Unauthorized personnel detection" },
  { key: "downtime", label: "Downtime & Idle Detection", desc: "Machine idle, unattended stations" },
  { key: "quality", label: "Quality Defect Detection", desc: "Label, color, alignment anomalies" },
  { key: "ergonomics", label: "Ergonomic Risk", desc: "Unsafe postures, lifting hazards" },
] as const;

const emptyCam = (tenantId: string): Partial<CameraRow> => ({
  tenant_id: tenantId,
  name: "",
  zone: "",
  type: "Vision",
  status: "configuring",
  resolution: "1920x1080",
  rtsp_url: "",
  stream_url: "",
  stream_type: "hls",
  retention_days: 30,
  heartbeat_interval_seconds: 60,
  ai_models: { ppe: true, intrusion: false, downtime: false, quality: false, ergonomics: false },
  confidence_threshold: 75,
  credentials: { username: "admin", password: "", onvif_port: 80 },
  fps: 25,
  ptz_enabled: false,
  recording_enabled: true,
});

const isLikelyStreamUrl = (u: string, t: StreamType) => {
  if (!u) return false;
  try {
    const url = new URL(u);
    if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) return false;
    if (t === "hls") return /\.m3u8($|\?)/i.test(url.pathname);
    if (t === "mjpeg") return /(mjpeg|mjpg|stream)/i.test(url.pathname) || url.pathname.length > 1;
    return true; // webrtc / whep — any http(s) endpoint accepted
  } catch {
    return false;
  }
};

const isLikelyRtsp = (u: string) => /^rtsp(s)?:\/\/.+/i.test(u);

const CameraConfig = () => {
  const { activeTenant, activeTenantId } = useTenants();
  const [rows, setRows] = useState<CameraRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<CameraRow> | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [gatewayBase, setGatewayBase] = useState<string>("");
  const [heartbeatFor, setHeartbeatFor] = useState<CameraRow | null>(null);

  const load = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("cameras")
      .select("*")
      .eq("tenant_id", activeTenantId)
      .order("name");
    if (error) toast.error(error.message);
    setRows((data as any as CameraRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    setGatewayBase((activeTenant as any)?.settings?.gateway_base_url ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId]);

  // Realtime sync so the wall + config stay in lockstep as soon as gateways emit heartbeats
  useEffect(() => {
    if (!activeTenantId) return;
    const ch = supabase
      .channel(`camera-config:${activeTenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cameras", filter: `tenant_id=eq.${activeTenantId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId]);

  const supabaseBase = useMemo(() => {
    // Public URL for heartbeat curl — derived from the client config
    const anyClient = supabase as any;
    return anyClient?.supabaseUrl ?? "";
  }, []);

  const saveGatewaySettings = async () => {
    if (!activeTenantId) return;
    setSavingSettings(true);
    const existing = ((activeTenant as any)?.settings ?? {}) as Record<string, unknown>;
    const { error } = await supabase
      .from("tenants")
      .update({ settings: { ...existing, gateway_base_url: gatewayBase.replace(/\/$/, "") } })
      .eq("id", activeTenantId);
    setSavingSettings(false);
    if (error) toast.error(error.message);
    else toast.success("Gateway settings saved");
  };

  const autoStreamUrl = (cameraId: string, type: StreamType) => {
    if (!gatewayBase) return "";
    const base = gatewayBase.replace(/\/$/, "");
    if (type === "hls") return `${base}/${cameraId}/index.m3u8`;
    if (type === "webrtc") return `${base}/${cameraId}/whep`;
    return `${base}/${cameraId}`;
  };

  const save = async () => {
    if (!editing || !activeTenantId) return;
    const e = editing;
    if (!e.name?.trim()) return toast.error("Camera name is required");
    if (e.rtsp_url && !isLikelyRtsp(e.rtsp_url)) return toast.error("RTSP URL must start with rtsp://");
    let stream = e.stream_url ?? "";
    if (!stream && e.id) stream = autoStreamUrl(e.id, (e.stream_type as StreamType) ?? "hls");
    if (stream && !isLikelyStreamUrl(stream, (e.stream_type as StreamType) ?? "hls")) {
      return toast.error(`Stream URL doesn't look like a valid ${e.stream_type?.toUpperCase()} endpoint`);
    }

    const payload = {
      tenant_id: activeTenantId,
      name: e.name!.trim(),
      zone: e.zone ?? null,
      type: e.type ?? "Vision",
      status: e.status ?? "configuring",
      resolution: e.resolution ?? "1920x1080",
      rtsp_url: e.rtsp_url ?? null,
      stream_url: stream || null,
      stream_type: e.stream_type ?? "hls",
      retention_days: e.retention_days ?? 30,
      heartbeat_interval_seconds: e.heartbeat_interval_seconds ?? 60,
      ai_models: e.ai_models ?? {},
      confidence_threshold: e.confidence_threshold ?? 75,
      credentials: e.credentials ?? {},
      fps: e.fps ?? 25,
      ptz_enabled: !!e.ptz_enabled,
      recording_enabled: e.recording_enabled ?? true,
    };

    if (e.id) {
      const { error } = await supabase.from("cameras").update(payload).eq("id", e.id);
      if (error) return toast.error(error.message);
      toast.success(`${payload.name} updated`);
    } else {
      // Insert; if no explicit stream URL and a gateway is configured, populate it on the returned id
      const { data, error } = await supabase.from("cameras").insert(payload).select("*").maybeSingle();
      if (error) return toast.error(error.message);
      if (data && !data.stream_url && gatewayBase) {
        const generated = autoStreamUrl(data.id, payload.stream_type as StreamType);
        await supabase.from("cameras").update({ stream_url: generated }).eq("id", data.id);
      }
      toast.success(`${payload.name} provisioned · ingest token generated`);
    }
    setEditing(null);
    load();
  };

  const remove = async (row: CameraRow) => {
    if (!confirm(`Delete ${row.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from("cameras").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Camera removed");
    load();
  };

  const testStream = async (row: CameraRow) => {
    if (!row.stream_url) {
      toast.error("No stream URL set. Add one or configure a gateway base URL.");
      return;
    }
    setTesting(row.id);
    try {
      // Best-effort reachability probe — HLS manifest / WHEP endpoint HEAD.
      // Browsers won't leak CORS body, but network reachability + status is verifiable.
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(row.stream_url, { method: "GET", mode: "no-cors", signal: controller.signal });
      clearTimeout(t);
      // With no-cors we usually get an opaque response; treat "no throw" as reachable
      void res;
      toast.success(`Stream endpoint reachable · ${row.stream_type.toUpperCase()}`);
    } catch (err: any) {
      toast.error(`Unreachable: ${err?.message ?? "network error"}`);
    } finally {
      setTesting(null);
    }
  };

  const rotateToken = async (row: CameraRow) => {
    if (!confirm("Rotate ingest token? The gateway will need the new token to send heartbeats.")) return;
    const newToken = crypto.getRandomValues(new Uint8Array(24));
    const hex = Array.from(newToken).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase.from("cameras").update({ ingest_token: hex }).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Token rotated");
    load();
  };

  const copy = (text: string, label = "Copied") => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const heartbeatCurl = (row: CameraRow) =>
    `curl -X POST '${supabaseBase}/functions/v1/camera-heartbeat' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "camera_id": "${row.id}",
    "token": "${row.ingest_token ?? "<token>"}",
    "status": "online",
    "resolution": "${row.resolution ?? "1920x1080"}",
    "fps": ${row.fps ?? 25}
  }'`;

  const online = rows.filter((r) => r.status === "online").length;
  const withStream = rows.filter((r) => !!r.stream_url).length;

  if (!activeTenantId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Select a tenant to manage cameras.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vision"
        icon={Camera}
        title="IP Camera Configuration"
        description="Provision cameras, wire them to your RTSP-to-HLS/WebRTC gateway, and activate live monitoring."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            <Button onClick={() => setEditing(emptyCam(activeTenantId))} className="gap-2">
              <Plus className="w-4 h-4" /> Add Camera
            </Button>
          </div>
        }
      />

      {/* Fleet strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Cameras", value: rows.length, tone: "text-foreground" },
          { label: "Online", value: online, tone: "text-success" },
          { label: "Live streams", value: withStream, tone: "text-primary" },
          { label: "Gateway", value: gatewayBase ? "Configured" : "Not set", tone: gatewayBase ? "text-success" : "text-warning" },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Gateway settings */}
      <div className="glass rounded-xl border border-border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Streaming Gateway</h3>
          <Badge variant="outline" className="text-xs">MediaMTX · go2rtc · Ant Media · WHEP</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Browsers can't pull RTSP directly. Point a gateway at your RTSP cameras and paste its base URL here.
          New cameras auto-generate their <span className="font-mono">stream_url</span> from this base plus the camera ID.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={gatewayBase}
            onChange={(e) => setGatewayBase(e.target.value)}
            placeholder="https://gateway.example.com"
            className="font-mono text-sm"
          />
          <Button onClick={saveGatewaySettings} disabled={savingSettings} className="gap-2">
            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
        </div>
        {gatewayBase && (
          <p className="text-[11px] text-muted-foreground font-mono">
            HLS pattern: {gatewayBase.replace(/\/$/, "")}/&lt;camera-id&gt;/index.m3u8 · WHEP: {gatewayBase.replace(/\/$/, "")}/&lt;camera-id&gt;/whep
          </p>
        )}
      </div>

      {/* Camera grid */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading cameras…
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-xl border border-dashed border-border p-12 text-center">
          <Camera className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            No cameras yet. Add your first IP camera to activate live monitoring.
          </p>
          <Button onClick={() => setEditing(emptyCam(activeTenantId))} className="gap-2">
            <Plus className="w-4 h-4" /> Add Camera
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((cam) => {
            const activeModels = Object.entries(cam.ai_models ?? {}).filter(([, v]) => v).map(([k]) => k);
            const lastSeen = cam.last_seen_at ? new Date(cam.last_seen_at) : null;
            const secsAgo = lastSeen ? Math.floor((Date.now() - lastSeen.getTime()) / 1000) : null;
            const heartbeatFresh = secsAgo !== null && secsAgo <= cam.heartbeat_interval_seconds * 3;
            return (
              <div key={cam.id} className="glass rounded-xl border border-border p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Camera className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{cam.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">
                        {cam.id.slice(0, 8)} · {cam.zone ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className={
                      cam.status === "online" ? "text-success border-success/40" :
                      cam.status === "maintenance" ? "text-warning border-warning/40" :
                      "text-muted-foreground"
                    }>
                      <Radio className={`w-2.5 h-2.5 mr-1 ${cam.status === "online" ? "animate-pulse" : ""}`} />
                      {cam.status}
                    </Badge>
                    {cam.stream_url ? (
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/40">
                        LIVE · {cam.stream_type.toUpperCase()}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">NO STREAM</Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Resolution</p>
                    <p className="text-foreground">{cam.resolution} · {cam.fps}fps</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last heartbeat</p>
                    <p className={heartbeatFresh ? "text-success" : "text-muted-foreground"}>
                      {secsAgo === null ? "Never" : secsAgo < 60 ? `${secsAgo}s ago` : `${Math.floor(secsAgo / 60)}m ago`}
                    </p>
                  </div>
                  {cam.rtsp_url && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">RTSP</p>
                      <p className="font-mono text-foreground text-[11px] truncate">{cam.rtsp_url}</p>
                    </div>
                  )}
                  {cam.stream_url && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Playback</p>
                      <p className="font-mono text-foreground text-[11px] truncate">{cam.stream_url}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Active AI Models</p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeModels.length === 0 && <span className="text-xs text-muted-foreground">None enabled</span>}
                    {activeModels.map((m) => (
                      <Badge key={m} variant="outline" className="text-[10px] capitalize border-primary/30 text-primary">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  <Button size="sm" variant="outline" onClick={() => testStream(cam)} disabled={testing === cam.id} className="gap-1.5">
                    <Wifi className="w-3.5 h-3.5" />
                    {testing === cam.id ? "Testing…" : "Test stream"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setHeartbeatFor(cam)} className="gap-1.5">
                    <Terminal className="w-3.5 h-3.5" /> Heartbeat
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(cam)} className="gap-1.5">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(cam)} className="gap-1.5 text-destructive hover:text-destructive ml-auto">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Add Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              {editing?.id ? "Edit Camera" : "Add IP Camera"}
            </DialogTitle>
            <DialogDescription>
              {editing?.id
                ? "Update stream, credentials, and AI model configuration."
                : "Provision a new camera. An ingest token is generated automatically for gateway heartbeats."}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <Tabs defaultValue="stream" className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="stream">Stream</TabsTrigger>
                <TabsTrigger value="ai">AI Models</TabsTrigger>
                <TabsTrigger value="ops">Operations</TabsTrigger>
              </TabsList>

              <TabsContent value="stream" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Camera Name *</Label>
                    <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Zone B – Assembly" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Zone</Label>
                    <Input value={editing.zone ?? ""} onChange={(e) => setEditing({ ...editing, zone: e.target.value })} placeholder="Zone B" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>RTSP URL (source)</Label>
                    <Input
                      value={editing.rtsp_url ?? ""}
                      onChange={(e) => setEditing({ ...editing, rtsp_url: e.target.value })}
                      placeholder="rtsp://user:pass@192.168.1.100:554/stream1"
                      className="font-mono text-sm"
                    />
                    {editing.rtsp_url && !isLikelyRtsp(editing.rtsp_url) && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Must start with rtsp://
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Stream Type</Label>
                    <Select
                      value={(editing.stream_type as StreamType) ?? "hls"}
                      onValueChange={(v: StreamType) => setEditing({ ...editing, stream_type: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hls">HLS (.m3u8)</SelectItem>
                        <SelectItem value="webrtc">WebRTC / WHEP</SelectItem>
                        <SelectItem value="mjpeg">MJPEG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Resolution</Label>
                    <Select
                      value={editing.resolution ?? "1920x1080"}
                      onValueChange={(v) => setEditing({ ...editing, resolution: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1280x720">720p HD</SelectItem>
                        <SelectItem value="1920x1080">1080p Full HD</SelectItem>
                        <SelectItem value="2560x1440">2K QHD</SelectItem>
                        <SelectItem value="3840x2160">4K UHD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Playback URL (browser)</Label>
                      {!editing.stream_url && gatewayBase && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => {
                            const id = editing.id ?? "<camera-id>";
                            setEditing({ ...editing, stream_url: autoStreamUrl(id, (editing.stream_type as StreamType) ?? "hls") });
                          }}
                        >
                          Auto-generate from gateway
                        </button>
                      )}
                    </div>
                    <Input
                      value={editing.stream_url ?? ""}
                      onChange={(e) => setEditing({ ...editing, stream_url: e.target.value })}
                      placeholder={
                        editing.stream_type === "webrtc"
                          ? "https://gateway/cam-1/whep"
                          : editing.stream_type === "mjpeg"
                          ? "http://gateway/cam-1/stream.mjpeg"
                          : "https://gateway/cam-1/index.m3u8"
                      }
                      className="font-mono text-sm"
                    />
                    {!editing.stream_url && !gatewayBase && (
                      <p className="text-xs text-warning flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> No stream URL. Configure a gateway base URL above to auto-generate on save.
                      </p>
                    )}
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Frame Rate: {editing.fps} fps</Label>
                      <Slider value={[editing.fps ?? 25]} min={5} max={60} step={5} onValueChange={(v) => setEditing({ ...editing, fps: v[0] })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Heartbeat: {editing.heartbeat_interval_seconds}s</Label>
                      <Slider value={[editing.heartbeat_interval_seconds ?? 60]} min={15} max={300} step={5} onValueChange={(v) => setEditing({ ...editing, heartbeat_interval_seconds: v[0] })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Retention: {editing.retention_days}d</Label>
                      <Slider value={[editing.retention_days ?? 30]} min={7} max={365} step={1} onValueChange={(v) => setEditing({ ...editing, retention_days: v[0] })} />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="ai" className="space-y-3 pt-4">
                <p className="text-xs text-muted-foreground">
                  Enable models to process frames from this camera. Powered by Gemini 2.5 vision via the AI Gateway.
                </p>
                {AI_MODEL_DEFS.map((m) => (
                  <div key={m.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </div>
                    <Switch
                      checked={!!editing.ai_models?.[m.key]}
                      onCheckedChange={(v) => setEditing({
                        ...editing,
                        ai_models: { ...(editing.ai_models ?? {}), [m.key]: v },
                      })}
                    />
                  </div>
                ))}
                <div className="space-y-1.5 pt-2">
                  <Label>Confidence Threshold: {editing.confidence_threshold}%</Label>
                  <Slider
                    value={[editing.confidence_threshold ?? 75]}
                    min={50} max={99} step={1}
                    onValueChange={(v) => setEditing({ ...editing, confidence_threshold: v[0] })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="ops" className="space-y-3 pt-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Username</Label>
                    <Input
                      value={editing.credentials?.username ?? ""}
                      onChange={(e) => setEditing({ ...editing, credentials: { ...(editing.credentials ?? {}), username: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={editing.credentials?.password ?? ""}
                      onChange={(e) => setEditing({ ...editing, credentials: { ...(editing.credentials ?? {}), password: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ONVIF Port</Label>
                    <Input
                      type="number"
                      value={editing.credentials?.onvif_port ?? 80}
                      onChange={(e) => setEditing({ ...editing, credentials: { ...(editing.credentials ?? {}), onvif_port: +e.target.value } })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium">PTZ Control</p>
                    <p className="text-xs text-muted-foreground">Pan / Tilt / Zoom support</p>
                  </div>
                  <Switch checked={!!editing.ptz_enabled} onCheckedChange={(v) => setEditing({ ...editing, ptz_enabled: v })} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium">Continuous Recording</p>
                    <p className="text-xs text-muted-foreground">Retain frames per retention policy</p>
                  </div>
                  <Switch checked={editing.recording_enabled ?? true} onCheckedChange={(v) => setEditing({ ...editing, recording_enabled: v })} />
                </div>
                {editing.id && editing.ingest_token && (
                  <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Ingest Token</Label>
                      <Button size="sm" variant="ghost" onClick={() => copy(editing.ingest_token!, "Token copied")} className="h-6 gap-1 text-xs">
                        <Copy className="w-3 h-3" /> Copy
                      </Button>
                    </div>
                    <p className="font-mono text-[11px] break-all text-muted-foreground">{editing.ingest_token}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Used by your streaming gateway to authenticate heartbeats. Rotate from the camera card.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} className="gap-2"><X className="w-4 h-4" /> Cancel</Button>
            <Button onClick={save} className="gap-2"><Save className="w-4 h-4" /> Save Camera</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Heartbeat instructions dialog */}
      <Dialog open={!!heartbeatFor} onOpenChange={(o) => !o && setHeartbeatFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" /> Gateway Heartbeat
            </DialogTitle>
            <DialogDescription>
              Configure your streaming gateway (MediaMTX, go2rtc, custom) to POST this heartbeat on the interval configured for the camera.
              As soon as heartbeats arrive, the camera goes <span className="text-success font-medium">LIVE</span> across the app.
            </DialogDescription>
          </DialogHeader>
          {heartbeatFor && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Endpoint</Label>
                <Button size="sm" variant="ghost" onClick={() => copy(`${supabaseBase}/functions/v1/camera-heartbeat`, "Endpoint copied")} className="h-6 gap-1 text-xs">
                  <Copy className="w-3 h-3" /> Copy
                </Button>
              </div>
              <p className="font-mono text-xs bg-muted/40 rounded p-2 break-all">
                POST {supabaseBase}/functions/v1/camera-heartbeat
              </p>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Sample cURL</Label>
                <Button size="sm" variant="ghost" onClick={() => copy(heartbeatCurl(heartbeatFor), "cURL copied")} className="h-6 gap-1 text-xs">
                  <Copy className="w-3 h-3" /> Copy
                </Button>
              </div>
              <Textarea readOnly value={heartbeatCurl(heartbeatFor)} className="font-mono text-[11px] h-40" />

              <div className="p-3 rounded-lg border border-border bg-muted/20 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  Optionally include a <span className="font-mono">detection</span> object per heartbeat to inject a live alert
                  (title, severity, confidence). It flows into the Alerts feed and camera wall instantly.
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" size="sm" onClick={() => rotateToken(heartbeatFor)} className="gap-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Rotate token
                </Button>
                <Button onClick={() => setHeartbeatFor(null)}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CameraConfig;
