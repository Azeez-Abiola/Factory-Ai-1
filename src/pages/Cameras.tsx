import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera as CameraIcon, Wifi, WifiOff, Wrench, Sparkles, Search, Volume2, VolumeX,
  Maximize2, Minimize2, LayoutGrid, Grid2x2, Grid3x3, Square, Play, Pause,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ZoomIn, ZoomOut,
  ShieldCheck, ShieldAlert, Activity, Radio
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLiveCameras, LiveCamera } from "@/hooks/useLiveCameras";
import LiveFeed from "@/components/app/LiveFeed";
import { toast } from "sonner";
import AIAnalyzeDialog from "@/components/app/AIAnalyzeDialog";
import PageHeader from "@/components/app/PageHeader";
import { useTenants } from "@/hooks/useTenants";
import { useVisionOverlay, VISION_CATEGORIES, categoryColor, VisionBox } from "@/hooks/useVisionOverlay";

type LayoutKey = "1" | "4" | "9" | "12" | "16";

const layoutConfig: Record<LayoutKey, { cols: string; label: string; icon: any; count: number }> = {
  "1":  { cols: "grid-cols-1",                                    label: "Focus",   icon: Square,     count: 1 },
  "4":  { cols: "grid-cols-2",                                    label: "Quad",    icon: Grid2x2,    count: 4 },
  "9":  { cols: "grid-cols-2 md:grid-cols-3",                     label: "3×3",     icon: Grid3x3,    count: 9 },
  "12": { cols: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",      label: "3×4",     icon: LayoutGrid, count: 12 },
  "16": { cols: "grid-cols-2 md:grid-cols-4",                     label: "4×4",     icon: LayoutGrid, count: 16 },
};

const statusConfig = {
  online:      { color: "bg-success",     icon: Wifi,    label: "Online",   text: "text-success",     ring: "ring-success/40" },
  offline:     { color: "bg-destructive", icon: WifiOff, label: "Offline",  text: "text-destructive", ring: "ring-destructive/40" },
  maintenance: { color: "bg-warning",     icon: Wrench,  label: "Maint.",   text: "text-warning",     ring: "ring-warning/40" },
};

const telemetryFor = (cam: LiveCamera) => {
  return {
    fps: cam.status === "online" ? cam.fps ?? null : null,
    resolution: cam.resolution ?? "Not reported",
  };
};

const Cameras = () => {
  const { cameras, hasLiveStreams } = useLiveCameras();
  const { activeTenantId } = useTenants();
  const [visionOn, setVisionOn] = useState(true);
  const [selected, setSelected] = useState<LiveCamera | null>(null);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [status, setStatus] = useState<string>("all");
  const [zone, setZone] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<LayoutKey>("9");
  const [page, setPage] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [wallFullscreen, setWallFullscreen] = useState(false);
  const [now, setNow] = useState(new Date());
  const wallRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Live clock — one interval, drives all overlay timestamps.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const zones = useMemo<string[]>(
    () => Array.from(new Set(cameras.map((c) => c.zone).filter((z): z is string => !!z && z.trim() !== ""))).sort(),
    [cameras]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cameras.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (zone !== "all" && c.zone !== zone) return false;
      if (q && !`${c.name} ${c.id} ${c.zone} ${c.type}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cameras, status, zone, search]);

  const perPage = layoutConfig[layout].count;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(safePage * perPage, safePage * perPage + perPage);

  // Auto-rotate pages
  useEffect(() => {
    if (!autoRotate || totalPages <= 1) return;
    const t = setInterval(() => setPage((p) => (p + 1) % totalPages), 8000);
    return () => clearInterval(t);
  }, [autoRotate, totalPages]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "1") setLayout("1");
      if (e.key === "4") setLayout("4");
      if (e.key === "9") setLayout("9");
      if (e.key === "6") setLayout("16");
      if (e.key === "ArrowRight") setPage((p) => (p + 1) % totalPages);
      if (e.key === "ArrowLeft") setPage((p) => (p - 1 + totalPages) % totalPages);
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [totalPages]);

  useEffect(() => {
    const onFsChange = () => setWallFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      wallRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const counts = useMemo(() => ({
    total: cameras.length,
    online: cameras.filter((c) => c.status === "online").length,
    offline: cameras.filter((c) => c.status === "offline").length,
    maintenance: cameras.filter((c) => c.status === "maintenance").length,
    detections: cameras.reduce((a, c) => a + c.detections, 0),
  }), [cameras]);

  const uptimePct = counts.total ? Math.round((counts.online / counts.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Vision"
        icon={CameraIcon}
        title="Camera Feeds"
        description={`${counts.online} of ${counts.total} cameras streaming • ${counts.detections} active AI detections`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("gap-1.5 text-xs", hasLiveStreams ? "border-success/40 text-success" : "text-muted-foreground")}>
              <span className="relative flex h-2 w-2">
                <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping", hasLiveStreams ? "bg-success" : "bg-muted-foreground")} />
                <span className={cn("relative inline-flex h-2 w-2 rounded-full", hasLiveStreams ? "bg-success" : "bg-muted-foreground")} />
              </span>
              {hasLiveStreams ? "STREAMS CONFIGURED" : "NO LIVE STREAMS"} • {now.toLocaleTimeString()}
            </Badge>
          </div>
        }
      />

      {/* Health strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <HealthTile icon={Activity}      label="Fleet Uptime"  value={`${uptimePct}%`}         tone="primary" />
        <HealthTile icon={ShieldCheck}   label="Online"        value={counts.online}           tone="success" />
        <HealthTile icon={ShieldAlert}   label="Offline"       value={counts.offline}          tone="destructive" />
        <HealthTile icon={Wrench}        label="Maintenance"   value={counts.maintenance}      tone="warning" />
        <HealthTile icon={Radio}         label="AI Detections" value={counts.detections}       tone="primary" />
      </div>

      {/* Controls bar */}
      <div className="glass rounded-xl border border-border p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cameras, zones, IDs…  ( press / )"
            className="pl-9 h-9 bg-background/60"
          />
        </div>

        <Select value={zone} onValueChange={setZone}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Zone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All zones</SelectItem>
            {zones.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-background/60">
          {(Object.keys(layoutConfig) as LayoutKey[]).map((k) => {
            const Icon = layoutConfig[k].icon;
            return (
              <button
                key={k}
                onClick={() => { setLayout(k); setPage(0); }}
                title={`${layoutConfig[k].label} (${layoutConfig[k].count} cams)`}
                aria-pressed={layout === k}
                className={cn(
                  "px-2 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors",
                  layout === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{layoutConfig[k].label}</span>
              </button>
            );
          })}
        </div>

        <Button
          size="sm" variant="outline" onClick={() => setAutoRotate((v) => !v)}
          className={cn("h-9 gap-1.5", autoRotate && "border-primary/40 text-primary")}
          title="Auto-cycle pages every 8s"
        >
          {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{autoRotate ? "Rotating" : "Auto-cycle"}</span>
        </Button>

        <Button
          size="sm" variant="outline" onClick={() => setAudioOn((v) => !v)}
          className={cn("h-9 gap-1.5", audioOn && "border-primary/40 text-primary")}
          title="Enable live audio on the focused/selected camera (only cameras with audio configured will emit sound)"
        >
          {audioOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{audioOn ? "Audio on" : "Audio"}</span>
        </Button>

        <Button
          size="sm" variant="outline" onClick={() => setVisionOn((v) => !v)}
          className={cn("h-9 gap-1.5", visionOn && "border-primary/40 text-primary")}
          title="Continuously analyse every visible live stream and draw colour-coded detection boxes"
          aria-pressed={visionOn}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{visionOn ? "AI overlay on" : "AI overlay off"}</span>
        </Button>

        <Button size="sm" variant="outline" onClick={toggleFullscreen} className="h-9 gap-1.5" title="Toggle wall fullscreen (F)">
          {wallFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Detection legend */}
      {visionOn && (
        <div className="glass flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border px-3 py-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Detection colours</span>
          {VISION_CATEGORIES.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: categoryColor(c.id) }} />
              {c.label}
            </span>
          ))}
        </div>
      )}



      {/* Wall */}
      <div ref={wallRef} className={cn("space-y-3", wallFullscreen && "bg-background p-4")}>
        {filtered.length === 0 ? (
          <div className="glass rounded-xl border border-border p-12 text-center">
            <CameraIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No cameras match the current filters.</p>
            <Button variant="link" size="sm" onClick={() => { setSearch(""); setStatus("all"); setZone("all"); }}>Clear filters</Button>
          </div>
        ) : (
          <>
            <div className={cn("grid gap-3", layoutConfig[layout].cols)}>
              {visible.map((cam, idx) => (
                <CameraTile key={cam.id} cam={cam} onOpen={() => setSelected(cam)} now={now} focus={layout === "1"} audioOn={audioOn} visionOn={visionOn} tenantId={activeTenantId} stagger={idx} />
              ))}
              {/* Fill empty slots so grid keeps its shape */}
              {Array.from({ length: Math.max(0, perPage - visible.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="rounded-xl border border-dashed border-border/60 min-h-[140px] flex items-center justify-center text-[10px] text-muted-foreground/60">
                  Empty slot
                </div>
              ))}
            </div>

            {/* Paginator */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing {safePage * perPage + 1}–{Math.min(filtered.length, safePage * perPage + perPage)} of {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setPage((p) => (p - 1 + totalPages) % totalPages)}>
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </Button>
                  <span className="px-2 font-mono">Page {safePage + 1} / {totalPages}</span>
                  <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setPage((p) => (p + 1) % totalPages)}>
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Camera Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl bg-card border-border">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <CameraIcon className="w-5 h-5 text-primary" />
                  {selected.name}
                  <Badge variant="outline" className={cn("text-xs", statusConfig[selected.status].text)}>
                    {statusConfig[selected.status].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono ml-1">{selected.id} • {selected.zone}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="relative h-80 bg-muted/30 rounded-lg overflow-hidden border border-border">
                  <FeedInner cam={selected} now={now} large audioOn={audioOn} visionOn={visionOn} tenantId={activeTenantId} stagger={0} />
                </div>

                {/* Telemetry */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <Telemetry label="Resolution" value={telemetryFor(selected).resolution} />
                  <Telemetry label="FPS" value={telemetryFor(selected).fps ?? "Not reported"} />
                  <Telemetry label="AI status" value={selected.inferenceEnabled ? selected.inferenceStatus ?? "Enabled" : "Disabled"} />
                  <Telemetry label="Last heartbeat" value={selected.lastSeenAt ? new Date(selected.lastSeenAt).toLocaleTimeString() : "Never"} />
                </div>

                {/* PTZ + actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {selected.ptzEnabled && <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground mr-1">PTZ</span>
                    <PtzBtn icon={ChevronUp}    onClick={() => toast.info("Tilt up sent")} />
                    <PtzBtn icon={ChevronDown}  onClick={() => toast.info("Tilt down sent")} />
                    <PtzBtn icon={ChevronLeft}  onClick={() => toast.info("Pan left sent")} />
                    <PtzBtn icon={ChevronRight} onClick={() => toast.info("Pan right sent")} />
                    <PtzBtn icon={ZoomIn}       onClick={() => toast.info("Zoom in sent")} />
                    <PtzBtn icon={ZoomOut}      onClick={() => toast.info("Zoom out sent")} />
                  </div>}
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setAnalyzeOpen(true)} disabled={!selected.snapshotUrl} className="gap-1.5">
                      <Sparkles className="w-4 h-4" /> Analyze with AI
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {selected && (
        <AIAnalyzeDialog
          open={analyzeOpen}
          onOpenChange={setAnalyzeOpen}
          cameraName={selected.name}
          cameraId={selected.id}
          snapshotUrl={selected.snapshotUrl}
        />
      )}
    </div>
  );
};

// ---------- Sub-components ----------

const HealthTile = ({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone: "primary" | "success" | "warning" | "destructive" }) => {
  const toneMap = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
  } as const;
  return (
    <div className="glass rounded-xl border border-border p-3 flex items-center gap-3">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", toneMap[tone])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground leading-tight">{value}</p>
      </div>
    </div>
  );
};

const CameraTile = ({ cam, onOpen, now, focus, audioOn, visionOn, tenantId, stagger }: { cam: LiveCamera; onOpen: () => void; now: Date; focus: boolean; audioOn: boolean; visionOn: boolean; tenantId: string | null; stagger: number }) => {
  const config = statusConfig[cam.status];
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className={cn(
        "glass rounded-xl border border-border hover:border-primary/40 cursor-pointer transition-all overflow-hidden group focus:outline-none focus-visible:ring-2 ring-primary/40",
        cam.status === "offline" && "opacity-80"
      )}
    >
      <div className={cn("relative bg-muted/30 overflow-hidden", focus ? "h-[420px]" : "h-40")}>
        <FeedInner cam={cam} now={now} large={focus} audioOn={audioOn} tileFocus={focus} visionOn={visionOn} tenantId={tenantId} stagger={stagger} />
      </div>
      <div className="p-2.5">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className="text-sm font-semibold text-foreground truncate">{cam.name}</h3>
          <div className={cn("w-2 h-2 rounded-full", config.color)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{cam.zone} • {cam.type}</span>
          {cam.detections > 0 && (
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
              {cam.detections} det.
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

/** Colour-coded AI detection boxes drawn over the live picture. */
const DetectionBoxes = ({ boxes, large }: { boxes: VisionBox[]; large: boolean }) => (
  <div className="pointer-events-none absolute inset-0">
    {boxes.map((box) => {
      const color = categoryColor(box.category);
      return (
        <div
          key={box.id}
          className="absolute rounded-[3px] transition-all duration-500"
          style={{
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.w * 100}%`,
            height: `${box.h * 100}%`,
            border: `${large ? 2 : 1.5}px solid ${color}`,
            boxShadow: `0 0 0 1px hsl(var(--background) / 0.35), 0 0 12px ${color}55`,
          }}
        >
          <span
            className={cn(
              "absolute -top-[15px] left-0 whitespace-nowrap rounded-sm px-1 font-mono leading-[14px]",
              large ? "text-[10px]" : "text-[9px]"
            )}
            style={{ background: color, color: "hsl(var(--background))" }}
          >
            {box.label}
            {box.confidence ? ` ${Math.round(box.confidence * 100)}%` : ""}
          </span>
        </div>
      );
    })}
  </div>
);

const FeedInner = ({ cam, now, large = false, audioOn = false, tileFocus = false, visionOn = true, tenantId = null, stagger = 0 }: { cam: LiveCamera; now: Date; large?: boolean; audioOn?: boolean; tileFocus?: boolean; visionOn?: boolean; tenantId?: string | null; stagger?: number }) => {
  const config = statusConfig[cam.status];
  const tel = telemetryFor(cam);
  const showLive = cam.isLive && cam.streamUrl;
  const captureRef = useRef<(() => string | null) | null>(null);

  const vision = useVisionOverlay({
    cameraId: cam.id,
    cameraName: cam.name,
    zone: cam.zone,
    tenantId,
    enabled: visionOn && !!showLive && cam.status !== "maintenance" && cam.inferenceEnabled !== false,
    intervalSeconds: large ? 10 : 20,
    startDelayMs: (stagger % 6) * 1200,
    capture: () => captureRef.current?.() ?? null,
    hasSnapshot: !!cam.snapshotUrl,
  });

  // A browser-reachable stream can play before a gateway heartbeat arrives.
  // Maintenance always wins; cameras without playback stay on their status panel.
  if (cam.status === "maintenance" || !showLive) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute inset-0 grid-bg opacity-10" />
        <div className="text-center relative">
          <config.icon className={cn(large ? "w-10 h-10" : "w-6 h-6", "mx-auto mb-1", config.text)} />
          <p className={cn("font-mono", large ? "text-sm" : "text-xs", config.text)}>{config.label}</p>
          <p className="text-[10px] text-muted-foreground mt-1 font-mono">{cam.id}</p>
        </div>
      </div>
    );
  }
  // Only unmute where the operator can actually attend to the audio:
  // the selected-camera dialog (`large`) or the single-camera focused wall (`tileFocus`).
  // Requires the camera itself to be configured with audio_enabled.
  const canPlayAudio = audioOn && !!cam.audioEnabled && (large || tileFocus);
  return (
    <>
      <div className="absolute inset-0">
        <LiveFeed
          url={cam.streamUrl}
          type={cam.streamType ?? "hls"}
          muted={!canPlayAudio}
          captureRef={captureRef}
          overlay={<DetectionBoxes boxes={vision.boxes} large={large} />}
        />
      </div>

      {/* Corner HUD */}
        <div className="absolute top-2 left-2 flex items-center gap-1 text-[9px] font-mono text-primary/90 bg-background/40 backdrop-blur-sm px-1.5 py-0.5 rounded">
        {tel.resolution}{tel.fps ? ` • ${tel.fps}fps` : ""}
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        {cam.audioEnabled && (
          canPlayAudio ? (
            <Volume2 className="w-3 h-3 text-primary" aria-label="Audio on" />
          ) : (
            <VolumeX className="w-3 h-3 text-muted-foreground/70" aria-label="Audio available, muted" />
          )
        )}
        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse-glow" />
        <span className="text-[9px] text-destructive font-mono">{large ? "LIVE" : "REC"}</span>
      </div>
      <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground font-mono">
        {cam.id} • {now.toLocaleTimeString()}
      </div>
      {visionOn && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-background/50 px-1.5 py-0.5 text-[9px] font-mono backdrop-blur-sm">
          <span className={cn("h-1.5 w-1.5 rounded-full", vision.running ? "bg-primary animate-pulse" : vision.error ? "bg-destructive" : "bg-success")} />
          <span className="text-muted-foreground">
            {vision.running
              ? "AI scanning"
              : vision.error
                ? "AI unavailable"
                : `AI ${vision.boxes.length} flagged`}
          </span>
        </div>
      )}
    </>
  );
};


const Telemetry = ({ label, value }: { label: string; value: string | number }) => (
  <div className="glass rounded-lg p-3 border border-border">
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-sm font-semibold text-foreground">{value}</p>
  </div>
);

const PtzBtn = ({ icon: Icon, onClick }: { icon: any; onClick: () => void }) => (
  <Button
    type="button"
    size="icon"
    variant="outline"
    onClick={onClick}
    className="h-8 w-8"
  >
    <Icon className="w-4 h-4" />
  </Button>
);

export default Cameras;
