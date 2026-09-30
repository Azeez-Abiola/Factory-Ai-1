ALTER TABLE public.tenant_notification_prefs
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS reply_to_email text;

CREATE OR REPLACE FUNCTION private.default_tenant_permission(_role text, _permission_key text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE
    WHEN _role = 'owner' THEN true
    WHEN _role = 'admin' THEN _permission_key <> ALL (ARRAY['billing.view','billing.manage','system.view'])
    WHEN _role = 'manager' THEN _permission_key = ANY (ARRAY['portal.view','dashboard.view','alerts.view','investigations.view','investigations.manage','investigations.export','cameras.view','floor_plan.view','quality.view','insights.view','reports.view','reports.create','reports.export','maintenance.view','maintenance.manage','notifications.manage','rules.manage'])
    WHEN _role = 'operator' THEN _permission_key = ANY (ARRAY['dashboard.view','shift.view','shift.manage','alerts.view','alerts.acknowledge','alerts.resolve','alerts.export','investigations.view','investigations.manage','investigations.export','cameras.view','floor_plan.view','quality.view','insights.view','reports.view','reports.export','maintenance.view','maintenance.manage'])
    WHEN _role = 'viewer' THEN _permission_key = ANY (ARRAY['dashboard.view','alerts.view','investigations.view','cameras.view','floor_plan.view','quality.view','insights.view','reports.view','maintenance.view'])
    ELSE false END
$$;

DROP POLICY IF EXISTS "Admins manage notification prefs" ON public.tenant_notification_prefs;
DROP POLICY IF EXISTS "Tenant admins/owners can manage notification prefs" ON public.tenant_notification_prefs;
DROP POLICY IF EXISTS "Permitted members manage notification prefs" ON public.tenant_notification_prefs;
CREATE POLICY "Permitted members manage notification prefs"
ON public.tenant_notification_prefs FOR ALL TO authenticated
USING (private.has_tenant_permission(tenant_id, 'notifications.manage'))
WITH CHECK (private.has_tenant_permission(tenant_id, 'notifications.manage'));