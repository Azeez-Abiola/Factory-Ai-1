-- gemini-2.5-pro/flash are no longer available to new API keys (Google
-- returns 404 telling callers to switch to the 3.x family). Update the
-- column default for new ai_analysis_config rows, and backfill any existing
-- tenant still pointed at the old default so their AI analysis doesn't 404.
ALTER TABLE public.ai_analysis_config
  ALTER COLUMN model SET DEFAULT 'google/gemini-3.6-flash';

UPDATE public.ai_analysis_config
SET model = 'google/gemini-3.6-flash'
WHERE model IN ('google/gemini-2.5-pro', 'google/gemini-2.5-flash', 'google/gemini-2.5-flash-lite');
