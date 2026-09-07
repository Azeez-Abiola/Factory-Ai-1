import { useEffect, useRef, useState } from "react";
import { Trash2, Upload, Loader2, ImageIcon, Crop, Video, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  frameSignature, toStoredSignature, Region, ReferenceSample,
} from "@/lib/visionMatch";

const BUCKET = "ppe-reference";

const DETECTION_TAGS = ["ppe", "intrusion", "quality", "housekeeping", "forklift", "ergonomics", "downtime"];

interface Props {
  tenantId: string;
  cameraId?: string;
  snapshotUrl?: string | null;
  regions: Region[];
  onRegionsChange: (regions: Region[]) => void;
  samples: ReferenceSample[];
  onSamplesChange: (samples: ReferenceSample[]) => void;
  referenceEnabled: boolean;
  onReferenceEnabledChange: (v: boolean) => void;
  tolerance: number;
  onToleranceChange: (v: number) => void;
  clipEnabled: boolean;
  onClipEnabledChange: (v: boolean) => void;
  clipSeconds: number;
  onClipSecondsChange: (v: number) => void;
}

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const CameraInspectionTab = ({
  tenantId, cameraId, snapshotUrl,
  regions, onRegionsChange,
  samples, onSamplesChange,
  referenceEnabled, onReferenceEnabledChange,
  tolerance, onToleranceChange,
  clipEnabled, onClipEnabledChange,
  clipSeconds, onClipSecondsChange,
}: Props) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  // Signed previews for the already-saved reference photos.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = samples.filter((s) => s.path && !previews[s.path]);
      if (!missing.length) return;
      const next: Record<string, string> = {};
      for (const s of missing) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(s.path, 3600);
        if (data?.signedUrl) next[s.path] = data.signedUrl;
      }
      if (!cancelled && Object.keys(next).length) setPreviews((p) => ({ ...p, ...next }));
    })();
    return () => { cancelled = true; };
  }, [samples, previews]);

  const relative = (e: React.MouseEvent) => {
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box) return null;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const p = relative(e);
    if (!p) return;
    startPoint.current = p;
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const p = relative(e);
    const s = startPoint.current;
    if (!p || !s) return;
    setDraft({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };

  const onMouseUp = () => {
    const d = draft;
    startPoint.current = null;
    setDraft(null);
    if (!d || d.w < 0.04 || d.h < 0.04) return;
    onRegionsChange([
      ...regions,
      { id: uid(), name: `Area ${regions.length + 1}`, x: +d.x.toFixed(3), y: +d.y.toFixed(3), w: +d.w.toFixed(3), h: +d.h.toFixed(3), categories: [] },
    ]);
  };

  const updateRegion = (id: string, patch: Partial<Region>) =>
    onRegionsChange(regions.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const toggleTag = (region: Region, tag: string) => {
    const current = region.categories ?? [];
    updateRegion(region.id, {
      categories: current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    });
  };

  const addSamples = async (files: FileList | null, label: "good" | "defect") => {
    if (!files?.length) return;
    setUploading(true);
    const added: ReferenceSample[] = [];
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read the file"));
          reader.readAsDataURL(file);
        });
        const signature = await frameSignature(dataUrl, regions);
        if (!signature) {
          toast.error(`${file.name} could not be read as an image`);
          continue;
        }
        const path = `${tenantId}/cameras/${cameraId ?? "unassigned"}/${uid()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
        if (error) {
          toast.error(`Upload failed: ${error.message}`);
          continue;
        }
        added.push({ id: uid(), path, label, note: "", signature: toStoredSignature(signature) });
        setPreviews((p) => ({ ...p, [path]: dataUrl }));
      }
      if (added.length) {
        onSamplesChange([...samples, ...added]);
        toast.success(`${added.length} sample${added.length > 1 ? "s" : ""} added`);
      }
    } finally {
      setUploading(false);
    }
  };

  const removeSample = async (sample: ReferenceSample) => {
    onSamplesChange(samples.filter((s) => s.id !== sample.id));
    await supabase.storage.from(BUCKET).remove([sample.path]);
  };

  const good = samples.filter((s) => s.label === "good").length;
  const bad = samples.filter((s) => s.label === "defect").length;

  return (
    <div className="space-y-6 pt-4">
      {/* ---------------- Inspection areas ---------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-medium"><Crop className="h-4 w-4 text-primary" /> Inspection areas</h4>
            <p className="text-xs text-muted-foreground">
              Drag on the picture to mark what this camera should watch. Anything outside the areas is ignored.
            </p>
          </div>
          {regions.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onRegionsChange([])}>Clear all</Button>
          )}
        </div>

        <div
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          className="relative aspect-video w-full cursor-crosshair select-none overflow-hidden rounded-lg border border-border bg-muted/30"
        >
          {snapshotUrl ? (
            <img src={snapshotUrl} alt="Camera still frame used to mark inspection areas" className="pointer-events-none h-full w-full object-cover" />
          ) : (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
              <p className="text-xs">Add an AI snapshot address to see the real view — you can still mark areas on the grid.</p>
            </div>
          )}
          {regions.map((r) => (
            <div
              key={r.id}
              className="pointer-events-none absolute rounded-sm border-2 border-primary bg-primary/10"
              style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
            >
              <span className="absolute -top-4 left-0 rounded-sm bg-primary px-1 text-[10px] font-mono text-primary-foreground">{r.name}</span>
            </div>
          ))}
          {draft && (
            <div
              className="pointer-events-none absolute rounded-sm border-2 border-dashed border-primary/70 bg-primary/5"
              style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }}
            />
          )}
        </div>

        {regions.map((r) => (
          <div key={r.id} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Input value={r.name} onChange={(e) => updateRegion(r.id, { name: e.target.value })} className="h-8" />
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onRegionsChange(regions.filter((x) => x.id !== r.id))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DETECTION_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(r, tag)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] capitalize transition-colors",
                    r.categories?.includes(tag)
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ---------------- Reference matching ---------------- */}
      <section className="space-y-3 border-t border-border pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium">Reference check (no AI cost)</h4>
            <p className="text-xs text-muted-foreground">
              Compares each frame with your own sample photos on the operator's machine. Clear matches are decided instantly and never reach the AI; only uncertain frames are sent on.
            </p>
          </div>
          <Switch checked={referenceEnabled} onCheckedChange={onReferenceEnabledChange} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> {good} correct</Badge>
          <Badge variant="outline" className="gap-1 text-destructive"><XCircle className="h-3 w-3" /> {bad} faulty</Badge>
          <div className="flex-1" />
          <label className="inline-flex">
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addSamples(e.target.files, "good"); e.target.value = ""; }} />
            <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 text-xs hover:border-primary/50">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Add correct samples
            </span>
          </label>
          <label className="inline-flex">
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addSamples(e.target.files, "defect"); e.target.value = ""; }} />
            <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 text-xs hover:border-primary/50">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Add faulty samples
            </span>
          </label>
        </div>

        {samples.length > 0 && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {samples.map((s) => (
              <div key={s.id} className="overflow-hidden rounded-lg border border-border">
                <div className="relative aspect-video bg-muted/40">
                  {previews[s.path] ? (
                    <img src={previews[s.path]} alt={s.note || `${s.label} reference sample`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  )}
                  <Badge
                    variant="outline"
                    className={cn("absolute left-1 top-1 text-[10px]", s.label === "good" ? "border-success/40 text-success" : "border-destructive/40 text-destructive")}
                  >
                    {s.label === "good" ? "Correct" : "Faulty"}
                  </Badge>
                  <Button type="button" size="icon" variant="ghost" className="absolute right-1 top-1 h-6 w-6 bg-background/70" onClick={() => removeSample(s)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                <Input
                  value={s.note ?? ""}
                  placeholder="Note (e.g. crooked seal)"
                  className="h-8 rounded-none border-0 border-t text-xs"
                  onChange={(e) => onSamplesChange(samples.map((x) => (x.id === s.id ? { ...x, note: e.target.value } : x)))}
                />
              </div>
            ))}
          </div>
        )}

        {referenceEnabled && (
          <div className="space-y-1.5 rounded-lg border border-border p-3">
            <Label>Match tolerance: {(tolerance * 100).toFixed(0)}%</Label>
            <Slider value={[Math.round(tolerance * 100)]} min={1} max={40} step={1} onValueChange={(v) => onToleranceChange(v[0] / 100)} />
            <p className="text-[11px] text-muted-foreground">
              Lower = only near-identical frames are decided locally (more go to the AI). Higher = more frames decided instantly, with more risk of a wrong call.
            </p>
          </div>
        )}
      </section>

      {/* ---------------- Video clips ---------------- */}
      <section className="space-y-3 border-t border-border pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-medium"><Video className="h-4 w-4 text-primary" /> Analyse short video clips</h4>
            <p className="text-xs text-muted-foreground">
              Instead of one still picture, record a few seconds of the live feed and analyse the movement — better for quality checks on a moving line.
            </p>
          </div>
          <Switch checked={clipEnabled} onCheckedChange={onClipEnabledChange} />
        </div>
        {clipEnabled && (
          <div className="space-y-1.5 rounded-lg border border-border p-3">
            <Label>Clip length: {clipSeconds}s</Label>
            <Slider value={[clipSeconds]} min={2} max={10} step={1} onValueChange={(v) => onClipSecondsChange(v[0])} />
            <p className="text-[11px] text-muted-foreground">
              Longer clips see more of the process but cost more per check.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default CameraInspectionTab;
