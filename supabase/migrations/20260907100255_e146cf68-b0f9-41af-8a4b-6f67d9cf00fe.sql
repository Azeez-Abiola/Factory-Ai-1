ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS scene_gating_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS scene_change_threshold numeric NOT NULL DEFAULT 1.2,
  ADD COLUMN IF NOT EXISTS frame_signature text,
  ADD COLUMN IF NOT EXISTS last_frame_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_scene_delta numeric,
  ADD COLUMN IF NOT EXISTS frames_skipped integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frames_analyzed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_idle_seconds integer NOT NULL DEFAULT 900;