import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenants } from "@/hooks/useTenants";
import { defaultPermission, type PermissionKey, type TenantRole } from "@/lib/permissions";

export function useTenantPermissions() {
  const { user, hasRole } = useAuth();
  const { activeTenantId } = useTenants();
  const [role, setRole] = useState<TenantRole | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !activeTenantId) { setRole(null); setOverrides({}); setLoading(false); return; }
    setLoading(true);
    const [memberResult, permissionResult] = await Promise.all([
      supabase.from("tenant_members").select("role").eq("tenant_id", activeTenantId).eq("user_id", user.id).maybeSingle(),
      supabase.from("tenant_role_permissions").select("role,permission_key,allowed").eq("tenant_id", activeTenantId),
    ]);
    const nextRole = memberResult.data?.role as TenantRole | undefined;
    setRole(nextRole ?? null);
    setOverrides(Object.fromEntries((permissionResult.data ?? []).filter((row) => row.role === nextRole).map((row) => [row.permission_key, row.allowed])));
    setLoading(false);
  }, [activeTenantId, user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!activeTenantId) return;
    const channel = supabase.channel(`effective-permissions-${activeTenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tenant_role_permissions", filter: `tenant_id=eq.${activeTenantId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTenantId, load]);

  const can = useCallback((key: PermissionKey) => {
    if (hasRole("super_admin")) return true;
    if (!role) return false;
    return overrides[key] ?? defaultPermission(role, key);
  }, [hasRole, overrides, role]);

  return useMemo(() => ({ can, role, loading, reload: load }), [can, role, loading, load]);
}
