
-- ============ TABLES FIRST ============
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  parent_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  plan text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active',
  industry text,
  contact_email text,
  contact_phone text,
  address text,
  timezone text DEFAULT 'UTC',
  branding jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;

CREATE TABLE public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_members TO authenticated;
GRANT ALL ON public.tenant_members TO service_role;

CREATE TABLE public.cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  zone text,
  rtsp_url text,
  type text DEFAULT 'IP',
  status text NOT NULL DEFAULT 'offline',
  resolution text,
  last_seen_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cameras_tenant_idx ON public.cameras(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cameras TO authenticated;
GRANT ALL ON public.cameras TO service_role;

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  camera_id uuid REFERENCES public.cameras(id) ON DELETE SET NULL,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  zone text,
  risk_score int,
  detected_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alerts_tenant_idx ON public.alerts(tenant_id);
CREATE INDEX alerts_status_idx ON public.alerts(status);
CREATE INDEX alerts_detected_idx ON public.alerts(detected_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;

CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  alert_id uuid REFERENCES public.alerts(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  severity text DEFAULT 'medium',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incidents_tenant_idx ON public.incidents(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_tenant_idx ON public.audit_log(tenant_id);
CREATE INDEX audit_created_idx ON public.audit_log(created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

-- ============ HELPERS (tables now exist) ============
CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_id = _tenant_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.tenant_role(_tenant_id uuid, _user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.tenant_members WHERE tenant_id = _tenant_id AND user_id = _user_id LIMIT 1
$$;

-- ============ ENABLE RLS ============
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
-- Tenants
CREATE POLICY "Members can view their tenants" ON public.tenants FOR SELECT TO authenticated
  USING (public.is_tenant_member(id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins manage all tenants" ON public.tenants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Tenant owners update their tenant" ON public.tenants FOR UPDATE TO authenticated
  USING (public.tenant_role(id, auth.uid()) IN ('owner','admin'))
  WITH CHECK (public.tenant_role(id, auth.uid()) IN ('owner','admin'));

-- Tenant members
CREATE POLICY "Members can view co-members" ON public.tenant_members FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Owners/admins manage members" ON public.tenant_members FOR ALL TO authenticated
  USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Cameras
CREATE POLICY "Members view tenant cameras" ON public.cameras FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Operators+ manage tenant cameras" ON public.cameras FOR ALL TO authenticated
  USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin','operator') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin','operator') OR public.has_role(auth.uid(), 'super_admin'));

-- Alerts
CREATE POLICY "Members view tenant alerts" ON public.alerts FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Members create tenant alerts" ON public.alerts FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Operators+ update tenant alerts" ON public.alerts FOR UPDATE TO authenticated
  USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin','operator') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin','operator') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins delete tenant alerts" ON public.alerts FOR DELETE TO authenticated
  USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Incidents
CREATE POLICY "Members view tenant incidents" ON public.incidents FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Operators+ manage tenant incidents" ON public.incidents FOR ALL TO authenticated
  USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin','operator') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin','operator') OR public.has_role(auth.uid(), 'super_admin'));

-- Audit log
CREATE POLICY "Admins view tenant audit log" ON public.audit_log FOR SELECT TO authenticated
  USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Members write audit log for their tenant" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid() AND
    (tenant_id IS NULL OR public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
  );

-- ============ TRIGGERS ============
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cameras_updated BEFORE UPDATE ON public.cameras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_alerts_updated BEFORE UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_incidents_updated BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ REALTIME ============
ALTER TABLE public.alerts REPLICA IDENTITY FULL;
ALTER TABLE public.incidents REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
