
ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS stream_url text,
  ADD COLUMN IF NOT EXISTS stream_type text NOT NULL DEFAULT 'hls',
  ADD COLUMN IF NOT EXISTS retention_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS heartbeat_interval_seconds integer NOT NULL DEFAULT 60;

ALTER TABLE public.cameras REPLICA IDENTITY FULL;
ALTER TABLE public.alerts  REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='cameras'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.cameras';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='alerts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts';
  END IF;
END $$;
