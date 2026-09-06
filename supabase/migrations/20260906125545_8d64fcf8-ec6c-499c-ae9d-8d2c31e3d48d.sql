ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS snapshot_url text;
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS last_inference_error text;

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'safety',
  impact text NOT NULL DEFAULT 'medium',
  trend text NOT NULL DEFAULT 'stable',
  metric_label text,
  metric_value text,
  recommendation text NOT NULL DEFAULT '',
  confidence integer NOT NULL DEFAULT 70,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  period_start timestamptz,
  period_end timestamptz,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_insights TO authenticated;
GRANT ALL ON public.ai_insights TO service_role;

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read tenant insights"
ON public.ai_insights FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins delete tenant insights"
ON public.ai_insights FOR DELETE TO authenticated
USING (public.tenant_role(tenant_id, auth.uid()) = 'tenant_admin' OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS ai_insights_tenant_generated_idx ON public.ai_insights (tenant_id, generated_at DESC);