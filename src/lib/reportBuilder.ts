import { supabase } from "@/integrations/supabase/client";
import { buildReportWith, type FocusArea, type ReportType } from "../../supabase/functions/_shared/reportCore";

export * from "../../supabase/functions/_shared/reportCore";

/** Build a report from the site's real alerts, incidents and cameras over a period. */
export const buildReport = (
  tenantId: string,
  type: ReportType,
  periodStart: Date,
  periodEnd: Date,
  scope?: { cameraIds?: string[]; zones?: string[] },
  focus?: FocusArea,
) => buildReportWith(supabase, tenantId, type, periodStart, periodEnd, scope, focus);
