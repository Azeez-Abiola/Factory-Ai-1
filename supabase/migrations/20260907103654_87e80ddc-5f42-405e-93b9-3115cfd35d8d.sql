CREATE TABLE public.site_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  zone_type text NOT NULL DEFAULT 'production',
  x numeric NOT NULL DEFAULT 0.05,
  y numeric NOT NULL DEFAULT 0.05,
  width numeric NOT NULL DEFAULT 0.25,
  height numeric NOT NULL DEFAULT 0.25,
  color text NOT NULL DEFAULT 'primary',
  description text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_zones TO authenticated;
GRANT ALL ON public.site_zones TO service_role;

ALTER TABLE public.site_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view site zones"
ON public.site_zones FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can insert site zones"
ON public.site_zones FOR INSERT TO authenticated
WITH CHECK (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update site zones"
ON public.site_zones FOR UPDATE TO authenticated
USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can delete site zones"
ON public.site_zones FOR DELETE TO authenticated
USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_site_zones_tenant ON public.site_zones(tenant_id);

CREATE TRIGGER trg_site_zones_updated
BEFORE UPDATE ON public.site_zones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();