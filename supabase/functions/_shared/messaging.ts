/**
 * Shared email + SMS delivery helpers.
 *
 * Both providers are reached through the Lovable connector gateway, so the
 * only secrets needed are the connector connection keys plus LOVABLE_API_KEY.
 * When a provider is not connected the helper returns a structured
 * `no_provider` result instead of throwing, so callers can still record the
 * attempt in notification_log and surface the gap in the admin UI.
 */

export interface DeliveryResult {
  ok: boolean;
  reason?: string;
  detail?: string;
  id?: string;
}

const GATEWAY = 'https://connector-gateway.lovable.dev';

function resendKey() {
  return Deno.env.get('RESEND_API_KEY') ?? Deno.env.get('RESEND_CONNECTOR_API_KEY');
}

function twilioKey() {
  return Deno.env.get('TWILIO_API_KEY') ?? Deno.env.get('TWILIO_CONNECTOR_API_KEY');
}

export function emailConfigured() {
  return Boolean(resendKey() && Deno.env.get('LOVABLE_API_KEY'));
}

export function smsConfigured() {
  return Boolean(twilioKey() && Deno.env.get('LOVABLE_API_KEY') && Deno.env.get('TWILIO_FROM_NUMBER'));
}

export function fromAddress() {
  return Deno.env.get('ALERT_FROM_EMAIL') ?? 'FactoryAI <onboarding@resend.dev>';
}

export async function sendEmail(to: string, subject: string, html: string): Promise<DeliveryResult> {
  const key = resendKey();
  const lovKey = Deno.env.get('LOVABLE_API_KEY');
  if (!key || !lovKey) return { ok: false, reason: 'no_provider' };

  const res = await fetch(`${GATEWAY}/resend/emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${lovKey}`,
      'X-Connection-Api-Key': key,
    },
    body: JSON.stringify({ from: fromAddress(), to: [to], subject, html }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`resend send failed [${res.status}]: ${text}`);
    return { ok: false, reason: `resend_${res.status}`, detail: text.slice(0, 400) };
  }
  let id: string | undefined;
  try { id = JSON.parse(text)?.id; } catch { /* body not json */ }
  return { ok: true, id };
}

export async function sendSms(to: string, body: string): Promise<DeliveryResult> {
  const key = twilioKey();
  const from = Deno.env.get('TWILIO_FROM_NUMBER');
  const lovKey = Deno.env.get('LOVABLE_API_KEY');
  if (!key || !from || !lovKey) return { ok: false, reason: 'no_provider' };

  const res = await fetch(`${GATEWAY}/twilio/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${lovKey}`,
      'X-Connection-Api-Key': key,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`twilio send failed [${res.status}]: ${text}`);
    return { ok: false, reason: `twilio_${res.status}`, detail: text.slice(0, 400) };
  }
  let id: string | undefined;
  try { id = JSON.parse(text)?.sid; } catch { /* body not json */ }
  return { ok: true, id };
}

export function emailShell(heading: string, bodyHtml: string, accent = '#0f766e') {
  return `<div style="font-family:Inter,Segoe UI,sans-serif;background:#0b1220;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#111a2b;border:1px solid #1e293b;border-radius:14px;overflow:hidden">
    <div style="padding:18px 24px;border-bottom:1px solid #1e293b">
      <span style="color:${accent};font-weight:700;letter-spacing:.08em;font-size:12px">FACTORYAI</span>
    </div>
    <div style="padding:24px;color:#e2e8f0">
      <h2 style="margin:0 0 12px;font-size:18px;color:#f8fafc">${heading}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #1e293b;color:#64748b;font-size:11px">
      Sent by FactoryAI • ${new Date().toUTCString()}
    </div>
  </div>
</div>`;
}
