import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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

async function probeHls(url: string) {
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/vnd.apple.mpegurl' } });
  if (!res.ok) return { ok: false, reason: `HLS playlist returned HTTP ${res.status}` };
  const text = (await res.text()).slice(0, 512);
  if (!text.includes('#EXTM3U')) return { ok: false, reason: 'Response is not a valid HLS playlist (#EXTM3U missing)' };
  return { ok: true, detail: text.split('\n').slice(0, 3).join(' | ') };
}

async function probeWhep(url: string) {
  const res = await fetch(url, { method: 'OPTIONS' });
  if (res.status === 404) return { ok: false, reason: 'WHEP endpoint returned 404' };
  return { ok: true, detail: `WHEP endpoint reachable (HTTP ${res.status})` };
}

async function probeMjpeg(url: string) {
  const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1023' } });
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
    const { stream_url, stream_type, rtsp_url, gateway_base_url } = await req.json();
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
      return new Response(JSON.stringify({
        ok: true,
        detail: 'RTSP URL shape is valid — playback will go through your configured gateway.',
        stream_type: 'hls',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let result;
    const t = (stream_type ?? '').toLowerCase();
    if (t === 'webrtc' || t === 'whep' || url.includes('/whep')) result = await probeWhep(url);
    else if (t === 'mjpeg' || url.includes('mjpeg')) result = await probeMjpeg(url);
    else result = await probeHls(url); // default HLS

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
