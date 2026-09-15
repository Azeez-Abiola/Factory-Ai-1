DROP POLICY IF EXISTS "Admins manage alert rules" ON public.alert_rules;
CREATE POLICY "Admins manage alert rules"
ON public.alert_rules
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.tenant_role(tenant_id, auth.uid()) IN ('owner', 'admin')
)
WITH CHECK (
  tenant_id IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.tenant_role(tenant_id, auth.uid()) IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Admins manage policies" ON public.policies;
CREATE POLICY "Admins manage policies"
ON public.policies
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.tenant_role(tenant_id, auth.uid()) IN ('owner', 'admin')
)
WITH CHECK (
  tenant_id IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.tenant_role(tenant_id, auth.uid()) IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Admins update violations" ON public.policy_violations;
CREATE POLICY "Admins update violations"
ON public.policy_violations
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.tenant_role(tenant_id, auth.uid()) IN ('owner', 'admin')
)
WITH CHECK (
  tenant_id IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.tenant_role(tenant_id, auth.uid()) IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Admins insert tenant ai budget" ON public.tenant_ai_budgets;
CREATE POLICY "Admins insert tenant ai budget"
ON public.tenant_ai_budgets
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.tenant_role(tenant_id, auth.uid()) IN ('owner', 'admin')
);

DROP POLICY IF EXISTS "Admins update tenant ai budget" ON public.tenant_ai_budgets;
CREATE POLICY "Admins update tenant ai budget"
ON public.tenant_ai_budgets
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.tenant_role(tenant_id, auth.uid()) IN ('owner', 'admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.tenant_role(tenant_id, auth.uid()) IN ('owner', 'admin')
);