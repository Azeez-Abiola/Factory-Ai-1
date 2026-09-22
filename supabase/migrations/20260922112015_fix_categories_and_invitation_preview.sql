-- Mirrors drizzle/migrations/0001_fix_categories_and_invitation_preview.sql,
-- applied directly to upstream's live database via Drizzle and never added
-- to this migrations folder (same gap as the two earlier drizzle-only
-- migrations already mirrored here).

-- 1. Normalise legacy string-only detection categories into full objects.
update public.ai_analysis_config c
set categories = (
  select jsonb_agg(
    case when jsonb_typeof(e) = 'string'
      then jsonb_build_object(
        'id', e #>> '{}',
        'label', initcap(replace(e #>> '{}', '_', ' ')),
        'description', '',
        'severity_hint', 'medium',
        'enabled', true)
      else e end
    order by ord)
  from jsonb_array_elements(c.categories) with ordinality t(e, ord)
)
where jsonb_typeof(categories) = 'array'
  and exists (select 1 from jsonb_array_elements(c.categories) x where jsonb_typeof(x) = 'string');

-- 2. Let an invitee (signed out, or signed in with another email) read the
--    invitation behind a token so the accept page can show it.
create or replace function public.invitation_preview(_token text)
returns table (email text, role text, status text, expires_at timestamptz, tenant_name text)
language sql
stable
security definer
set search_path = public
as $$
  select i.email, i.role, i.status, i.expires_at, t.name
  from public.tenant_invitations i
  join public.tenants t on t.id = i.tenant_id
  where i.token = _token
  limit 1
$$;

revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;
