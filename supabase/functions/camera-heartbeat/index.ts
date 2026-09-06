// Public heartbeat endpoint for streaming gateways (MediaMTX, go2rtc, Frigate, custom).
// Per-camera token authentication — no user JWT required.
//
// POST /camera-heartbeat
// {
//   "camera_id": "uuid",
//   "token": "hex string from cameras.ingest_token",
//   "status": "online" | "offline" | "maintenance",   // optional, default "online"
//   "resolution": "1920x1080",                         // optional
//   "fps": 25,                                         // optional
//   "detection": {                                     // optional — creates a live alert
//     "title": "Missing hard hat",
//     "severity": "high",                              // low | medium | high | critical
//     "confidence": 0.92,
//     "metadata": { ... }
//   }
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { camera_id, token, status, resolution, fps, detection } = payload ?? {};
  if (!camera_id || !token) return json({ error: "camera_id and token required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Heartbeat via security-definer RPC (token-gated inside the function).
  const { data: ok, error } = await supabase.rpc("camera_heartbeat", {
    _camera_id: camera_id,
    _token: token,
    _status: status ?? "online",
    _resolution: resolution ?? null,
    _fps: fps ?? null,
  });

  if (error) return json({ error: error.message }, 500);
  if (!ok) return json({ error: "Invalid camera_id or token" }, 401);

  // Optional live detection → insert as alert scoped to camera's tenant.
  if (detection && typeof detection === "object") {
    const { data: cam } = await supabase
      .from("cameras")
      .select("tenant_id, name, zone")
      .eq("id", camera_id)
      .maybeSingle();

    if (cam) {
      await supabase.from("alerts").insert({
        tenant_id: cam.tenant_id,
        camera_id,
        type: String(detection.type ?? "camera_ai"),
        title: String(detection.title ?? "Detection"),
        description: String(detection.description ?? "Live camera detection"),
        severity: String(detection.severity ?? "medium"),
        status: "open",
        zone: cam.zone ?? cam.name,
        risk_score: Math.round(Number(detection.confidence ?? 0) * 100),
        metadata: { ...(detection.metadata ?? {}), confidence: Number(detection.confidence ?? 0), source: "camera_ai" },
      });
    }
  }

  return json({ ok: true, at: new Date().toISOString() });
});
