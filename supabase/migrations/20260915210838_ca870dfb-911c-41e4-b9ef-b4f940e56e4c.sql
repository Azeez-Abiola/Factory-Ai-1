DROP TRIGGER IF EXISTS alerts_notify_trigger ON public.alerts;
DROP FUNCTION IF EXISTS public.trigger_notify_alert();
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_notify_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, net
AS $$
BEGIN
  PERFORM net.http_post(
    url:='https://zipwhudzvvosedllampr.supabase.co/functions/v1/notify-alert',
    headers:='{"Content-Type": "application/json", "apikey": "sb_publishable_WqOJxxtqk98x85sO3Oy8fQ_OcjNCGY4"}'::jsonb,
    body:=jsonb_build_object('alert_id', NEW.id::text, 'kind', 'alert')
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.trigger_notify_alert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_notify_alert() TO service_role;
CREATE TRIGGER alerts_notify_trigger
AFTER INSERT ON public.alerts
FOR EACH ROW
EXECUTE FUNCTION public.trigger_notify_alert();