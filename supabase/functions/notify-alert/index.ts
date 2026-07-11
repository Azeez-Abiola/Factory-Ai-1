import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * notify-alert: given { alert_id } or { incident_id, kind: 'escalation' },
 * loads tenant notification prefs and sends email (Resend) + SMS (Twilio)
 * to configured recipients. Records every attempt in notification_log.
 * Providers are optional — if not configured, entries are logged with
 * status='skipped_no_provider' so the admin UI can surface the gap.
 */

const SEVERITY_ORDER = { low: 1, medium: 2, high: 3, critical: 4 } as const;

function inQuietHours(start: string | null, end: string | null) {
  if (!start || !end) return false;
  const now = new Date();
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm, e = eh * 60 + em;
  return s <= e ? mins >= s && mins <= e : mins >= s || mins <= e;
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  const lovKey = Deno.env.get('LOVABLE_API_KEY');
  if (!key || !lovKey) return { ok: false, reason: 'no_provider' };
  const res = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${lovKey}`,
      'X-Connection-Api-Key': key,
    },
    body: JSON.stringify({
      from: 'FactoryAI Alerts <onboarding@resend.dev>',
      to: [to], subject, html,
    }),
  });
  if (!res.ok) return { ok: false, reason: `resend_${res.status}`, detail: await res.text() };
  return { ok: true };
}

async function sendSms(to: string, body: string) {
  const key = Deno.env.get('TWILIO_API_KEY');
  const from = Deno.env.get('TWILIO_FROM_NUMBER');
  const lovKey = Deno.env.get('LOVABLE_API_KEY');
  if (!key || !from || !lovKey) return { ok: false, reason: 'no_provider' };
  const res = await fetch('https://connector-gateway.lovable.dev/twilio/Messages.json', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${lovKey}`,
      'X-Connection-Api-Key': key,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) return { ok: false, reason: `twilio_${res.status}`, detail: await res.text() };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let tenant_id: string, subject: string, message: string, severity: string;
    let alert_id: string | null = body.alert_id ?? null;
    let incident_id: string | null = body.incident_id ?? null;
    const kind = body.kind ?? 'alert';

    if (alert_id) {
      const { data: alert } = await supabase.from('alerts').select('*').eq('id', alert_id).single();
      if (!alert) return new Response(JSON.stringify({ error: 'alert not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      tenant_id = alert.tenant_id;
      severity = alert.severity;
      subject = `[${severity.toUpperCase()}] ${alert.type ?? 'Alert'} — ${alert.zone ?? 'unknown zone'}`;
      message = alert.description ?? alert.type ?? 'New alert';
    } else if (incident_id) {
      const { data: inc } = await supabase.from('incidents').select('*').eq('id', incident_id).single();
      if (!inc) return new Response(JSON.stringify({ error: 'incident not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      tenant_id = inc.tenant_id;
      severity = inc.severity ?? 'high';
      subject = kind === 'escalation' ? `ESCALATED: ${inc.title}` : inc.title;
      message = inc.description ?? '';
    } else {
      return new Response(JSON.stringify({ error: 'alert_id or incident_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: prefs } = await supabase.from('tenant_notification_prefs').select('*').eq('tenant_id', tenant_id).maybeSingle();
    if (!prefs) return new Response(JSON.stringify({ ok: true, skipped: 'no_prefs' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const min = SEVERITY_ORDER[prefs.min_severity as keyof typeof SEVERITY_ORDER] ?? 3;
    const sev = SEVERITY_ORDER[severity as keyof typeof SEVERITY_ORDER] ?? 3;
    if (sev < min) return new Response(JSON.stringify({ ok: true, skipped: 'below_severity' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (kind === 'escalation' && !prefs.notify_on_escalation) return new Response(JSON.stringify({ ok: true, skipped: 'escalation_off' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (inQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end)) return new Response(JSON.stringify({ ok: true, skipped: 'quiet_hours' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const html = `<div style="font-family:sans-serif"><h2 style="color:#dc2626">${subject}</h2><p>${message}</p><p style="color:#666;font-size:12px">FactoryAI • ${new Date().toISOString()}</p></div>`;
    const sms = `[FactoryAI] ${subject}\n${message.slice(0, 120)}`;

    const logs: Array<{ channel: string; recipient: string; status: string; reason?: string }> = [];
    if (prefs.email_enabled) {
      for (const to of prefs.email_recipients ?? []) {
        const r = await sendEmail(to, subject, html);
        logs.push({ channel: 'email', recipient: to, status: r.ok ? 'sent' : 'skipped_no_provider', reason: r.ok ? undefined : (r as any).reason });
      }
    }
    if (prefs.sms_enabled) {
      for (const to of prefs.sms_recipients ?? []) {
        const r = await sendSms(to, sms);
        logs.push({ channel: 'sms', recipient: to, status: r.ok ? 'sent' : 'skipped_no_provider', reason: r.ok ? undefined : (r as any).reason });
      }
    }

    if (logs.length) {
      await supabase.from('notification_log').insert(logs.map((l) => ({
        tenant_id, alert_id, incident_id, ...l, metadata: { kind, severity, subject },
      })));
    }

    return new Response(JSON.stringify({ ok: true, sent: logs.filter((l) => l.status === 'sent').length, attempted: logs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
