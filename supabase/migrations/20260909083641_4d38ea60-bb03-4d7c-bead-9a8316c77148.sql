CREATE TABLE public.equipment_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  zone text,
  asset_type text NOT NULL DEFAULT 'machine',
  camera_id uuid REFERENCES public.cameras(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  health_score integer NOT NULL DEFAULT 100,
  failure_probability integer NOT NULL DEFAULT 0,
  estimated_time_to_failure text,
  anomaly_type text,
  recommendation text,
  last_service_at timestamptz,
  health_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_assets TO authenticated;
GRANT ALL ON public.equipment_assets TO service_role;
ALTER TABLE public.equipment_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read equipment" ON public.equipment_assets FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Staff insert equipment" ON public.equipment_assets FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Staff update equipment" ON public.equipment_assets FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins delete equipment" ON public.equipment_assets FOR DELETE TO authenticated
  USING (public.tenant_role(tenant_id, auth.uid()) IN ('admin','owner','manager') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_equipment_assets_updated BEFORE UPDATE ON public.equipment_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_equipment_assets_tenant ON public.equipment_assets(tenant_id);

CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.equipment_assets(id) ON DELETE SET NULL,
  reference text NOT NULL,
  title text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'scheduled',
  assignee_name text NOT NULL,
  assigned_to uuid REFERENCES auth.users(id),
  scheduled_date date,
  notes text,
  completion_notes text,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read work orders" ON public.work_orders FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Staff insert work orders" ON public.work_orders FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Staff update work orders" ON public.work_orders FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins delete work orders" ON public.work_orders FOR DELETE TO authenticated
  USING (public.tenant_role(tenant_id, auth.uid()) IN ('admin','owner','manager') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_work_orders_updated BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_work_orders_tenant ON public.work_orders(tenant_id);
CREATE INDEX idx_work_orders_asset ON public.work_orders(asset_id);