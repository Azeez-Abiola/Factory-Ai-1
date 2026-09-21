-- Self-signups now require super_admin approval before they can reach /app.
-- Accounts created via the invite flow (tenant_members) or the Admin API are
-- unaffected by this gate in practice, since the frontend only blocks on an
-- explicit 'pending'/'rejected' status.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending';

-- Grandfather every account that already existed before this migration —
-- otherwise every current user gets locked out the moment this lands.
UPDATE public.profiles SET approval_status = 'approved' WHERE approval_status = 'pending';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Super admins can act on any profile's approval fields (they already have
-- unrestricted SELECT on profiles per "Super admins can view all profiles").
CREATE POLICY "Super admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Email addresses live in auth.users, not exposed via PostgREST — this
-- mirrors the existing tenant_member_emails() pattern for the same reason.
-- Calls private.has_role() directly (not the public wrapper) since that
-- wrapper is SECURITY INVOKER and would otherwise run as this function's
-- own DEFINER context rather than checking against the real caller.
CREATE OR REPLACE FUNCTION public.pending_signups()
RETURNS TABLE(user_id uuid, email text, display_name text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT p.id, u.email::text, p.display_name, p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.approval_status = 'pending'
    AND private.has_role(auth.uid(), 'super_admin')
  ORDER BY p.created_at ASC
$$;

REVOKE ALL ON FUNCTION public.pending_signups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pending_signups() TO authenticated, service_role;
