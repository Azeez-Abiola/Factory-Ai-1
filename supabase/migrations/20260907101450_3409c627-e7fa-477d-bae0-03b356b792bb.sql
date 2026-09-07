
CREATE OR REPLACE FUNCTION public.ai_budget_status(_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
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
