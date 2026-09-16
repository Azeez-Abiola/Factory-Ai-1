DROP POLICY IF EXISTS "Requester can update pending requests" ON public.site_requests;
CREATE POLICY "Requester can update pending requests"
ON public.site_requests
FOR UPDATE
TO authenticated
USING (requested_by = auth.uid() AND status = 'pending')
WITH CHECK (
  requested_by = auth.uid()
  AND is_tenant_member(tenant_id, auth.uid())
  AND status = 'pending'
);

DROP POLICY IF EXISTS "Admins can review site requests" ON public.site_requests;
CREATE POLICY "Admins can review site requests"
ON public.site_requests
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin')
  OR tenant_role(tenant_id, auth.uid()) IN ('owner', 'admin')
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin')
  OR tenant_role(tenant_id, auth.uid()) IN ('owner', 'admin')
);

CREATE OR REPLACE FUNCTION public.protect_tenant_platform_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin')
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

DROP TRIGGER IF EXISTS trg_protect_tenant_platform_fields ON public.tenants;
CREATE TRIGGER trg_protect_tenant_platform_fields
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.protect_tenant_platform_fields();