
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.alert_rules ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.policy_violations ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

UPDATE public.policies SET tenant_id = (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
UPDATE public.alert_rules ar SET tenant_id = COALESCE((SELECT tenant_id FROM public.policies WHERE id = ar.policy_id), (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)) WHERE tenant_id IS NULL;
UPDATE public.policy_violations pv SET tenant_id = COALESCE(
  (SELECT tenant_id FROM public.policies WHERE id = pv.policy_id),
  (SELECT tenant_id FROM public.cameras WHERE id::text = pv.camera_id),
  (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)
) WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_policies_tenant ON public.policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON public.alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_violations_tenant ON public.policy_violations(tenant_id);

DROP POLICY IF EXISTS "View policies" ON public.policies;
DROP POLICY IF EXISTS "Manage policies" ON public.policies;
CREATE POLICY "Tenant members view policies" ON public.policies FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "Tenant members manage policies" ON public.policies FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "View alert rules" ON public.alert_rules;
DROP POLICY IF EXISTS "Manage alert rules" ON public.alert_rules;
CREATE POLICY "Tenant members view alert rules" ON public.alert_rules FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "Tenant members manage alert rules" ON public.alert_rules FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "View violations" ON public.policy_violations;
DROP POLICY IF EXISTS "Log violations" ON public.policy_violations;
DROP POLICY IF EXISTS "Manage violations" ON public.policy_violations;
CREATE POLICY "Tenant members view violations" ON public.policy_violations FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "Tenant members log violations" ON public.policy_violations FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "Tenant members update violations" ON public.policy_violations FOR UPDATE TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()));

REVOKE EXECUTE ON FUNCTION public.camera_heartbeat(uuid, text, text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.camera_heartbeat(uuid, text, text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.camera_heartbeat(uuid, text, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.camera_heartbeat(uuid, text, text, text, integer) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
