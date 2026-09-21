ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS local_stream_url text,
  ADD COLUMN IF NOT EXISTS local_stream_type text NOT NULL DEFAULT 'mjpeg',
  ADD COLUMN IF NOT EXISTS local_snapshot_url text,
  ADD COLUMN IF NOT EXISTS local_direct_enabled boolean NOT NULL DEFAULT false;