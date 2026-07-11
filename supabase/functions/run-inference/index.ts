import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * run-inference: cron-invoked worker. For every camera with
 * inference_enabled = true whose last_inference_at is older than its
 * configured cadence, calls analyze-frame with the camera's stream_url
 * and records inference_status + last_inference_at. Detections come back
 * as alerts via analyze-frame's existing pipeline.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: cams, error } = await supabase
    .from('cameras')
    .select('id, tenant_id, name, stream_url, rtsp_url, ai_models, confidence_threshold, inference_interval_seconds, last_inference_at, status')
    .eq('inference_enabled', true)
    .eq('status', 'online')
    .limit(50);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const now = Date.now();
  const due = (cams ?? []).filter((c) => {
    if (!c.last_inference_at) return true;
    const age = (now - new Date(c.last_inference_at).getTime()) / 1000;
    return age >= (c.inference_interval_seconds ?? 30);
  });

  const analyzeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-frame`;
  const results: Array<{ camera_id: string; ok: boolean; error?: string }> = [];

  await Promise.all(due.map(async (c) => {
    await supabase.from('cameras').update({ inference_status: 'running' }).eq('id', c.id);
    try {
      const res = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          camera_id: c.id,
          tenant_id: c.tenant_id,
          stream_url: c.stream_url ?? c.rtsp_url,
          ai_models: c.ai_models,
          confidence_threshold: c.confidence_threshold,
          scheduled: true,
        }),
      });
      const ok = res.ok;
      await supabase.from('cameras').update({
        inference_status: ok ? 'ok' : 'error',
        last_inference_at: new Date().toISOString(),
      }).eq('id', c.id);
      results.push({ camera_id: c.id, ok, error: ok ? undefined : `analyze_${res.status}` });
    } catch (e) {
      await supabase.from('cameras').update({
        inference_status: 'error',
        last_inference_at: new Date().toISOString(),
      }).eq('id', c.id);
      results.push({ camera_id: c.id, ok: false, error: (e as Error).message });
    }
  }));

  return new Response(JSON.stringify({ scanned: cams?.length ?? 0, processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
