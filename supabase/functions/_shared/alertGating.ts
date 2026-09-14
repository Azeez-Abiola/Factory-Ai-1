/**
 * Shared confidence gating for AI alerts.
 *
 * Two thresholds exist in the product and BOTH must be honoured:
 *  1. cameras.confidence_threshold  (0-100 in the DB, per camera)
 *  2. alert_rules.confidence_threshold (0-1, per site, optionally tied to a policy)
 *
 * A violation only becomes an alert when its confidence clears the effective
 * threshold = max(camera threshold, applicable rule threshold).
 */

export interface GateRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger_source: string;
  confidence_threshold: number;   // 0..1
  cooldown_seconds: number;
  policy_id: string | null;
  policy_category?: string | null;
}

export interface GateDecision {
  pass: boolean;
  confidence: number;
  threshold: number;
  rule_id: string | null;
  rule_name: string | null;
  source: "violation" | "detection" | "category" | "severity";
}

const SEVERITY_CONFIDENCE: Record<string, number> = {
  low: 0.4, medium: 0.6, high: 0.8, critical: 0.95,
};

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[_-]+/g, " ").trim();

function tokens(v: unknown): string[] {
  return norm(v).split(/\s+/).filter((t) => t.length > 2);
}

/** Best-effort confidence for a violation, never silently defaulting to 1. */
export function resolveConfidence(
  violation: any,
  detections: any[],
): { confidence: number; source: GateDecision["source"] } {
  const own = Number(violation?.confidence);
  if (Number.isFinite(own) && own >= 0 && own <= 1) return { confidence: own, source: "violation" };

  const vTokens = new Set([...tokens(violation?.type), ...tokens(violation?.description).slice(0, 6)]);
  let best: { score: number; conf: number } | null = null;

  for (const d of detections) {
    const conf = Number(d?.confidence);
    if (!Number.isFinite(conf)) continue;
    const dTokens = [...tokens(d?.label), ...tokens(d?.bbox_hint)];
    let score = 0;
    for (const t of dTokens) if (vTokens.has(t)) score += 2;
    if (norm(d?.label) && norm(violation?.type).includes(norm(d?.label))) score += 3;
    if (norm(violation?.type) && norm(d?.label).includes(norm(violation?.type))) score += 3;
    if (score > 0 && (!best || score > best.score)) best = { score, conf };
  }
  if (best) return { confidence: best.conf, source: "detection" };

  // Same-category detections (e.g. violation "no hard hat" vs detection category "ppe").
  const vCat = norm(violation?.category);
  if (vCat) {
    const catConfs = detections
      .filter((d) => norm(d?.category) === vCat && Number.isFinite(Number(d?.confidence)))
      .map((d) => Number(d.confidence));
    if (catConfs.length) return { confidence: Math.max(...catConfs), source: "category" };
  }

  // No usable detection — fall back to the severity the model assigned.
  return { confidence: SEVERITY_CONFIDENCE[norm(violation?.severity)] ?? 0.5, source: "severity" };
}

/** Rules that apply to a violation: policy-category matches, or site-wide rules. */
function applicableRules(violation: any, rules: GateRule[]): GateRule[] {
  const active = rules.filter((r) => r.enabled && (r.trigger_source ?? "ai_vision") === "ai_vision");
  if (!active.length) return [];
  const haystack = `${norm(violation?.type)} ${norm(violation?.category)} ${norm(violation?.description)}`;
  const matched = active.filter((r) => {
    const cat = norm(r.policy_category);
    return cat ? haystack.includes(cat) : false;
  });
  if (matched.length) return matched;
  return active.filter((r) => !r.policy_id);
}

/** Effective threshold + pass/fail for one violation. */
export function gateViolation(
  violation: any,
  detections: any[],
  cameraThreshold: number,   // 0..1
  rules: GateRule[],
): GateDecision {
  const { confidence, source } = resolveConfidence(violation, detections);
  const relevant = applicableRules(violation, rules);
  // A single matching rule is enough to fire, so the least strict applicable
  // rule sets the rule bar; the camera threshold is always a hard floor.
  let ruleThreshold = 0;
  let rule: GateRule | null = null;
  for (const r of relevant) {
    const t = Number(r.confidence_threshold);
    if (!Number.isFinite(t)) continue;
    if (!rule || t < ruleThreshold) { ruleThreshold = t; rule = r; }
  }
  const threshold = Math.max(cameraThreshold, rule ? ruleThreshold : 0);
  return {
    pass: confidence >= threshold,
    confidence: Number(confidence.toFixed(3)),
    threshold: Number(threshold.toFixed(3)),
    rule_id: rule?.id ?? null,
    rule_name: rule?.name ?? null,
    source,
  };
}

/** Longest cooldown any enabled ai_vision rule asks for, else the fallback. */
export function effectiveCooldown(rules: GateRule[], fallbackSeconds: number): number {
  const active = rules.filter((r) => r.enabled && Number.isFinite(Number(r.cooldown_seconds)));
  if (!active.length) return fallbackSeconds;
  return Math.max(fallbackSeconds, ...active.map((r) => Number(r.cooldown_seconds)));
}

/** Loads a site's alert rules with their policy category joined in. */
export async function loadGateRules(supabase: any, tenantId: string): Promise<GateRule[]> {
  const { data, error } = await supabase
    .from("alert_rules")
    .select("id, name, enabled, trigger_source, confidence_threshold, cooldown_seconds, policy_id, policies(category)")
    .eq("tenant_id", tenantId);
  if (error || !data) return [];
  return data.map((r: any) => ({
    id: r.id,
    name: r.name,
    enabled: !!r.enabled,
    trigger_source: r.trigger_source ?? "ai_vision",
    confidence_threshold: Number(r.confidence_threshold ?? 0),
    cooldown_seconds: Number(r.cooldown_seconds ?? 0),
    policy_id: r.policy_id ?? null,
    policy_category: r.policies?.category ?? null,
  }));
}
