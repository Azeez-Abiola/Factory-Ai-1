
CREATE TABLE IF NOT EXISTS public.tenant_notification_prefs (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  email_recipients TEXT[] NOT NULL DEFAULT '{}',
  sms_recipients TEXT[] NOT NULL DEFAULT '{}',
  min_severity TEXT NOT NULL DEFAULT 'medium',
  notify_on_escalation BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_notification_prefs TO authenticated;
GRANT ALL ON public.tenant_notification_prefs TO service_role;

ALTER TABLE public.tenant_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view notification prefs"
ON public.tenant_notification_prefs
FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant admins/owners can manage notification prefs"
ON public.tenant_notification_prefs
FOR ALL TO authenticated
USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin'))
WITH CHECK (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin'));

CREATE TRIGGER update_tenant_notification_prefs_updated_at
BEFORE UPDATE ON public.tenant_notification_prefs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
