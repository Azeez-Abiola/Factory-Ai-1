import { supabase } from "@/integrations/supabase/client";

export type ReportType = "safety" | "quality" | "audit" | "productivity";
export type ReportStatus = "passed" | "failed" | "pending";

export interface ReportFinding {
  id: string;
  title: string;
  severity: string;
  zone: string;
  camera: string;
  status: string;
  occurrences: number;
  description: string;
  correctiveAction: string;
  detected_at: string;
}

export interface ReportData {
  findings: ReportFinding[];
  byCategory: { category: string; count: number }[];
  bySeverity: { name: string; value: number }[];
  trend: { label: string; score: number }[];
  byArea: { area: string; score: number }[];
  totals: {
    alerts: number;
    resolved: number;
    open: number;
    cameras: number;
    incidents: number;
  };
}

export interface ReportRow {
  id: string;
  tenant_id: string;
  reference: string;
  title: string;
  type: ReportType;
  status: ReportStatus;
  score: number;
  findings_count: number;
  period_start: string | null;
  period_end: string | null;
  summary: string | null;
  data: ReportData;
  generated_by: string | null;
  generated_by_name: string;
  created_at: string;
}

const SEVERITY_WEIGHT: Record<string, number> = { critical: 8, high: 5, medium: 3, low: 1 };

const TYPE_KEYWORDS: Record<ReportType, string[]> = {
  safety: ["ppe", "safety", "hazard", "helmet", "vest", "restricted", "forklift", "fall", "fire", "ergonom"],
  quality: ["quality", "defect", "label", "package", "contaminat", "misalign", "surface"],
  productivity: ["downtime", "idle", "throughput", "productivity", "stoppage", "bottleneck"],
  audit: [],
};

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  safety: "Safety",
  quality: "Quality",
  audit: "Audit",
  productivity: "Productivity",
};

interface AlertLike {
  id: string;
  type: string | null;
  title: string | null;
  description: string | null;
  severity: string | null;
  status: string | null;
  zone: string | null;
  camera_id: string | null;
  detected_at: string;
  metadata: Record<string, unknown> | null;
}

const matchesType = (a: AlertLike, type: ReportType) => {
  const keys = TYPE_KEYWORDS[type];
  if (!keys.length) return true;
  const hay = `${a.type ?? ""} ${a.title ?? ""} ${a.description ?? ""}`.toLowerCase();
  return keys.some((k) => hay.includes(k));
};

const prettify = (s: string) =>
  s.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());

const recommendation = (severity: string) => {
  switch (severity) {
    case "critical":
      return "Stop-work review required. Assign an owner today and verify the fix within 24 hours.";
    case "high":
      return "Assign corrective action this shift and re-check on the next inspection round.";
    case "medium":
      return "Add to the weekly improvement list and brief the shift supervisor.";
    default:
      return "Monitor and address during routine housekeeping.";
  }
};

/** Build a report from the site's real alerts, incidents and cameras over a period. */
export const buildReport = async (
  tenantId: string,
  type: ReportType,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ score: number; status: ReportStatus; findings_count: number; summary: string; data: ReportData }> => {
  const [alertsRes, camerasRes, incidentsRes, historyRes] = await Promise.all([
    supabase
      .from("alerts")
      .select("id,type,title,description,severity,status,zone,camera_id,detected_at,metadata")
      .eq("tenant_id", tenantId)
      .gte("detected_at", periodStart.toISOString())
      .lte("detected_at", periodEnd.toISOString())
      .order("detected_at", { ascending: false })
      .limit(1000),
    supabase.from("cameras").select("id,name,zone").eq("tenant_id", tenantId),
    supabase
      .from("incidents")
      .select("id,opened_at")
      .eq("tenant_id", tenantId)
      .gte("opened_at", periodStart.toISOString())
      .lte("opened_at", periodEnd.toISOString()),
    supabase
      .from("alerts")
      .select("id,type,title,description,severity,detected_at")
      .eq("tenant_id", tenantId)
      .gte("detected_at", new Date(periodEnd.getTime() - 1000 * 60 * 60 * 24 * 180).toISOString())
      .lte("detected_at", periodEnd.toISOString())
      .limit(5000),
  ]);

  const cameraMap = new Map<string, { name: string; zone: string | null }>();
  (camerasRes.data ?? []).forEach((c) => cameraMap.set(c.id, { name: c.name, zone: c.zone }));

  const all = (alertsRes.data ?? []) as AlertLike[];
  const scoped = all.filter((a) => matchesType(a, type));

  // Group repeat alerts of the same kind in the same zone into one finding.
  const groups = new Map<string, AlertLike[]>();
  scoped.forEach((a) => {
    const key = `${(a.type ?? "issue").toLowerCase()}|${(a.zone ?? cameraMap.get(a.camera_id ?? "")?.zone ?? "unzoned").toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  });

  const findings: ReportFinding[] = [...groups.values()]
    .map((items) => {
      const first = items[0];
      const sev = ["critical", "high", "medium", "low"].find((s) => items.some((i) => (i.severity ?? "").toLowerCase() === s)) ?? "low";
      const resolved = items.every((i) => (i.status ?? "").toLowerCase() === "resolved");
      const cam = cameraMap.get(first.camera_id ?? "");
      return {
        id: first.id,
        title: first.title ?? prettify(first.type ?? "Issue detected"),
        severity: sev,
        zone: first.zone ?? cam?.zone ?? "Unassigned zone",
        camera: cam?.name ?? "Unassigned camera",
        status: resolved ? "resolved" : "open",
        occurrences: items.length,
        description:
          first.description ??
          `${items.length} detection${items.length > 1 ? "s" : ""} of ${prettify(first.type ?? "this issue").toLowerCase()} during the reporting period.`,
        correctiveAction: recommendation(sev),
        detected_at: first.detected_at,
      };
    })
    .sort((a, b) => (SEVERITY_WEIGHT[b.severity] ?? 0) * b.occurrences - (SEVERITY_WEIGHT[a.severity] ?? 0) * a.occurrences);

  const byCategoryMap = new Map<string, number>();
  scoped.forEach((a) => {
    const label = prettify(a.type ?? "Other");
    byCategoryMap.set(label, (byCategoryMap.get(label) ?? 0) + 1);
  });
  const byCategory = [...byCategoryMap.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const bySeverity = ["critical", "high", "medium", "low"].map((name) => ({
    name: prettify(name),
    value: scoped.filter((a) => (a.severity ?? "").toLowerCase() === name).length,
  }));

  const penalty = scoped.reduce((sum, a) => {
    const w = SEVERITY_WEIGHT[(a.severity ?? "low").toLowerCase()] ?? 1;
    const closed = (a.status ?? "").toLowerCase() === "resolved";
    return sum + (closed ? w * 0.4 : w);
  }, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  // 6-month score trend using the same penalty model.
  const history = (historyRes.data ?? []) as { severity: string | null; detected_at: string; type: string | null; title: string | null; description: string | null }[];
  const trend: { label: string; score: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const end = new Date(periodEnd);
    end.setMonth(end.getMonth() - i + 1, 1);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setMonth(start.getMonth() - 1);
    const bucket = history.filter((h) => {
      const d = new Date(h.detected_at);
      return d >= start && d < end && matchesType(h as AlertLike, type);
    });
    const p = bucket.reduce((s, h) => s + (SEVERITY_WEIGHT[(h.severity ?? "low").toLowerCase()] ?? 1), 0);
    trend.push({
      label: start.toLocaleString(undefined, { month: "short" }),
      score: Math.max(0, Math.min(100, Math.round(100 - p))),
    });
  }

  const byArea = byCategory.slice(0, 6).map((c) => ({
    area: c.category.length > 14 ? `${c.category.slice(0, 13)}…` : c.category,
    score: Math.max(0, 100 - c.count * 6),
  }));

  const resolved = scoped.filter((a) => (a.status ?? "").toLowerCase() === "resolved").length;
  const data: ReportData = {
    findings,
    byCategory,
    bySeverity,
    trend,
    byArea,
    totals: {
      alerts: scoped.length,
      resolved,
      open: scoped.length - resolved,
      cameras: cameraMap.size,
      incidents: incidentsRes.data?.length ?? 0,
    },
  };

  const status: ReportStatus = score >= 75 ? "passed" : "failed";
  const summary =
    scoped.length === 0
      ? `No ${REPORT_TYPE_LABELS[type].toLowerCase()} events were detected across ${cameraMap.size} camera${cameraMap.size === 1 ? "" : "s"} during this period.`
      : `${scoped.length} ${REPORT_TYPE_LABELS[type].toLowerCase()} event${scoped.length === 1 ? "" : "s"} across ${cameraMap.size} camera${cameraMap.size === 1 ? "" : "s"}, grouped into ${findings.length} finding${findings.length === 1 ? "" : "s"}. ${resolved} of ${scoped.length} were closed out, leaving ${scoped.length - resolved} open.`;

  return { score, status, findings_count: findings.length, summary, data };
};

export const emptyReportData = (): ReportData => ({
  findings: [],
  byCategory: [],
  bySeverity: [],
  trend: [],
  byArea: [],
  totals: { alerts: 0, resolved: 0, open: 0, cameras: 0, incidents: 0 },
});
