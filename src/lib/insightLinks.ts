import { mockInsights, AIInsight } from "@/data/extendedMockData";
import { Alert, AlertCategory, mockAlerts } from "@/data/mockData";

// Map an alert category to the insight category that "contains" it analytically.
const alertToInsightCategory: Record<AlertCategory, AIInsight["category"][]> = {
  safety: ["safety"],
  quality: ["quality"],
  downtime: ["efficiency", "cost"],
  productivity: ["efficiency"],
};

// Map an insight category to the alert categories it covers.
const insightToAlertCategories: Record<AIInsight["category"], AlertCategory[]> = {
  safety: ["safety"],
  quality: ["quality"],
  efficiency: ["productivity", "downtime"],
  cost: ["downtime"],
};

export const insightCategoryForAlert = (alert: Alert): AIInsight | null => {
  const cats = alertToInsightCategory[alert.category] || [];
  return mockInsights.find((i) => cats.includes(i.category)) || null;
};

export const alertsForInsight = (insight: AIInsight, limit = 5): Alert[] => {
  const cats = insightToAlertCategories[insight.category] || [];
  return mockAlerts
    .filter((a) => cats.includes(a.category))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
};

export const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
