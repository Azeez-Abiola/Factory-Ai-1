import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { fetchWithAuth } from '../_shared/digestFetch.ts';
import { loadGateRules, gateViolation, effectiveCooldown } from '../_shared/alertGating.ts';

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    // Recorders (Hikvision/Dahua) answer with Digest auth, not Basic.
    const res = await fetchWithAuth(url, credentials as any, { headers, signal: controller.signal });
    if (!res.ok) return { ok: false as const, reason: `snapshot_http_${res.status}` };
    const ct = res.headers.get('content-type') ?? 'image/jpeg';
    if (!ct.startsWith('image/') && !ct.startsWith('multipart/')) {
      return { ok: false as const, reason: `snapshot_content_type_${ct}` };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.length) return { ok: false as const, reason: 'snapshot_empty' };
    const mime = ct.startsWith('image/') ? ct.split(';')[0] : 'image/jpeg';
    return { ok: true as const, dataUrl: `data:${mime};base64,${toBase64(buf)}`, bytes: buf.length, raw: buf, mime };
  } catch (e) {
    return { ok: false as const, reason: `snapshot_error_${(e as Error).name}` };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ *
 * Scene-change gating
 * A 32x32 grayscale fingerprint of every polled frame is stored on the
 * camera row. The (expensive) vision model only sees a frame when its
 * fingerprint drifts past the camera's sensitivity threshold, so a static
 * scene costs one cheap snapshot fetch instead of one LLM call.
 * ------------------------------------------------------------------ */
const SIG_SIZE = 32;

/** 32x32 luma fingerprint from a JPEG buffer, base64 encoded. Null when undecodable. */
async function frameSignature(bytes: Uint8Array, mime: string): Promise<string | null> {
  if (!/jpe?g/i.test(mime)) return null;
  try {
    const { default: jpeg } = await import('npm:jpeg-js@0.4.4');
    const img = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 128 });
    if (!img?.width || !img?.height) return null;
    const out = new Uint8Array(SIG_SIZE * SIG_SIZE);
    for (let y = 0; y < SIG_SIZE; y++) {
      const sy = Math.min(img.height - 1, Math.floor((y + 0.5) * img.height / SIG_SIZE));
      for (let x = 0; x < SIG_SIZE; x++) {
        const sx = Math.min(img.width - 1, Math.floor((x + 0.5) * img.width / SIG_SIZE));
        const p = (sy * img.width + sx) * 4;
        out[y * SIG_SIZE + x] = (0.299 * img.data[p] + 0.587 * img.data[p + 1] + 0.114 * img.data[p + 2]) | 0;
      }
    }
    return toBase64(out);
  } catch {
    return null;
  }
}

/** Mean absolute luma difference, expressed as a percentage (0..100). */
function signatureDelta(a: string, b: string): number | null {
  try {
    const decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const x = decode(a), y = decode(b);
    if (x.length !== y.length || !x.length) return null;
    let sum = 0;
    for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i]);
    return (sum / x.length) / 255 * 100;
  } catch {
    return null;
  }
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let requestedCamera: string | null = null;
  try {
    const body = await req.json();
    requestedCamera = body?.camera_id ?? null;
  } catch { /* cron invokes with no body */ }

  // On-demand runs must be authenticated and scoped to one of the caller's tenants.
  // Scheduled no-body runs are invoked internally by the existing database scheduler.
  if (requestedCamera) {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Authentication required' }, 401);
    const { data: userData } = await supabase.auth.getUser(jwt);
    const userId = userData?.user?.id;
    if (!userId) return json({ error: 'Authentication required' }, 401);
    const { data: requested } = await supabase.from('cameras').select('tenant_id').eq('id', requestedCamera).maybeSingle();
    if (!requested) return json({ error: 'Camera not found' }, 404);
    const [{ data: member }, { data: superAdmin }] = await Promise.all([
      supabase.rpc('is_tenant_member', { _tenant_id: requested.tenant_id, _user_id: userId }),
      supabase.rpc('has_role', { _user_id: userId, _role: 'super_admin' }),
    ]);
    if (!member && !superAdmin) return json({ error: 'You do not have access to this camera' }, 403);
  }

  let query = supabase
    .from('cameras')
    .select('id, tenant_id, name, zone, stream_url, snapshot_url, rtsp_url, credentials, ai_models, confidence_threshold, inference_interval_seconds, last_inference_at, status, inference_enabled, scene_gating_enabled, scene_change_threshold, frame_signature, last_frame_change_at, frames_skipped, frames_analyzed, max_idle_seconds')
    .limit(50);

  query = requestedCamera
    ? query.eq('id', requestedCamera)
    : query.eq('inference_enabled', true).eq('status', 'online');

  const { data: cams, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const now = Date.now();
  const POLL_FLOOR_SECONDS = 10;
  const due = (cams ?? []).filter((c) => {
    if (requestedCamera) return true;
    if (!c.last_inference_at) return true;
    const age = (now - new Date(c.last_inference_at).getTime()) / 1000;
    // With scene gating on, the camera is polled on every tick — the cheap
    // fingerprint check, not a fixed cadence, decides if the model runs.
    const cadence = c.scene_gating_enabled === false
      ? (c.inference_interval_seconds ?? 30)
      : POLL_FLOOR_SECONDS;
    return age >= cadence;
  });

  const analyzeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-frame`;
  const results: Array<Record<string, unknown>> = [];

  const budgetBlocked = new Set<string>();

  for (const cam of due) {
    if (budgetBlocked.has(cam.tenant_id)) continue;
    await supabase.from('cameras').update({ inference_status: 'running' }).eq('id', cam.id);

    const finish = async (status: string, err: string | null, extra: Record<string, unknown> = {}, patch: Record<string, unknown> = {}) => {
      await supabase.from('cameras').update({
        inference_status: status,
        last_inference_at: new Date().toISOString(),
        last_inference_error: err,
        ...patch,
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

    // ---- Scene-change gate -------------------------------------------------
    // Manual runs always analyse. Otherwise the model only sees frames whose
    // fingerprint drifted past the threshold, or a periodic keep-alive frame.
    const gatingOn = cam.scene_gating_enabled !== false;
    const signature = gatingOn ? await frameSignature(frame.raw, frame.mime) : null;
    let sceneDelta: number | null = null;

    if (gatingOn && signature && !requestedCamera) {
      const previous = typeof cam.frame_signature === 'string' ? cam.frame_signature : null;
      sceneDelta = previous ? signatureDelta(previous, signature) : null;
      const threshold = Number(cam.scene_change_threshold ?? 1.2);
      const maxIdle = Number(cam.max_idle_seconds ?? 900);
      const sinceChange = cam.last_frame_change_at
        ? (now - new Date(cam.last_frame_change_at).getTime()) / 1000
        : Number.POSITIVE_INFINITY;

      if (sceneDelta !== null && sceneDelta < threshold && sinceChange < maxIdle) {
        await finish('idle', null, {
          skipped: true,
          reason: 'scene_unchanged',
          scene_delta: Number(sceneDelta.toFixed(3)),
          threshold,
        }, {
          frame_signature: signature,
          last_scene_delta: sceneDelta,
          frames_skipped: (cam.frames_skipped ?? 0) + 1,
        });
        continue;
      }
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
          cameraId: cam.id,
          source: 'live_inference',
          sceneChanged: true,
          sceneDelta: sceneDelta,
          cameraName: cam.name,
          zone: cam.zone,
          categories: selectedCategories,
          context,
        }),
      });
      const payload = await res.json();
      if (res.status === 402) {
        // Tenant AI budget exhausted — pause this camera until the cap is raised.
        budgetBlocked.add(cam.tenant_id);
        await finish('budget_paused', String(payload?.message ?? 'Monthly AI analysis budget reached.').slice(0, 300), { skipped: true, reason: 'budget_exceeded' });
        continue;
      }
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

    // Site alert rules add their own confidence bar and cooldown on top of the camera's.
    const gateRules = await loadGateRules(supabase, cam.tenant_id);
    const decisions = new Map<any, ReturnType<typeof gateViolation>>();
    for (const v of violations) decisions.set(v, gateViolation(v, detections, threshold, gateRules));

    // Cooldown: don't re-raise the same violation type for the same camera.
    const cooldownSeconds = effectiveCooldown(gateRules, Math.max((cam.inference_interval_seconds ?? 30) * 3, 300));
    const since = new Date(Date.now() - cooldownSeconds * 1000).toISOString();
    const { data: recent } = await supabase
      .from('alerts')
      .select('type')
      .eq('camera_id', cam.id)
      .gte('detected_at', since);
    const recentTypes = new Set((recent ?? []).map((r) => r.type));

    const rows = violations
      .filter((v) => decisions.get(v)!.pass)

      .map((v) => {
        const type = String(v.type ?? 'anomaly').toLowerCase().replace(/\s+/g, '_').slice(0, 60);
        return {
          type,
          tenant_id: cam.tenant_id,
          camera_id: cam.id,
          severity: ['low', 'medium', 'high', 'critical'].includes(v.severity) ? v.severity : 'medium',
          title: String(v.type ?? 'Detected violation').slice(0, 140),
          description: String(v.description ?? analysis.summary ?? '').slice(0, 1000),
          status: 'open',
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
            scene_changed: true,
            scene_delta: sceneDelta === null ? null : Number(sceneDelta.toFixed(3)),
            confidence_gate: decisions.get(v) ?? null,
          },

        };
      })
      .filter((r) => !recentTypes.has(r.type));

    if (rows.length) {
      // Persist the exact frame that triggered the alert so operators can
      // review the visual evidence with detection boxes later.
      let evidencePath: string | null = null;
      try {
        const ext = frame.mime === 'image/png' ? 'png' : 'jpg';
        const path = `${cam.tenant_id}/${cam.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('alert-evidence')
          .upload(path, frame.raw, { contentType: frame.mime, upsert: false });
        if (!upErr) evidencePath = path;
      } catch (_e) {
        evidencePath = null;
      }
      if (evidencePath) {
        for (const r of rows) {
          (r.metadata as Record<string, unknown>).evidence_path = evidencePath;
        }
      }
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
      scene_delta: sceneDelta === null ? null : Number(sceneDelta.toFixed(3)),
      gated: gatingOn && !!signature,
      analysis,
    }, {
      ...(signature ? { frame_signature: signature, last_frame_change_at: new Date().toISOString() } : {}),
      ...(sceneDelta === null ? {} : { last_scene_delta: sceneDelta }),
      frames_analyzed: (cam.frames_analyzed ?? 0) + 1,
    });
  }

  const analyzed = results.filter((r) => r.status === 'ok').length;
  const skipped = results.filter((r) => r.skipped === true).length;

  return json({
    budget_paused_tenants: [...budgetBlocked],
    scanned: cams?.length ?? 0,
    processed: results.length,
    analyzed,
    skipped_unchanged: skipped,
    alerts_created: results.reduce((n, r) => n + (Number(r.alerts_created) || 0), 0),
    results,
  });
});

