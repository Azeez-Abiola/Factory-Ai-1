import { useSyncExternalStore } from "react";
import {
  incidentTimelines as seedTimelines,
  mockAuditLog as seedAudit,
  TimelineEvent,
  AuditEntry,
} from "@/data/extendedMockData";
import { mockAlerts, Alert } from "@/data/mockData";

// ---------- store ----------
type Timelines = Record<string, TimelineEvent[]>;

let timelines: Timelines = { ...seedTimelines };
let auditLog: AuditEntry[] = [...seedAudit];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// Auto-seed a minimal timeline (detection → creation) for any alert missing one
const ensureTimeline = (alertId: string): TimelineEvent[] => {
  if (timelines[alertId]) return timelines[alertId];
  const alert: Alert | undefined = mockAlerts.find((a) => a.id === alertId);
  if (!alert) return [];
  const base: TimelineEvent[] = [
    {
      id: `${alertId}-TL-1`,
      timestamp: alert.timestamp,
      type: "detection",
      title: "AI Detection Triggered",
      description: `${alert.cameraId} (${alert.cameraName}) flagged: ${alert.title}.`,
    },
    {
      id: `${alertId}-TL-2`,
      timestamp: new Date(new Date(alert.timestamp).getTime() + 2000).toISOString(),
      type: "notification",
      title: "Alert Created",
      description: `${alert.severity.toUpperCase()} ${alert.category} alert ${alert.id} generated and pushed to dashboard.`,
    },
  ];
  if (alert.assignedTo) {
    base.push({
      id: `${alertId}-TL-3`,
      timestamp: new Date(new Date(alert.timestamp).getTime() + 60000).toISOString(),
      type: "assignment",
      title: `Assigned to ${alert.assignedTo}`,
      description: `Incident routed to ${alert.assignedTo} for investigation.`,
      actor: "System",
    });
  }
  if (alert.status === "resolved" && alert.resolution) {
    base.push({
      id: `${alertId}-TL-4`,
      timestamp: new Date(new Date(alert.timestamp).getTime() + 300000).toISOString(),
      type: "resolution",
      title: "Incident Resolved",
      description: alert.resolution,
      actor: alert.assignedTo,
    });
  }
  timelines = { ...timelines, [alertId]: base };
  return timelines[alertId];
};

// Pre-seed every mock alert so nothing shows "no timeline available"
mockAlerts.forEach((a) => ensureTimeline(a.id));

// ---------- public API ----------
export const appendTimelineEvent = (
  alertId: string,
  event: Omit<TimelineEvent, "id" | "timestamp"> & { timestamp?: string }
) => {
  const list = ensureTimeline(alertId);
  const next: TimelineEvent = {
    id: `${alertId}-TL-${list.length + 1}-${Date.now()}`,
    timestamp: event.timestamp || new Date().toISOString(),
    type: event.type,
    title: event.title,
    description: event.description,
    actor: event.actor,
  };
  timelines = { ...timelines, [alertId]: [...list, next] };
  emit();
};

export const addTimelineNote = (alertId: string, note: string, actor = "Current User") => {
  if (!note.trim()) return;
  appendTimelineEvent(alertId, {
    type: "action",
    title: "Investigator Note",
    description: note.trim(),
    actor,
  });
};

export const logAudit = (
  entry: Omit<AuditEntry, "id" | "timestamp" | "ipAddress"> & { ipAddress?: string; timestamp?: string }
) => {
  const next: AuditEntry = {
    id: `AUD-${Date.now()}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    actor: entry.actor,
    actorRole: entry.actorRole,
    tenant: entry.tenant,
    action: entry.action,
    resource: entry.resource,
    details: entry.details,
    ipAddress: entry.ipAddress || "—",
  };
  auditLog = [next, ...auditLog];
  emit();
};

// ---------- hooks ----------
export const useTimeline = (alertId: string): TimelineEvent[] => {
  return useSyncExternalStore(
    subscribe,
    () => {
      ensureTimeline(alertId);
      return timelines[alertId] || [];
    },
    () => timelines[alertId] || []
  );
};

export const useAuditLog = (): AuditEntry[] =>
  useSyncExternalStore(subscribe, () => auditLog, () => auditLog);
