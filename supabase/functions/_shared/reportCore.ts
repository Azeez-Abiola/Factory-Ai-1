// Shared report builder — used by the console (src/lib/reportBuilder.ts) and the scheduled-report worker.
// deno-lint-ignore-file no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export type BuiltinReportType = "safety" | "quality" | "audit" | "productivity" | "security" | "hygiene" | "maintenance";
/** Built-in type, or "cat:<detection category id>" for a focus area linked to a site's detection category. */
export type ReportType = string;

/** A focus area: which alerts a report covers. */
export interface FocusArea {
  value: string; // report type stored on the report
  label: string;
  keywords: string[]; // empty = every alert
  description?: string;
}

const STOP = new Set(["and", "the", "for", "with", "from", "into", "zone", "area", "control", "compliance", "risk", "entry", "other"]);

/** Turn a detection category from AI Model & Categories into a report focus area. */
export const focusFromCategory = (c: { id: string; label?: string; description?: string }): FocusArea => {
  const words = [
    c.id.toLowerCase(),
    c.id.replace(/[_-]+/g, " ").toLowerCase(),
    ...`${c.id} ${c.label ?? ""}`.toLowerCase().split(/[^a-z0-9]+/),
  ].filter((w) => w.length >= 3 && !STOP.has(w));
  return {
    value: `cat:${c.id}`,
    label: (c.label || c.id).trim(),
    keywords: [...new Set(words)],
    description: c.description || undefined,
  };
};

export const AUDIT_FOCUS: FocusArea = { value: "audit", label: "Audit (all focus areas)", keywords: [], description: "Every alert, whatever the category." };
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
  focus?: FocusArea | null;
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

const TYPE_KEYWORDS: Record<BuiltinReportType, string[]> = {
  safety: ["ppe", "safety", "hazard", "helmet", "vest", "restricted", "forklift", "fall", "fire", "ergonom"],
  quality: ["quality", "defect", "label", "package", "contaminat", "misalign", "surface"],
  productivity: ["downtime", "idle", "throughput", "productivity", "stoppage", "bottleneck"],
  security: ["security", "theft", "intrud", "unauthor", "tamper", "loiter", "after-hours", "after hours", "asset", "trespass"],
  hygiene: ["hygiene", "housekeep", "clean", "spill", "contaminat", "waste", "litter", "glove", "hairnet"],
  maintenance: ["maintenance", "equipment", "fault", "leak", "vibration", "overheat", "wear", "breakdown", "anomaly"],
  audit: [],
};

export const REPORT_TYPE_LABELS: Record<string, string> = {
  safety: "Safety",
  quality: "Quality",
  audit: "Audit (all focus areas)",
  productivity: "Productivity",
  security: "Security & theft control",
  hygiene: "Hygiene & housekeeping",
  maintenance: "Equipment & maintenance",
};

export const REPORT_TYPES: BuiltinReportType[] = [
  "safety",
  "quality",
  "security",
  "hygiene",
  "maintenance",
  "productivity",
  "audit",
];

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

const matchesType = (a: AlertLike, type: ReportType, focus?: FocusArea) => {
  const keys = focus ? focus.keywords : (TYPE_KEYWORDS[type as BuiltinReportType] ?? []);
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
export const buildReportWith = async (
  supabase: Client,
  tenantId: string,
  type: ReportType,
  periodStart: Date,
  periodEnd: Date,
  scope?: { cameraIds?: string[]; zones?: string[] },
  focus?: FocusArea,
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
  (camerasRes.data ?? []).forEach((c: { id: string; name: string; zone: string | null }) => cameraMap.set(c.id, { name: c.name, zone: c.zone }));

  const all = (alertsRes.data ?? []) as AlertLike[];
  const cameraFilter = scope?.cameraIds?.length ? new Set(scope.cameraIds) : null;
  const zoneFilter = scope?.zones?.length ? new Set(scope.zones.map((z) => z.toLowerCase())) : null;
  const scoped = all.filter((a) => {
    if (!matchesType(a, type, focus)) return false;
    if (cameraFilter && !(a.camera_id && cameraFilter.has(a.camera_id))) return false;
    if (zoneFilter) {
      const zone = (a.zone ?? cameraMap.get(a.camera_id ?? "")?.zone ?? "").toLowerCase();
      if (!zoneFilter.has(zone)) return false;
    }
    return true;
  });

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
      return d >= start && d < end && matchesType(h as AlertLike, type, focus);
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
    focus: focus ?? null,
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

  const focusLabel = focus?.label ?? REPORT_TYPE_LABELS[type] ?? type;
  const status: ReportStatus = score >= 75 ? "passed" : "failed";
  const summary =
    scoped.length === 0
      ? `No ${focusLabel.toLowerCase()} events were detected across ${cameraMap.size} camera${cameraMap.size === 1 ? "" : "s"} during this period.`
      : `${scoped.length} ${focusLabel.toLowerCase()} event${scoped.length === 1 ? "" : "s"} across ${cameraMap.size} camera${cameraMap.size === 1 ? "" : "s"}, grouped into ${findings.length} finding${findings.length === 1 ? "" : "s"}. ${resolved} of ${scoped.length} were closed out, leaving ${scoped.length - resolved} open.`;

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

/** Display name of a report's focus area. */
export const reportTypeLabel = (r: { type: string; data?: { focus?: FocusArea | null } | null }) =>
  r.data?.focus?.label ?? REPORT_TYPE_LABELS[r.type] ?? r.type.replace(/^cat:/, "");

/** Focus areas for a site: its enabled detection categories, plus Audit. */
export const focusAreasFromCategories = (cats: unknown): FocusArea[] => {
  const list = Array.isArray(cats) ? cats : [];
  const seen = new Set<string>();
  const out: FocusArea[] = [];
  for (const c of list as { id?: string; label?: string; description?: string; enabled?: boolean }[]) {
    if (!c || typeof c !== "object" || !c.id || c.enabled === false || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(focusFromCategory({ id: c.id, label: c.label, description: c.description }));
  }
  return [...out, AUDIT_FOCUS];
};
