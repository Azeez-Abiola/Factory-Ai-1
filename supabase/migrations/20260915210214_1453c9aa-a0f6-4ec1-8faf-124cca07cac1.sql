CREATE OR REPLACE FUNCTION public.protect_tenant_platform_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'super_admin')
     AND (
       NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
     ) THEN
    RAISE EXCEPTION 'Only platform administrators can change plan, status, or hierarchy';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_tenant_platform_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_tenant_platform_fields() TO service_role;