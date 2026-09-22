import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DetectionCategory {
  id: string;
  label: string;
  description: string;
  severity_hint?: "low" | "medium" | "high" | "critical";
  enabled?: boolean;
}

/** Built-in categories shipped with the platform. Kept in one place so the
 *  AI Model & Categories module and the camera editor never drift apart. */
export const DEFAULT_CATEGORIES: DetectionCategory[] = [
  { id: "ppe",          label: "PPE Compliance",         description: "hard hats, hi-vis vests, gloves, goggles, hearing/respiratory protection", severity_hint: "high",     enabled: true },
  { id: "intrusion",    label: "Restricted Zone Entry",  description: "unauthorized personnel in cordoned or hazardous areas",                     severity_hint: "critical", enabled: true },
  { id: "downtime",     label: "Machine Downtime",       description: "idle machinery, stalled lines, missing operators at stations",              severity_hint: "medium",   enabled: true },
  { id: "ergonomics",   label: "Ergonomic Risk",         description: "unsafe lifts, awkward postures, repetitive strain indicators",              severity_hint: "medium",   enabled: true },
  { id: "quality",      label: "Quality / Defect",       description: "visible defects, misalignment, damaged product, packaging errors",          severity_hint: "medium",   enabled: true },
  { id: "housekeeping", label: "Housekeeping (5S)",      description: "spills, obstructions, blocked exits, poor 5S",                              severity_hint: "low",      enabled: true },
  { id: "forklift",     label: "Forklift / Pedestrian",  description: "pedestrian in forklift zone, no spotter, unsafe speed",                     severity_hint: "critical", enabled: true },
  { id: "security",     label: "Security & Theft Control", description: "unauthorized access, removal, concealment or abnormal movement of company assets/materials", severity_hint: "critical", enabled: true },
];

const titleise = (id: string) => id.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

/** Older sites stored categories as plain id strings. Coerce anything we read
 *  into the full object shape so the UI and the analyser never see blanks. */
export const normaliseCategories = (raw: unknown): DetectionCategory[] => {
  if (!Array.isArray(raw)) return [];
  const out: DetectionCategory[] = [];
  for (const entry of raw) {
    if (typeof entry === "string" && entry.trim()) {
      const id = entry.trim();
      out.push({ id, label: titleise(id), description: "", severity_hint: "medium", enabled: true });
    } else if (entry && typeof entry === "object") {
      const c = entry as Partial<DetectionCategory>;
      if (!c.id) continue;
      out.push({
        id: c.id,
        label: c.label || titleise(c.id),
        description: c.description ?? "",
        severity_hint: c.severity_hint ?? "medium",
        enabled: c.enabled !== false,
      });
    }
  }
  // Last entry wins on duplicate ids.
  return Array.from(new Map(out.map((c) => [c.id, c])).values());
};

/** Keeps a tenant's saved list but adds any newly shipped built-in categories. */
export const mergeWithDefaults = (saved: unknown): DetectionCategory[] => {
  const list = normaliseCategories(saved);
  if (!list.length) return DEFAULT_CATEGORIES;
  const missing = DEFAULT_CATEGORIES.filter((d) => !list.some((c) => c.id === d.id));
  return [...list, ...missing];
};

/** Live list of a site's detection categories (built-ins + the site's own),
 *  so every screen offers exactly what the analyser is configured to look for. */
export function useDetectionCategories(tenantId?: string | null) {
  const [categories, setCategories] = useState<DetectionCategory[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) { setCategories(DEFAULT_CATEGORIES); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ai_analysis_config")
        .select("categories")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (cancelled) return;
      const saved = Array.isArray(data?.categories) ? (data!.categories as unknown as DetectionCategory[]) : [];
      setCategories(mergeWithDefaults(saved.filter((c) => c?.id && c?.label)));
      setLoading(false);
    };
    void load();

    const channel = supabase
      .channel(`detection-categories-${tenantId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_analysis_config", filter: `tenant_id=eq.${tenantId}` },
        () => void load(),
      )
      .subscribe();

    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [tenantId]);

  return { categories, loading, enabled: categories.filter((c) => c.enabled !== false) };
}
