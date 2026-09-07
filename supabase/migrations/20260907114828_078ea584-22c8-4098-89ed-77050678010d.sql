ALTER TABLE public.ai_analysis_config
  ADD COLUMN IF NOT EXISTS custom_models jsonb NOT NULL DEFAULT '[]'::jsonb;