
REVOKE EXECUTE ON FUNCTION public.camera_heartbeat(uuid, text, text, text, integer) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.camera_heartbeat(uuid, text, text, text, integer) TO service_role;
