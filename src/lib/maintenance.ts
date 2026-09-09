export interface EquipmentAssetRow {
  id: string;
  tenant_id: string;
  name: string;
  zone: string | null;
  asset_type: string;
  camera_id: string | null;
  status: string;
  health_score: number;
  failure_probability: number;
  estimated_time_to_failure: string | null;
  anomaly_type: string | null;
  recommendation: string | null;
  last_service_at: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface WorkOrderRow {
  id: string;
  tenant_id: string;
  asset_id: string | null;
  reference: string;
  title: string;
  priority: string;
  status: string;
  assignee_name: string;
  scheduled_date: string | null;
  notes: string | null;
  completion_notes: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface MaintenanceAlertLike {
  id: string;
  type: string | null;
  severity: string | null;
  zone: string | null;
  camera_id: string | null;
  detected_at: string;
}

export type RiskLevel = "critical" | "warning" | "watch";

export interface AssetHealth {
  health: number;
  failureProbability: number;
  riskLevel: RiskLevel;
  anomalyType: string;
  recommendation: string;
  estimatedTimeToFailure: string;
  eventCount: number;
  trendData: { day: string; health: number }[];
}

const SEVERITY_PENALTY: Record<string, number> = { critical: 14, high: 9, medium: 4, low: 1 };

const prettify = (s: string) =>
  s.replace(/[_-]+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());

export const assetAlerts = (asset: EquipmentAssetRow, alerts: MaintenanceAlertLike[]) =>
  alerts.filter((a) => {
    if (asset.camera_id && a.camera_id === asset.camera_id) return true;
    if (asset.zone && a.zone && a.zone.toLowerCase() === asset.zone.toLowerCase()) return true;
    return false;
  });

const penaltyOf = (items: MaintenanceAlertLike[]) =>
  items.reduce((sum, a) => sum + (SEVERITY_PENALTY[(a.severity ?? "low").toLowerCase()] ?? 1), 0);

const timeToFailure = (fp: number) => {
  if (fp >= 80) return "Under 3 days";
  if (fp >= 70) return "3-7 days";
  if (fp >= 50) return "1-3 weeks";
  if (fp >= 30) return "1-2 months";
  return "No near-term risk";
};

const recommendationFor = (risk: RiskLevel, anomaly: string) => {
  switch (risk) {
    case "critical":
      return `Stop-work inspection recommended. ${anomaly} is repeating — schedule a technician today and verify after the fix.`;
    case "warning":
      return `Schedule a service visit this week to check ${anomaly.toLowerCase()} before it escalates.`;
    default:
      return "Condition is stable. Keep it on the routine inspection round.";
  }
};

/** Derive live condition for an asset from its recent camera activity. */
export const computeAssetHealth = (
  asset: EquipmentAssetRow,
  alerts: MaintenanceAlertLike[],
  now: Date = new Date(),
): AssetHealth => {
  const related = assetAlerts(asset, alerts);
  const health = Math.max(0, Math.min(100, 100 - penaltyOf(related)));
  const failureProbability = 100 - health;
  const riskLevel: RiskLevel = failureProbability >= 70 ? "critical" : failureProbability >= 40 ? "warning" : "watch";

  const typeCounts = new Map<string, number>();
  related.forEach((a) => {
    const k = prettify(a.type ?? "Unclassified event");
    typeCounts.set(k, (typeCounts.get(k) ?? 0) + 1);
  });
  const anomalyType =
    [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? asset.anomaly_type ?? "No anomaly detected";

  const trendData: { day: string; health: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() - i);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const window = related.filter((a) => {
      const d = new Date(a.detected_at);
      return d >= start && d <= end;
    });
    trendData.push({
      day: end.toLocaleDateString(undefined, { weekday: "short" }),
      health: Math.max(0, Math.min(100, 100 - penaltyOf(window))),
    });
  }

  return {
    health,
    failureProbability,
    riskLevel,
    anomalyType,
    recommendation: asset.recommendation ?? recommendationFor(riskLevel, anomalyType),
    estimatedTimeToFailure: timeToFailure(failureProbability),
    eventCount: related.length,
    trendData,
  };
};

export const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; barColor: string; dotColor: string }> = {
  critical: {
    label: "Critical",
    color: "bg-destructive/10 text-destructive border-destructive/30",
    barColor: "hsl(0 72% 51%)",
    dotColor: "bg-destructive",
  },
  warning: {
    label: "Warning",
    color: "bg-warning/10 text-warning border-warning/30",
    barColor: "hsl(38 92% 50%)",
    dotColor: "bg-warning",
  },
  watch: {
    label: "Watch",
    color: "bg-primary/10 text-primary border-primary/30",
    barColor: "hsl(172 66% 50%)",
    dotColor: "bg-primary",
  },
};

export const nextWorkOrderReference = (count: number) => `WO-${String(count + 1).padStart(4, "0")}`;
