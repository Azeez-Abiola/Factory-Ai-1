
CREATE TABLE public.ai_analysis_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  system_prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-pro',
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_analysis_config TO authenticated;
GRANT ALL ON public.ai_analysis_config TO service_role;

ALTER TABLE public.ai_analysis_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read ai config"
  ON public.ai_analysis_config FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant admins can insert ai config"
  ON public.ai_analysis_config FOR INSERT TO authenticated
  WITH CHECK (
    public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Tenant admins can update ai config"
  ON public.ai_analysis_config FOR UPDATE TO authenticated
  USING (
    public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Tenant admins can delete ai config"
  ON public.ai_analysis_config FOR DELETE TO authenticated
  USING (
    public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE TRIGGER update_ai_analysis_config_updated_at
  BEFORE UPDATE ON public.ai_analysis_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
