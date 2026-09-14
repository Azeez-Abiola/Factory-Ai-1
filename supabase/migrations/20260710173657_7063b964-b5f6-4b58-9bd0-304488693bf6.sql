
CREATE TABLE public.policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  natural_language text NOT NULL,
  compiled_prompt text,
  compiled_rule jsonb,
  category text NOT NULL DEFAULT 'safety',
  severity text NOT NULL DEFAULT 'medium',
  scope_zones text[] NOT NULL DEFAULT '{}',
  scope_cameras text[] NOT NULL DEFAULT '{}',
  active_hours jsonb NOT NULL DEFAULT '{"start":"00:00","end":"23:59","days":["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policies TO authenticated;
GRANT ALL ON public.policies TO service_role;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View policies" ON public.policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage policies" ON public.policies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'tenant_admin'));
CREATE TRIGGER trg_policies_updated BEFORE UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  policy_id uuid REFERENCES public.policies(id) ON DELETE SET NULL,
  trigger_source text NOT NULL DEFAULT 'ai_vision',
  conditions jsonb NOT NULL DEFAULT '{"all":[]}'::jsonb,
  confidence_threshold numeric NOT NULL DEFAULT 0.75,
  debounce_seconds int NOT NULL DEFAULT 30,
  cooldown_seconds int NOT NULL DEFAULT 300,
  notification_channels text[] NOT NULL DEFAULT ARRAY['in_app'],
  escalation_minutes int NOT NULL DEFAULT 15,
  auto_assign_role text,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_rules TO authenticated;
GRANT ALL ON public.alert_rules TO service_role;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View alert rules" ON public.alert_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage alert rules" ON public.alert_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'tenant_admin'));
CREATE TRIGGER trg_alert_rules_updated BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.policy_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid REFERENCES public.policies(id) ON DELETE CASCADE,
  alert_rule_id uuid REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  camera_id text,
  zone text,
  severity text NOT NULL DEFAULT 'medium',
  confidence numeric,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_violations TO authenticated;
GRANT ALL ON public.policy_violations TO service_role;
ALTER TABLE public.policy_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View violations" ON public.policy_violations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Log violations" ON public.policy_violations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins update violations" ON public.policy_violations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'tenant_admin'));
