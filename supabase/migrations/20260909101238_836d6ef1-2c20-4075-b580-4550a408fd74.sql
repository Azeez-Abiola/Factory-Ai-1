
-- 1. Keep the global access level in sync with each person's site membership
CREATE OR REPLACE FUNCTION public.tenant_role_to_app_role(_role text)
RETURNS app_role
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'owner' THEN 'tenant_admin'::app_role
    WHEN 'admin' THEN 'tenant_admin'::app_role
    WHEN 'manager' THEN 'manager'::app_role
    WHEN 'operator' THEN 'operator'::app_role
    ELSE 'viewer'::app_role
  END
$$;

CREATE OR REPLACE FUNCTION public.sync_user_roles_from_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := COALESCE(NEW.user_id, OLD.user_id);
  _desired app_role;
BEGIN
  SELECT MIN(public.tenant_role_to_app_role(tm.role)::text)::app_role
    INTO _desired
  FROM public.tenant_members tm
  WHERE tm.user_id = _uid;

  -- rank: tenant_admin > manager > operator > viewer (pick strongest)
  SELECT r INTO _desired FROM (
    SELECT public.tenant_role_to_app_role(tm.role) AS r,
           CASE public.tenant_role_to_app_role(tm.role)
             WHEN 'tenant_admin' THEN 1 WHEN 'manager' THEN 2
             WHEN 'operator' THEN 3 ELSE 4 END AS rank
    FROM public.tenant_members tm WHERE tm.user_id = _uid
  ) s ORDER BY rank LIMIT 1;

  IF _desired IS NULL THEN
    _desired := 'viewer'::app_role;
  END IF;

  -- never downgrade a super admin
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'super_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _uid AND role <> _desired;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, _desired)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_roles ON public.tenant_members;
CREATE TRIGGER trg_sync_user_roles
AFTER INSERT OR UPDATE OF role OR DELETE ON public.tenant_members
FOR EACH ROW EXECUTE FUNCTION public.sync_user_roles_from_membership();

-- Backfill existing memberships
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.tenant_members LOOP
    UPDATE public.tenant_members SET role = role WHERE user_id = r.user_id;
  END LOOP;
END $$;

-- 2. Protect a site from losing its last owner
CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner')
     OR (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner') THEN
    IF (SELECT COUNT(*) FROM public.tenant_members
         WHERE tenant_id = OLD.tenant_id AND role = 'owner') <= 1 THEN
      RAISE EXCEPTION 'This site must keep at least one owner';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_owner ON public.tenant_members;
CREATE TRIGGER trg_prevent_last_owner
BEFORE UPDATE OR DELETE ON public.tenant_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_owner_removal();

-- 3. Let site admins see member email addresses
CREATE OR REPLACE FUNCTION public.tenant_member_emails(_tenant_id uuid)
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.tenant_member_emails(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.tenant_member_emails(uuid) TO authenticated;
