import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Map as MapIcon, Camera as CameraIcon, AlertTriangle, Plus, Save, Pencil,
  Trash2, RefreshCw, X, ArrowUpRight, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import PageHeader from "@/components/app/PageHeader";
import FieldLabel from "@/components/forms/FieldLabel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ZoneRow {
  id: string;
  tenant_id: string;
  name: string;
  zone_type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  description: string | null;
}

interface AlertRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  zone: string | null;
  camera_id: string | null;
  detected_at: string;
  type: string;
}

interface CameraRow {
  id: string;
  name: string;
  zone: string | null;
  status: string;
}

const ZONE_TYPES = [
  { value: "production", label: "Production" },
  { value: "assembly", label: "Assembly" },
  { value: "storage", label: "Storage / Warehouse" },
  { value: "loading", label: "Loading Dock" },
  { value: "quality", label: "Quality / Lab" },
  { value: "hazard", label: "Hazard / Restricted" },
  { value: "office", label: "Office / Welfare" },
];

const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const zoneTone = (severity: string | null) => {
  switch (severity) {
    case "critical": return "border-destructive bg-destructive/25";
    case "high": return "border-destructive/70 bg-destructive/15";
    case "medium": return "border-warning bg-warning/15";
    case "low": return "border-primary/60 bg-primary/10";
    default: return "border-border bg-muted/40";
  }
};

const sevBadge = (severity: string) => {
  switch (severity) {
    case "critical": return "bg-destructive/15 text-destructive border-destructive/30";
    case "high": return "bg-destructive/10 text-destructive border-destructive/20";
    case "medium": return "bg-warning/15 text-warning border-warning/30";
    default: return "bg-primary/10 text-primary border-primary/20";
  }
};

const isOpen = (s: string) => s !== "resolved" && s !== "dismissed" && s !== "closed";

const FloorPlan = () => {
  const { activeTenantId, activeTenant } = useTenants();
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [cameras, setCameras] = useState<CameraRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Record<string, true>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<{ id?: string; name: string; zone_type: string; description: string }>({
    name: "", zone_type: "production", description: "",
  });
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const load = useCallback(async () => {
    if (!activeTenantId) { setZones([]); setAlerts([]); setCameras([]); setLoading(false); return; }
    setLoading(true);
    const [z, a, c] = await Promise.all([
      supabase.from("site_zones").select("*").eq("tenant_id", activeTenantId).order("created_at"),
      supabase.from("alerts").select("id,title,severity,status,zone,camera_id,detected_at,type")
        .eq("tenant_id", activeTenantId).order("detected_at", { ascending: false }).limit(300),
      supabase.from("cameras").select("id,name,zone,status").eq("tenant_id", activeTenantId),
    ]);
    if (z.error) toast.error("Could not load the floor plan");
    setZones(((z.data ?? []) as any[]).map((r) => ({
      ...r, x: Number(r.x), y: Number(r.y), width: Number(r.width), height: Number(r.height),
    })) as ZoneRow[]);
    setAlerts((a.data ?? []) as AlertRow[]);
    setCameras((c.data ?? []) as CameraRow[]);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => { load(); }, [load]);

  // Live alerts over the layout
  useEffect(() => {
    if (!activeTenantId) return;
    const ch = supabase
      .channel(`floorplan-alerts-${activeTenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `tenant_id=eq.${activeTenantId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeTenantId, load]);

  const matchZone = useCallback(
    (zoneName: string) => (value: string | null | undefined) =>
      !!value && value.trim().toLowerCase() === zoneName.trim().toLowerCase(),
    [],
  );

  const zoneStats = useMemo(() => {
    const map: Record<string, { open: AlertRow[]; topSeverity: string | null; cameras: CameraRow[]; online: number }> = {};
    for (const z of zones) {
      const m = matchZone(z.name);
      const zoneCameras = cameras.filter((c) => m(c.zone));
      const camIds = new Set(zoneCameras.map((c) => c.id));
      const open = alerts.filter((al) => isOpen(al.status) && (m(al.zone) || (al.camera_id && camIds.has(al.camera_id))));
      const topSeverity = open.reduce<string | null>(
        (acc, al) => (!acc || (severityRank[al.severity] ?? 0) > (severityRank[acc] ?? 0) ? al.severity : acc), null);
      map[z.id] = { open, topSeverity, cameras: zoneCameras, online: zoneCameras.filter((c) => c.status === "online").length };
    }
    return map;
  }, [zones, alerts, cameras, matchZone]);

  const unmappedZones = useMemo(() => {
    const known = new Set(zones.map((z) => z.name.trim().toLowerCase()));
    const names = new Set<string>();
    for (const c of cameras) if (c.zone && !known.has(c.zone.trim().toLowerCase())) names.add(c.zone.trim());
    for (const a of alerts) if (a.zone && !known.has(a.zone.trim().toLowerCase())) names.add(a.zone.trim());
    return [...names];
  }, [zones, cameras, alerts]);

  const selectedZone = zones.find((z) => z.id === selected) ?? null;
  const selectedStats = selected ? zoneStats[selected] : null;

  // ---- drag to reposition (edit mode) ----
  const onPointerDown = (e: React.PointerEvent, zone: ZoneRow) => {
    if (!editMode) { setSelected(zone.id); return; }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id: zone.id,
      dx: (e.clientX - rect.left) / rect.width - zone.x,
      dy: (e.clientY - rect.top) / rect.height - zone.y,
    };
    setSelected(zone.id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    const zone = zones.find((z) => z.id === drag.id);
    if (!zone) return;
    const nx = Math.min(Math.max((e.clientX - rect.left) / rect.width - drag.dx, 0), 1 - zone.width);
    const ny = Math.min(Math.max((e.clientY - rect.top) / rect.height - drag.dy, 0), 1 - zone.height);
    setZones((prev) => prev.map((z) => (z.id === drag.id ? { ...z, x: Number(nx.toFixed(4)), y: Number(ny.toFixed(4)) } : z)));
    setDirty((d) => ({ ...d, [drag.id]: true }));
  };

  const endDrag = () => { dragRef.current = null; };

  const resize = (id: string, key: "width" | "height", delta: number) => {
    setZones((prev) => prev.map((z) => {
      if (z.id !== id) return z;
      const max = key === "width" ? 1 - z.x : 1 - z.y;
      return { ...z, [key]: Math.min(Math.max(Number((z[key] + delta).toFixed(4)), 0.08), max) };
    }));
    setDirty((d) => ({ ...d, [id]: true }));
  };

  const saveLayout = async () => {
    const ids = Object.keys(dirty);
    if (!ids.length) { setEditMode(false); return; }
    setSaving(true);
    for (const id of ids) {
      const z = zones.find((v) => v.id === id);
      if (!z) continue;
      const { error } = await supabase.from("site_zones")
        .update({ x: z.x, y: z.y, width: z.width, height: z.height }).eq("id", id);
      if (error) { toast.error("Could not save the layout: " + error.message); setSaving(false); return; }
    }
    setDirty({});
    setSaving(false);
    setEditMode(false);
    toast.success("Floor plan layout saved");
  };

  const openNewZone = (name = "") => {
    setDraft({ name, zone_type: "production", description: "" });
    setDialogOpen(true);
  };

  const openEditZone = (z: ZoneRow) => {
    setDraft({ id: z.id, name: z.name, zone_type: z.zone_type, description: z.description ?? "" });
    setDialogOpen(true);
  };

  const submitZone = async () => {
    if (!activeTenantId) return;
    if (!draft.name.trim()) { toast.error("Give the area a name"); return; }
    setSaving(true);
    if (draft.id) {
      const { error } = await supabase.from("site_zones")
        .update({ name: draft.name.trim(), zone_type: draft.zone_type, description: draft.description || null })
        .eq("id", draft.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const idx = zones.length;
      const { error } = await supabase.from("site_zones").insert({
        tenant_id: activeTenantId,
        name: draft.name.trim(),
        zone_type: draft.zone_type,
        description: draft.description || null,
        x: Number((0.05 + (idx % 3) * 0.31).toFixed(4)),
        y: Number((0.06 + Math.floor(idx / 3) * 0.31).toFixed(4)),
        width: 0.28,
        height: 0.26,
      });
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setDialogOpen(false);
    toast.success(draft.id ? "Area updated" : "Area added to the floor plan");
    load();
  };

  const deleteZone = async (id: string) => {
    const { error } = await supabase.from("site_zones").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (selected === id) setSelected(null);
    toast.success("Area removed");
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Situational awareness"
        icon={MapIcon}
        title="Factory Floor Plan"
        description={`Live layout of ${activeTenant?.name ?? "this site"} — click an area to see what is happening right now.`}
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border">
              <Switch id="fp-edit" checked={editMode} onCheckedChange={(v) => { setEditMode(v); if (!v) setDirty({}); }} />
              <label htmlFor="fp-edit" className="text-xs font-medium text-muted-foreground">Arrange layout</label>
            </div>
            {editMode && (
              <Button size="sm" onClick={saveLayout} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-2" onClick={() => openNewZone()}>
              <Plus className="w-4 h-4" /> Add area
            </Button>
            <Button size="sm" variant="ghost" onClick={load} aria-label="Refresh floor plan">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        {/* Plan canvas */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div
            ref={canvasRef}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
            className="relative w-full aspect-[16/10] rounded-lg border border-border overflow-hidden bg-muted/20 [background-image:linear-gradient(to_right,hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.5)_1px,transparent_1px)] [background-size:5%_8%]"
          >
            {loading && (
              <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}
            {!loading && zones.length === 0 && (
              <div className="absolute inset-0 grid place-items-center text-center px-6">
                <div className="space-y-2">
                  <MapIcon className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">No areas on this floor plan yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Add the areas of your factory — production, storage, loading dock — then turn on “Arrange layout” to drag them into place.
                  </p>
                  <Button size="sm" className="gap-2 mt-1" onClick={() => openNewZone()}>
                    <Plus className="w-4 h-4" /> Add your first area
                  </Button>
                </div>
              </div>
            )}
            {zones.map((z) => {
              const stats = zoneStats[z.id];
              const active = selected === z.id;
              return (
                <button
                  key={z.id}
                  type="button"
                  onPointerDown={(e) => onPointerDown(e, z)}
                  onClick={() => setSelected(z.id)}
                  style={{
                    left: `${z.x * 100}%`, top: `${z.y * 100}%`,
                    width: `${z.width * 100}%`, height: `${z.height * 100}%`,
                  }}
                  className={cn(
                    "absolute rounded-lg border-2 p-2 text-left transition-shadow",
                    zoneTone(stats?.topSeverity ?? null),
                    active && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    editMode ? "cursor-move" : "cursor-pointer hover:shadow-lg",
                    stats?.topSeverity === "critical" && "animate-pulse",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">{z.name}</span>
                    {!!stats?.open.length && (
                      <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                        {stats.open.length}
                      </span>
                    )}
                  </div>
                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{z.zone_type}</span>
                  <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CameraIcon className="w-3 h-3" />{stats?.online ?? 0}/{stats?.cameras.length ?? 0} live
                  </span>
                </button>
              );
            })}
          </div>

          {editMode && selectedZone && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{selectedZone.name}</span>
              <span>· size</span>
              <Button size="sm" variant="outline" onClick={() => resize(selectedZone.id, "width", -0.03)}>Narrower</Button>
              <Button size="sm" variant="outline" onClick={() => resize(selectedZone.id, "width", 0.03)}>Wider</Button>
              <Button size="sm" variant="outline" onClick={() => resize(selectedZone.id, "height", -0.03)}>Shorter</Button>
              <Button size="sm" variant="outline" onClick={() => resize(selectedZone.id, "height", 0.03)}>Taller</Button>
            </div>
          )}

          {/* legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {[
              { l: "Critical", c: "bg-destructive" },
              { l: "High", c: "bg-destructive/70" },
              { l: "Medium", c: "bg-warning" },
              { l: "Low", c: "bg-primary/60" },
              { l: "Clear", c: "bg-muted-foreground/40" },
            ].map((i) => (
              <span key={i.l} className="flex items-center gap-1.5">
                <span className={cn("w-3 h-3 rounded-sm", i.c)} /> {i.l}
              </span>
            ))}
          </div>

          {unmappedZones.length > 0 && (
            <div className="mt-4 rounded-lg border border-dashed border-border p-3">
              <p className="text-xs text-muted-foreground mb-2">
                These area names are used by cameras or alerts but are not on the plan yet:
              </p>
              <div className="flex flex-wrap gap-2">
                {unmappedZones.map((n) => (
                  <Button key={n} size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => openNewZone(n)}>
                    <Plus className="w-3 h-3" /> {n}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4 h-fit xl:sticky xl:top-24">
          {!selectedZone ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Select an area on the plan to see its live alerts and cameras.
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{selectedZone.name}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{selectedZone.zone_type}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditZone(selectedZone)} aria-label="Edit area">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteZone(selectedZone.id)} aria-label="Delete area">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelected(null)} aria-label="Close">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {selectedZone.description && (
                <p className="text-xs text-muted-foreground">{selectedZone.description}</p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-2xl font-semibold text-foreground">{selectedStats?.open.length ?? 0}</p>
                  <p className="text-[11px] text-muted-foreground">Open alerts</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-2xl font-semibold text-foreground">
                    {selectedStats?.online ?? 0}/{selectedStats?.cameras.length ?? 0}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Cameras live</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Live alerts</p>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {!selectedStats?.open.length && (
                    <p className="text-xs text-muted-foreground italic">No open alerts in this area.</p>
                  )}
                  {selectedStats?.open.map((a) => (
                    <Link
                      key={a.id}
                      to="/app/alerts"
                      className="block rounded-lg border border-border p-2.5 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-foreground truncate">{a.title}</span>
                        <Badge variant="outline" className={cn("text-[10px] shrink-0", sevBadge(a.severity))}>
                          {a.severity}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(a.detected_at).toLocaleString()}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Cameras</p>
                <div className="space-y-1.5">
                  {!selectedStats?.cameras.length && (
                    <p className="text-xs text-muted-foreground italic">
                      No cameras assigned to this area yet — set the area name on a camera in Admin.
                    </p>
                  )}
                  {selectedStats?.cameras.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-foreground">{c.name}</span>
                      <span className={cn("text-[11px]", c.status === "online" ? "text-success" : "text-muted-foreground")}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
                <Button asChild size="sm" variant="outline" className="w-full mt-3 gap-2">
                  <Link to="/app/cameras">
                    Open live feeds <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            </>
          )}

          {!!alerts.filter((a) => isOpen(a.status) && a.severity === "critical").length && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
              <p className="text-xs text-destructive">
                {alerts.filter((a) => isOpen(a.status) && a.severity === "critical").length} critical alert(s) open across this site.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add / edit area */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit area" : "Add area"}</DialogTitle>
            <DialogDescription>
              Use the same name you give cameras for this part of the factory so alerts land in the right place.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <FieldLabel required htmlFor="zone-name">Area name</FieldLabel>
              <Input id="zone-name" value={draft.name} placeholder="Zone B – Assembly"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Type</FieldLabel>
              <Select value={draft.zone_type} onValueChange={(v) => setDraft({ ...draft, zone_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ZONE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Notes</FieldLabel>
              <Input value={draft.description} placeholder="Hard hats and hi-vis required at all times"
                onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitZone} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {draft.id ? "Save" : "Add area"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FloorPlan;
