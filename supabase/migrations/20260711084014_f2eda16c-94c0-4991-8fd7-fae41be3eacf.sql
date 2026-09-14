
-- Tenant-level integration settings (gateway base URL, etc.)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Camera production fields: per-camera ingest token, AI model config, credentials
ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS ingest_token text UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  ADD COLUMN IF NOT EXISTS ai_models jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence_threshold integer NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fps integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS ptz_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_enabled boolean NOT NULL DEFAULT true;

-- Backfill tokens for any existing rows missing one
UPDATE public.cameras SET ingest_token = encode(gen_random_bytes(24),'hex') WHERE ingest_token IS NULL;

-- Public heartbeat lookup helper for the edge function (security definer, token-gated)
CREATE OR REPLACE FUNCTION public.camera_heartbeat(
  _camera_id uuid,
  _token text,
  _status text DEFAULT 'online',
  _resolution text DEFAULT NULL,
  _fps integer DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _match boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.cameras
    WHERE id = _camera_id AND ingest_token = _token
  ) INTO _match;

  IF NOT _match THEN
    RETURN false;
  END IF;

  UPDATE public.cameras
     SET last_seen_at = now(),
         status = COALESCE(_status, status),
         resolution = COALESCE(_resolution, resolution),
         fps = COALESCE(_fps, fps),
         updated_at = now()
   WHERE id = _camera_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.camera_heartbeat(uuid, text, text, text, integer) TO anon, authenticated, service_role;
