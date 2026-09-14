-- Guarded: trigger_notify_alert() was created directly on the live database
-- and was never captured by a migration, so a fresh deploy from this
-- migration history doesn't have it. Skip the REVOKE rather than fail.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'trigger_notify_alert'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.trigger_notify_alert() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;