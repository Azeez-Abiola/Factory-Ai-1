ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

CREATE TABLE public.site_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id),
  site_name text NOT NULL,
  location text,
  estimated_cameras integer NOT NULL DEFAULT 1,
  expected_go_live date,
  justification text,
  contact_email text,
  contact_phone text,
  status text NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_requests TO authenticated;
GRANT ALL ON public.site_requests TO service_role;

ALTER TABLE public.site_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their tenant site requests"
  ON public.site_requests FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Members can create site requests"
  ON public.site_requests FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Requester can update pending requests"
  ON public.site_requests FOR UPDATE TO authenticated
  USING (requested_by = auth.uid() AND status = 'pending')
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Admins can review site requests"
  ON public.site_requests FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.tenant_role(tenant_id, auth.uid()) IN ('owner', 'admin')
    OR (public.has_role(auth.uid(), 'tenant_admin') AND public.is_tenant_member(tenant_id, auth.uid()))
  )
  WITH CHECK (true);

CREATE POLICY "Requester can delete pending requests"
  ON public.site_requests FOR DELETE TO authenticated
  USING (
    (requested_by = auth.uid() AND status = 'pending')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE INDEX idx_site_requests_tenant ON public.site_requests(tenant_id, created_at DESC);
CREATE INDEX idx_site_requests_status ON public.site_requests(status);

CREATE TRIGGER trg_site_requests_updated
  BEFORE UPDATE ON public.site_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();