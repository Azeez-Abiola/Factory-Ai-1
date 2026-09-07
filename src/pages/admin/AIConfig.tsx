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
import { useTenants } from "@/hooks/useTenants";
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

const DEFAULT_PROMPT = `You are an industrial vision safety analyst for a factory floor monitoring platform.
Analyze the provided camera frame and return a STRICT JSON object with this schema:
{
  "summary": string,
  "risk_score": number,
  "severity": "low"|"medium"|"high"|"critical",
  "detections": [ { "label": string, "confidence": number, "bbox_hint": string } ],
  "safety_violations": [ { "type": string, "description": string, "severity": "low"|"medium"|"high"|"critical" } ],
  "productivity_notes": string[],
  "recommended_actions": string[]
}
Return ONLY the JSON object — no markdown, no prose.`;

const DEFAULT_CATEGORIES: Category[] = [
  { id: "ppe",          label: "PPE Compliance",         description: "hard hats, hi-vis vests, gloves, goggles, hearing/respiratory protection", severity_hint: "high",     enabled: true },
  { id: "intrusion",    label: "Restricted Zone Entry",  description: "unauthorized personnel in cordoned or hazardous areas",                     severity_hint: "critical", enabled: true },
  { id: "downtime",     label: "Machine Downtime",       description: "idle machinery, stalled lines, missing operators at stations",              severity_hint: "medium",   enabled: true },
  { id: "ergonomics",   label: "Ergonomic Risk",         description: "unsafe lifts, awkward postures, repetitive strain indicators",              severity_hint: "medium",   enabled: true },
  { id: "quality",      label: "Quality / Defect",       description: "visible defects, misalignment, damaged product, packaging errors",          severity_hint: "medium",   enabled: true },
  { id: "housekeeping", label: "Housekeeping (5S)",      description: "spills, obstructions, blocked exits, poor 5S",                              severity_hint: "low",      enabled: true },
  { id: "forklift",     label: "Forklift / Pedestrian",  description: "pedestrian in forklift zone, no spotter, unsafe speed",                     severity_hint: "critical", enabled: true },
];

const MODELS = [
  { id: "google/gemini-2.5-pro",   label: "Gemini 2.5 Pro (best vision, default)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (faster, cheaper)" },
  { id: "openai/gpt-5.5",          label: "GPT-5.5 (reasoning-heavy)" },
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
  const [testOpen, setTestOpen] = useState(false);
  const [testImage, setTestImage] = useState(SAMPLE_IMAGE);
  const [testMode, setTestMode] = useState<"image" | "video">("image");
  const [testVideo, setTestVideo] = useState<string>(sampleClip.url);
  const [videoLabel, setVideoLabel] = useState<string>("Sample factory clip (5s)");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [newCatLabel, setNewCatLabel] = useState("");

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
        const cats = Array.isArray(data.categories) ? (data.categories as unknown as Category[]) : [];
        setCategories(cats.length ? cats : DEFAULT_CATEGORIES);
      } else {
        setSystemPrompt(DEFAULT_PROMPT);
        setModel("google/gemini-2.5-pro");
        setCategories(DEFAULT_CATEGORIES);
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
      metadata: { model, category_count: categories.length, enabled_count: categories.filter((c) => c.enabled !== false).length },
    });
    toast.success("AI configuration saved");
  };

  const resetDefaults = () => {
    setSystemPrompt(DEFAULT_PROMPT);
    setModel("google/gemini-2.5-pro");
    setCategories(DEFAULT_CATEGORIES);
    toast.info("Reset to platform defaults — click Save to apply");
  };

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
          <TabsTrigger value="categories">Detection Categories ({categories.length})</TabsTrigger>
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
        </TabsContent>

        <TabsContent value="model" className="space-y-4">
          <div className="glass rounded-xl border border-border p-5 space-y-4">
            <div>
              <Label>Vision model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="max-w-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                All calls route through Lovable AI Gateway. Gemini 2.5 Pro is the default for best vision accuracy; switch to Flash to reduce cost when running high-cadence inference.
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
