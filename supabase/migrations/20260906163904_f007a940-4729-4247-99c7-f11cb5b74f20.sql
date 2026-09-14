CREATE TABLE public.shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  supervisor_id uuid NOT NULL REFERENCES auth.users(id),
  incoming_supervisor_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  accepted_at timestamp with time zone,
  accepted_by uuid REFERENCES auth.users(id),
  opening_notes text,
  handover_notes text,
  acceptance_notes text,
  key_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  unresolved_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view shifts"
ON public.shifts FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant members can start shifts"
ON public.shifts FOR INSERT TO authenticated
WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()) AND supervisor_id = auth.uid());

CREATE POLICY "Tenant members can update shifts"
ON public.shifts FOR UPDATE TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()))
WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant admins can delete shifts"
ON public.shifts FOR DELETE TO authenticated
USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE UNIQUE INDEX shifts_one_active_per_tenant
  ON public.shifts (tenant_id) WHERE status = 'active';
CREATE INDEX shifts_tenant_started_idx ON public.shifts (tenant_id, started_at DESC);

CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();