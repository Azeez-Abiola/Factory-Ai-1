import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { emailConfigured, emailShell, sendEmail, sendSms, smsConfigured } from '../_shared/messaging.ts';

/**
 * notify-alert: given { alert_id } or { incident_id, kind: 'escalation' },
 * loads tenant notification prefs and delivers email (Resend) + SMS (Twilio)
 * to the configured recipients. Every attempt is written to notification_log
 * with its real outcome (sent / failed / skipped_no_provider).
 */

const SEVERITY_ORDER = { low: 1, medium: 2, high: 3, critical: 4 } as const;

const SEVERITY_ACCENT: Record<string, string> = {
  low: '#0ea5e9', medium: '#f59e0b', high: '#f97316', critical: '#dc2626',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function inQuietHours(start: string | null, end: string | null) {
  if (!start || !end) return false;
  const now = new Date();
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm, e = eh * 60 + em;
  return s <= e ? mins >= s && mins <= e : mins >= s || mins <= e;
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
    let detail = '';
    const alert_id: string | null = body.alert_id ?? null;
    const incident_id: string | null = body.incident_id ?? null;
    const kind = body.kind ?? 'alert';

    if (alert_id) {
      const { data: alert } = await supabase.from('alerts').select('*').eq('id', alert_id).single();
      if (!alert) return json({ error: 'alert not found' }, 404);
      tenant_id = alert.tenant_id;
      severity = alert.severity;
      subject = `[${String(severity).toUpperCase()}] ${alert.title ?? alert.type ?? 'Alert'} — ${alert.zone ?? 'unknown zone'}`;
      message = alert.description ?? alert.title ?? alert.type ?? 'New alert';
      const source = (alert.metadata as any)?.source === 'live_inference' ? 'Live camera AI' : 'Platform';
      detail = `Source: ${source} • Risk score: ${alert.risk_score ?? '—'} • Detected: ${new Date(alert.detected_at).toUTCString()}`;
    } else if (incident_id) {
      const { data: inc } = await supabase.from('incidents').select('*').eq('id', incident_id).single();
      if (!inc) return json({ error: 'incident not found' }, 404);
      tenant_id = inc.tenant_id;
      severity = inc.severity ?? 'high';
      subject = kind === 'escalation' ? `ESCALATED: ${inc.title}` : inc.title;
      message = inc.notes ?? inc.title ?? '';
      detail = `Status: ${inc.status} • Escalation level: ${inc.escalation_level ?? 0} • Opened: ${new Date(inc.opened_at).toUTCString()}`;
    } else {
      return json({ error: 'alert_id or incident_id required' }, 400);
    }

    const { data: prefs } = await supabase.from('tenant_notification_prefs').select('*').eq('tenant_id', tenant_id).maybeSingle();
    if (!prefs) return json({ ok: true, skipped: 'no_prefs' });

    const min = SEVERITY_ORDER[prefs.min_severity as keyof typeof SEVERITY_ORDER] ?? 3;
    const sev = SEVERITY_ORDER[severity as keyof typeof SEVERITY_ORDER] ?? 3;
    if (sev < min) return json({ ok: true, skipped: 'below_severity' });
    if (kind === 'escalation' && !prefs.notify_on_escalation) return json({ ok: true, skipped: 'escalation_off' });
    if (inQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end)) return json({ ok: true, skipped: 'quiet_hours' });

    const accent = SEVERITY_ACCENT[severity] ?? '#0f766e';
    const html = emailShell(
      subject,
      `<p style="margin:0 0 14px;line-height:1.6">${message}</p>
       <p style="margin:0 0 6px;color:#94a3b8;font-size:12px">${detail}</p>
       <p style="margin:14px 0 0;color:#94a3b8;font-size:12px">Open the FactoryAI operator console to acknowledge or escalate.</p>`,
      accent,
    );
    const sms = `[FactoryAI] ${subject}\n${message.slice(0, 120)}`;

    const logs: Array<{ channel: string; recipient: string; status: string; reason?: string; metadata: Record<string, unknown> }> = [];

    if (prefs.email_enabled) {
      for (const to of prefs.email_recipients ?? []) {
        const r = await sendEmail(to, subject, html);
        logs.push({
          channel: 'email',
          recipient: to,
          status: r.ok ? 'sent' : (r.reason === 'no_provider' ? 'skipped_no_provider' : 'failed'),
          reason: r.reason,
          metadata: { kind, severity, subject, provider_id: r.id, detail: r.detail },
        });
      }
    }

    if (prefs.sms_enabled) {
      for (const to of prefs.sms_recipients ?? []) {
        const r = await sendSms(to, sms);
        logs.push({
          channel: 'sms',
          recipient: to,
          status: r.ok ? 'sent' : (r.reason === 'no_provider' ? 'skipped_no_provider' : 'failed'),
          reason: r.reason,
          metadata: { kind, severity, subject, provider_id: r.id, detail: r.detail },
        });
      }
    }

    if (logs.length) {
      await supabase.from('notification_log').insert(logs.map((l) => ({ tenant_id, alert_id, incident_id, ...l })));
    }

    return json({
      ok: true,
      sent: logs.filter((l) => l.status === 'sent').length,
      failed: logs.filter((l) => l.status === 'failed').length,
      attempted: logs.length,
      providers: { email: emailConfigured(), sms: smsConfigured() },
    });
  } catch (e) {
    console.error('notify-alert crash', e);
    return json({ error: (e as Error).message }, 500);
  }
});
