CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role' OR _user_id = auth.uid() THEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role' OR _user_id = auth.uid() THEN EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_id = _tenant_id AND user_id = _user_id
    )
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.tenant_role(_tenant_id uuid, _user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role' OR _user_id = auth.uid() THEN (
      SELECT role FROM public.tenant_members
      WHERE tenant_id = _tenant_id AND user_id = _user_id
      LIMIT 1
    )
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.tenant_member_emails(_tenant_id uuid)
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT tm.user_id, u.email::text
  FROM public.tenant_members tm
  JOIN auth.users u ON u.id = tm.user_id
  WHERE tm.tenant_id = _tenant_id
    AND (
      public.tenant_role(_tenant_id, auth.uid()) IN ('owner','admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
$$;

CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  _inv public.tenant_invitations%ROWTYPE;
  _email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF _email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _inv FROM public.tenant_invitations
   WHERE token = _token AND status = 'pending' AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation invalid or expired';
  END IF;

  IF lower(_inv.email) <> lower(_email) THEN
    RAISE EXCEPTION 'Invitation email does not match your account';
  END IF;

  INSERT INTO public.tenant_members(tenant_id, user_id, role)
  VALUES (_inv.tenant_id, auth.uid(), _inv.role)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.tenant_invitations
     SET status = 'accepted', accepted_at = now(), updated_at = now()
   WHERE id = _inv.id;

  RETURN _inv.tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_tenant_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_member_emails(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_tenant_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_role(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_member_emails(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.has_role(uuid, public.app_role) IS 'SECURITY DEFINER required to avoid recursive user_roles RLS; caller may inspect only their own role unless using service_role.';
COMMENT ON FUNCTION public.is_tenant_member(uuid, uuid) IS 'SECURITY DEFINER required to avoid recursive tenant_members RLS; caller may inspect only their own membership unless using service_role.';
COMMENT ON FUNCTION public.tenant_role(uuid, uuid) IS 'SECURITY DEFINER required to avoid recursive tenant_members RLS; caller may inspect only their own tenant role unless using service_role.';
COMMENT ON FUNCTION public.tenant_member_emails(uuid) IS 'SECURITY DEFINER required to read auth email addresses; internally restricted to tenant owners/admins and super admins.';
COMMENT ON FUNCTION public.accept_tenant_invitation(text) IS 'SECURITY DEFINER required to accept an invite before membership exists; validates authentication, token expiry, and exact account email.';