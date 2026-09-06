CREATE TABLE public.tenant_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'safety',
  unit text NOT NULL DEFAULT '%',
  target numeric NOT NULL DEFAULT 0,
  warning_threshold numeric NOT NULL DEFAULT 0,
  critical_threshold numeric NOT NULL DEFAULT 0,
  direction text NOT NULL DEFAULT 'higher_is_better',
  current_value numeric NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  description text NOT NULL DEFAULT '',
  formula text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_kpis TO authenticated;
GRANT ALL ON public.tenant_kpis TO service_role;
ALTER TABLE public.tenant_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_kpis_select" ON public.tenant_kpis FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "tenant_kpis_write" ON public.tenant_kpis FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin','tenant_admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin','tenant_admin')
);

CREATE TRIGGER trg_tenant_kpis_updated BEFORE UPDATE ON public.tenant_kpis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tenant_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  last_triggered_at timestamptz,
  success_rate numeric NOT NULL DEFAULT 100,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_webhooks TO authenticated;
GRANT ALL ON public.tenant_webhooks TO service_role;
ALTER TABLE public.tenant_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_webhooks_select" ON public.tenant_webhooks FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "tenant_webhooks_write" ON public.tenant_webhooks FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin','tenant_admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin','tenant_admin')
);

CREATE TRIGGER trg_tenant_webhooks_updated BEFORE UPDATE ON public.tenant_webhooks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tenant_kpis_tenant ON public.tenant_kpis(tenant_id);
CREATE INDEX idx_tenant_webhooks_tenant ON public.tenant_webhooks(tenant_id);