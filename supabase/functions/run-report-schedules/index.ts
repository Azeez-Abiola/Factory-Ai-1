// Scheduled-report worker. Called hourly; generates reports for schedules that are due.
// Bounded batch, claims each schedule by advancing next_run_at before building (no double runs).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { buildReportWith, focusAreasFromCategories, REPORT_TYPE_LABELS, type ReportData, type ReportType } from "../_shared/reportCore.ts";
import { computeNextRun, describeSchedule, lookbackDays, type ScheduleFrequency } from "../_shared/reportSchedule.ts";
import { emailShell, sendEmail } from "../_shared/messaging.ts";

const BATCH = 20;
const DEFAULT_APP_URL = "https://factoryai.1879techhub.com";
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SEVERITY_COLOR: Record<string, string> = { critical: "#f87171", high: "#fb923c", medium: "#fbbf24", low: "#94a3b8" };

/** The report's body content, dropped into the shared email shell. */
function reportEmailBody(opts: {
  tenantName: string; summary: string; score: number; status: string;
  totals: ReportData["totals"]; findings: ReportData["findings"]; reportUrl: string;
}) {
  const rows = opts.findings.slice(0, 5).map((f) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #1e293b;color:#e2e8f0">${f.title}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #1e293b;color:${SEVERITY_COLOR[f.severity] ?? "#94a3b8"};text-transform:capitalize">${f.severity}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #1e293b;color:#94a3b8">${f.zone}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #1e293b;color:#94a3b8;text-align:right">${f.occurrences}</td>
    </tr>`).join("");

  return `
    <p style="margin:0 0 4px;color:#94a3b8;font-size:12px">${opts.tenantName}</p>
    <p style="margin:0 0 16px;line-height:1.6">${opts.summary}</p>
    <p style="margin:0 0 18px">
      <span style="font-size:26px;font-weight:700;color:${opts.status === "passed" ? "#4ade80" : "#f87171"}">${opts.score}</span>
      <span style="color:#64748b;font-size:12px"> / 100 · ${opts.totals.alerts} alert${opts.totals.alerts === 1 ? "" : "s"}, ${opts.totals.open} open, ${opts.totals.incidents} incident${opts.totals.incidents === 1 ? "" : "s"}</span>
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin:0 0 20px">
      <thead><tr>
        <th style="text-align:left;padding:6px 8px;color:#64748b;border-bottom:1px solid #1e293b">Finding</th>
        <th style="text-align:left;padding:6px 8px;color:#64748b;border-bottom:1px solid #1e293b">Severity</th>
        <th style="text-align:left;padding:6px 8px;color:#64748b;border-bottom:1px solid #1e293b">Zone</th>
        <th style="text-align:right;padding:6px 8px;color:#64748b;border-bottom:1px solid #1e293b">Times</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="4" style="padding:8px;color:#64748b">No findings this period.</td></tr>`}</tbody>
    </table>
    <p style="margin:0 0 6px"><a href="${opts.reportUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600">View full report</a></p>`;
}

/** Emails a just-generated report to a schedule's recipients via Resend. Never throws. */
async function emailReport(
  recipients: string[], title: string, appUrl: string, reportId: string,
  tenantName: string, summary: string, score: number, status: string, totals: ReportData["totals"], findings: ReportData["findings"],
): Promise<string | null> {
  if (!recipients.length) return null;
  const html = emailShell(title, reportEmailBody({
    tenantName, summary, score, status, totals, findings,
    reportUrl: `${appUrl}/app/reports/${reportId}`,
  }));
  const outcomes = await Promise.all(recipients.map((to) => sendEmail(to, title, html)));
  const failed = outcomes.filter((o) => !o.ok);
  if (!failed.length) return null;
  if (failed.length === outcomes.length) {
    return `Report generated, but no emails could be sent (${failed[0].reason ?? "delivery failed"}).`;
  }
  return `Report generated. Emailed ${outcomes.length - failed.length} of ${outcomes.length} recipient(s) — ${failed.length} failed.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();

  // Optional: run one schedule right now for a signed-in user who may create reports.
  let body: { schedule_id?: string; app_url?: string } = {};
  try { body = await req.json(); } catch { /* cron sends minimal body */ }
  const appUrl = (typeof body.app_url === "string" && body.app_url.startsWith("http") ? body.app_url : Deno.env.get("APP_URL") || DEFAULT_APP_URL).replace(/\/$/, "");

  let due: any[] = [];
  let manual = false;
  if (body.schedule_id && typeof body.schedule_id === "string") {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await supabase.auth.getUser(jwt);
    if (!u?.user) return json({ error: "Sign in required" }, 401);
    const { data: s } = await supabase.from("report_schedules").select("*").eq("id", body.schedule_id).maybeSingle();
    if (!s) return json({ error: "Schedule not found" }, 404);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: allowed } = await userClient.rpc("has_tenant_permission", { _tenant_id: s.tenant_id, _permission_key: "reports.create" });
    if (!allowed) return json({ error: "You don't have permission to run reports for this site" }, 403);
    due = [s];
    manual = true;
  } else {
    const { data } = await supabase
      .from("report_schedules").select("*")
      .eq("enabled", true).lte("next_run_at", now.toISOString())
      .order("next_run_at").limit(BATCH);
    due = data ?? [];
  }

  const results: Record<string, unknown>[] = [];
  for (const s of due) {
    const timing = { frequency: s.frequency as ScheduleFrequency, run_hour: s.run_hour, weekday: s.weekday, month_day: s.month_day, timezone: s.timezone };
    if (!manual) {
      // Claim: only proceed if nobody else advanced it already.
      const { data: claimed } = await supabase.from("report_schedules")
        .update({ next_run_at: computeNextRun(timing, now).toISOString() })
        .eq("id", s.id).eq("next_run_at", s.next_run_at).select("id");
      if (!claimed?.length) continue;
    }
    try {
      const end = now;
      const start = new Date(end.getTime() - lookbackDays(timing.frequency) * 864e5);
      const type = s.type as ReportType;
      const { data: cfg } = await supabase.from("ai_analysis_config").select("categories").eq("tenant_id", s.tenant_id).maybeSingle();
      const areas = focusAreasFromCategories(cfg?.categories);
      const focus = areas.find((a) => a.value === type);
      if (!focus && type.startsWith("cat:")) throw new Error("This focus area's detection category was removed or switched off in AI Model & Categories");
      const built = await buildReportWith(supabase, s.tenant_id, type, start, end, { cameraIds: s.camera_ids, zones: s.zones }, focus);

      const { data: last } = await supabase.from("reports").select("reference").eq("tenant_id", s.tenant_id).limit(1000);
      const highest = (last ?? []).reduce((m: number, r: { reference: string }) => {
        const n = Number(String(r.reference).replace(/\D/g, ""));
        return Number.isFinite(n) && n > m ? n : m;
      }, 0);
      const { data: tenant } = await supabase.from("tenants").select("name").eq("id", s.tenant_id).maybeSingle();
      const label = `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`;
      const title = `${s.name} — ${tenant?.name ?? "site"} (${label})`;

      const { data: rep, error } = await supabase.from("reports").insert({
        tenant_id: s.tenant_id,
        reference: `RPT-${String(highest + 1).padStart(4, "0")}`,
        title,
        type,
        status: built.status,
        score: built.score,
        findings_count: built.findings_count,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        summary: `${built.summary} Automated: ${describeSchedule(timing).toLowerCase()}.`,
        data: { ...built.data, scope: { cameraIds: s.camera_ids, zones: s.zones }, schedule_id: s.id },
        generated_by: s.created_by,
        generated_by_name: `Scheduled · ${focus?.label ?? REPORT_TYPE_LABELS[type] ?? type}`,
      }).select("id").single();
      if (error) throw error;

      const emailNote = await emailReport(
        s.recipients ?? [], title, appUrl, rep.id, tenant?.name ?? "site",
        built.summary, built.score, built.status, built.data.totals, built.data.findings,
      ).catch((e) => `Report generated, but email delivery crashed: ${(e as Error).message}`);

      await supabase.from("report_schedules").update({
        last_run_at: now.toISOString(), last_status: "success", last_error: emailNote, last_report_id: rep.id,
      }).eq("id", s.id);
      results.push({ id: s.id, report_id: rep.id, email: emailNote });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("report_schedules").update({ last_run_at: now.toISOString(), last_status: "failed", last_error: msg.slice(0, 500) }).eq("id", s.id);
      results.push({ id: s.id, error: msg });
    }
  }
  return json({ processed: results.length, results });
});
