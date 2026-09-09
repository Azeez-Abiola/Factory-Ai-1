import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { fetchWithAuth } from '../_shared/digestFetch.ts';

/**
 * camera-snapshot: returns the current still frame of a camera as image/jpeg.
 *
 * Browsers cannot load recorder snapshots directly: they sit on plain http and
 * require Digest auth. This proxies them over https with the stored camera
 * credentials, after checking the caller belongs to the camera's tenant.
 *
 * Called as an <img> src, so the JWT arrives as a `token` query parameter.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const fail = (message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const url = new URL(req.url);
    const cameraId = url.searchParams.get('camera_id');
    if (!cameraId || !/^[0-9a-f-]{36}$/i.test(cameraId)) return fail('Valid camera_id is required', 400);

    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      || url.searchParams.get('token') || '';
    if (!jwt) return fail('Authentication required', 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData } = await admin.auth.getUser(jwt);
    const userId = userData?.user?.id;
    if (!userId) return fail('Authentication required', 401);

    const { data: cam } = await admin
      .from('cameras')
      .select('id, tenant_id, snapshot_url, credentials')
      .eq('id', cameraId)
      .maybeSingle();
    if (!cam) return fail('Camera not found', 404);

    const [{ data: member }, { data: superAdmin }] = await Promise.all([
      admin.rpc('is_tenant_member', { _tenant_id: cam.tenant_id, _user_id: userId }),
      admin.rpc('has_role', { _user_id: userId, _role: 'super_admin' }),
    ]);
    if (!member && !superAdmin) return fail('You do not have access to this camera', 403);

    if (!cam.snapshot_url) return fail('This camera has no snapshot address configured', 409);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    let res: Response;
    try {
      res = await fetchWithAuth(cam.snapshot_url, cam.credentials as any, {
        headers: { Accept: 'image/jpeg,image/*' },
        signal: controller.signal,
      });
    } catch (e) {
      return fail(`Camera did not respond: ${(e as Error).message}`, 504);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      await res.body?.cancel();
      return fail(`Camera returned HTTP ${res.status}`, res.status === 401 || res.status === 403 ? 502 : 502);
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    return new Response(bytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return fail(`Unexpected error: ${(e as Error).message}`, 500);
  }
});
