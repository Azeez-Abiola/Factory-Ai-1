import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { fetchWithAuth } from '../_shared/digestFetch.ts';

/**
 * camera-ptz: sends a real pan / tilt / zoom command to the recorder.
 *
 * Hikvision/Dahua-style recorders expose ISAPI continuous PTZ:
 *   PUT http://<host>/ISAPI/PTZCtrl/channels/<ch>/continuous
 *   <PTZData><pan>..</pan><tilt>..</tilt><zoom>..</zoom></PTZData>
 * A move is started, then stopped after a short nudge duration.
 */

type Direction = 'up' | 'down' | 'left' | 'right' | 'zoom_in' | 'zoom_out';

const VECTORS: Record<Direction, { pan: number; tilt: number; zoom: number }> = {
  up: { pan: 0, tilt: 1, zoom: 0 },
  down: { pan: 0, tilt: -1, zoom: 0 },
  left: { pan: -1, tilt: 0, zoom: 0 },
  right: { pan: 1, tilt: 0, zoom: 0 },
  zoom_in: { pan: 0, tilt: 0, zoom: 1 },
  zoom_out: { pan: 0, tilt: 0, zoom: -1 },
};

/** Recorder host + channel are derived from the addresses already stored. */
function resolveTarget(cam: { snapshot_url: string | null; stream_url: string | null; rtsp_url: string | null; metadata: any }) {
  const metaChannel = cam.metadata?.channel ?? cam.metadata?.channel_id ?? null;
  const httpish = [cam.snapshot_url, cam.stream_url].find((u) => u && /^https?:\/\//i.test(u)) ?? null;
  let host: string | null = null;
  if (httpish) {
    const u = new URL(httpish);
    host = `${u.protocol}//${u.host}`;
  } else if (cam.rtsp_url) {
    const m = cam.rtsp_url.match(/^rtsps?:\/\/(?:[^@/]*@)?([^/:]+)(?::(\d+))?/i);
    if (m) host = `http://${m[1]}`;
  }

  const fromPath = (u: string | null) => u?.match(/channels?\/(\d+)/i)?.[1] ?? null;
  const channel = String(metaChannel ?? fromPath(cam.snapshot_url) ?? fromPath(cam.stream_url) ?? fromPath(cam.rtsp_url) ?? '');

  return { host, channel };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { camera_id: cameraId, direction, speed = 40, duration_ms = 500 } = await req.json().catch(() => ({}));
    if (!cameraId || !/^[0-9a-f-]{36}$/i.test(cameraId)) return json({ ok: false, reason: 'Valid camera_id is required' }, 400);
    if (!direction || !(direction in VECTORS)) return json({ ok: false, reason: 'Unknown PTZ direction' }, 400);

    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ ok: false, reason: 'Authentication required' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData } = await admin.auth.getUser(jwt);
    const userId = userData?.user?.id;
    if (!userId) return json({ ok: false, reason: 'Authentication required' }, 401);

    const { data: cam } = await admin
      .from('cameras')
      .select('id, tenant_id, name, ptz_enabled, snapshot_url, stream_url, rtsp_url, metadata, credentials')
      .eq('id', cameraId)
      .maybeSingle();
    if (!cam) return json({ ok: false, reason: 'Camera not found' }, 404);

    const [{ data: member }, { data: superAdmin }] = await Promise.all([
      admin.rpc('is_tenant_member', { _tenant_id: cam.tenant_id, _user_id: userId }),
      admin.rpc('has_role', { _user_id: userId, _role: 'super_admin' }),
    ]);
    if (!member && !superAdmin) return json({ ok: false, reason: 'You do not have access to this camera' }, 403);
    if (!cam.ptz_enabled) return json({ ok: false, reason: 'Pan/tilt/zoom is not enabled for this camera' }, 409);

    const { host, channel } = resolveTarget(cam as any);
    if (!host || !channel) {
      return json({ ok: false, reason: 'This camera has no recorder address or channel saved, so movement cannot be sent' }, 409);
    }

    const v = VECTORS[direction as Direction];
    const s = Math.max(1, Math.min(100, Number(speed) || 40));
    const endpoint = `${host}/ISAPI/PTZCtrl/channels/${channel}/continuous`;
    const body = (mul: number) =>
      `<?xml version="1.0" encoding="UTF-8"?><PTZData><pan>${v.pan * s * mul}</pan><tilt>${v.tilt * s * mul}</tilt><zoom>${v.zoom * s * mul}</zoom></PTZData>`;

    const send = async (mul: number) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      try {
        return await fetchWithAuth(endpoint, cam.credentials as any, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/xml' },
          body: body(mul),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    };

    let res: Response;
    try {
      res = await send(1);
    } catch (e) {
      return json({ ok: false, reason: `Camera did not respond: ${(e as Error).message}` }, 200);
    }
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      const reason =
        res.status === 401 || res.status === 403
          ? 'The recorder rejected the saved camera sign-in for movement control'
          : res.status === 404
            ? 'This channel does not support movement control on the recorder'
            : `Recorder returned HTTP ${res.status}`;
      return json({ ok: false, reason, detail: text.slice(0, 300) }, 200);
    }

    // Stop the movement after a short nudge so a click moves a step, not forever.
    await new Promise((r) => setTimeout(r, Math.max(100, Math.min(2000, Number(duration_ms) || 500))));
    try {
      const stop = await send(0);
      await stop.text().catch(() => '');
    } catch { /* the stop is best-effort; recorders also auto-stop */ }

    return json({ ok: true, direction, channel });
  } catch (e) {
    return json({ ok: false, reason: `Unexpected error: ${(e as Error).message}` }, 500);
  }
});
