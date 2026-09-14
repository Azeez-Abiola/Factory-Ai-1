
-- Escalation policies per tenant
CREATE TABLE public.escalation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default Escalation',
  timeout_minutes integer NOT NULL DEFAULT 30 CHECK (timeout_minutes > 0),
  supervisor_ids uuid[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escalation_policies TO authenticated;
GRANT ALL ON public.escalation_policies TO service_role;
ALTER TABLE public.escalation_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view escalation policies"
  ON public.escalation_policies FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "Admins manage escalation policies"
  ON public.escalation_policies FOR ALL TO authenticated
  USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin','supervisor'))
  WITH CHECK (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin','supervisor'));

CREATE TRIGGER trg_escalation_policies_updated
  BEFORE UPDATE ON public.escalation_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Escalation state on incidents
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_escalation_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_escalated_at timestamptz;

-- Extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
