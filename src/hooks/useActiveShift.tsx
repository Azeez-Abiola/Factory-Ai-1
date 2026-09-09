import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";

export interface ActiveShiftInfo {
  id: string;
  name: string;
  status: string;
  started_at: string;
}

/** Tracks whether the current site has a shift on duty right now. */
export const useActiveShift = () => {
  const { activeTenantId } = useTenants();
  const [shift, setShift] = useState<ActiveShiftInfo | null>(null);
  const [pending, setPending] = useState<ActiveShiftInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeTenantId) {
      setShift(null);
      setPending(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("shifts")
      .select("id,name,status,started_at")
      .eq("tenant_id", activeTenantId)
      .in("status", ["active", "pending_handover"])
      .order("started_at", { ascending: false });
    const rows = (data ?? []) as ActiveShiftInfo[];
    setShift(rows.find((r) => r.status === "active") ?? null);
    setPending(rows.find((r) => r.status === "pending_handover") ?? null);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!activeTenantId) return;
    const channel = supabase
      .channel(`active-shift:${activeTenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shifts", filter: `tenant_id=eq.${activeTenantId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTenantId, load]);

  return { shift, pending, loading, refresh: load };
};
