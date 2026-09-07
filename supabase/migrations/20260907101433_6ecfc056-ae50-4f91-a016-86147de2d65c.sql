
CREATE TABLE public.tenant_ai_budgets (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  monthly_limit_usd numeric NOT NULL DEFAULT 50,
  alert_threshold_pct integer NOT NULL DEFAULT 80,
  hard_stop boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  last_alert_pct integer NOT NULL DEFAULT 0,
  last_alert_period date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_ai_budgets TO authenticated;
GRANT ALL ON public.tenant_ai_budgets TO service_role;
ALTER TABLE public.tenant_ai_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read tenant ai budget" ON public.tenant_ai_budgets
FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins insert tenant ai budget" ON public.tenant_ai_budgets
FOR INSERT TO authenticated
WITH CHECK (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'tenant_admin'));

CREATE POLICY "Admins update tenant ai budget" ON public.tenant_ai_budgets
FOR UPDATE TO authenticated
USING (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'tenant_admin'))
WITH CHECK (public.tenant_role(tenant_id, auth.uid()) IN ('owner','admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'tenant_admin'));

CREATE TRIGGER trg_tenant_ai_budgets_updated
BEFORE UPDATE ON public.tenant_ai_budgets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  camera_id uuid REFERENCES public.cameras(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'live_inference',
  model text,
  media text NOT NULL DEFAULT 'image',
  scene_changed boolean NOT NULL DEFAULT true,
  scene_delta numeric,
  cost_usd numeric NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read tenant ai usage" ON public.ai_usage_events
FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_ai_usage_tenant_created ON public.ai_usage_events (tenant_id, created_at DESC);
CREATE INDEX idx_ai_usage_camera ON public.ai_usage_events (camera_id);

CREATE OR REPLACE FUNCTION public.ai_budget_status(_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'tenant_id', _tenant_id,
    'period_start', date_trunc('month', now()),
    'monthly_limit_usd', COALESCE(b.monthly_limit_usd, 50),
    'alert_threshold_pct', COALESCE(b.alert_threshold_pct, 80),
    'hard_stop', COALESCE(b.hard_stop, true),
    'enabled', COALESCE(b.enabled, true),
    'spend_usd', COALESCE(u.spend, 0),
    'pct_used', CASE WHEN COALESCE(b.monthly_limit_usd, 50) > 0
      THEN ROUND((COALESCE(u.spend, 0) / COALESCE(b.monthly_limit_usd, 50) * 100)::numeric, 2) ELSE 0 END,
    'analyzed_frames', COALESCE(u.analyzed, 0),
    'calls', COALESCE(u.calls, 0)
  )
  FROM (SELECT 1) s
  LEFT JOIN public.tenant_ai_budgets b ON b.tenant_id = _tenant_id
  LEFT JOIN LATERAL (
    SELECT SUM(cost_usd) AS spend,
           COUNT(*) FILTER (WHERE scene_changed) AS analyzed,
           COUNT(*) AS calls
    FROM public.ai_usage_events e
    WHERE e.tenant_id = _tenant_id AND e.created_at >= date_trunc('month', now())
  ) u ON true;
$$;

REVOKE EXECUTE ON FUNCTION public.ai_budget_status(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ai_budget_status(uuid) TO authenticated, service_role;
