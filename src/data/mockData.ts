// ==================== ALERTS ====================
export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertStatus = "open" | "assigned" | "resolved";
export type AlertCategory = "safety" | "downtime" | "quality" | "productivity";

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  category: AlertCategory;
  cameraId: string;
  cameraName: string;
  zone: string;
  timestamp: string;
  assignedTo?: string;
  imageUrl?: string;
  resolution?: string;
}

export const mockAlerts: Alert[] = [
  {
    id: "ALT-001",
    title: "Missing PPE – Hard Hat",
    description: "Worker detected without hard hat in Zone B heavy machinery area. Violation persisted for 4 minutes before alert triggered.",
    severity: "critical",
    status: "open",
    category: "safety",
    cameraId: "CAM-04",
    cameraName: "Zone B – Assembly",
    zone: "Zone B",
    timestamp: "2026-03-13T09:23:41Z",
  },
  {
    id: "ALT-002",
    title: "Machine Idle – Packaging Line 3",
    description: "Packaging Line 3 has been idle for 18 minutes. No operator detected at station.",
    severity: "high",
    status: "assigned",
    category: "downtime",
    cameraId: "CAM-07",
    cameraName: "Packaging Hall",
    zone: "Zone D",
    timestamp: "2026-03-13T09:15:02Z",
    assignedTo: "Ravi Mehta",
  },
  {
    id: "ALT-003",
    title: "Packaging Defect Detected",
    description: "Misaligned label detected on batch #4821. 3 consecutive units affected.",
    severity: "high",
    status: "open",
    category: "quality",
    cameraId: "CAM-09",
    cameraName: "QC Station 2",
    zone: "Zone E",
    timestamp: "2026-03-13T09:11:30Z",
  },
  {
    id: "ALT-004",
    title: "Restricted Zone Entry",
    description: "Unauthorized personnel detected entering restricted maintenance area.",
    severity: "critical",
    status: "assigned",
    category: "safety",
    cameraId: "CAM-02",
    cameraName: "Maintenance Bay",
    zone: "Zone A",
    timestamp: "2026-03-13T08:58:15Z",
    assignedTo: "Priya Sharma",
  },
  {
    id: "ALT-005",
    title: "Production Bottleneck",
    description: "Workflow congestion detected at Station 5. Queue time exceeds 12 minutes.",
    severity: "medium",
    status: "open",
    category: "productivity",
    cameraId: "CAM-06",
    cameraName: "Assembly Line 2",
    zone: "Zone C",
    timestamp: "2026-03-13T08:45:00Z",
  },
  {
    id: "ALT-006",
    title: "Worker Not at Station",
    description: "Workstation 8 unattended for 22 minutes during active shift.",
    severity: "medium",
    status: "resolved",
    category: "productivity",
    cameraId: "CAM-08",
    cameraName: "Assembly Line 3",
    zone: "Zone C",
    timestamp: "2026-03-13T08:30:00Z",
    assignedTo: "Amit Patel",
    resolution: "Worker was on unscheduled break. Supervisor notified.",
  },
  {
    id: "ALT-007",
    title: "Quality Deviation – Color Mismatch",
    description: "Color variation detected in batch #4819. Delta E > 3.5 threshold.",
    severity: "low",
    status: "resolved",
    category: "quality",
    cameraId: "CAM-09",
    cameraName: "QC Station 2",
    zone: "Zone E",
    timestamp: "2026-03-13T08:12:00Z",
    assignedTo: "Neha Gupta",
    resolution: "Ink cartridge replaced. Batch cleared after re-inspection.",
  },
  {
    id: "ALT-008",
    title: "Conveyor Belt Slowdown",
    description: "Conveyor speed dropped 40% on Line 1. Potential mechanical issue.",
    severity: "high",
    status: "open",
    category: "downtime",
    cameraId: "CAM-03",
    cameraName: "Main Conveyor",
    zone: "Zone B",
    timestamp: "2026-03-13T09:28:00Z",
  },
];

// ==================== CAMERAS ====================
export interface Camera {
  id: string;
  name: string;
  zone: string;
  status: "online" | "offline" | "maintenance";
  detections: number;
  lastDetection?: string;
  type: string;
}

export const mockCameras: Camera[] = [
  { id: "CAM-01", name: "Main Entrance", zone: "Zone A", status: "online", detections: 2, lastDetection: "PPE Check", type: "Safety" },
  { id: "CAM-02", name: "Maintenance Bay", zone: "Zone A", status: "online", detections: 1, lastDetection: "Restricted Zone", type: "Safety" },
  { id: "CAM-03", name: "Main Conveyor", zone: "Zone B", status: "online", detections: 3, lastDetection: "Speed Anomaly", type: "Production" },
  { id: "CAM-04", name: "Zone B – Assembly", zone: "Zone B", status: "online", detections: 1, lastDetection: "Missing PPE", type: "Safety" },
  { id: "CAM-05", name: "Raw Material Storage", zone: "Zone B", status: "offline", detections: 0, type: "Inventory" },
  { id: "CAM-06", name: "Assembly Line 2", zone: "Zone C", status: "online", detections: 2, lastDetection: "Bottleneck", type: "Production" },
  { id: "CAM-07", name: "Packaging Hall", zone: "Zone D", status: "online", detections: 1, lastDetection: "Machine Idle", type: "Production" },
  { id: "CAM-08", name: "Assembly Line 3", zone: "Zone C", status: "online", detections: 0, type: "Production" },
  { id: "CAM-09", name: "QC Station 2", zone: "Zone E", status: "online", detections: 4, lastDetection: "Label Defect", type: "Quality" },
  { id: "CAM-10", name: "Loading Dock", zone: "Zone F", status: "maintenance", detections: 0, type: "Logistics" },
  { id: "CAM-11", name: "Warehouse Aisle 1", zone: "Zone F", status: "online", detections: 1, lastDetection: "Worker Absence", type: "Productivity" },
  { id: "CAM-12", name: "Control Room", zone: "Zone A", status: "online", detections: 0, type: "Safety" },
];

// ==================== DASHBOARD STATS ====================
export const dashboardStats = {
  safetyScore: 87,
  totalIncidents: 14,
  openAlerts: 5,
  resolvedToday: 9,
  uptime: 94.2,
  defectRate: 0.8,
  activeCameras: 10,
  totalCameras: 12,
};

export const hourlyAlerts = [
  { hour: "06:00", safety: 1, quality: 0, downtime: 0, productivity: 1 },
  { hour: "07:00", safety: 0, quality: 1, downtime: 1, productivity: 0 },
  { hour: "08:00", safety: 2, quality: 2, downtime: 0, productivity: 1 },
  { hour: "09:00", safety: 1, quality: 1, downtime: 2, productivity: 1 },
  { hour: "10:00", safety: 0, quality: 0, downtime: 1, productivity: 0 },
  { hour: "11:00", safety: 1, quality: 1, downtime: 0, productivity: 2 },
  { hour: "12:00", safety: 0, quality: 0, downtime: 1, productivity: 0 },
  { hour: "13:00", safety: 1, quality: 2, downtime: 0, productivity: 1 },
  { hour: "14:00", safety: 0, quality: 1, downtime: 1, productivity: 0 },
];

export const weeklyDefects = [
  { day: "Mon", defects: 12, target: 8 },
  { day: "Tue", defects: 8, target: 8 },
  { day: "Wed", defects: 15, target: 8 },
  { day: "Thu", defects: 6, target: 8 },
  { day: "Fri", defects: 10, target: 8 },
  { day: "Sat", defects: 4, target: 8 },
  { day: "Sun", defects: 3, target: 8 },
];

export const downtimeByZone = [
  { zone: "Zone A", minutes: 12 },
  { zone: "Zone B", minutes: 45 },
  { zone: "Zone C", minutes: 28 },
  { zone: "Zone D", minutes: 18 },
  { zone: "Zone E", minutes: 8 },
  { zone: "Zone F", minutes: 5 },
];

export const productivityData = [
  { hour: "06:00", efficiency: 92 },
  { hour: "07:00", efficiency: 88 },
  { hour: "08:00", efficiency: 95 },
  { hour: "09:00", efficiency: 78 },
  { hour: "10:00", efficiency: 85 },
  { hour: "11:00", efficiency: 90 },
  { hour: "12:00", efficiency: 65 },
  { hour: "13:00", efficiency: 82 },
  { hour: "14:00", efficiency: 88 },
];

// ==================== REPORTS ====================
export interface ComplianceReport {
  id: string;
  title: string;
  type: "safety" | "quality" | "audit" | "productivity";
  date: string;
  status: "passed" | "failed" | "pending";
  score: number;
  findings: number;
  generatedBy: string;
}

export const mockReports: ComplianceReport[] = [
  { id: "RPT-001", title: "Daily Safety Compliance Report", type: "safety", date: "2026-03-13", status: "passed", score: 87, findings: 3, generatedBy: "AI System" },
  { id: "RPT-002", title: "Weekly Quality Audit – Line 1", type: "quality", date: "2026-03-12", status: "passed", score: 94, findings: 1, generatedBy: "AI System" },
  { id: "RPT-003", title: "Monthly Safety Audit", type: "audit", date: "2026-03-10", status: "failed", score: 72, findings: 8, generatedBy: "AI System" },
  { id: "RPT-004", title: "Workforce Productivity – Week 10", type: "productivity", date: "2026-03-09", status: "passed", score: 89, findings: 2, generatedBy: "AI System" },
  { id: "RPT-005", title: "Quality Inspection – Batch #4800", type: "quality", date: "2026-03-08", status: "pending", score: 0, findings: 0, generatedBy: "Pending" },
  { id: "RPT-006", title: "Daily Safety Compliance Report", type: "safety", date: "2026-03-07", status: "passed", score: 91, findings: 2, generatedBy: "AI System" },
  { id: "RPT-007", title: "Regulatory Compliance Audit Q1", type: "audit", date: "2026-03-05", status: "passed", score: 96, findings: 1, generatedBy: "AI System" },
  { id: "RPT-008", title: "Packaging QC Report", type: "quality", date: "2026-03-04", status: "failed", score: 68, findings: 5, generatedBy: "AI System" },
];

// ==================== TEAM ====================
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

export const mockTeam: TeamMember[] = [
  { id: "T-01", name: "Ravi Mehta", role: "Production Supervisor", avatar: "RM" },
  { id: "T-02", name: "Priya Sharma", role: "Safety Manager", avatar: "PS" },
  { id: "T-03", name: "Amit Patel", role: "Line Operator", avatar: "AP" },
  { id: "T-04", name: "Neha Gupta", role: "Quality Lead", avatar: "NG" },
  { id: "T-05", name: "Suresh Kumar", role: "Maintenance Head", avatar: "SK" },
];
