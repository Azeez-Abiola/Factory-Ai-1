/**
 * Tenant AI budget guard.
 *
 * Every vision call is metered against the tenant's monthly cap. When spend
 * crosses the alert threshold an operator alert is raised; when it passes the
 * cap (and hard stop is on) further analysis is refused until the next month
 * or until an admin raises the limit.
 */

type Client = {
  from: (t: string) => any;
};

/** Rough per-call cost in USD by model family. Video clips cost ~4x a frame. */
const MODEL_COST: Record<string, number> = {
  "google/gemini-3.1-pro-preview": 0.012,
  "google/gemini-3-pro-image": 0.012,
  "google/gemini-3.6-flash": 0.0025,
  "google/gemini-3.5-flash": 0.0025,
  // Retained for historical usage_events recorded before the 3.x switch.
  "google/gemini-2.5-pro": 0.012,
  "google/gemini-2.5-flash": 0.0025,
  "google/gemini-2.5-flash-lite": 0.0009,
};
const FALLBACK_COST = 0.006;

export function estimateCost(model: string | undefined, media: "image" | "video" = "image") {
  const base = MODEL_COST[model ?? ""] ?? FALLBACK_COST;
  return Number((base * (media === "video" ? 4 : 1)).toFixed(6));
}

export interface BudgetState {
  enabled: boolean;
  hardStop: boolean;
  limit: number;
  thresholdPct: number;
  spend: number;
  pctUsed: number;
  blocked: boolean;
}

const DEFAULTS = { monthly_limit_usd: 50, alert_threshold_pct: 80, hard_stop: true, enabled: true };

function periodStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function getBudgetState(supabase: Client, tenantId: string): Promise<BudgetState> {
  const [{ data: budget }, { data: rows }] = await Promise.all([
    supabase.from("tenant_ai_budgets").select("*").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("ai_usage_events").select("cost_usd").eq("tenant_id", tenantId).gte("created_at", periodStart()).limit(20000),
  ]);

  const b = { ...DEFAULTS, ...(budget ?? {}) };
  const spend = (rows ?? []).reduce((s: number, r: any) => s + Number(r.cost_usd ?? 0), 0);
  const limit = Number(b.monthly_limit_usd) || 0;
  const pctUsed = limit > 0 ? (spend / limit) * 100 : 0;

  return {
    enabled: b.enabled !== false,
    hardStop: b.hard_stop !== false,
    limit,
    thresholdPct: Number(b.alert_threshold_pct) || 80,
    spend,
    pctUsed,
    blocked: b.enabled !== false && b.hard_stop !== false && limit > 0 && spend >= limit,
  };
}

export interface UsageEvent {
  tenantId: string;
  cameraId?: string | null;
  source: string;
  model?: string;
  media?: "image" | "video";
  sceneChanged?: boolean;
  sceneDelta?: number | null;
  metadata?: Record<string, unknown>;
}

/**
 * Records one metered AI call and, when spend crosses the alert threshold or
 * the cap, raises a budget alert for the tenant (once per period per level).
 */
export async function recordUsage(supabase: Client, ev: UsageEvent, state?: BudgetState) {
  const cost = estimateCost(ev.model, ev.media ?? "image");
  await supabase.from("ai_usage_events").insert({
    tenant_id: ev.tenantId,
    camera_id: ev.cameraId ?? null,
    source: ev.source,
    model: ev.model ?? null,
    media: ev.media ?? "image",
    scene_changed: ev.sceneChanged !== false,
    scene_delta: ev.sceneDelta ?? null,
    cost_usd: cost,
    metadata: ev.metadata ?? {},
  });

  try {
    const before = state ?? (await getBudgetState(supabase, ev.tenantId));
    if (!before.enabled || before.limit <= 0) return cost;
    const spend = before.spend + cost;
    const pct = (spend / before.limit) * 100;
    const level = pct >= 100 ? 100 : pct >= before.thresholdPct ? before.thresholdPct : 0;
    if (!level) return cost;

    const today = new Date();
    const period = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const { data: row } = await supabase
      .from("tenant_ai_budgets")
      .select("last_alert_pct, last_alert_period")
      .eq("tenant_id", ev.tenantId)
      .maybeSingle();

    const alreadyNotified = row?.last_alert_period === period && Number(row?.last_alert_pct ?? 0) >= level;
    if (alreadyNotified) return cost;

    await supabase.from("alerts").insert({
      tenant_id: ev.tenantId,
      camera_id: ev.cameraId ?? null,
      type: "ai_budget",
      severity: level >= 100 ? "critical" : "high",
      title: level >= 100 ? "AI budget exhausted" : `AI budget at ${Math.round(pct)}%`,
      description: level >= 100
        ? `This site has used its entire monthly AI analysis budget ($${before.limit.toFixed(2)}). ${before.hardStop ? "Live AI analysis is paused until the budget is raised or the month resets." : "Analysis continues and spend will exceed the cap."}`
        : `This site has used ${Math.round(pct)}% of its $${before.limit.toFixed(2)} monthly AI analysis budget.`,
      status: "open",
      risk_score: level >= 100 ? 90 : 60,
      detected_at: new Date().toISOString(),
      metadata: { source: "ai_budget", spend_usd: Number(spend.toFixed(4)), limit_usd: before.limit, pct_used: Number(pct.toFixed(2)) },
    });

    await supabase.from("tenant_ai_budgets").upsert({
      tenant_id: ev.tenantId,
      last_alert_pct: level,
      last_alert_period: period,
    }, { onConflict: "tenant_id" });
  } catch (e) {
    console.warn("ai budget alerting failed", (e as Error).message);
  }

  return cost;
}
