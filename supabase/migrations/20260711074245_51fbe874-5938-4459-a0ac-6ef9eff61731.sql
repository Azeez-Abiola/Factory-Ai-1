
-- Resolution tasks for supervisor workflow on incidents
CREATE TABLE public.resolution_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
  alert_id UUID REFERENCES public.alerts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | in_progress | blocked | completed | cancelled
  priority TEXT NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resolution_tasks TO authenticated;
GRANT ALL ON public.resolution_tasks TO service_role;

ALTER TABLE public.resolution_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view resolution tasks"
  ON public.resolution_tasks FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can create resolution tasks"
  ON public.resolution_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Supervisors and assignees can update tasks"
  ON public.resolution_tasks FOR UPDATE TO authenticated
  USING (
    public.is_tenant_member(tenant_id, auth.uid())
    AND (
      public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin','supervisor')
      OR assigned_to = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can delete tasks"
  ON public.resolution_tasks FOR DELETE TO authenticated
  USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin'));

CREATE TRIGGER update_resolution_tasks_updated_at
  BEFORE UPDATE ON public.resolution_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_resolution_tasks_tenant ON public.resolution_tasks(tenant_id);
CREATE INDEX idx_resolution_tasks_incident ON public.resolution_tasks(incident_id);
CREATE INDEX idx_resolution_tasks_status ON public.resolution_tasks(status);

-- Enable realtime
ALTER TABLE public.resolution_tasks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.resolution_tasks;
