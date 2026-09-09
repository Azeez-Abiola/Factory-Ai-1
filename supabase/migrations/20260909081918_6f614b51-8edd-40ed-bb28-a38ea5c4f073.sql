CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reference text NOT NULL,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'safety',
  status text NOT NULL DEFAULT 'pending',
  score integer NOT NULL DEFAULT 0,
  findings_count integer NOT NULL DEFAULT 0,
  period_start timestamptz,
  period_end timestamptz,
  summary text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by uuid REFERENCES auth.users(id),
  generated_by_name text NOT NULL DEFAULT 'AI System',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_tenant_created ON public.reports (tenant_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read reports" ON public.reports
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant members create reports" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant members update reports" ON public.reports
  FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant admins delete reports" ON public.reports
  FOR DELETE TO authenticated
  USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin','tenant_admin','manager') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_reports_updated BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();