CREATE TABLE public.report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'safety',
  frequency text NOT NULL DEFAULT 'weekly',
  run_hour integer NOT NULL DEFAULT 7,
  weekday integer NOT NULL DEFAULT 1,
  month_day integer NOT NULL DEFAULT 1,
  timezone text NOT NULL DEFAULT 'UTC',
  camera_ids text[] NOT NULL DEFAULT '{}',
  zones text[] NOT NULL DEFAULT '{}',
  recipients text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  last_report_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_schedules_freq CHECK (frequency IN ('daily','weekly','monthly')),
  CONSTRAINT report_schedules_hour CHECK (run_hour BETWEEN 0 AND 23),
  CONSTRAINT report_schedules_weekday CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT report_schedules_mday CHECK (month_day BETWEEN 1 AND 28)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_schedules TO authenticated;
GRANT ALL ON public.report_schedules TO service_role;
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view report schedules" ON public.report_schedules FOR SELECT TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'reports.view'));
CREATE POLICY "Creators add report schedules" ON public.report_schedules FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_permission(tenant_id, 'reports.create'));
CREATE POLICY "Creators edit report schedules" ON public.report_schedules FOR UPDATE TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'reports.create'))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'reports.create'));
CREATE POLICY "Creators delete report schedules" ON public.report_schedules FOR DELETE TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'reports.create'));
CREATE INDEX idx_report_schedules_due ON public.report_schedules (next_run_at) WHERE enabled;
CREATE TRIGGER trg_report_schedules_updated BEFORE UPDATE ON public.report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();