import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Database, Upload, Loader2, Trash2, CheckCircle2, XCircle, Save, RefreshCw, Camera as CameraIcon, Video,
} from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { extractVideoFrames, frameSignature, toStoredSignature, type ReferenceSample, type Region } from "@/lib/visionMatch";
import { cn } from "@/lib/utils";


const BUCKET = "ppe-reference";

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

interface CamRow {
  id: string;
  name: string;
  zone: string | null;
  reference_samples: ReferenceSample[];
  reference_match_enabled: boolean;
  reference_match_threshold: number;
  regions_of_interest: Region[];
}

const QualityDataset = () => {
  const { activeTenantId } = useTenants();
  const [cams, setCams] = useState<CamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const goodInput = useRef<HTMLInputElement>(null);
  const defectInput = useRef<HTMLInputElement>(null);
  const goodVideoInput = useRef<HTMLInputElement>(null);
  const defectVideoInput = useRef<HTMLInputElement>(null);


  const load = useCallback(async () => {
    if (!activeTenantId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("cameras")
      .select("id,name,zone,reference_samples,reference_match_enabled,reference_match_threshold,regions_of_interest")
      .eq("tenant_id", activeTenantId)
      .order("name");
    if (error) toast.error(error.message);
    const rows = ((data ?? []) as any[]).map((r) => ({
      ...r,
      reference_samples: Array.isArray(r.reference_samples) ? r.reference_samples : [],
      regions_of_interest: Array.isArray(r.regions_of_interest) ? r.regions_of_interest : [],
    })) as CamRow[];
    setCams(rows);
    setSelectedId((prev) => prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null);
    setDirty(false);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => cams.find((c) => c.id === selectedId) ?? null, [cams, selectedId]);

  // Signed previews for stored examples
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      const missing = selected.reference_samples.filter((s) => s.path && !previews[s.path]);
      if (!missing.length) return;
      const next: Record<string, string> = {};
      for (const s of missing) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(s.path, 3600);
        if (data?.signedUrl) next[s.path] = data.signedUrl;
      }
      if (!cancelled && Object.keys(next).length) setPreviews((p) => ({ ...p, ...next }));
    })();
    return () => { cancelled = true; };
  }, [selected, previews]);

  const patchSelected = (patch: Partial<CamRow>) => {
    if (!selectedId) return;
    setCams((prev) => prev.map((c) => (c.id === selectedId ? { ...c, ...patch } : c)));
    setDirty(true);
  };

  const addExamples = async (files: FileList | null, label: "good" | "defect") => {
    if (!files?.length || !selected || !activeTenantId) return;
    setUploading(true);
    const added: ReferenceSample[] = [];
    try {
      for (const file of Array.from(files).slice(0, 20)) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read file"));
          reader.readAsDataURL(file);
        });
        const signature = await frameSignature(dataUrl, selected.regions_of_interest);
        if (!signature) { toast.error(`${file.name} could not be read as a picture`); continue; }
        const path = `${activeTenantId}/quality/${selected.id}/${uid()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
        if (error) { toast.error(`Upload failed: ${error.message}`); continue; }
        added.push({ id: uid(), path, label, note: file.name, signature: toStoredSignature(signature) });
        setPreviews((p) => ({ ...p, [path]: dataUrl }));
      }
      if (added.length) {
        patchSelected({ reference_samples: [...selected.reference_samples, ...added] });
        toast.success(`${added.length} example${added.length > 1 ? "s" : ""} added — save to apply`);
      }
    } finally {
      setUploading(false);
      if (goodInput.current) goodInput.current.value = "";
      if (defectInput.current) defectInput.current.value = "";
    }
  };

  const addVideoExamples = async (files: FileList | null, label: "good" | "defect") => {
    if (!files?.length || !selected || !activeTenantId) return;
    setUploading(true);
    const added: ReferenceSample[] = [];
    try {
      for (const file of Array.from(files).slice(0, 5)) {
        if (file.size > 60 * 1024 * 1024) {
          toast.error(`${file.name} is too large — please trim it to under 60MB`);
          continue;
        }
        const objectUrl = URL.createObjectURL(file);
        let frames: { time: number; dataUrl: string }[] = [];
        try {
          frames = await extractVideoFrames(objectUrl, 8);
        } catch {
          toast.error(`${file.name} could not be read as a video`);
          URL.revokeObjectURL(objectUrl);
          continue;
        }
        if (!frames.length) {
          toast.error(`No usable frames found in ${file.name}`);
          URL.revokeObjectURL(objectUrl);
          continue;
        }
        const path = `${activeTenantId}/quality/${selected.id}/${uid()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
        if (error) {
          toast.error(`Upload failed: ${error.message}`);
          URL.revokeObjectURL(objectUrl);
          continue;
        }
        const groupId = uid();
        for (const frame of frames) {
          const signature = await frameSignature(frame.dataUrl, selected.regions_of_interest);
          if (!signature) continue;
          added.push({
            id: uid(), path, label, kind: "video", groupId, time: frame.time,
            note: file.name, signature: toStoredSignature(signature),
          });
        }
        setPreviews((p) => ({ ...p, [path]: p[path] ?? objectUrl }));
      }
      if (added.length) {
        patchSelected({ reference_samples: [...selected.reference_samples, ...added] });
        toast.success(`${added.length} frames learned from your process video — save to apply`);
      }
    } finally {
      setUploading(false);
      if (goodVideoInput.current) goodVideoInput.current.value = "";
      if (defectVideoInput.current) defectVideoInput.current.value = "";
    }
  };

  const removeExample = async (sample: ReferenceSample) => {
    if (!selected) return;
    const remaining = sample.groupId
      ? selected.reference_samples.filter((s) => s.groupId !== sample.groupId)
      : selected.reference_samples.filter((s) => s.id !== sample.id);
    patchSelected({ reference_samples: remaining });
    if (!remaining.some((s) => s.path === sample.path)) {
      await supabase.storage.from(BUCKET).remove([sample.path]);
    }
  };



  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("cameras")
      .update({
        reference_samples: selected.reference_samples as unknown as any,
        reference_match_enabled: selected.reference_match_enabled,
        reference_match_threshold: selected.reference_match_threshold,
      })
      .eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setDirty(false);
    toast.success(`Dataset saved for ${selected.name}`);
  };

  const counts = (c: CamRow) => ({
    good: c.reference_samples.filter((s) => s.label === "good").length,
    defect: c.reference_samples.filter((s) => s.label === "defect").length,
  });

  /** One card per photo, and one card per uploaded video (not per extracted frame). */
  const cards = useMemo(() => {
    const seen = new Set<string>();
    return (selected?.reference_samples ?? []).filter((s) => {
      if (!s.groupId) return true;
      if (seen.has(s.groupId)) return false;
      seen.add(s.groupId);
      return true;
    });
  }, [selected]);

  const frameCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of selected?.reference_samples ?? []) {
      if (s.groupId) map[s.groupId] = (map[s.groupId] ?? 0) + 1;
    }
    return map;
  }, [selected]);


  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quality"
        icon={Database}
        title="Quality Dataset"
        description="Upload pictures of good product and known defects for each camera. The AI compares live frames against your own examples instead of generic rules."
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={load} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
            </Button>
            <Button className="gap-2" onClick={save} disabled={!dirty || saving || !selected}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save dataset
            </Button>
          </>
        }
      />

      {cams.length === 0 && !loading ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No cameras yet for this site. Add cameras first, then build their quality dataset here.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          {/* Camera list */}
          <div className="rounded-lg border border-border bg-card overflow-hidden h-fit">
            <div className="px-4 py-3 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
              Cameras
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {cams.map((c) => {
                const n = counts(c);
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-muted/40 transition-colors",
                      c.id === selectedId && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <CameraIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <CheckCircle2 className="w-3 h-3 text-success" />{n.good} good
                      </Badge>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <XCircle className="w-3 h-3 text-destructive" />{n.defect} defect
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editor */}
          {selected && (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-foreground">{selected.name}</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selected.zone ? `Zone: ${selected.zone}` : "No zone assigned"} ·{" "}
                      {selected.reference_samples.length} example{selected.reference_samples.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ref-toggle" className="text-xs">Use dataset</Label>
                    <Switch
                      id="ref-toggle"
                      checked={selected.reference_match_enabled}
                      onCheckedChange={(v) => patchSelected({ reference_match_enabled: v })}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <input
                      ref={goodInput} type="file" accept="image/*" multiple className="hidden"
                      onChange={(e) => addExamples(e.target.files, "good")}
                    />
                    <Button variant="outline" className="w-full gap-2" disabled={uploading}
                      onClick={() => goodInput.current?.click()}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Add good product photos
                    </Button>
                  </div>
                  <div>
                    <input
                      ref={defectInput} type="file" accept="image/*" multiple className="hidden"
                      onChange={(e) => addExamples(e.target.files, "defect")}
                    />
                    <Button variant="outline" className="w-full gap-2" disabled={uploading}
                      onClick={() => defectInput.current?.click()}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Add defect photos
                    </Button>
                  </div>
                  <div>
                    <input
                      ref={goodVideoInput} type="file" accept="video/*" multiple className="hidden"
                      onChange={(e) => addVideoExamples(e.target.files, "good")}
                    />
                    <Button variant="outline" className="w-full gap-2" disabled={uploading}
                      onClick={() => goodVideoInput.current?.click()}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                      Add good process video
                    </Button>
                  </div>
                  <div>
                    <input
                      ref={defectVideoInput} type="file" accept="video/*" multiple className="hidden"
                      onChange={(e) => addVideoExamples(e.target.files, "defect")}
                    />
                    <Button variant="outline" className="w-full gap-2" disabled={uploading}
                      onClick={() => defectVideoInput.current?.click()}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                      Add bad process video
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Videos are sampled into 8 still frames each, so a short clip of the line running well — or going
                  wrong — teaches the system as much as a set of photos.
                </p>


                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <Label>Match tolerance</Label>
                    <span className="text-muted-foreground tabular-nums">
                      {selected.reference_match_threshold.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    min={0.02} max={0.3} step={0.01}
                    value={[selected.reference_match_threshold]}
                    onValueChange={([v]) => patchSelected({ reference_match_threshold: v })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Lower is stricter — the live picture must look very close to one of your examples before it is
                    judged locally. Anything uncertain is still sent to the AI.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Examples</h3>
                {selected.reference_samples.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No examples yet. Upload a handful of good units and a handful of known defects.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {cards.map((s) => (
                      <div key={s.id} className="group relative rounded-md border border-border overflow-hidden bg-muted/30">
                        {previews[s.path] ? (
                          s.kind === "video" ? (
                            <video
                              src={previews[s.path]}
                              className="w-full h-28 object-cover bg-black"
                              muted playsInline controls preload="metadata"
                            />
                          ) : (
                            <img src={previews[s.path]} alt={s.note ?? s.label} className="w-full h-28 object-cover" loading="lazy" />
                          )
                        ) : (
                          <div className="w-full h-28 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex items-center justify-between px-2 py-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Badge
                              variant="outline"
                              className={cn("text-[10px]", s.label === "good"
                                ? "text-success border-success/30" : "text-destructive border-destructive/30")}
                            >
                              {s.label === "good" ? "Good" : "Defect"}
                            </Badge>
                            {s.kind === "video" && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                                <Video className="w-3 h-3" />
                                {frameCounts[s.groupId ?? ""] ?? 1} frames
                              </span>
                            )}
                          </div>
                          <Button
                            size="icon" variant="ghost" className="h-6 w-6"
                            aria-label="Remove example" title="Remove example"
                            onClick={() => removeExample(s)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QualityDataset;
