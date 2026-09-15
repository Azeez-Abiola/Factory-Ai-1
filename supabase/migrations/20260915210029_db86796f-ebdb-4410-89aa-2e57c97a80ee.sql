REVOKE ALL ON FUNCTION public.accept_tenant_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_tenant_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.tenant_member_emails(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_member_emails(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.tenant_role(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_role(uuid, uuid) TO authenticated, service_role;