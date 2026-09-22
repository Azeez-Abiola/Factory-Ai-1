-- Platform-wide user directory for super_admin: every signed-up account
-- (any approval status), regardless of tenant membership. Complements
-- pending_signups() which only surfaces the 'pending' subset.
CREATE OR REPLACE FUNCTION public.platform_users()
RETURNS TABLE(user_id uuid, email text, display_name text, approval_status text, created_at timestamptz, last_sign_in_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT p.id, u.email::text, p.display_name, p.approval_status, p.created_at, u.last_sign_in_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE private.has_role(auth.uid(), 'super_admin')
  ORDER BY p.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.platform_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_users() TO authenticated, service_role;
