
REVOKE ALL ON FUNCTION public.sync_user_roles_from_membership() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_last_owner_removal() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.tenant_role_to_app_role(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.tenant_member_emails(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tenant_member_emails(uuid) TO authenticated;
