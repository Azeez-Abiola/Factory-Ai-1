import { supabase } from "@/integrations/supabase/client";

/**
 * Frame-gated metrics.
 *
 * The vision pipeline only sends the model frames whose scene actually
 * changed. Compliance and PPE scores therefore have to be measured against
 * *analysed* frames (real observations), never against every polled frame —
 * otherwise a static camera silently inflates the score.
 */

/** An alert only counts as an observation when it came from a real scene change. */
export function isRealChangeAlert(metadata: unknown): boolean {
  const m = (metadata ?? {}) as Record<string, unknown>;
  return m.scene_changed !== false;
}

/** Number of frames the model actually analysed for this tenant in the window. */
export async function fetchAnalyzedFrames(tenantId: string, sinceISO: string): Promise<number> {
  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("scene_changed", true)
    .gte("created_at", sinceISO);
  if (error) {
    console.warn("[gatedMetrics] analysed frame count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Compliance % over analysed frames. Falls back to the alert population when
 * no frames have been metered yet (e.g. before the inference worker runs).
 */
export function complianceScore(analyzedFrames: number, violations: number, totalAlerts: number): number {
  const observations = analyzedFrames > 0 ? Math.max(analyzedFrames, violations) : totalAlerts;
  if (observations === 0) return 100;
  return Math.round(((observations - violations) / observations) * 1000) / 10;
}

/** PPE violations per 1,000 analysed frames — comparable across cameras and cadences. */
export function ppePerThousandFrames(analyzedFrames: number, ppeViolations: number): number {
  if (analyzedFrames <= 0) return 0;
  return Math.round((ppeViolations / analyzedFrames) * 1000 * 100) / 100;
}
