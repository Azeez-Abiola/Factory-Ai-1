import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GEMINI_CHAT_URL, geminiHeaders, getGeminiKey, toGeminiModel } from '../_shared/ai.ts';

/**
 * generate-insights: turns real alert/incident/camera history into AI Insights
 * rows. Called on demand from the AI Insights page (user JWT, must be a member
 * of the tenant) or by cron with the service role for every active tenant.
 */

const MODEL = 'google/gemini-3.7-flash';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const SYSTEM = `You are the analytics brain of an industrial vision safety platform.
You receive aggregated operational data (alerts, incidents, cameras) for one factory tenant.
Return STRICT JSON: { "insights": [ { "title": string, "description": string, "category": "safety"|"efficiency"|"quality"|"cost", "impact": "high"|"medium"|"low", "trend": "up"|"down"|"stable", "metric_label": string, "metric_value": string, "recommendation": string, "confidence": number } ] }
Rules: 3-6 insights, grounded ONLY in the numbers provided, quantified in the description,
each recommendation concrete and actionable by a plant manager. No markdown, JSON only.`;

async function summarise(supabase: any, tenantId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [alerts, incidents, cameras] = await Promise.all([
    supabase.from('alerts').select('type, severity, zone, status, detected_at, risk_score').eq('tenant_id', tenantId).gte('detected_at', since).limit(2000),
    supabase.from('incidents').select('status, severity, opened_at, closed_at, escalation_level').eq('tenant_id', tenantId).gte('opened_at', since).limit(1000),
    supabase.from('cameras').select('id, name, zone, status, inference_enabled').eq('tenant_id', tenantId).limit(200),
  ]);

  const a = alerts.data ?? [];
  const byType: Record<string, number> = {};
  const byZone: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byHour: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  for (const row of a) {
    byType[row.type ?? 'unknown'] = (byType[row.type ?? 'unknown'] ?? 0) + 1;
    byZone[row.zone ?? 'unassigned'] = (byZone[row.zone ?? 'unassigned'] ?? 0) + 1;
    bySeverity[row.severity ?? 'unknown'] = (bySeverity[row.severity ?? 'unknown'] ?? 0) + 1;
    const d = new Date(row.detected_at);
    byHour[String(d.getUTCHours()).padStart(2, '0')] = (byHour[String(d.getUTCHours()).padStart(2, '0')] ?? 0) + 1;
    byDay[d.toISOString().slice(0, 10)] = (byDay[d.toISOString().slice(0, 10)] ?? 0) + 1;
  }

  const inc = incidents.data ?? [];
  const closed = inc.filter((i: any) => i.closed_at);
  const avgResolutionMinutes = closed.length
    ? Math.round(closed.reduce((s: number, i: any) => s + (new Date(i.closed_at).getTime() - new Date(i.opened_at).getTime()) / 60000, 0) / closed.length)
    : null;

  return {
    window_days: 30,
    totals: {
      alerts: a.length,
      open_alerts: a.filter((r: any) => r.status === 'new' || r.status === 'acknowledged').length,
      incidents: inc.length,
      escalated_incidents: inc.filter((i: any) => (i.escalation_level ?? 0) > 0).length,
      cameras: (cameras.data ?? []).length,
      cameras_with_ai: (cameras.data ?? []).filter((c: any) => c.inference_enabled).length,
      cameras_offline: (cameras.data ?? []).filter((c: any) => c.status !== 'online').length,
    },
    avg_incident_resolution_minutes: avgResolutionMinutes,
    alerts_by_type: byType,
    alerts_by_zone: byZone,
    alerts_by_severity: bySeverity,
    alerts_by_hour_utc: byHour,
    alerts_by_day: byDay,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const geminiKey = getGeminiKey();
  if (!geminiKey) return json({ error: 'GEMINI_API_KEY is not configured' }, 500);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let tenantIds: string[] = [];
  let body: any = {};
  try { body = await req.json(); } catch { /* cron: no body */ }

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '');
  const isServiceRole = jwt === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (body?.tenant_id) {
    if (!isServiceRole) {
      const { data: userData } = await admin.auth.getUser(jwt);
      const uid = userData?.user?.id;
      if (!uid) return json({ error: 'unauthorized' }, 401);
      const { data: allowed } = await admin.rpc('is_tenant_member', { _tenant_id: body.tenant_id, _user_id: uid });
      const { data: superAdmin } = await admin.rpc('has_role', { _user_id: uid, _role: 'super_admin' });
      if (!allowed && !superAdmin) return json({ error: 'forbidden' }, 403);
    }
    tenantIds = [body.tenant_id];
  } else {
    if (!isServiceRole) return json({ error: 'unauthorized' }, 401);
    const { data } = await admin.from('tenants').select('id').eq('status', 'active').limit(200);
    tenantIds = (data ?? []).map((t: any) => t.id);
  }

  const out: Array<Record<string, unknown>> = [];

  for (const tenantId of tenantIds) {
    const stats = await summarise(admin, tenantId);
    if (!stats.totals.alerts && !stats.totals.incidents) {
      out.push({ tenant_id: tenantId, skipped: 'no_operational_data' });
      continue;
    }

    const res = await fetch(GEMINI_CHAT_URL, {
      method: 'POST',
      headers: geminiHeaders(geminiKey),
      body: JSON.stringify({
        model: toGeminiModel(MODEL),
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Tenant operational data (last 30 days):\n${JSON.stringify(stats, null, 2)}` },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`Gemini error [${res.status}]: ${detail}`);
      out.push({ tenant_id: tenantId, error: `ai_error_${res.status}`, detail: detail.slice(0, 300) });
      continue;
    }

    const payload = await res.json();
    const raw: string = payload?.choices?.[0]?.message?.content ?? '';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    let parsed: any = null;
    try { parsed = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* noop */ } }
    }

    const insights: any[] = Array.isArray(parsed?.insights) ? parsed.insights : [];
    if (!insights.length) {
      out.push({ tenant_id: tenantId, error: 'no_insights_parsed' });
      continue;
    }

    const periodEnd = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const rows = insights.slice(0, 6).map((i) => ({
      tenant_id: tenantId,
      title: String(i.title ?? 'Insight').slice(0, 180),
      description: String(i.description ?? ''),
      category: ['safety', 'efficiency', 'quality', 'cost'].includes(i.category) ? i.category : 'safety',
      impact: ['high', 'medium', 'low'].includes(i.impact) ? i.impact : 'medium',
      trend: ['up', 'down', 'stable'].includes(i.trend) ? i.trend : 'stable',
      metric_label: String(i.metric_label ?? 'Observed metric').slice(0, 120),
      metric_value: String(i.metric_value ?? '—').slice(0, 60),
      recommendation: String(i.recommendation ?? ''),
      confidence: Math.min(99, Math.max(40, Math.round(Number(i.confidence) || 75))),
      evidence: stats,
      period_start: periodStart,
      period_end: periodEnd,
      generated_at: periodEnd,
    }));

    // Keep the ledger tidy: drop insights older than 60 days for this tenant.
    await admin.from('ai_insights').delete().eq('tenant_id', tenantId)
      .lt('generated_at', new Date(Date.now() - 60 * 86_400_000).toISOString());

    const { error: insErr } = await admin.from('ai_insights').insert(rows);
    if (insErr) {
      out.push({ tenant_id: tenantId, error: insErr.message });
      continue;
    }
    out.push({ tenant_id: tenantId, created: rows.length });
  }

  return json({ ok: true, tenants: tenantIds.length, results: out });
});
