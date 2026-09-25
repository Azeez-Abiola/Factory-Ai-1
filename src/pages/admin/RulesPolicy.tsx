import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck, Plus, Sparkles, Trash2, Pencil, Bell, Zap, Loader2,
  Target, CheckCircle2, AlertTriangle, Radio, Clock, ListTree, BrainCircuit,
  BookOpen, Copy, Search, Tag, Star, ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { POLICY_TEMPLATES, STARTER_PACKS, packForIndustry, type PolicyTemplate } from "@/data/policyTemplates";
import { provisionTenantCompliance } from "@/lib/provisionCompliance";
import { useTenants } from "@/hooks/useTenants";
import { describeEdgeFunctionError } from "@/lib/edgeFunctionError";
import { auditLog } from "@/lib/audit";

import PageHeader from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import MultiSelect from "@/components/admin/MultiSelect";

export interface ScopeCamera { id: string; name: string; zone: string | null }

// ── Types ──
interface Policy {
  id: string;
  name: string;
  description: string | null;
  natural_language: string;
  compiled_prompt: string | null;
  compiled_rule: any;
  category: string;
  severity: string;
  scope_zones: string[];
  scope_cameras: string[];
  active_hours: any;
  enabled: boolean;
  created_at: string;
}

interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  policy_id: string | null;
  trigger_source: string;
  conditions: any;
  confidence_threshold: number;
  debounce_seconds: number;
  cooldown_seconds: number;
  notification_channels: string[];
  escalation_minutes: number;
  auto_assign_role: string | null;
  enabled: boolean;
}

const severityColor = (s: string) =>
  s === "critical" ? "bg-destructive/15 text-destructive border-destructive/30"
  : s === "high" ? "bg-orange-500/15 text-orange-500 border-orange-500/30"
  : s === "medium" ? "bg-yellow-500/15 text-yellow-600 border-yellow-500/30"
  : "bg-primary/15 text-primary border-primary/30";

const PRESET_CATEGORIES = ["safety", "security", "quality", "productivity", "compliance", "housekeeping"];
const SEVERITIES = ["low", "medium", "high", "critical"];

// ── Policy Dialog ──
function PolicyDialog({
  open, onOpenChange, editing, seed, onSaved, categories, tenantId, cameras, zoneOptions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Policy | null;
  seed?: PolicyTemplate | null;
  onSaved: () => void;
  categories: string[];
  tenantId: string | null;
  cameras: ScopeCamera[];
  zoneOptions: string[];
}) {
  const [form, setForm] = useState<{
    name: string; description: string; natural_language: string;
    category: string; severity: string; enabled: boolean;
    scope_zones: string[]; scope_cameras: string[];
  }>({
    name: "", description: "", natural_language: "",
    category: "safety", severity: "medium", enabled: true,
    scope_zones: [], scope_cameras: [],
  });
  const [compiling, setCompiling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [compiled, setCompiled] = useState<{ vision_prompt?: string; rule?: any; summary?: string; suggested_actions?: string[] } | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? "",
        natural_language: editing.natural_language,
        category: editing.category,
        severity: editing.severity,
        enabled: editing.enabled,
        scope_zones: editing.scope_zones ?? [],
        scope_cameras: editing.scope_cameras ?? [],
      });
      setCompiled(
        editing.compiled_prompt || editing.compiled_rule
          ? { vision_prompt: editing.compiled_prompt ?? "", rule: editing.compiled_rule }
          : null
      );
    } else if (seed) {
      setForm({
        name: seed.name,
        description: seed.description,
        natural_language: seed.natural_language,
        category: seed.category,
        severity: seed.severity,
        enabled: true,
        // Only keep template zones that actually exist on this site.
        scope_zones: seed.scope_zones.filter(z => zoneOptions.includes(z)),
        scope_cameras: [],
      });
      setCompiled(null);
    } else {
      setForm({
        name: "", description: "", natural_language: "",
        category: "safety", severity: "medium", enabled: true,
        scope_zones: [], scope_cameras: [],
      });
      setCompiled(null);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [editing, seed, open]);

  const compileWithAI = async () => {
    if (form.natural_language.trim().length < 5) {
      toast.error("Add more detail to the policy statement first.");
      return;
    }
    setCompiling(true);
    try {
      const { data, error } = await supabase.functions.invoke("compile-policy", {
        body: {
          natural_language: form.natural_language,
          name: form.name,
          category: form.category,
          severity: form.severity,
          tenantId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCompiled(data.compiled);
      toast.success("Policy compiled with AI.");
    } catch (e: any) {
      toast.error(await describeEdgeFunctionError(e));
    } finally {
      setCompiling(false);
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.natural_language.trim()) {
      toast.error("Name and policy statement are required.");
      return;
    }
    if (!editing && !tenantId) {
      toast.error("Select a site first — policies are scoped to a site.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        natural_language: form.natural_language.trim(),
        category: form.category,
        severity: form.severity,
        enabled: form.enabled,
        scope_zones: form.scope_zones,
        scope_cameras: form.scope_cameras,
        compiled_prompt: compiled?.vision_prompt ?? null,
        compiled_rule: compiled?.rule ?? null,
      };
      const { error } = editing
        ? await supabase.from("policies").update(payload).eq("id", editing.id)
        : await supabase.from("policies").insert({ ...payload, tenant_id: tenantId });
      if (error) throw error;
      toast.success(editing ? "Policy updated." : "Policy created.");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save policy.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {editing ? "Edit Policy" : "New Policy"}
          </DialogTitle>
          <DialogDescription>
            Describe the rule in plain English. Optionally compile it with AI into a vision prompt and structured rule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="policy-name">Name *</Label>
              <Input id="policy-name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Hard hat compliance – Zone A" />
            </div>
            <div>
              <Label>Category</Label>
              {form.category === "__custom__" || (form.category && !categories.includes(form.category)) ? (
                <div className="flex gap-1.5">
                  <Input
                    autoFocus
                    value={form.category === "__custom__" ? "" : form.category}
                    onChange={(e) => setForm(f => ({ ...f, category: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                    placeholder="e.g. ergonomics"
                  />
                  <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0"
                    onClick={() => setForm(f => ({ ...f, category: "safety" }))}
                    title="Use preset list">
                    <ListTree className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value="__custom__">+ Custom category…</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">Presets from best-practice taxonomy; custom values are stored per-policy.</p>
            </div>
          </div>
          <div>
            <Label>Short description</Label>
            <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional internal note" />
          </div>
          <div>
            <Label htmlFor="policy-statement">Policy statement (plain English) *</Label>
            <Textarea
              id="policy-statement"
              rows={4}
              value={form.natural_language}
              onChange={(e) => setForm(f => ({ ...f, natural_language: e.target.value }))}
              placeholder="Example: All personnel entering Zone A between 06:00 and 22:00 must wear a hard hat and a high-visibility vest."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="policy-zones">Scope zones</Label>
              <MultiSelect
                id="policy-zones"
                options={zoneOptions.map(z => ({ value: z, label: z }))}
                value={form.scope_zones}
                onChange={(v) => setForm(f => ({ ...f, scope_zones: v }))}
                placeholder="All zones"
                searchPlaceholder="Search zones…"
                emptyText="No zones defined for this site yet."
              />
              <p className="text-[11px] text-muted-foreground mt-1">Leave empty to apply to every zone.</p>
            </div>
            <div>
              <Label htmlFor="policy-cameras">Scope cameras</Label>
              <MultiSelect
                id="policy-cameras"
                options={cameras.map(c => ({ value: c.id, label: c.name, hint: c.zone ?? undefined }))}
                value={form.scope_cameras}
                onChange={(v) => setForm(f => ({ ...f, scope_cameras: v }))}
                placeholder="All cameras"
                searchPlaceholder="Search cameras…"
                emptyText="No cameras added to this site yet."
              />
              <p className="text-[11px] text-muted-foreground mt-1">Leave empty to apply to every camera.</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-4 py-3">
            <div>
              <div className="text-sm font-medium">Enabled</div>
              <div className="text-xs text-muted-foreground">Rules powered by this policy will actively evaluate.</div>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm(f => ({ ...f, enabled: v }))} />
          </div>

          <Separator />

          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">AI Policy Compiler</span>
              </div>
              <Button size="sm" variant="secondary" onClick={compileWithAI} disabled={compiling}>
                {compiling ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Compiling…</> : <><BrainCircuit className="w-3.5 h-3.5 mr-1.5" /> Compile with AI</>}
              </Button>
            </div>
            {compiled?.summary && (
              <p className="text-xs text-muted-foreground italic">{compiled.summary}</p>
            )}
            {compiled?.vision_prompt && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Vision prompt</div>
                <div className="text-xs font-mono bg-background/60 rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">{compiled.vision_prompt}</div>
              </div>
            )}
            {compiled?.rule && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Structured rule</div>
                <pre className="text-xs font-mono bg-background/60 rounded p-2 max-h-40 overflow-auto">{JSON.stringify(compiled.rule, null, 2)}</pre>
              </div>
            )}
            {!compiled && (
              <p className="text-xs text-muted-foreground">
                Optional. Compiling turns your policy into a vision prompt used by the analyze-frame model and a structured rule the alert engine can evaluate.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create policy"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Alert Rule Dialog ──
function AlertRuleDialog({
  open, onOpenChange, editing, policies, onSaved, tenantId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: AlertRule | null;
  policies: Policy[];
  onSaved: () => void;
  tenantId: string | null;
}) {
  const [form, setForm] = useState<{
    name: string; description: string; policy_id: string | null;
    trigger_source: string; confidence_threshold: number;
    debounce_seconds: number; cooldown_seconds: number;
    escalation_minutes: number; auto_assign_role: string;
    notification_channels: string[]; enabled: boolean;
  }>({
    name: "", description: "", policy_id: null,
    trigger_source: "ai_vision", confidence_threshold: 0.75,
    debounce_seconds: 30, cooldown_seconds: 300,
    escalation_minutes: 15, auto_assign_role: "",
    notification_channels: ["in_app"], enabled: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? "",
        policy_id: editing.policy_id,
        trigger_source: editing.trigger_source,
        confidence_threshold: Number(editing.confidence_threshold),
        debounce_seconds: editing.debounce_seconds,
        cooldown_seconds: editing.cooldown_seconds,
        escalation_minutes: editing.escalation_minutes,
        auto_assign_role: editing.auto_assign_role ?? "",
        notification_channels: editing.notification_channels ?? ["in_app"],
        enabled: editing.enabled,
      });
    } else {
      setForm({
        name: "", description: "", policy_id: null,
        trigger_source: "ai_vision", confidence_threshold: 0.75,
        debounce_seconds: 30, cooldown_seconds: 300,
        escalation_minutes: 15, auto_assign_role: "",
        notification_channels: ["in_app"], enabled: true,
      });
    }
  }, [editing, open]);

  const toggleChannel = (ch: string) => {
    setForm(f => ({
      ...f,
      notification_channels: f.notification_channels.includes(ch)
        ? f.notification_channels.filter(c => c !== ch)
        : [...f.notification_channels, ch],
    }));
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required."); return; }
    if (!editing && !tenantId) { toast.error("Select a site first — alert rules are scoped to a site."); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        policy_id: form.policy_id,
        trigger_source: form.trigger_source,
        confidence_threshold: form.confidence_threshold,
        debounce_seconds: form.debounce_seconds,
        cooldown_seconds: form.cooldown_seconds,
        escalation_minutes: form.escalation_minutes,
        auto_assign_role: form.auto_assign_role.trim() || null,
        notification_channels: form.notification_channels,
        enabled: form.enabled,
      };
      const { error } = editing
        ? await supabase.from("alert_rules").update(payload).eq("id", editing.id)
        : await supabase.from("alert_rules").insert({ ...payload, tenant_id: tenantId });
      if (error) throw error;
      toast.success(editing ? "Alert rule updated." : "Alert rule created.");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save alert rule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-primary" />{editing ? "Edit Alert Rule" : "New Alert Rule"}</DialogTitle>
          <DialogDescription>Define how a policy fires: triggers, debounce, escalation, and channels.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rule-name">Name *</Label>
              <Input id="rule-name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Linked policy</Label>
              <Select value={form.policy_id ?? "none"} onValueChange={(v) => setForm(f => ({ ...f, policy_id: v === "none" ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {policies.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Trigger source</Label>
              <Select value={form.trigger_source} onValueChange={(v) => setForm(f => ({ ...f, trigger_source: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ai_vision">AI Vision</SelectItem>
                  <SelectItem value="sensor">Sensor / IoT</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Auto-assign role</Label>
              <Input value={form.auto_assign_role} onChange={(e) => setForm(f => ({ ...f, auto_assign_role: e.target.value }))} placeholder="e.g. safety_supervisor" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card/40 p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs uppercase tracking-wider">Confidence threshold</Label>
                <span className="text-sm font-mono">{(form.confidence_threshold * 100).toFixed(0)}%</span>
              </div>
              <Slider min={0.3} max={1} step={0.05} value={[form.confidence_threshold]} onValueChange={([v]) => setForm(f => ({ ...f, confidence_threshold: v }))} />
              <p className="text-xs text-muted-foreground mt-1">Detections below this confidence are dropped.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wider">Debounce (s)</Label>
                <Input type="number" value={form.debounce_seconds} onChange={(e) => setForm(f => ({ ...f, debounce_seconds: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider">Cooldown (s)</Label>
                <Input type="number" value={form.cooldown_seconds} onChange={(e) => setForm(f => ({ ...f, cooldown_seconds: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider">Escalate after (min)</Label>
                <Input type="number" value={form.escalation_minutes} onChange={(e) => setForm(f => ({ ...f, escalation_minutes: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider mb-2 block">Notification channels</Label>
            <div className="flex flex-wrap gap-2">
              {["in_app", "email", "sms", "webhook", "slack"].map(ch => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    form.notification_channels.includes(ch)
                      ? "bg-primary/15 text-primary border-primary/40"
                      : "bg-card/40 text-muted-foreground border-border hover:border-primary/30"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-4 py-3">
            <div className="text-sm font-medium">Enabled</div>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm(f => ({ ...f, enabled: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create rule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──
const RulesPolicy = () => {
  const { activeTenantId, tenants } = useTenants();
  const [provisioning, setProvisioning] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [cameras, setCameras] = useState<ScopeCamera[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [policyDialog, setPolicyDialog] = useState(false);
  const [ruleDialog, setRuleDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [seedTemplate, setSeedTemplate] = useState<PolicyTemplate | null>(null);
  const [tplSearch, setTplSearch] = useState("");
  const [tplCategory, setTplCategory] = useState<string>("all");
  const [tab, setTab] = useState<string>("policies");
  const [catSearch, setCatSearch] = useState("");
  const [policyCategory, setPolicyCategory] = useState<string>("all");
  const [renaming, setRenaming] = useState<{ old: string; next: string } | null>(null);
  const [savingRename, setSavingRename] = useState(false);

  // Merged category list: presets + any custom ones already in use.
  const allCategories = useMemo(() => {
    const set = new Set<string>(PRESET_CATEGORIES);
    policies.forEach(p => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [policies]);

  const categoryStats = useMemo(() => {
    const counts = new Map<string, { policies: number; enabled: number }>();
    allCategories.forEach(c => counts.set(c, { policies: 0, enabled: 0 }));
    policies.forEach(p => {
      const entry = counts.get(p.category) ?? { policies: 0, enabled: 0 };
      entry.policies += 1;
      if (p.enabled) entry.enabled += 1;
      counts.set(p.category, entry);
    });
    return Array.from(counts.entries()).map(([name, s]) => ({
      name,
      isPreset: PRESET_CATEGORIES.includes(name),
      ...s,
    }));
  }, [allCategories, policies]);

  const filteredCategories = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    return categoryStats.filter(c => !q || c.name.toLowerCase().includes(q));
  }, [categoryStats, catSearch]);

  const filteredTemplates = useMemo(() => {
    const q = tplSearch.trim().toLowerCase();
    return POLICY_TEMPLATES.filter(t =>
      (tplCategory === "all" || t.category === tplCategory) &&
      (!q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some(tg => tg.toLowerCase().includes(q)))
    );
  }, [tplSearch, tplCategory]);

  const useTemplate = (t: PolicyTemplate) => {
    setEditingPolicy(null);
    setSeedTemplate(t);
    setPolicyDialog(true);
  };

  const load = async () => {
    setLoading(true);
    if (!activeTenantId) {
      setPolicies([]); setRules([]); setCameras([]); setZones([]); setLoading(false);
      return;
    }
    const [{ data: pd, error: pe }, { data: rd, error: re }, { data: cd }, { data: zd }] = await Promise.all([
      supabase.from("policies").select("*").eq("tenant_id", activeTenantId).order("created_at", { ascending: false }),
      supabase.from("alert_rules").select("*").eq("tenant_id", activeTenantId).order("created_at", { ascending: false }),
      supabase.from("cameras").select("id, name, zone").eq("tenant_id", activeTenantId).order("name"),
      supabase.from("site_zones").select("name").eq("tenant_id", activeTenantId).order("name"),
    ]);
    if (pe) toast.error(pe.message);
    if (re) toast.error(re.message);
    setPolicies((pd ?? []) as Policy[]);
    setRules((rd ?? []) as AlertRule[]);
    setCameras((cd ?? []) as ScopeCamera[]);
    setZones(((zd ?? []) as { name: string }[]).map(z => z.name));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTenantId]);

  // Zones come from the mapped floor plan plus any zone already set on a camera.
  const zoneOptions = useMemo(() => {
    const set = new Set<string>(zones);
    cameras.forEach(c => c.zone && set.add(c.zone));
    policies.forEach(p => (p.scope_zones ?? []).forEach(z => set.add(z)));
    return Array.from(set).sort();
  }, [zones, cameras, policies]);

  const cameraLabel = (id: string) => cameras.find(c => c.id === id)?.name ?? id;

  const togglePolicy = async (p: Policy) => {
    const { error } = await supabase.from("policies").update({ enabled: !p.enabled }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`Policy ${!p.enabled ? "enabled" : "disabled"}.`);
    load();
  };

  const toggleRule = async (r: AlertRule) => {
    const { error } = await supabase.from("alert_rules").update({ enabled: !r.enabled }).eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  };

  const deletePolicy = async (id: string) => {
    if (!confirm("Delete this policy? Linked alert rules will be unlinked.")) return;
    const { error } = await supabase.from("policies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Policy deleted.");
    load();
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Delete this alert rule?")) return;
    const { error } = await supabase.from("alert_rules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Alert rule deleted.");
    load();
  };

  const activeTenant = tenants.find(t => t.id === activeTenantId) ?? null;
  const suggestedPack = packForIndustry(activeTenant?.industry);

  const applyStarterPack = async (packId: string) => {
    if (!activeTenantId) return toast.error("Select a site first.");
    setProvisioning(true);
    try {
      const res = await provisionTenantCompliance(activeTenantId, { packId });
      if (res.errors.length) {
        toast.error(res.errors[0]);
      } else if (!res.policiesCreated && res.policiesSkipped) {
        toast.info(`${res.pack.label} is already applied — all ${res.policiesSkipped} rules exist.`);
      } else {
        toast.success(
          `${res.pack.label} applied · ${res.policiesCreated} rules, ${res.categoriesCreated} detection categories` +
            (res.escalationCreated ? ", escalation policy" : "") +
            (res.notificationsCreated ? ", notification defaults" : ""),
        );
      }
      await load();
    } finally {
      setProvisioning(false);
    }
  };

  const visiblePolicies = policyCategory === "all" ? policies : policies.filter(p => p.category === policyCategory);
  const activePolicies = policies.filter(p => p.enabled).length;
  const compiled = policies.filter(p => p.compiled_prompt).length;
  const activeRules = rules.filter(r => r.enabled).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        icon={ShieldCheck}
        title="Rules & Policy"
        description="Configure business policies, alert rules, and FactoryAI guardrails in plain English."
        actions={
          <>
            <Button variant="outline" onClick={() => { setSeedTemplate(null); setEditingPolicy(null); setTab("templates"); }}>
              <BookOpen className="w-4 h-4 mr-1.5" /> Browse Templates
            </Button>
            <Select disabled={provisioning} onValueChange={applyStarterPack}>
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder={provisioning ? "Applying starter pack…" : "Apply compliance starter pack"} />
              </SelectTrigger>
              <SelectContent>
                {STARTER_PACKS.map(pack => (
                  <SelectItem key={pack.id} value={pack.id}>
                    {pack.label}{pack.id === suggestedPack.id ? " · recommended" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={() => { setEditingRule(null); setRuleDialog(true); }}>
              <Bell className="w-4 h-4 mr-1.5" /> New Alert Rule
            </Button>
            <Button onClick={() => { setEditingPolicy(null); setSeedTemplate(null); setPolicyDialog(true); }}>
              <Plus className="w-4 h-4 mr-1.5" /> New Policy
            </Button>
          </>
        }
      />

      {!activeTenantId && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="py-4 text-sm">
            Pick a site at the top of the page. Policies and alert rules belong to a single site, so nothing can be
            listed or created until one is selected.
          </CardContent>
        </Card>
      )}

      {activeTenant && (
        <p className="text-xs text-muted-foreground">
          Showing governance for <span className="font-medium text-foreground">{activeTenant.name}</span>.
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Active policies</div>
          <div className="font-display text-2xl mt-1">{activePolicies}<span className="text-muted-foreground text-sm">/{policies.length}</span></div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI-compiled</div>
          <div className="font-display text-2xl mt-1">{compiled}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Alert rules armed</div>
          <div className="font-display text-2xl mt-1">{activeRules}<span className="text-muted-foreground text-sm">/{rules.length}</span></div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> KPIs</div>
          <div className="mt-1"><Link to="/admin/kpi-config" className="text-primary text-sm hover:underline">Open KPI & OKR config →</Link></div>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="policies"><ListTree className="w-4 h-4 mr-1.5" /> Policies</TabsTrigger>
          <TabsTrigger value="rules"><Bell className="w-4 h-4 mr-1.5" /> Alert Rules</TabsTrigger>
          <TabsTrigger value="categories"><Tag className="w-4 h-4 mr-1.5" /> Categories</TabsTrigger>
          <TabsTrigger value="templates"><BookOpen className="w-4 h-4 mr-1.5" /> Templates</TabsTrigger>
          <TabsTrigger value="guardrails"><BrainCircuit className="w-4 h-4 mr-1.5" /> AI Guardrails</TabsTrigger>
        </TabsList>

        {/* Templates */}
        <TabsContent value="templates" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" /> Best-Practice Policy Library</CardTitle>
              <CardDescription>
                Pre-built templates aligned to OSHA, ISO, NFPA, and NIOSH standards. Clone any template and customize it for your zones, cameras, and severity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={tplSearch} onChange={(e) => setTplSearch(e.target.value)} placeholder="Search templates, tags, standards…" className="pl-9" />
                </div>
                <Select value={tplCategory} onValueChange={setTplCategory}>
                  <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {filteredTemplates.map(t => (
                  <div key={t.id} className="rounded-lg border border-border bg-card/50 hover:border-primary/40 transition p-4 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm">{t.name}</h4>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className={severityColor(t.severity)}>{t.severity}</Badge>
                          <Badge variant="outline" className="text-[10px] uppercase">{t.category}</Badge>
                          {t.standard && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">{t.standard}</Badge>}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{t.description}</p>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {t.tags.slice(0, 4).map(tg => (
                        <span key={tg} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">#{tg}</span>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{t.scope_zones.length} default zone{t.scope_zones.length !== 1 ? "s" : ""}</span>
                      <Button size="sm" onClick={() => useTemplate(t)}>
                        <Copy className="w-3.5 h-3.5 mr-1.5" /> Clone & Customize
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredTemplates.length === 0 && (
                  <div className="md:col-span-2 py-10 text-center text-sm text-muted-foreground">
                    No templates match your filter.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policies */}
        <TabsContent value="policies" className="mt-4 space-y-3">
          {loading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}
          {policyCategory !== "all" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="border-primary/40 text-primary"><Tag className="w-3 h-3 mr-1" />{policyCategory}</Badge>
              <button className="hover:underline" onClick={() => setPolicyCategory("all")}>Clear filter</button>
            </div>
          )}
          {!loading && policies.length > 0 && visiblePolicies.length === 0 && (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              No policies in “{policyCategory}”.{" "}
              <button className="text-primary hover:underline" onClick={() => setPolicyCategory("all")}>Clear filter</button>
            </CardContent></Card>
          )}
          {!loading && policies.length === 0 && (
            <Card><CardContent className="py-10 text-center">
              <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <div className="font-medium">No policies yet</div>
              <p className="text-sm text-muted-foreground mt-1">Create your first business rule to power alerts and AI vision.</p>
              <Button className="mt-4" onClick={() => { setEditingPolicy(null); setPolicyDialog(true); }}>
                <Plus className="w-4 h-4 mr-1.5" /> New Policy
              </Button>
            </CardContent></Card>
          )}
          {visiblePolicies.map(p => (
            <Card key={p.id} className="group">
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{p.name}</h3>
                      <Badge variant="outline" className={severityColor(p.severity)}>{p.severity}</Badge>
                      <Badge variant="outline" className="text-[10px] uppercase">{p.category}</Badge>
                      {p.compiled_prompt && <Badge variant="outline" className="border-primary/40 text-primary text-[10px]"><Sparkles className="w-3 h-3 mr-1" /> AI-compiled</Badge>}
                      {!p.enabled && <Badge variant="outline" className="text-muted-foreground">disabled</Badge>}
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                    <p className="text-sm mt-2 line-clamp-2">{p.natural_language}</p>
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                      <span>Zones: {p.scope_zones.length > 0 ? p.scope_zones.join(", ") : "All zones"}</span>
                      <span>Cameras: {p.scope_cameras.length > 0 ? p.scope_cameras.map(cameraLabel).join(", ") : "All cameras"}</span>
                      {(() => {
                        const linked = rules.filter(r => r.policy_id === p.id);
                        return linked.length > 0
                          ? <span>Alert rules: {linked.map(r => r.name).join(", ")}</span>
                          : <span className="text-warning">No alert rule linked</span>;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:shrink-0">
                    <Switch checked={p.enabled} onCheckedChange={() => togglePolicy(p)} />
                    <Button variant="ghost" size="icon" onClick={() => { setEditingPolicy(p); setPolicyDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deletePolicy(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Alert Rules */}
        <TabsContent value="rules" className="mt-4 space-y-3">
          {loading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}
          {!loading && rules.length === 0 && (
            <Card><CardContent className="py-10 text-center">
              <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <div className="font-medium">No alert rules yet</div>
              <p className="text-sm text-muted-foreground mt-1">Rules define how a policy fires: source, thresholds, cooldowns, and channels.</p>
              <Button className="mt-4" onClick={() => { setEditingRule(null); setRuleDialog(true); }}>
                <Plus className="w-4 h-4 mr-1.5" /> New Alert Rule
              </Button>
            </CardContent></Card>
          )}
          {rules.map(r => {
            const linked = policies.find(p => p.id === r.policy_id);
            return (
              <Card key={r.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{r.name}</h3>
                        <Badge variant="outline"><Radio className="w-3 h-3 mr-1" />{r.trigger_source}</Badge>
                        {linked && <Badge variant="outline" className="border-primary/40 text-primary">↳ {linked.name}</Badge>}
                        {!r.enabled && <Badge variant="outline" className="text-muted-foreground">disabled</Badge>}
                      </div>
                      {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> ≥ {(Number(r.confidence_threshold) * 100).toFixed(0)}% confidence</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> debounce {r.debounce_seconds}s</span>
                        <span>cooldown {r.cooldown_seconds}s</span>
                        <span>escalate {r.escalation_minutes}m</span>
                        <span>via {r.notification_channels.join(", ")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:shrink-0">
                      <Switch checked={r.enabled} onCheckedChange={() => toggleRule(r)} />
                      <Button variant="ghost" size="icon" onClick={() => { setEditingRule(r); setRuleDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteRule(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* AI Guardrails */}
        <TabsContent value="guardrails" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-primary" /> How AI evaluates your policies</CardTitle>
              <CardDescription>Each policy you compile becomes part of the vision system's prompt. Tune what the model looks for and when it fires.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3 rounded-lg bg-card/50 border border-border p-3">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Natural-language authoring</div>
                  <p className="text-muted-foreground text-xs">Write policies in plain English. The AI compiler turns them into a strict vision prompt plus a structured rule.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-card/50 border border-border p-3">
                <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                <div>
                  <div className="font-medium">Confidence gating</div>
                  <p className="text-muted-foreground text-xs">Every alert rule enforces a minimum confidence. Detections under threshold are logged but do not fire alerts.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-card/50 border border-border p-3">
                <Clock className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Debounce & cooldown</div>
                  <p className="text-muted-foreground text-xs">Debounce suppresses flapping detections; cooldown prevents alert storms from the same policy on the same camera.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-card/50 border border-border p-3">
                <Bell className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Escalation ladder</div>
                  <p className="text-muted-foreground text-xs">Unacknowledged alerts escalate after N minutes to the next role in the chain. All state changes hit the audit log.</p>
                </div>
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground">
                Vision analysis, policy compilation and insights use the AI model set for this site in AI Model & Categories (Gemini or OpenAI); usage is metered against the site's AI budget.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories */}
        <TabsContent value="categories" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Tag className="w-5 h-5 text-primary" /> Policy Categories</CardTitle>
              <CardDescription>
                Review every category in use across your policies, rename custom ones (updates every linked policy),
                and reuse them from the "Category" dropdown when authoring a new policy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={catSearch} onChange={(e) => setCatSearch(e.target.value)} placeholder="Search categories…" className="pl-9" />
                </div>
                <Button variant="outline" onClick={() => { setEditingPolicy(null); setSeedTemplate(null); setPolicyDialog(true); }}>
                  <Plus className="w-4 h-4 mr-1.5" /> New policy with custom category
                </Button>
              </div>

              <div className="rounded-lg border border-border divide-y divide-border overflow-x-auto [&>*]:min-w-[520px]">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/30">
                  <div className="col-span-5">Category</div>
                  <div className="col-span-2 text-center">Policies</div>
                  <div className="col-span-2 text-center">Active</div>
                  <div className="col-span-3 text-right">Actions</div>
                </div>
                {filteredCategories.length === 0 && (
                  <div className="px-4 py-6 text-sm text-muted-foreground text-center">No categories match.</div>
                )}
                {filteredCategories.map((c) => (
                  <div key={c.name} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                    <div className="col-span-5 flex items-center gap-2 min-w-0">
                      <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{c.name}</span>
                      {c.isPreset ? (
                        <Badge variant="outline" className="text-[10px]"><Star className="w-2.5 h-2.5 mr-1" /> preset</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">custom</Badge>
                      )}
                    </div>
                    <div className="col-span-2 text-center text-sm">{c.policies}</div>
                    <div className="col-span-2 text-center text-sm">
                      {c.enabled}<span className="text-muted-foreground">/{c.policies}</span>
                    </div>
                    <div className="col-span-3 flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setPolicyCategory(c.name); setTab("policies"); }}
                        disabled={c.policies === 0} title="View policies">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRenaming({ old: c.name, next: c.name })}
                        disabled={c.isPreset || c.policies === 0} title={c.isPreset ? "Preset categories can't be renamed" : "Rename & bulk update"}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Renaming a custom category updates <strong>every policy</strong> referencing it and records an entry in the audit log.
                Preset categories are locked to keep the best-practice taxonomy consistent across tenants.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!renaming} onOpenChange={(v) => { if (!v) setRenaming(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" /> Rename category</DialogTitle>
            <DialogDescription>
              This will update every policy that uses <code className="font-mono text-xs">{renaming?.old}</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>New category name</Label>
              <Input
                autoFocus
                value={renaming?.next ?? ""}
                onChange={(e) => setRenaming(r => r ? { ...r, next: e.target.value.toLowerCase().replace(/\s+/g, "-") } : r)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Lowercase, hyphenated. Merging into an existing category is allowed.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button
              disabled={savingRename || !renaming?.next.trim() || renaming.next === renaming.old || PRESET_CATEGORIES.includes(renaming?.old ?? "")}
              onClick={async () => {
                if (!renaming) return;
                const next = renaming.next.trim();
                if (!next) return;
                setSavingRename(true);
                const affected = policies.filter(p => p.category === renaming.old).map(p => p.id);
                const { error } = await supabase
                  .from("policies")
                  .update({ category: next })
                  .eq("category", renaming.old)
                  .eq("tenant_id", activeTenantId ?? "");
                setSavingRename(false);
                if (error) return toast.error(error.message);
                toast.success(`Renamed to "${next}" (${affected.length} polic${affected.length === 1 ? "y" : "ies"} updated).`);
                if (activeTenantId) {
                  await auditLog({
                    tenantId: activeTenantId,
                    action: "policy_category.rename",
                    entityType: "policy_category",
                    metadata: { from: renaming.old, to: next, affected_policies: affected },
                  });
                }
                setRenaming(null);
                load();
              }}>
              {savingRename ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Renaming…</> : "Rename & update policies"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PolicyDialog
        open={policyDialog}
        onOpenChange={(v) => { setPolicyDialog(v); if (!v) setSeedTemplate(null); }}
        editing={editingPolicy}
        seed={seedTemplate}
        onSaved={load}
        categories={allCategories}
        tenantId={activeTenantId}
        cameras={cameras}
        zoneOptions={zoneOptions}
      />
      <AlertRuleDialog open={ruleDialog} onOpenChange={setRuleDialog} editing={editingRule} policies={policies} onSaved={load} tenantId={activeTenantId} />
    </div>
  );
};

export default RulesPolicy;
