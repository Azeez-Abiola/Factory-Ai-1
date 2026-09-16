CREATE TABLE public.tenant_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','manager','operator','viewer')),
  permission_key text NOT NULL CHECK (permission_key ~ '^[a-z_]+\.[a-z_]+$'),
  allowed boolean NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, role, permission_key),
  CHECK (role <> 'owner' OR allowed = true)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_role_permissions TO authenticated;
GRANT ALL ON public.tenant_role_permissions TO service_role;
ALTER TABLE public.tenant_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant admins view role permissions" ON public.tenant_role_permissions FOR SELECT TO authenticated
USING (private.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR private.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Tenant admins create role permissions" ON public.tenant_role_permissions FOR INSERT TO authenticated
WITH CHECK ((private.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR private.has_role(auth.uid(), 'super_admin')) AND role <> 'owner' AND updated_by = auth.uid());
CREATE POLICY "Tenant admins update role permissions" ON public.tenant_role_permissions FOR UPDATE TO authenticated
USING ((private.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR private.has_role(auth.uid(), 'super_admin')) AND role <> 'owner')
WITH CHECK ((private.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR private.has_role(auth.uid(), 'super_admin')) AND role <> 'owner' AND updated_by = auth.uid());
CREATE POLICY "Tenant admins delete role permissions" ON public.tenant_role_permissions FOR DELETE TO authenticated
USING ((private.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR private.has_role(auth.uid(), 'super_admin')) AND role <> 'owner');
CREATE TRIGGER trg_tenant_role_permissions_updated BEFORE UPDATE ON public.tenant_role_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.billing_plans (
  plan_key text PRIMARY KEY CHECK (plan_key IN ('starter','professional','enterprise')),
  label text NOT NULL,
  base_fee numeric(12,2) NOT NULL CHECK (base_fee >= 0),
  per_camera_fee numeric(12,2) NOT NULL CHECK (per_camera_fee >= 0),
  allowance text NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_plans TO authenticated;
GRANT ALL ON public.billing_plans TO service_role;
GRANT UPDATE ON public.billing_plans TO authenticated;
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users view billing plans" ON public.billing_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins update billing plans" ON public.billing_plans FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'))
WITH CHECK (private.has_role(auth.uid(), 'super_admin') AND updated_by = auth.uid());
INSERT INTO public.billing_plans(plan_key,label,base_fee,per_camera_fee,allowance) VALUES
('starter','Starter',0,15,'Up to 5 cameras'),
('professional','Professional',499,25,'Up to 50 cameras'),
('enterprise','Enterprise',1499,40,'Unlimited cameras');
CREATE TRIGGER trg_billing_plans_updated BEFORE UPDATE ON public.billing_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION private.default_tenant_permission(_role text, _permission_key text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE
    WHEN _role = 'owner' THEN true
    WHEN _role = 'admin' THEN _permission_key <> ALL (ARRAY['billing.view','billing.manage','system.view'])
    WHEN _role = 'manager' THEN _permission_key = ANY (ARRAY['portal.view','dashboard.view','alerts.view','investigations.view','investigations.manage','investigations.export','cameras.view','floor_plan.view','quality.view','insights.view','reports.view','reports.create','reports.export','maintenance.view','maintenance.manage'])
    WHEN _role = 'operator' THEN _permission_key = ANY (ARRAY['dashboard.view','shift.view','shift.manage','alerts.view','alerts.acknowledge','alerts.resolve','alerts.export','investigations.view','investigations.manage','investigations.export','cameras.view','floor_plan.view','quality.view','insights.view','reports.view','reports.export','maintenance.view','maintenance.manage'])
    WHEN _role = 'viewer' THEN _permission_key = ANY (ARRAY['dashboard.view','alerts.view','investigations.view','cameras.view','floor_plan.view','quality.view','insights.view','reports.view','maintenance.view'])
    ELSE false END
$$;

CREATE OR REPLACE FUNCTION private.has_tenant_permission(_tenant_id uuid, _permission_key text, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT CASE
    WHEN private.has_role(_user_id, 'super_admin') THEN true
    WHEN _user_id IS DISTINCT FROM auth.uid() AND auth.role() <> 'service_role' THEN false
    ELSE COALESCE(
      (SELECT rp.allowed FROM public.tenant_role_permissions rp
       WHERE rp.tenant_id = _tenant_id
         AND rp.role = private.tenant_role(_tenant_id, _user_id)
         AND rp.permission_key = _permission_key),
      private.default_tenant_permission(private.tenant_role(_tenant_id, _user_id), _permission_key)
    )
  END
$$;
REVOKE ALL ON FUNCTION private.default_tenant_permission(text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_tenant_permission(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.default_tenant_permission(text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_tenant_permission(uuid,text,uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.has_tenant_permission(_tenant_id uuid, _permission_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog AS $$
  SELECT private.has_tenant_permission(_tenant_id, _permission_key, auth.uid())
$$;
REVOKE ALL ON FUNCTION public.has_tenant_permission(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_tenant_permission(uuid,text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Operators+ update tenant alerts" ON public.alerts;
CREATE POLICY "Permission holders update tenant alerts" ON public.alerts FOR UPDATE TO authenticated
USING (private.has_tenant_permission(tenant_id, 'alerts.acknowledge'))
WITH CHECK (private.has_tenant_permission(tenant_id, 'alerts.acknowledge'));
DROP POLICY IF EXISTS "Operators+ manage tenant incidents" ON public.incidents;
CREATE POLICY "Permission holders manage tenant incidents" ON public.incidents FOR ALL TO authenticated
USING (private.has_tenant_permission(tenant_id, 'investigations.manage'))
WITH CHECK (private.has_tenant_permission(tenant_id, 'investigations.manage'));
DROP POLICY IF EXISTS "Operators+ manage tenant cameras" ON public.cameras;
CREATE POLICY "Permission holders manage tenant cameras" ON public.cameras FOR ALL TO authenticated
USING (private.has_tenant_permission(tenant_id, 'admin_ai.manage'))
WITH CHECK (private.has_tenant_permission(tenant_id, 'admin_ai.manage'));

COMMENT ON TABLE public.tenant_role_permissions IS 'Tenant-specific overrides to the built-in role permission matrix.';
COMMENT ON FUNCTION public.has_tenant_permission(uuid,text) IS 'Caller-safe tenant permission check used by the application; elevated lookup remains outside the exposed API schema.';