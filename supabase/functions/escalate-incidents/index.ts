// Auto-escalation cron worker.
// Finds open/investigating incidents whose next_escalation_at has passed and
// rotates their resolution tasks to the next supervisor in the tenant's policy.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();
  const summary: Array<Record<string, unknown>> = [];

  // Fetch policies keyed by tenant
  const { data: policies } = await supabase
    .from("escalation_policies")
    .select("*")
    .eq("is_active", true);
  const policyByTenant = new Map<string, any>();
  (policies ?? []).forEach((p) => policyByTenant.set(p.tenant_id, p));

  // Find due incidents
  const { data: due } = await supabase
    .from("incidents")
    .select("*")
    .in("status", ["open", "investigating"])
    .lte("next_escalation_at", now);

  for (const inc of due ?? []) {
    const pol = policyByTenant.get(inc.tenant_id);
    if (!pol || !pol.supervisor_ids?.length) continue;

    const nextLevel = (inc.escalation_level ?? 0) + 1;
    const supervisorIdx = nextLevel % pol.supervisor_ids.length;
    const nextSupervisor: string = pol.supervisor_ids[supervisorIdx];

    // Reassign open tasks + assign incident
    await supabase.from("resolution_tasks")
      .update({ assigned_to: nextSupervisor })
      .eq("incident_id", inc.id)
      .not("status", "in", "(completed,cancelled)");

    const nextAt = new Date(Date.now() + pol.timeout_minutes * 60_000).toISOString();
    await supabase.from("incidents")
      .update({
        assigned_to: nextSupervisor,
        escalation_level: nextLevel,
        last_escalated_at: now,
        next_escalation_at: nextAt,
      })
      .eq("id", inc.id);

    await supabase.from("audit_log").insert({
      tenant_id: inc.tenant_id,
      action: "incident.escalated",
      entity_type: "incident",
      entity_id: inc.id,
      metadata: {
        level: nextLevel,
        reassigned_to: nextSupervisor,
        policy_id: pol.id,
        timeout_minutes: pol.timeout_minutes,
      },
    });

    summary.push({ incident_id: inc.id, level: nextLevel, reassigned_to: nextSupervisor });
  }

  return new Response(JSON.stringify({ processed: summary.length, escalations: summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
