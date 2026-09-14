/**
 * Shared email + SMS delivery helpers.
 *
 * Email is sent directly through Resend's API with our own RESEND_API_KEY.
 * SMS is parked for now (email-only notifications) — smsConfigured() always
 * reports false so callers skip it and record a `no_provider` attempt
 * instead of erroring. Re-wire sendSms to Twilio's REST API directly when
 * SMS comes back into scope.
 */

export interface DeliveryResult {
  ok: boolean;
  reason?: string;
  detail?: string;
  id?: string;
}

const RESEND_API = 'https://api.resend.com/emails';

function resendKey() {
  return Deno.env.get('RESEND_API_KEY');
}

export function emailConfigured() {
  return Boolean(resendKey());
}

export function smsConfigured() {
  return false;
}

export function fromAddress() {
  return Deno.env.get('ALERT_FROM_EMAIL') ?? 'FactoryAI <onboarding@resend.dev>';
}

export async function sendEmail(to: string, subject: string, html: string): Promise<DeliveryResult> {
  const key = resendKey();
  if (!key) return { ok: false, reason: 'no_provider' };

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
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

export async function sendSms(_to: string, _body: string): Promise<DeliveryResult> {
  return { ok: false, reason: 'no_provider' };
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
