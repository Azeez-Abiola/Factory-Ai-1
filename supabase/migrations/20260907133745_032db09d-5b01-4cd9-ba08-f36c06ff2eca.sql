ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS regions_of_interest jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reference_match_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reference_match_threshold numeric NOT NULL DEFAULT 0.06,
  ADD COLUMN IF NOT EXISTS reference_samples jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS clip_analysis_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clip_seconds integer NOT NULL DEFAULT 5;