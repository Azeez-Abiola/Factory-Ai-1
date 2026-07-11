
-- Cameras: continuous inference fields
ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS inference_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inference_interval_seconds integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS last_inference_at timestamptz,
  ADD COLUMN IF NOT EXISTS inference_status text NOT NULL DEFAULT 'idle';

-- Per-tenant notification preferences
CREATE TABLE public.tenant_notification_prefs (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  email_recipients text[] NOT NULL DEFAULT '{}',
  sms_recipients text[] NOT NULL DEFAULT '{}',
  min_severity text NOT NULL DEFAULT 'high',
  notify_on_escalation boolean NOT NULL DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_notification_prefs TO authenticated;
GRANT ALL ON public.tenant_notification_prefs TO service_role;
ALTER TABLE public.tenant_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view notification prefs"
ON public.tenant_notification_prefs FOR SELECT TO authenticated
USING (is_tenant_member(tenant_id, auth.uid()) OR has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins manage notification prefs"
ON public.tenant_notification_prefs FOR ALL TO authenticated
USING (tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR has_role(auth.uid(),'super_admin'))
WITH CHECK (tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR has_role(auth.uid(),'super_admin'));

CREATE TRIGGER tenant_notification_prefs_updated
BEFORE UPDATE ON public.tenant_notification_prefs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notification delivery log
CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  alert_id uuid REFERENCES public.alerts(id) ON DELETE SET NULL,
  incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  channel text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view notification log"
ON public.notification_log FOR SELECT TO authenticated
USING (is_tenant_member(tenant_id, auth.uid()) OR has_role(auth.uid(),'super_admin'));

CREATE INDEX idx_notification_log_tenant ON public.notification_log(tenant_id, created_at DESC);
CREATE INDEX idx_cameras_inference_due ON public.cameras(inference_enabled, last_inference_at)
  WHERE inference_enabled = true;
