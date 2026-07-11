
CREATE TABLE IF NOT EXISTS public.escalation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  timeout_minutes integer NOT NULL DEFAULT 30 CHECK (timeout_minutes > 0),
  supervisor_ids uuid[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.escalation_policies TO authenticated;
GRANT ALL ON public.escalation_policies TO service_role;

ALTER TABLE public.escalation_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view escalation policies"
  ON public.escalation_policies FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant admins can manage escalation policies"
  ON public.escalation_policies FOR ALL TO authenticated
  USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin'))
  WITH CHECK (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin'));

CREATE TRIGGER update_escalation_policies_updated_at
  BEFORE UPDATE ON public.escalation_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
