-- Mirrors drizzle/migrations/0000_camera_onsite_direct_stream.sql, which was
-- applied directly to upstream's live database via Drizzle and never added
-- to this migrations folder, so a fresh `supabase db push` wouldn't pick it
-- up otherwise.
ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS local_stream_url text,
  ADD COLUMN IF NOT EXISTS local_stream_type text NOT NULL DEFAULT 'mjpeg',
  ADD COLUMN IF NOT EXISTS local_snapshot_url text,
  ADD COLUMN IF NOT EXISTS local_direct_enabled boolean NOT NULL DEFAULT false;
