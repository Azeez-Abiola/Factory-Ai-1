GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_tenant_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.tenant_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.tenant_member_emails(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.accept_tenant_invitation(text) TO authenticated;