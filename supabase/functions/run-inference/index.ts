import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * run-inference: pulls a real still frame from every due camera, sends it to
 * analyze-frame (tenant-configured Gemini vision), and persists any detected
 * safety/quality violation as an alert. Alert inserts fire the existing
 * notify-alert trigger, so live video drives the whole alert -> incident ->
 * notification chain.
 *
 * Invoked by cron with no body (processes all due cameras) or with
 * { camera_id } from the admin UI to run one camera on demand.
 */

const SEVERITY_SCORE: Record<string, number> = { low: 25, medium: 50, high: 75, critical: 92 };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Resolve the URL we can pull a JPEG/PNG still frame from. */
function snapshotCandidate(cam: Record<string, any>): string | null {
  if (cam.snapshot_url) return cam.snapshot_url;
  const stream: string | null = cam.stream_url ?? null;
  if (stream && /\.(jpe?g|png)$/i.test(stream)) return stream;
  if (stream && /mjpe?g|snapshot|still|jpg/i.test(stream)) return stream;
  return null;
}

async function fetchFrame(url: string, credentials: Record<string, any> | null) {
  const headers: Record<string, string> = { Accept: 'image/*' };
  if (credentials?.username) {
    headers.Authorization = `Basic ${btoa(`${credentials.username}:${credentials.password ?? ''}`)}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) return { ok: false as const, reason: `snapshot_http_${res.status}` };
    const ct = res.headers.get('content-type') ?? 'image/jpeg';
    if (!ct.startsWith('image/') && !ct.startsWith('multipart/')) {
      return { ok: false as const, reason: `snapshot_content_type_${ct}` };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.length) return { ok: false as const, reason: 'snapshot_empty' };
    const mime = ct.startsWith('image/') ? ct.split(';')[0] : 'image/jpeg';
    return { ok: true as const, dataUrl: `data:${mime};base64,${toBase64(buf)}`, bytes: buf.length };
  } catch (e) {
    return { ok: false as const, reason: `snapshot_error_${(e as Error).name}` };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let requestedCamera: string | null = null;
  try {
    const body = await req.json();
    requestedCamera = body?.camera_id ?? null;
  } catch { /* cron invokes with no body */ }

  let query = supabase
    .from('cameras')
    .select('id, tenant_id, name, zone, stream_url, snapshot_url, rtsp_url, credentials, ai_models, confidence_threshold, inference_interval_seconds, last_inference_at, status, inference_enabled')
    .limit(50);

  query = requestedCamera
    ? query.eq('id', requestedCamera)
    : query.eq('inference_enabled', true).eq('status', 'online');

  const { data: cams, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const now = Date.now();
  const due = (cams ?? []).filter((c) => {
    if (requestedCamera) return true;
    if (!c.last_inference_at) return true;
    const age = (now - new Date(c.last_inference_at).getTime()) / 1000;
    return age >= (c.inference_interval_seconds ?? 30);
  });

  const analyzeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-frame`;
  const results: Array<Record<string, unknown>> = [];

  for (const cam of due) {
    await supabase.from('cameras').update({ inference_status: 'running' }).eq('id', cam.id);

    const finish = async (status: string, err: string | null, extra: Record<string, unknown> = {}) => {
      await supabase.from('cameras').update({
        inference_status: status,
        last_inference_at: new Date().toISOString(),
        last_inference_error: err,
      }).eq('id', cam.id);
      results.push({ camera_id: cam.id, camera: cam.name, status, error: err, ...extra });
    };

    const url = snapshotCandidate(cam);
    if (!url) {
      await finish('error', 'No snapshot image address configured for this camera. Add a still-frame URL so AI analysis can read the live feed.');
      continue;
    }

    const frame = await fetchFrame(url, (cam.credentials ?? null) as Record<string, any> | null);
    if (!frame.ok) {
      await finish('error', frame.reason);
      continue;
    }

    // Tenant policies steer what the model looks for on this frame.
    const { data: policies } = await supabase
      .from('policies')
      .select('name, natural_language, compiled_prompt, severity, scope_zones')
      .eq('tenant_id', cam.tenant_id)
      .eq('enabled', true)
      .limit(20);

    const relevant = (policies ?? []).filter((p) =>
      !p.scope_zones?.length ||
      p.scope_zones.includes('All zones') ||
      (cam.zone && p.scope_zones.includes(cam.zone))
    );

    const context = relevant.length
      ? `Enforce these tenant policies and reference them by name in violations:\n${
        relevant.map((p) => `- [${p.severity}] ${p.name}: ${p.compiled_prompt ?? p.natural_language}`).join('\n')
      }`
      : undefined;

    let analysis: any = null;
    try {
      const selectedCategories = cam.ai_models && typeof cam.ai_models === 'object' && !Array.isArray(cam.ai_models)
        ? Object.entries(cam.ai_models)
            .filter(([, enabled]) => enabled === true)
            .map(([category]) => category)
        : Array.isArray(cam.ai_models) ? cam.ai_models : undefined;
      const res = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          imageUrl: frame.dataUrl,
          tenantId: cam.tenant_id,
          cameraName: cam.name,
          zone: cam.zone,
          categories: selectedCategories,
          context,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        await finish('error', `analyze_${res.status}: ${String(payload?.error ?? '').slice(0, 200)}`);
        continue;
      }
      analysis = payload?.analysis;
    } catch (e) {
      await finish('error', `analyze_call_failed: ${(e as Error).message}`);
      continue;
    }

    if (!analysis) {
      await finish('error', 'AI returned no readable analysis for this frame.');
      continue;
    }

    const threshold = (cam.confidence_threshold ?? 70) / 100;
    const violations: any[] = Array.isArray(analysis.safety_violations) ? analysis.safety_violations : [];
    const detections: any[] = Array.isArray(analysis.detections) ? analysis.detections : [];

    // Cooldown: don't re-raise the same violation type for the same camera.
    const cooldownSeconds = Math.max((cam.inference_interval_seconds ?? 30) * 3, 300);
    const since = new Date(Date.now() - cooldownSeconds * 1000).toISOString();
    const { data: recent } = await supabase
      .from('alerts')
      .select('type')
      .eq('camera_id', cam.id)
      .gte('detected_at', since);
    const recentTypes = new Set((recent ?? []).map((r) => r.type));

    const rows = violations
      .filter((v) => {
        const match = detections.find((d) => String(d.label ?? '').toLowerCase().includes(String(v.type ?? '').toLowerCase()));
        const conf = typeof match?.confidence === 'number' ? match.confidence : 1;
        return conf >= threshold;
      })
      .map((v) => {
        const type = String(v.type ?? 'anomaly').toLowerCase().replace(/\s+/g, '_').slice(0, 60);
        return {
          type,
          tenant_id: cam.tenant_id,
          camera_id: cam.id,
          severity: ['low', 'medium', 'high', 'critical'].includes(v.severity) ? v.severity : 'medium',
          title: String(v.type ?? 'Detected violation').slice(0, 140),
          description: String(v.description ?? analysis.summary ?? '').slice(0, 1000),
          status: 'new',
          zone: cam.zone,
          risk_score: typeof analysis.risk_score === 'number'
            ? Math.round(analysis.risk_score)
            : SEVERITY_SCORE[v.severity as string] ?? 50,
          detected_at: new Date().toISOString(),
          metadata: {
            source: 'live_inference',
            camera: cam.name,
            summary: analysis.summary,
            detections,
            recommended_actions: analysis.recommended_actions ?? [],
            policies_applied: relevant.map((p) => p.name),
            frame_bytes: frame.bytes,
          },
        };
      })
      .filter((r) => !recentTypes.has(r.type));

    if (rows.length) {
      const { error: insErr } = await supabase.from('alerts').insert(rows);
      if (insErr) {
        await finish('error', `alert_insert_failed: ${insErr.message}`, { violations: violations.length });
        continue;
      }
    }

    await finish('ok', null, {
      violations: violations.length,
      alerts_created: rows.length,
      suppressed: violations.length - rows.length,
      summary: analysis.summary,
    });
  }

  return json({
    scanned: cams?.length ?? 0,
    processed: results.length,
    alerts_created: results.reduce((n, r) => n + (Number(r.alerts_created) || 0), 0),
    results,
  });
});
