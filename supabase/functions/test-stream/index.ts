import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * test-stream: validates a stream URL before a camera is persisted.
 * - HLS (.m3u8): GET the playlist, must return 200 and contain #EXTM3U.
 * - MJPEG (http image stream): HEAD/GET must return image/* or multipart.
 * - RTSP: cannot be probed from Deno directly — validates URL shape and
 *   requires a gateway_base_url so playback can be verified as HLS.
 * - WebRTC (WHEP): OPTIONS on the endpoint should not 404.
 */

function validateUrl(url: string): { ok: boolean; reason?: string } {
  try {
    const u = new URL(url);
    if (!['http:', 'https:', 'rtsp:', 'rtsps:'].includes(u.protocol)) {
      return { ok: false, reason: `Unsupported protocol: ${u.protocol}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Malformed URL' };
  }
}

function requestHeaders(credentials?: { username?: string; password?: string } | null, accept = '*/*') {
  const headers: Record<string, string> = { Accept: accept };
  if (credentials?.username) headers.Authorization = `Basic ${btoa(`${credentials.username}:${credentials.password ?? ''}`)}`;
  return headers;
}

class ProbeError extends Error {}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 10_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (timedOut) {
      throw new ProbeError('The stream did not respond within 10 seconds. Check the address is reachable from the public internet (not a private LAN IP) and that any gateway/firewall allows it.');
    }
    throw new ProbeError(`Could not reach the stream: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function probeHls(url: string, credentials?: { username?: string; password?: string } | null) {
  const res = await fetchWithTimeout(url, { method: 'GET', headers: requestHeaders(credentials, 'application/vnd.apple.mpegurl') });
  if (!res.ok) return { ok: false, reason: `HLS playlist returned HTTP ${res.status}` };
  const text = (await res.text()).slice(0, 512);
  if (!text.includes('#EXTM3U')) return { ok: false, reason: 'Response is not a valid HLS playlist (#EXTM3U missing)' };
  return { ok: true, detail: text.split('\n').slice(0, 3).join(' | ') };
}

async function probeWhep(url: string, credentials?: { username?: string; password?: string } | null) {
  const res = await fetchWithTimeout(url, { method: 'OPTIONS', headers: requestHeaders(credentials) });
  if (res.status === 404) return { ok: false, reason: 'WHEP endpoint returned 404' };
  return { ok: true, detail: `WHEP endpoint reachable (HTTP ${res.status})` };
}

async function probeMjpeg(url: string, credentials?: { username?: string; password?: string } | null) {
  const res = await fetchWithTimeout(url, { method: 'GET', headers: { ...requestHeaders(credentials, 'image/*'), Range: 'bytes=0-1023' } });
  if (!res.ok) return { ok: false, reason: `MJPEG returned HTTP ${res.status}` };
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.startsWith('image/') && !ct.startsWith('multipart/')) {
    return { ok: false, reason: `Unexpected content-type: ${ct}` };
  }
  return { ok: true, detail: `content-type: ${ct}` };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ ok: false, reason: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: { user } } = await client.auth.getUser();
    if (!user) return new Response(JSON.stringify({ ok: false, reason: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { stream_url, stream_type, rtsp_url, gateway_base_url, snapshot_url, credentials } = await req.json();
    const url = stream_url || rtsp_url;
    if (!url) {
      return new Response(JSON.stringify({ ok: false, reason: 'stream_url or rtsp_url required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const shape = validateUrl(url);
    if (!shape.ok) return new Response(JSON.stringify(shape), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // RTSP can't be probed from an edge function; require a gateway for playback.
    if (url.startsWith('rtsp')) {
      if (!gateway_base_url) {
        return new Response(JSON.stringify({
          ok: false,
          reason: 'RTSP source needs a streaming gateway (set Gateway Base URL in Tenant Settings) so the browser can play HLS/WebRTC.',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (snapshot_url) {
        const snapshot = await probeMjpeg(snapshot_url, credentials);
        if (!snapshot.ok) return new Response(JSON.stringify({ ok: false, reason: `RTSP format is valid, but snapshot test failed: ${snapshot.reason}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        ok: true,
        detail: snapshot_url ? 'RTSP format and AI snapshot verified; playback will use the configured gateway.' : 'RTSP format verified; playback will use the configured gateway.',
        stream_type: 'hls',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let result;
    const t = (stream_type ?? '').toLowerCase();
    if (t === 'webrtc' || t === 'whep' || url.includes('/whep')) result = await probeWhep(url, credentials);
    else if (t === 'mjpeg' || url.includes('mjpeg')) result = await probeMjpeg(url, credentials);
    else result = await probeHls(url, credentials); // default HLS

    if (result.ok && snapshot_url) {
      const snapshot = await probeMjpeg(snapshot_url, credentials);
      if (!snapshot.ok) result = { ok: false, reason: `Playback is reachable, but AI snapshot failed: ${snapshot.reason}` };
      else result = { ok: true, detail: `${result.detail ?? 'Playback reachable'} · AI snapshot reachable` };
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const err = e as Error;
    // Unreachable / slow streams are an expected test outcome, not a server fault.
    const expected = err instanceof ProbeError || err.name === 'AbortError' || /aborted|timed out|timeout/i.test(err.message);
    return new Response(
      JSON.stringify({ ok: false, reason: expected ? err.message : `Unexpected error: ${err.message}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
