import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import type { AIInsight } from "@/data/extendedMockData";

export interface InsightRecord extends AIInsight {
  tenantId: string;
  periodStart: string | null;
  periodEnd: string | null;
  evidence: Record<string, unknown> | null;
}

function mapRow(row: Record<string, any>): InsightRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    category: row.category,
    impact: row.impact,
    confidence: row.confidence ?? 0,
    metric: row.metric_label ?? "Observed metric",
    metricValue: row.metric_value ?? "—",
    trend: row.trend ?? "stable",
    recommendation: row.recommendation ?? "",
    generatedAt: row.generated_at,
    tenantId: row.tenant_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    evidence: (row.evidence ?? null) as Record<string, unknown> | null,
  };
}

/** Loads AI insights generated from this tenant's real operational history. */
export function useInsights() {
  const { activeTenantId } = useTenants();
  const [insights, setInsights] = useState<InsightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase.from("ai_insights").select("*").order("generated_at", { ascending: false }).limit(100);
    if (activeTenantId) query = query.eq("tenant_id", activeTenantId);
    const { data, error: err } = await query;
    if (err) {
      setError(err.message);
      setInsights([]);
    } else {
      setInsights((data ?? []).map(mapRow));
    }
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => { load(); }, [load]);

  const generate = useCallback(async () => {
    if (!activeTenantId) return { ok: false, message: "Select a site first." };
    setGenerating(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-insights", {
        body: { tenant_id: activeTenantId },
      });
      if (fnErr) return { ok: false, message: fnErr.message };
      const result = (data as any)?.results?.[0];
      if (result?.skipped === "no_operational_data") {
        return { ok: false, message: "Not enough alert or incident history yet to generate insights." };
      }
      if (result?.error) return { ok: false, message: String(result.error) };
      await load();
      return { ok: true, message: `${result?.created ?? 0} new insights generated.` };
    } finally {
      setGenerating(false);
    }
  }, [activeTenantId, load]);

  return { insights, loading, generating, error, reload: load, generate };
}
