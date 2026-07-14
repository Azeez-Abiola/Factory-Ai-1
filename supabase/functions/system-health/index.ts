import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user is super_admin
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Counts (headers only for counts)
    const [
      auditTotal,
      auditPrev,
      alerts24h,
      alertsPrev,
      incidents24h,
      camerasAll,
      camerasOnline,
      tenantsCount,
      notif24h,
      notifFailed,
    ] = await Promise.all([
      admin.from("audit_log").select("id", { count: "exact", head: true }).gte("created_at", since24h),
      admin.from("audit_log").select("id", { count: "exact", head: true }).gte("created_at", since48h).lt("created_at", since24h),
      admin.from("alerts").select("id", { count: "exact", head: true }).gte("detected_at", since24h),
      admin.from("alerts").select("id", { count: "exact", head: true }).gte("detected_at", since48h).lt("detected_at", since24h),
      admin.from("incidents").select("id", { count: "exact", head: true }).gte("created_at", since24h),
      admin.from("cameras").select("id", { count: "exact", head: true }),
      admin.from("cameras").select("id", { count: "exact", head: true }).eq("status", "online"),
      admin.from("tenants").select("id", { count: "exact", head: true }),
      admin.from("notification_log").select("id", { count: "exact", head: true }).gte("created_at", since24h),
      admin.from("notification_log").select("id", { count: "exact", head: true }).gte("created_at", since24h).eq("status", "failed"),
    ]);

    // 24h hourly traffic from audit_log + alerts
    const { data: recentAudit } = await admin
      .from("audit_log")
      .select("created_at")
      .gte("created_at", since24h)
      .limit(10000);
    const { data: recentAlerts } = await admin
      .from("alerts")
      .select("detected_at,severity")
      .gte("detected_at", since24h)
      .limit(10000);

    const buckets: Record<string, { events: number; alerts: number }> = {};
    for (let i = 23; i >= 0; i--) {
      const h = new Date(Date.now() - i * 3600 * 1000);
      const key = `${h.getUTCHours().toString().padStart(2, "0")}:00`;
      buckets[key] = { events: 0, alerts: 0 };
    }
    const keyOf = (iso: string) => {
      const d = new Date(iso);
      return `${d.getUTCHours().toString().padStart(2, "0")}:00`;
    };
    for (const r of recentAudit ?? []) {
      const k = keyOf(r.created_at);
      if (buckets[k]) buckets[k].events++;
    }
    for (const r of recentAlerts ?? []) {
      const k = keyOf(r.detected_at);
      if (buckets[k]) buckets[k].alerts++;
    }
    const trafficSeries = Object.entries(buckets).map(([time, v]) => ({ time, ...v }));

    // Per-tenant usage (top 8)
    const { data: tenants } = await admin.from("tenants").select("id,name").limit(50);
    const usage: { name: string; alerts: number; incidents: number; cameras: number }[] = [];
    for (const t of tenants ?? []) {
      const [a, i, c] = await Promise.all([
        admin.from("alerts").select("id", { count: "exact", head: true }).eq("tenant_id", t.id).gte("detected_at", since24h),
        admin.from("incidents").select("id", { count: "exact", head: true }).eq("tenant_id", t.id).gte("created_at", since24h),
        admin.from("cameras").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
      ]);
      usage.push({
        name: t.name,
        alerts: a.count ?? 0,
        incidents: i.count ?? 0,
        cameras: c.count ?? 0,
      });
    }
    usage.sort((x, y) => (y.alerts + y.incidents + y.cameras) - (x.alerts + x.incidents + x.cameras));

    // Recent log stream from audit_log (latest 25)
    const { data: recentLog } = await admin
      .from("audit_log")
      .select("id,action,entity_type,entity_id,tenant_id,created_at,metadata,ip_address")
      .order("created_at", { ascending: false })
      .limit(25);

    // Camera inference status distribution
    const { data: infStatus } = await admin
      .from("cameras")
      .select("inference_status");
    const inference: Record<string, number> = {};
    for (const r of infStatus ?? []) {
      const k = r.inference_status ?? "idle";
      inference[k] = (inference[k] ?? 0) + 1;
    }

    return new Response(
      JSON.stringify({
        generated_at: new Date().toISOString(),
        counts: {
          audit_24h: auditTotal.count ?? 0,
          audit_prev_24h: auditPrev.count ?? 0,
          alerts_24h: alerts24h.count ?? 0,
          alerts_prev_24h: alertsPrev.count ?? 0,
          incidents_24h: incidents24h.count ?? 0,
          cameras_total: camerasAll.count ?? 0,
          cameras_online: camerasOnline.count ?? 0,
          tenants_total: tenantsCount.count ?? 0,
          notifications_24h: notif24h.count ?? 0,
          notifications_failed_24h: notifFailed.count ?? 0,
        },
        traffic: trafficSeries,
        tenant_usage: usage.slice(0, 8),
        recent_log: recentLog ?? [],
        inference_status: inference,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("system-health error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
