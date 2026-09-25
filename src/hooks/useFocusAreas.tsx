import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AUDIT_FOCUS, focusAreasFromCategories, type FocusArea } from "@/lib/reportBuilder";

/** Report focus areas for a site = its enabled detection categories (AI Model & Categories) + Audit. */
export const useFocusAreas = (tenantId: string | null) => {
  const [areas, setAreas] = useState<FocusArea[]>([AUDIT_FOCUS]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) { setAreas([AUDIT_FOCUS]); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from("ai_analysis_config").select("categories").eq("tenant_id", tenantId).maybeSingle();
      if (!cancelled) { setAreas(focusAreasFromCategories(data?.categories)); setLoading(false); }
    };
    load();
    const ch = supabase
      .channel(`focus-areas-${tenantId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_analysis_config", filter: `tenant_id=eq.${tenantId}` }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [tenantId]);

  return { areas, loading };
};
