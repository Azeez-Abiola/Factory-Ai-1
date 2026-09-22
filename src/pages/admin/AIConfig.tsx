import { useEffect, useMemo, useState } from "react";
import { Sparkles, Save, Plus, Trash2, RotateCcw, ImageIcon, Loader2, Info, Eye, Copy } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_DEFECT_TYPES, type DefectType } from "@/lib/defectTypes";
import { useTenants } from "@/hooks/useTenants";
import { DEFAULT_CATEGORIES, mergeWithDefaults } from "@/lib/detectionCategories";
import { auditLog } from "@/lib/audit";
import { toast } from "sonner";
import sampleClip from "@/assets/sample-factory-clip.mp4.asset.json";

interface Category {
  id: string;
  label: string;
  description: string;
  severity_hint?: "low" | "medium" | "high" | "critical";
  enabled?: boolean;
}

const DEFAULT_PROMPT = `You are an industrial vision analyst for a factory floor monitoring platform.
You are responsible for EVERY active detection category listed for this site — not only the obvious hazard in the picture.

METHOD (follow in order, silently):
1. Describe the scene to yourself: area type, people, machines, vehicles, materials, lighting, time-of-day cues.
2. Sweep the frame category by category, in the order the active categories are listed. For each one decide explicitly: is there evidence here, yes or no? Never skip a category because another one already produced a finding.
3. Only then write the JSON. One frame may produce findings in several categories at once, or none at all.

EVIDENCE RULES:
- Report only what is visible. Never infer a violation from context alone or invent people, equipment or events.
- If the frame is too dark, blurred or obstructed to judge a category, say so in "summary" instead of guessing.
- One entry per distinct subject or event — no duplicates, and summarise a clip once rather than per frame.
- "confidence" is calibrated 0-1: ≥0.85 unmistakable, 0.6-0.85 likely, <0.6 uncertain (still report, but say so).
- Every safety_violation must match at least one detection of the same category.
- A clean frame is a valid answer: empty arrays, short summary, low risk_score. Never manufacture a finding.

SEVERITY: low = minor deviation; medium = policy breach with plausible harm or loss; high = imminent injury, significant product loss or asset removal in progress; critical = life-threatening exposure, emergency, or major theft/unauthorised access. "risk_score" reflects the highest-severity finding and must agree with "severity".

Return a STRICT JSON object with this schema:
{
  "summary": string,
  "risk_score": number,
  "severity": "low"|"medium"|"high"|"critical",
  "detections": [ { "label": string, "category": string, "severity": "low"|"medium"|"high"|"critical", "confidence": number, "bbox": [x, y, width, height], "bbox_hint": string } ],
  "safety_violations": [ { "type": string, "description": string, "severity": "low"|"medium"|"high"|"critical" } ],
  "productivity_notes": string[],
  "recommended_actions": string[]
}
"bbox" is required on every detection, normalised to the FULL frame as fractions 0-1 (x/y = top-left corner, x+width <= 1, y+height <= 1).
"recommended_actions" are concrete shift-level instructions, never generic advice.
Return ONLY the JSON object — no markdown, no prose.`;



interface ReferenceImage {
  path: string;
  label: string;
  kind: "compliant" | "violation";
  note?: string;
}

interface CustomModel {
  id: string;
  label: string;
  notes?: string;
}

const SITE_PPE_MODEL_ID = "site/ppe-reference";

const MODELS = [
  { id: SITE_PPE_MODEL_ID, label: "Site PPE Model (your factory's photos + Gemini)" },
  { id: "google/gemini-2.5-pro",   label: "Gemini 2.5 Pro (best vision, default)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (faster, cheaper)" },
  { id: "google/gemini-3-pro-image", label: "Gemini 3 Pro (next-gen vision)" },
  { id: "openai/gpt-5.5",          label: "GPT-5.5 (reasoning-heavy)" },
  { id: "openai/gpt-6-astra",      label: "GPT-6 Astra (most capable)" },
];


const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const SAMPLE_IMAGE = "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=1200";

const AIConfig = () => {
  const { tenants, activeTenantId } = useTenants();
  const activeTenant = useMemo(() => tenants.find((t) => t.id === activeTenantId), [tenants, activeTenantId]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);
  const [model, setModel] = useState("google/gemini-2.5-pro");
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [defectTypes, setDefectTypes] = useState<DefectType[]>(DEFAULT_DEFECT_TYPES);
  const [newDefectLabel, setNewDefectLabel] = useState("");
  const [testOpen, setTestOpen] = useState(false);
  const [testImage, setTestImage] = useState(SAMPLE_IMAGE);
  const [testMode, setTestMode] = useState<"image" | "video">("image");
  const [testVideo, setTestVideo] = useState<string>(sampleClip.url);
  const [videoLabel, setVideoLabel] = useState<string>("Sample factory clip (5s)");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [newModelId, setNewModelId] = useState("");
  const [newModelLabel, setNewModelLabel] = useState("");
  const [newModelNotes, setNewModelNotes] = useState("");
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [refPreviews, setRefPreviews] = useState<Record<string, string>>({});
  const [uploadingRefs, setUploadingRefs] = useState(false);
  const [refKind, setRefKind] = useState<"compliant" | "violation">("compliant");
  const [refNote, setRefNote] = useState("");

  const allModels = useMemo(
    () => [...MODELS, ...customModels.filter((m) => m.id && !MODELS.some((b) => b.id === m.id))],
    [customModels],
  );

  useEffect(() => {
    if (!activeTenantId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ai_analysis_config")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .maybeSingle();
      if (data) {
        setSystemPrompt(data.system_prompt || DEFAULT_PROMPT);
        setModel(data.model || "google/gemini-2.5-pro");
        setCategories(mergeWithDefaults(data.categories));
        const defects = Array.isArray((data as any).defect_types) ? ((data as any).defect_types as DefectType[]) : [];
        setDefectTypes(defects);
        const models = Array.isArray((data as any).custom_models) ? ((data as any).custom_models as CustomModel[]) : [];
        setCustomModels(models);
        const refs = Array.isArray((data as any).reference_images) ? ((data as any).reference_images as ReferenceImage[]) : [];
        setReferenceImages(refs);
        void signPreviews(refs);
      } else {
        setSystemPrompt(DEFAULT_PROMPT);
        setModel("google/gemini-2.5-pro");
        setCategories(DEFAULT_CATEGORIES);
        setDefectTypes(DEFAULT_DEFECT_TYPES);
        setCustomModels([]);
        setReferenceImages([]);
        setRefPreviews({});
      }
      setLoading(false);
    })();
  }, [activeTenantId]);

  const save = async () => {
    if (!activeTenantId) { toast.error("Select a tenant first"); return; }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const payload = {
      tenant_id: activeTenantId,
      system_prompt: systemPrompt,
      model,
      categories: categories as unknown as never,
      custom_models: customModels as unknown as never,
      reference_images: referenceImages as unknown as never,
      defect_types: defectTypes as unknown as never,
      updated_by: userRes.user?.id,
    };
    const { error } = await supabase
      .from("ai_analysis_config")
      .upsert(payload, { onConflict: "tenant_id" });
    setSaving(false);
    if (error) { toast.error("Save failed: " + error.message); return; }
    await auditLog({
      tenantId: activeTenantId,
      action: "ai_config.updated",
      entityType: "ai_analysis_config",
      metadata: { model, category_count: categories.length, custom_model_count: customModels.length, reference_image_count: referenceImages.length, enabled_count: categories.filter((c) => c.enabled !== false).length },
    });
    toast.success("AI configuration saved");
  };

  const signPreviews = async (refs: ReferenceImage[]) => {
    if (!refs.length) { setRefPreviews({}); return; }
    const { data } = await supabase.storage
      .from("ppe-reference")
      .createSignedUrls(refs.map((r) => r.path), 3600);
    const map: Record<string, string> = {};
    (data ?? []).forEach((d, i) => { if (d.signedUrl) map[refs[i].path] = d.signedUrl; });
    setRefPreviews(map);
  };

  const onReferenceFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!activeTenantId) { toast.error("Select a tenant first"); return; }
    setUploadingRefs(true);
    const added: ReferenceImage[] = [];
    for (const file of Array.from(files).slice(0, 10)) {
      if (!file.type.startsWith("image/")) { toast.error(`${file.name} is not an image`); continue; }
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} is larger than 10 MB`); continue; }
      const path = `${activeTenantId}/${crypto.randomUUID()}-${slugify(file.name.replace(/\.[^.]+$/, ""))}`;
      const { error } = await supabase.storage.from("ppe-reference").upload(path, file, { contentType: file.type });
      if (error) { toast.error(`Upload failed for ${file.name}: ${error.message}`); continue; }
      added.push({ path, label: file.name.replace(/\.[^.]+$/, ""), kind: refKind, note: refNote.trim() || undefined });
    }
    if (added.length) {
      const next = [...referenceImages, ...added];
      setReferenceImages(next);
      await signPreviews(next);
      toast.success(`${added.length} reference photo${added.length > 1 ? "s" : ""} added — click Save to apply`);
    }
    setUploadingRefs(false);
  };

  const updateReference = (path: string, patch: Partial<ReferenceImage>) =>
    setReferenceImages((rs) => rs.map((r) => (r.path === path ? { ...r, ...patch } : r)));

  const removeReference = async (path: string) => {
    await supabase.storage.from("ppe-reference").remove([path]);
    setReferenceImages((rs) => rs.filter((r) => r.path !== path));
    toast.info("Reference photo removed — click Save to apply");
  };

  const addCustomModel = () => {
    const id = newModelId.trim();
    if (!id) { toast.error("Enter the model identifier"); return; }
    if (!/^[\w.-]+\/[\w.:-]+$/.test(id)) { toast.error("Use the vendor/model format, e.g. google/gemini-3.7-flash"); return; }
    if (allModels.some((m) => m.id === id)) { toast.error("That model is already in the list"); return; }
    setCustomModels((m) => [...m, { id, label: newModelLabel.trim() || id, notes: newModelNotes.trim() || undefined }]);
    setNewModelId(""); setNewModelLabel(""); setNewModelNotes("");
    toast.success("Model added — click Save to apply");
  };

  const removeCustomModel = (id: string) => {
    setCustomModels((m) => m.filter((x) => x.id !== id));
    if (model === id) setModel("google/gemini-2.5-pro");
  };

  const resetDefaults = () => {
    setSystemPrompt(DEFAULT_PROMPT);
    setModel("google/gemini-2.5-pro");
    setCategories(DEFAULT_CATEGORIES);

    toast.info("Reset to platform defaults — click Save to apply");
  };

  const addDefectType = () => {
    const label = newDefectLabel.trim();
    if (!label) return;
    const id = slugify(label);
    if (defectTypes.some((d) => d.id === id)) { toast.error("That defect type already exists"); return; }
    setDefectTypes((d) => [...d, { id, label, description: "", severity_hint: "medium", enabled: true }]);
    setNewDefectLabel("");
  };
  const updateDefectType = (id: string, patch: Partial<DefectType>) =>
    setDefectTypes((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const removeDefectType = (id: string) => setDefectTypes((ds) => ds.filter((d) => d.id !== id));

  const addCategory = () => {
    const label = newCatLabel.trim();
    if (!label) return;
    const id = slugify(label);
    if (categories.some((c) => c.id === id)) { toast.error("Category id already exists"); return; }
    setCategories((c) => [...c, { id, label, description: "", severity_hint: "medium", enabled: true }]);
    setNewCatLabel("");
  };

  const updateCategory = (id: string, patch: Partial<Category>) => {
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const removeCategory = (id: string) => setCategories((cs) => cs.filter((c) => c.id !== id));

  const toDataUrl = async (url: string) => {
    if (url.startsWith("data:")) return url;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load clip (${res.status})`);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Could not read clip"));
      reader.readAsDataURL(blob);
    });
  };

  const onVideoFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { toast.error("Clip is too large — use a clip under 20 MB"); return; }
    const dataUrl = await toDataUrl(URL.createObjectURL(file));
    setTestVideo(dataUrl);
    setVideoLabel(file.name);
  };

  const runTest = async () => {
    if (testMode === "video" && !testVideo) { toast.error("Provide a test clip"); return; }
    if (testMode === "image" && !testImage) { toast.error("Provide a test image URL"); return; }
    setTesting(true); setTestResult(null);
    try {
      const videoUrl = testMode === "video" ? await toDataUrl(testVideo) : undefined;
      const { data, error } = await supabase.functions.invoke("analyze-frame", {
        body: {
          imageUrl: testMode === "image" ? testImage : undefined,
          videoUrl,
          tenantId: activeTenantId,
          cameraName: "Prompt test",
          zone: "Configuration sandbox",
          categories: categories.filter((c) => c.enabled !== false).map((c) => c.id),
        },
      });
      if (error) throw error;
      setTestResult(data);
      toast.success("Analysis complete");
    } catch (e) {
      toast.error("Test failed: " + (e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Vision Model"
        icon={Sparkles}
        title="AI Model & Categories"
        description={activeTenant ? `Editing config for ${activeTenant.name}` : "Select a tenant to configure."}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetDefaults} className="gap-2"><RotateCcw className="w-4 h-4" /> Reset defaults</Button>
            <Button variant="outline" onClick={() => setTestOpen(true)} className="gap-2"><Eye className="w-4 h-4" /> Test on frame</Button>
            <Button onClick={save} disabled={saving || loading} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="prompt" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prompt">System Prompt</TabsTrigger>
          <TabsTrigger value="categories">Detection Categories{loading ? "" : ` (${categories.length})`}</TabsTrigger>
          <TabsTrigger value="model">Model</TabsTrigger>
          <TabsTrigger value="help">How it works</TabsTrigger>
        </TabsList>

        <TabsContent value="prompt" className="space-y-4">
          <div className="glass rounded-xl border border-border p-5 space-y-3">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p>This is the system prompt sent with every frame. The active categories are automatically appended so you never need to hand-list them here. Keep the JSON schema block intact — the alerts pipeline depends on it.</p>
            </div>
            <Label htmlFor="prompt">System prompt</Label>
            <Textarea
              id="prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={18}
              className="font-mono text-xs leading-relaxed"
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{systemPrompt.length} chars</span>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(systemPrompt); toast.success("Copied"); }}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="glass rounded-xl border border-border p-4 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <Input
              placeholder="New category label (e.g. Chemical spill)"
              value={newCatLabel}
              onChange={(e) => setNewCatLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
              className="max-w-sm"
            />
            <Button onClick={addCategory} className="gap-2"><Plus className="w-4 h-4" /> Add category</Button>
            <span className="text-xs text-muted-foreground ml-auto">
              {categories.filter((c) => c.enabled !== false).length} active · {categories.length} total
            </span>
          </div>

          <div className="space-y-3">
            {categories.map((c) => (
              <div key={c.id} className="glass rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Input
                        value={c.label}
                        onChange={(e) => updateCategory(c.id, { label: e.target.value })}
                        className="max-w-xs font-semibold"
                      />
                      <Badge variant="outline" className="text-[10px] font-mono">{c.id}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <Switch checked={c.enabled !== false} onCheckedChange={(v) => updateCategory(c.id, { enabled: v })} />
                      <span className="text-xs text-muted-foreground">{c.enabled !== false ? "Active" : "Disabled"}</span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeCategory(c.id)} aria-label="Delete category">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
                  <div>
                    <Label className="text-xs">Detection guidance (sent to the model)</Label>
                    <Textarea
                      value={c.description}
                      onChange={(e) => updateCategory(c.id, { description: e.target.value })}
                      rows={2}
                      className="text-sm"
                      placeholder="Describe what the model should look for…"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Default severity</Label>
                    <Select value={c.severity_hint ?? "medium"} onValueChange={(v) => updateCategory(c.id, { severity_hint: v as Category["severity_hint"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="glass rounded-xl border border-border p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Defect types</h3>
              <p className="text-xs text-muted-foreground mt-1">
                The specific product faults this site cares about. They are sent to the model with the
                Quality / Defect category and drive the defect breakdown on the Quality page.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <Input
                placeholder="New defect type (e.g. Label misaligned)"
                value={newDefectLabel}
                onChange={(e) => setNewDefectLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDefectType(); } }}
                className="max-w-sm"
              />
              <Button variant="outline" onClick={addDefectType} className="gap-2"><Plus className="w-4 h-4" /> Add defect type</Button>
              <span className="text-xs text-muted-foreground ml-auto">
                {defectTypes.filter((d) => d.enabled !== false).length} active · {defectTypes.length} total
              </span>
            </div>

            {defectTypes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No defect types yet — add the faults your line inspects for, or{" "}
                <button type="button" className="text-primary underline" onClick={() => setDefectTypes(DEFAULT_DEFECT_TYPES)}>
                  start from the standard list
                </button>.
              </p>
            ) : (
              <div className="space-y-3">
                {defectTypes.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Input
                          value={d.label}
                          onChange={(e) => updateDefectType(d.id, { label: e.target.value })}
                          className="max-w-xs font-medium"
                        />
                        <Badge variant="outline" className="text-[10px] font-mono">{d.id}</Badge>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Switch checked={d.enabled !== false} onCheckedChange={(v) => updateDefectType(d.id, { enabled: v })} />
                        <Button size="icon" variant="ghost" onClick={() => removeDefectType(d.id)} aria-label="Delete defect type">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
                      <div>
                        <Label className="text-xs">What it looks like</Label>
                        <Textarea
                          value={d.description}
                          onChange={(e) => updateDefectType(d.id, { description: e.target.value })}
                          rows={2}
                          className="text-sm"
                          placeholder="Describe the fault so the model can recognise it…"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Default severity</Label>
                        <Select value={d.severity_hint ?? "medium"} onValueChange={(v) => updateDefectType(d.id, { severity_hint: v as DefectType["severity_hint"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="model" className="space-y-4">
          <div className="glass rounded-xl border border-border p-5 space-y-4">
            <div>
              <Label>Vision model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="max-w-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allModels.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                All calls route through the FactoryAI Gateway. Gemini 2.5 Pro is the default for best vision accuracy; switch to Flash to reduce cost when running high-cadence inference.
              </p>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="font-semibold text-foreground text-sm">Site PPE Model — your factory's own photos</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                    Upload photos of your own crews showing correct PPE and real violations. When <strong>Site PPE Model</strong> is selected above, every frame is judged against these photos instead of generic PPE assumptions — your helmet colours, vest type and local rules. Up to 8 photos are sent with each analysis.
                  </p>
                </div>
                <Badge variant={model === SITE_PPE_MODEL_ID ? "secondary" : "outline"} className="text-[10px] shrink-0">
                  {model === SITE_PPE_MODEL_ID ? "In use" : "Not selected"}
                </Badge>
              </div>

              {referenceImages.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {referenceImages.map((r) => (
                    <div key={r.path} className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                      {refPreviews[r.path]
                        ? <img src={refPreviews[r.path]} alt={`PPE reference: ${r.label}`} className="w-full h-32 object-cover" loading="lazy" />
                        : <div className="w-full h-32 grid place-items-center text-muted-foreground"><ImageIcon className="w-5 h-5" /></div>}
                      <div className="p-3 space-y-2">
                        <Input value={r.label} onChange={(e) => updateReference(r.path, { label: e.target.value })} className="h-8 text-xs" aria-label="Reference label" />
                        <div className="flex items-center gap-2">
                          <Select value={r.kind} onValueChange={(v) => updateReference(r.path, { kind: v as ReferenceImage["kind"] })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="compliant">Correct PPE</SelectItem>
                              <SelectItem value="violation">PPE violation</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" aria-label={`Remove ${r.label}`} onClick={() => removeReference(r.path)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                        <Input value={r.note ?? ""} onChange={(e) => updateReference(r.path, { note: e.target.value })} placeholder="Note (optional)" className="h-8 text-xs" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-3 max-w-3xl items-end">
                <div>
                  <Label className="text-xs">These photos show</Label>
                  <Select value={refKind} onValueChange={(v) => setRefKind(v as "compliant" | "violation")}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compliant">Correct PPE</SelectItem>
                      <SelectItem value="violation">PPE violation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Note applied to this upload (optional)</Label>
                  <Input value={refNote} onChange={(e) => setRefNote(e.target.value)} placeholder="e.g. Blue helmet + orange vest is our line standard" className="h-9 text-xs" />
                </div>
              </div>
              <div>
                <input id="ppe-ref-upload" type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void onReferenceFiles(e.target.files); e.currentTarget.value = ""; }} />
                <Button variant="outline" size="sm" disabled={uploadingRefs || !activeTenantId} onClick={() => document.getElementById("ppe-ref-upload")?.click()}>
                  {uploadingRefs ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                  {uploadingRefs ? "Uploading…" : "Upload PPE photos"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  JPG or PNG up to 10 MB each. Photos are stored privately for this site only. Remember to click Save.
                </p>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div>
                <h4 className="font-semibold text-foreground text-sm">Additional vision models</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Register another model for this site and it appears in the selector above. Use the vendor/model identifier, e.g. <code className="text-xs bg-muted/40 px-1 rounded">google/gemini-3.7-flash</code>.
                </p>
              </div>

              {customModels.length > 0 && (
                <div className="space-y-2">
                  {customModels.map((m) => (
                    <div key={m.id} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{m.label}</span>
                          {model === m.id && <Badge variant="secondary" className="text-[10px]">In use</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">{m.id}</p>
                        {m.notes && <p className="text-xs text-muted-foreground mt-1">{m.notes}</p>}
                      </div>
                      <Button variant="ghost" size="icon" aria-label={`Remove ${m.label}`} onClick={() => removeCustomModel(m.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2 max-w-3xl">
                <div>
                  <Label className="text-xs">Model identifier</Label>
                  <Input value={newModelId} onChange={(e) => setNewModelId(e.target.value)} placeholder="vendor/model-name" />
                </div>
                <div>
                  <Label className="text-xs">Display name</Label>
                  <Input value={newModelLabel} onChange={(e) => setNewModelLabel(e.target.value)} placeholder="e.g. Gemini 3.7 Flash (fast)" />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Input value={newModelNotes} onChange={(e) => setNewModelNotes(e.target.value)} placeholder="When should operators pick this model?" />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={addCustomModel}>
                <Plus className="w-4 h-4 mr-1.5" /> Add model
              </Button>
              <p className="text-xs text-muted-foreground">
                Added models must be supported by the AI gateway. Use <strong>Test on frame</strong> after saving to confirm the model returns usable detections.
              </p>
            </div>

          </div>
        </TabsContent>

        <TabsContent value="help" className="space-y-4">
          <div className="glass rounded-xl border border-border p-5 space-y-3 text-sm text-muted-foreground">
            <h3 className="font-semibold text-foreground">How the analyze-frame model works</h3>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Camera heartbeat or inference worker calls the <code className="text-xs bg-muted/40 px-1 rounded">analyze-frame</code> edge function with a frame URL and this tenant's id.</li>
              <li>The function loads <em>your</em> saved system prompt, model choice, and active categories from <code className="text-xs bg-muted/40 px-1 rounded">ai_analysis_config</code>.</li>
              <li>Active categories are appended to the system prompt as focus areas — you edit them here, no code deploy needed.</li>
              <li>The model returns JSON matching a strict schema (summary, risk_score, severity, detections, violations, actions).</li>
              <li>The pipeline maps violations into the <code className="text-xs bg-muted/40 px-1 rounded">alerts</code> table, respecting each category's default severity.</li>
            </ol>
            <p className="pt-2">Use <strong>Test on frame</strong> (top-right) to preview the exact model output your operators will see before saving changes.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Test dialog */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ImageIcon className="w-5 h-5 text-primary" /> Test analysis</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Tabs value={testMode} onValueChange={(v) => { setTestMode(v as "image" | "video"); setTestResult(null); }}>
              <TabsList>
                <TabsTrigger value="image">Still frame</TabsTrigger>
                <TabsTrigger value="video">Video clip</TabsTrigger>
              </TabsList>
            </Tabs>

            {testMode === "image" ? (
              <>
                <Label>Frame URL</Label>
                <div className="flex gap-2">
                  <Input value={testImage} onChange={(e) => setTestImage(e.target.value)} className="font-mono text-xs" />
                  <Button onClick={runTest} disabled={testing} className="gap-2 shrink-0">
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Run
                  </Button>
                </div>
                {testImage && (
                  <div className="rounded-lg border border-border bg-muted/20 max-h-64 overflow-hidden flex items-center justify-center">
                    <img src={testImage} alt="Test" className="max-h-64 object-contain" />
                  </div>
                )}
              </>
            ) : (
              <>
                <Label>Clip</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setTestVideo(sampleClip.url); setVideoLabel("Sample factory clip (5s)"); setTestResult(null); }}
                  >
                    Use sample clip
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <label className="cursor-pointer">
                      Upload clip
                      <input
                        type="file"
                        accept="video/mp4,video/webm"
                        className="sr-only"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) onVideoFile(f); }}
                      />
                    </label>
                  </Button>
                  <Button onClick={runTest} disabled={testing} className="gap-2 shrink-0">
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Run
                  </Button>
                  <span className="text-xs text-muted-foreground truncate">{videoLabel}</span>
                </div>
                {testVideo && (
                  <div className="rounded-lg border border-border bg-muted/20 overflow-hidden flex items-center justify-center">
                    <video src={testVideo} controls muted loop playsInline className="max-h-64 w-full object-contain bg-black" />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  The clip is analysed end-to-end, so movement over time (a worker walking without a hard hat, a stalled line, a forklift near pedestrians) is judged the same way it will be on a live feed. Keep clips short — under 10 seconds and 20 MB.
                </p>
              </>
            )}
            {testResult && (
              <pre className="text-[11px] bg-muted/40 rounded-lg p-3 overflow-x-auto max-h-80">
                {JSON.stringify(testResult.analysis ?? testResult, null, 2)}
              </pre>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AIConfig;
