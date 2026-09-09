import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  plan: string;
  status: string;
  industry: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  timezone: string | null;
  branding: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const ACTIVE_KEY = "factoryai.activeTenantId";

/**
 * Loads all tenants the current user can access (RLS-scoped),
 * plus the active tenant id persisted in localStorage.
 */
export function useTenants() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_KEY),
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setTenants([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Load tenants failed:", error);
      setTenants([]);
    } else {
      const rows = (data ?? []) as TenantRow[];
      setTenants(rows);
      // If no active tenant, pick first
      if (!activeTenantId && rows.length > 0) {
        setActiveTenantIdState(rows[0].id);
        localStorage.setItem(ACTIVE_KEY, rows[0].id);
      }
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const setActiveTenantId = useCallback((id: string | null) => {
    setActiveTenantIdState(id);
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
    window.dispatchEvent(new CustomEvent(ACTIVE_EVENT, { detail: id }));
  }, []);

  // Keep every mounted consumer in sync when the site is switched anywhere.
  useEffect(() => {
    const onChange = (e: Event) => {
      const id = (e as CustomEvent<string | null>).detail ?? localStorage.getItem(ACTIVE_KEY);
      setActiveTenantIdState(id);
    };
    window.addEventListener(ACTIVE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(ACTIVE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? null;

  return { tenants, activeTenant, activeTenantId, setActiveTenantId, loading, reload: load };
}
