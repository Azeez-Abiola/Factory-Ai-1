import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { emailShell, sendEmail } from '../_shared/messaging.ts';

/**
 * send-invite: emails a tenant invitation link to the invitee and records the
 * attempt in notification_log. Caller must be signed in and be an admin of the
 * tenant the invitation belongs to.
 */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { invitation_id, app_url } = await req.json();
    if (!invitation_id || typeof invitation_id !== 'string') {
      return json({ error: 'invitation_id is required' }, 400);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: userData } = await admin.auth.getUser(jwt);
    const uid = userData?.user?.id;
    if (!uid) return json({ error: 'unauthorized' }, 401);

    const { data: invite } = await admin
      .from('tenant_invitations')
      .select('id, tenant_id, email, role, token, status, expires_at')
      .eq('id', invitation_id)
      .maybeSingle();
    if (!invite) return json({ error: 'invitation not found' }, 404);

    const { data: tenantRole } = await admin.rpc('tenant_role', { _tenant_id: invite.tenant_id, _user_id: uid });
    const { data: superAdmin } = await admin.rpc('has_role', { _user_id: uid, _role: 'super_admin' });
    if (tenantRole !== 'tenant_admin' && !superAdmin) return json({ error: 'forbidden' }, 403);

    const { data: tenant } = await admin.from('tenants').select('name').eq('id', invite.tenant_id).maybeSingle();
    const base = (typeof app_url === 'string' && app_url.startsWith('http') ? app_url : '').replace(/\/$/, '');
    const link = `${base}/invite/${invite.token}`;
    const expires = new Date(invite.expires_at).toUTCString();

    const html = emailShell(
      `You've been invited to ${tenant?.name ?? 'FactoryAI'}`,
      `<p style="margin:0 0 14px;line-height:1.6">You have been invited to join <strong>${tenant?.name ?? 'the workspace'}</strong> on FactoryAI as <strong>${invite.role.replace('_', ' ')}</strong>.</p>
       <p style="margin:0 0 20px"><a href="${link}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600">Accept invitation</a></p>
       <p style="margin:0 0 6px;color:#94a3b8;font-size:12px">Or paste this link into your browser:</p>
       <p style="margin:0 0 14px;color:#94a3b8;font-size:12px;word-break:break-all">${link}</p>
       <p style="margin:0;color:#94a3b8;font-size:12px">This invitation expires on ${expires}.</p>`,
    );

    const result = await sendEmail(invite.email, `Your invitation to ${tenant?.name ?? 'FactoryAI'}`, html);

    await admin.from('notification_log').insert({
      tenant_id: invite.tenant_id,
      channel: 'email',
      recipient: invite.email,
      status: result.ok ? 'sent' : (result.reason === 'no_provider' ? 'skipped_no_provider' : 'failed'),
      reason: result.reason,
      metadata: { kind: 'invitation', role: invite.role, invitation_id: invite.id, detail: result.detail },
    });

    if (!result.ok) {
      return json({
        ok: false,
        reason: result.reason,
        message: result.reason === 'no_provider'
          ? 'Email delivery is not connected yet — the invite link was created but no email was sent.'
          : `Email provider rejected the send (${result.reason}).`,
        link,
      }, result.reason === 'no_provider' ? 200 : 502);
    }

    return json({ ok: true, sent_to: invite.email, link });
  } catch (e) {
    console.error('send-invite crash', e);
    return json({ error: (e as Error).message }, 500);
  }
});
