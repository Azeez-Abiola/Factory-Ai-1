
-- Tenant invitations
CREATE TABLE public.tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email, status)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_invitations TO authenticated;
GRANT ALL ON public.tenant_invitations TO service_role;

ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invitations in their tenant"
ON public.tenant_invitations
FOR ALL
TO authenticated
USING (
  tenant_role(tenant_id, auth.uid()) IN ('owner','admin')
  OR has_role(auth.uid(),'super_admin')
)
WITH CHECK (
  tenant_role(tenant_id, auth.uid()) IN ('owner','admin')
  OR has_role(auth.uid(),'super_admin')
);

CREATE POLICY "Invitees can view their own pending invitation"
ON public.tenant_invitations
FOR SELECT
TO authenticated
USING (lower(email) = lower((auth.jwt() ->> 'email')));

CREATE INDEX idx_tenant_invitations_tenant ON public.tenant_invitations(tenant_id);
CREATE INDEX idx_tenant_invitations_email ON public.tenant_invitations(lower(email));

CREATE TRIGGER update_tenant_invitations_updated_at
BEFORE UPDATE ON public.tenant_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow tenant members to see co-member profiles (for member list display)
CREATE POLICY "Co-members can view each other's profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_members tm1
    JOIN public.tenant_members tm2 ON tm1.tenant_id = tm2.tenant_id
    WHERE tm1.user_id = auth.uid() AND tm2.user_id = profiles.id
  )
);

-- Accept invitation RPC
CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.tenant_invitations%ROWTYPE;
  _email text;
BEGIN
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

REVOKE ALL ON FUNCTION public.accept_tenant_invitation(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(text) TO authenticated;
