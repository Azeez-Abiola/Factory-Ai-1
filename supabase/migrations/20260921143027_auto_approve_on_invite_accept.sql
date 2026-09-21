-- Accepting a legitimate tenant invitation is itself the vetting step — a
-- tenant admin already vouched for this person by inviting them, so they
-- shouldn't also be stuck behind the separate self-signup approval gate
-- (supabase/migrations/20260921142207_signup_approval_gate.sql).
CREATE OR REPLACE FUNCTION private.accept_tenant_invitation(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  _inv public.tenant_invitations%ROWTYPE;
  _email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF _email IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _inv FROM public.tenant_invitations
   WHERE token = _token AND status = 'pending' AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation invalid or expired'; END IF;
  IF lower(_inv.email) <> lower(_email) THEN
    RAISE EXCEPTION 'Invitation email does not match your account';
  END IF;
  INSERT INTO public.tenant_members(tenant_id, user_id, role)
  VALUES (_inv.tenant_id, auth.uid(), _inv.role)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  UPDATE public.tenant_invitations
     SET status = 'accepted', accepted_at = now(), updated_at = now()
   WHERE id = _inv.id;
  UPDATE public.profiles
     SET approval_status = 'approved'
   WHERE id = auth.uid() AND approval_status <> 'approved';
  RETURN _inv.tenant_id;
END;
$$;
