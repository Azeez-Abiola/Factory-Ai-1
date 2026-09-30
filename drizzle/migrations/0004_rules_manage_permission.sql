DROP POLICY IF EXISTS "Tenant members manage policies" ON public.policies;
DROP POLICY IF EXISTS "Admins manage policies" ON public.policies;
CREATE POLICY "Permitted members manage policies" ON public.policies FOR ALL TO authenticated
USING (tenant_id IS NOT NULL AND private.has_tenant_permission(tenant_id, 'rules.manage'))
WITH CHECK (tenant_id IS NOT NULL AND private.has_tenant_permission(tenant_id, 'rules.manage'));

DROP POLICY IF EXISTS "Tenant members manage alert rules" ON public.alert_rules;
DROP POLICY IF EXISTS "Admins manage alert rules" ON public.alert_rules;
CREATE POLICY "Permitted members manage alert rules" ON public.alert_rules FOR ALL TO authenticated
USING (tenant_id IS NOT NULL AND private.has_tenant_permission(tenant_id, 'rules.manage'))
WITH CHECK (tenant_id IS NOT NULL AND private.has_tenant_permission(tenant_id, 'rules.manage'));