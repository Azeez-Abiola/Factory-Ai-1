// ==================== LIVE ALERT SIMULATION ====================
export const simulationAlerts = [
  { title: "Missing Safety Goggles – Zone C", category: "safety", severity: "critical", zone: "Zone C", camera: "CAM-06" },
  { title: "Forklift Speed Violation", category: "safety", severity: "high", zone: "Zone D", camera: "CAM-07" },
  { title: "Spill Detected Near Station 3", category: "safety", severity: "critical", zone: "Zone B", camera: "CAM-04" },
  { title: "Machine Vibration Anomaly – Press #2", category: "downtime", severity: "high", zone: "Zone B", camera: "CAM-03" },
  { title: "Label Misprint Detected", category: "quality", severity: "medium", zone: "Zone E", camera: "CAM-09" },
  { title: "Unauthorized Area Access", category: "safety", severity: "critical", zone: "Zone A", camera: "CAM-02" },
  { title: "Idle Workstation – Line 4", category: "productivity", severity: "low", zone: "Zone C", camera: "CAM-08" },
  { title: "Temperature Threshold Exceeded", category: "quality", severity: "high", zone: "Zone B", camera: "CAM-05" },
  { title: "PPE Non-Compliance – Welding Bay", category: "safety", severity: "critical", zone: "Zone A", camera: "CAM-01" },
  { title: "Conveyor Jam Detected", category: "downtime", severity: "high", zone: "Zone D", camera: "CAM-07" },
];

// ==================== INCIDENT TIMELINE ====================
export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: "detection" | "notification" | "escalation" | "assignment" | "action" | "resolution";
  title: string;
  description: string;
  actor?: string;
}

export const incidentTimelines: Record<string, TimelineEvent[]> = {
  "ALT-001": [
    { id: "TL-1", timestamp: "2026-03-13T09:23:41Z", type: "detection", title: "AI Detection Triggered", description: "Camera CAM-04 detected worker without hard hat in Zone B. Confidence: 97.2%" },
    { id: "TL-2", timestamp: "2026-03-13T09:23:43Z", type: "notification", title: "Alert Created", description: "Critical safety alert ALT-001 generated and pushed to dashboard." },
    { id: "TL-3", timestamp: "2026-03-13T09:24:10Z", type: "notification", title: "SMS Sent to Safety Manager", description: "Notification sent to Priya Sharma (Safety Manager) via SMS and email." },
    { id: "TL-4", timestamp: "2026-03-13T09:27:00Z", type: "escalation", title: "Auto-Escalated", description: "No response in 3 minutes. Alert escalated to Plant Manager." },
    { id: "TL-5", timestamp: "2026-03-13T09:28:30Z", type: "assignment", title: "Assigned to Priya Sharma", description: "Plant Manager assigned incident to Safety Manager.", actor: "Ravi Mehta" },
  ],
  "ALT-002": [
    { id: "TL-1", timestamp: "2026-03-13T09:15:02Z", type: "detection", title: "Idle Machine Detected", description: "Packaging Line 3 has been idle for 18 minutes. No operator at station." },
    { id: "TL-2", timestamp: "2026-03-13T09:15:04Z", type: "notification", title: "Alert Created", description: "High severity downtime alert generated." },
    { id: "TL-3", timestamp: "2026-03-13T09:16:30Z", type: "assignment", title: "Assigned to Ravi Mehta", description: "Auto-assigned to production supervisor based on zone rules.", actor: "System" },
    { id: "TL-4", timestamp: "2026-03-13T09:20:00Z", type: "action", title: "Operator Dispatched", description: "Ravi dispatched backup operator to Packaging Line 3.", actor: "Ravi Mehta" },
  ],
};

// ==================== SHIFT HANDOVER ====================
export interface ShiftReport {
  id: string;
  shiftName: string;
  date: string;
  startTime: string;
  endTime: string;
  supervisor: string;
  safetyScore: number;
  incidentsCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  productionEfficiency: number;
  defectsFound: number;
  keyEvents: string[];
  unresolvedIssues: string[];
  recommendations: string[];
}

export const mockShiftReports: ShiftReport[] = [
  {
    id: "SH-001", shiftName: "Morning Shift", date: "2026-03-27", startTime: "06:00", endTime: "14:00",
    supervisor: "Ravi Mehta", safetyScore: 92, incidentsCount: 4, resolvedCount: 3, unresolvedCount: 1,
    productionEfficiency: 88, defectsFound: 3,
    keyEvents: ["PPE violation in Zone B resolved in 8 minutes", "Conveyor belt slowdown addressed by maintenance", "New quality checkpoint added at Station 5"],
    unresolvedIssues: ["CAM-05 still offline – awaiting replacement part"],
    recommendations: ["Increase PPE checks in Zone B during shift change", "Schedule conveyor maintenance for this weekend"],
  },
  {
    id: "SH-002", shiftName: "Afternoon Shift", date: "2026-03-26", startTime: "14:00", endTime: "22:00",
    supervisor: "Priya Sharma", safetyScore: 85, incidentsCount: 6, resolvedCount: 5, unresolvedCount: 1,
    productionEfficiency: 82, defectsFound: 5,
    keyEvents: ["Two unauthorized zone entries detected and addressed", "Packaging defect batch quarantined", "Emergency drill conducted successfully"],
    unresolvedIssues: ["Temperature sensor in Zone E showing intermittent readings"],
    recommendations: ["Review access controls for restricted areas", "Calibrate Zone E temperature sensors"],
  },
  {
    id: "SH-003", shiftName: "Night Shift", date: "2026-03-26", startTime: "22:00", endTime: "06:00",
    supervisor: "Suresh Kumar", safetyScore: 95, incidentsCount: 2, resolvedCount: 2, unresolvedCount: 0,
    productionEfficiency: 91, defectsFound: 1,
    keyEvents: ["Smooth production run with minimal interruptions", "Preventive maintenance completed on Line 2"],
    unresolvedIssues: [],
    recommendations: ["Continue current staffing levels for night shift"],
  },
  {
    id: "SH-004", shiftName: "Morning Shift", date: "2026-03-26", startTime: "06:00", endTime: "14:00",
    supervisor: "Ravi Mehta", safetyScore: 78, incidentsCount: 8, resolvedCount: 6, unresolvedCount: 2,
    productionEfficiency: 75, defectsFound: 7,
    keyEvents: ["Major bottleneck at Station 5 lasted 45 minutes", "3 PPE violations in first hour", "Quality audit triggered re-inspection of Batch #4819"],
    unresolvedIssues: ["Station 5 workflow needs redesign", "Batch #4819 pending final QC clearance"],
    recommendations: ["Redesign Station 5 layout to reduce congestion", "Add additional PPE dispensers near Zone B entry"],
  },
];

// ==================== AI INSIGHTS ====================
export interface AIInsight {
  id: string;
  title: string;
  description: string;
  category: "safety" | "efficiency" | "quality" | "cost";
  impact: "high" | "medium" | "low";
  confidence: number;
  metric: string;
  metricValue: string;
  trend: "up" | "down" | "stable";
  recommendation: string;
  generatedAt: string;
}

export const mockInsights: AIInsight[] = [
  {
    id: "INS-001", title: "PPE Violations Spike on Night Shifts", category: "safety", impact: "high", confidence: 94,
    description: "Analysis of 30-day data shows 40% more PPE violations during night shifts (22:00-06:00) compared to day shifts, primarily in Zone B.",
    metric: "Night Shift PPE Violations", metricValue: "+40%", trend: "up",
    recommendation: "Deploy additional safety supervisors during night shifts and install automated PPE detection alerts at Zone B entry points.",
    generatedAt: "2026-03-27T06:00:00Z",
  },
  {
    id: "INS-002", title: "Station 5 Is Your Biggest Bottleneck", category: "efficiency", impact: "high", confidence: 91,
    description: "Station 5 causes 62% of all production delays on Assembly Line 2. Average queue time: 14.3 minutes vs 3.2 minute target.",
    metric: "Avg Queue Time", metricValue: "14.3 min", trend: "up",
    recommendation: "Add a parallel processing lane at Station 5 or redistribute tasks to Stations 4 and 6 to balance workload.",
    generatedAt: "2026-03-27T06:00:00Z",
  },
  {
    id: "INS-003", title: "Defect Rate Correlates with Humidity", category: "quality", impact: "medium", confidence: 87,
    description: "Label misalignment defects increase 3.2x when Zone E humidity exceeds 65%. This pattern has been consistent over 8 weeks.",
    metric: "Defect Rate at >65% Humidity", metricValue: "3.2x", trend: "up",
    recommendation: "Install dehumidifiers in Zone E or adjust label adhesive formulation for high-humidity conditions.",
    generatedAt: "2026-03-27T06:00:00Z",
  },
  {
    id: "INS-004", title: "Energy Savings Opportunity Detected", category: "cost", impact: "medium", confidence: 82,
    description: "Conveyor systems in Zone D run at full speed during low-throughput periods (12:00-13:00), consuming 28% more energy than needed.",
    metric: "Potential Monthly Savings", metricValue: "$2,400", trend: "stable",
    recommendation: "Implement variable speed drives on Zone D conveyors with throughput-based auto-adjustment.",
    generatedAt: "2026-03-27T06:00:00Z",
  },
  {
    id: "INS-005", title: "Weekend Shifts Outperform Weekdays", category: "efficiency", impact: "low", confidence: 79,
    description: "Saturday and Sunday shifts show 12% higher production efficiency and 35% fewer quality incidents than weekday averages.",
    metric: "Weekend Efficiency Boost", metricValue: "+12%", trend: "stable",
    recommendation: "Study weekend shift practices (smaller teams, fewer interruptions) and apply learnings to weekday operations.",
    generatedAt: "2026-03-27T06:00:00Z",
  },
];

// ==================== PREDICTIVE MAINTENANCE ====================
export interface MaintenanceAlert {
  id: string;
  equipment: string;
  zone: string;
  riskLevel: "critical" | "warning" | "watch";
  failureProbability: number;
  estimatedTimeToFailure: string;
  anomalyType: string;
  lastMaintenance: string;
  recommendation: string;
  trendData: { day: string; health: number }[];
}

export const mockMaintenanceAlerts: MaintenanceAlert[] = [
  {
    id: "PM-001", equipment: "Conveyor Belt – Line 1", zone: "Zone B", riskLevel: "critical", failureProbability: 89,
    estimatedTimeToFailure: "2-3 days", anomalyType: "Vibration pattern degradation",
    lastMaintenance: "2026-02-15", recommendation: "Immediate belt tension adjustment and bearing inspection required.",
    trendData: [{ day: "Mon", health: 82 }, { day: "Tue", health: 78 }, { day: "Wed", health: 71 }, { day: "Thu", health: 65 }, { day: "Fri", health: 58 }, { day: "Sat", health: 52 }, { day: "Sun", health: 45 }],
  },
  {
    id: "PM-002", equipment: "Hydraulic Press #2", zone: "Zone B", riskLevel: "warning", failureProbability: 67,
    estimatedTimeToFailure: "1-2 weeks", anomalyType: "Pressure fluctuation increasing",
    lastMaintenance: "2026-01-28", recommendation: "Schedule hydraulic fluid replacement and seal inspection within 5 days.",
    trendData: [{ day: "Mon", health: 88 }, { day: "Tue", health: 86 }, { day: "Wed", health: 83 }, { day: "Thu", health: 80 }, { day: "Fri", health: 76 }, { day: "Sat", health: 73 }, { day: "Sun", health: 70 }],
  },
  {
    id: "PM-003", equipment: "Packaging Robot Arm – Unit 3", zone: "Zone D", riskLevel: "warning", failureProbability: 54,
    estimatedTimeToFailure: "2-3 weeks", anomalyType: "Motor current draw increasing",
    lastMaintenance: "2026-02-20", recommendation: "Lubricate joints and check motor brushes during next scheduled downtime.",
    trendData: [{ day: "Mon", health: 91 }, { day: "Tue", health: 90 }, { day: "Wed", health: 88 }, { day: "Thu", health: 86 }, { day: "Fri", health: 84 }, { day: "Sat", health: 82 }, { day: "Sun", health: 80 }],
  },
  {
    id: "PM-004", equipment: "Air Compressor – Central", zone: "Zone A", riskLevel: "watch", failureProbability: 32,
    estimatedTimeToFailure: "4-6 weeks", anomalyType: "Minor temperature elevation",
    lastMaintenance: "2026-03-01", recommendation: "Monitor temperature trends. Schedule filter replacement in next maintenance window.",
    trendData: [{ day: "Mon", health: 95 }, { day: "Tue", health: 94 }, { day: "Wed", health: 94 }, { day: "Thu", health: 93 }, { day: "Fri", health: 92 }, { day: "Sat", health: 92 }, { day: "Sun", health: 91 }],
  },
];

// ==================== AUDIT LOG ====================
export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  tenant: string;
  action: string;
  resource: string;
  details: string;
  ipAddress: string;
}

export const mockAuditLog: AuditEntry[] = [
  { id: "AUD-001", timestamp: "2026-03-27T09:30:00Z", actor: "Omkar Deshmukh", actorRole: "Super Admin", tenant: "Platform", action: "tenant.create", resource: "Siemens Goa", details: "New tenant created with Starter plan", ipAddress: "103.21.58.44" },
  { id: "AUD-002", timestamp: "2026-03-27T09:28:00Z", actor: "Omkar Deshmukh", actorRole: "Super Admin", tenant: "Platform", action: "user.invite", resource: "deepak@siemens.in", details: "Invited as Tenant Admin for Siemens Goa", ipAddress: "103.21.58.44" },
  { id: "AUD-003", timestamp: "2026-03-27T09:15:00Z", actor: "Ravi Mehta", actorRole: "Tenant Admin", tenant: "Tata Steel Works", action: "alert.resolve", resource: "ALT-006", details: "Resolved: Worker Not at Station", ipAddress: "122.176.45.12" },
  { id: "AUD-004", timestamp: "2026-03-27T08:45:00Z", actor: "Ming Chen", actorRole: "Tenant Admin", tenant: "Foxconn Chennai", action: "camera.add", resource: "CAM-65", details: "Added new camera in Zone 12 – Final Assembly", ipAddress: "49.37.12.88" },
  { id: "AUD-005", timestamp: "2026-03-27T08:30:00Z", actor: "System", actorRole: "System", tenant: "Platform", action: "billing.invoice", resource: "INV-2026-033", details: "Invoice generated for Nestlé Nanjangud: $3,800", ipAddress: "—" },
  { id: "AUD-006", timestamp: "2026-03-27T08:00:00Z", actor: "System", actorRole: "System", tenant: "Platform", action: "report.generate", resource: "RPT-001", details: "Daily compliance reports generated for 7 tenants", ipAddress: "—" },
  { id: "AUD-007", timestamp: "2026-03-26T18:30:00Z", actor: "Priya Sharma", actorRole: "Tenant Admin", tenant: "Nestlé Nanjangud", action: "user.role_change", resource: "neha@nestle.in", details: "Changed role from Viewer to Operator", ipAddress: "157.48.22.91" },
  { id: "AUD-008", timestamp: "2026-03-26T17:00:00Z", actor: "Omkar Deshmukh", actorRole: "Super Admin", tenant: "Platform", action: "tenant.suspend", resource: "Bajaj Auto Pune", details: "Tenant suspended due to payment failure", ipAddress: "103.21.58.44" },
  { id: "AUD-009", timestamp: "2026-03-26T15:20:00Z", actor: "Karthik Reddy", actorRole: "Tenant Admin", tenant: "Dr. Reddy's Hyderabad", action: "zone.update", resource: "Zone 3 – Cleanroom", details: "Updated alert thresholds for cleanroom compliance", ipAddress: "61.95.33.17" },
  { id: "AUD-010", timestamp: "2026-03-26T14:00:00Z", actor: "System", actorRole: "System", tenant: "Platform", action: "system.backup", resource: "Database", details: "Automated daily backup completed successfully", ipAddress: "—" },
  { id: "AUD-011", timestamp: "2026-03-26T12:45:00Z", actor: "Ananya Singh", actorRole: "Super Admin", tenant: "Platform", action: "plan.upgrade", resource: "Amul Dairy Anand", details: "Plan upgraded from Starter to Professional", ipAddress: "103.21.58.50" },
  { id: "AUD-012", timestamp: "2026-03-26T10:00:00Z", actor: "Deepak Nair", actorRole: "Tenant Admin", tenant: "Siemens Goa", action: "camera.configure", resource: "CAM-08", details: "Configured AI detection model: PPE + Zone Intrusion", ipAddress: "203.192.44.67" },
];

// ==================== WEBHOOK CONFIG ====================
export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: "active" | "inactive" | "error";
  lastTriggered: string;
  successRate: number;
}

export const mockWebhooks: WebhookConfig[] = [
  { id: "WH-001", name: "Slack – Safety Alerts", url: "https://hooks.slack.com/services/T0.../B0.../xxx", events: ["alert.critical", "alert.high"], status: "active", lastTriggered: "2026-03-27T09:23:41Z", successRate: 99.8 },
  { id: "WH-002", name: "Teams – Daily Reports", url: "https://outlook.office.com/webhook/...", events: ["report.generated"], status: "active", lastTriggered: "2026-03-27T08:00:00Z", successRate: 98.5 },
  { id: "WH-003", name: "ERP – Production Data", url: "https://erp.internal.com/api/webhook", events: ["shift.complete", "production.stats"], status: "error", lastTriggered: "2026-03-25T14:00:00Z", successRate: 82.3 },
  { id: "WH-004", name: "PagerDuty – Critical Only", url: "https://events.pagerduty.com/v2/enqueue", events: ["alert.critical"], status: "inactive", lastTriggered: "2026-03-20T03:15:00Z", successRate: 100 },
];

// ==================== WHITE LABEL ====================
export interface WhiteLabelConfig {
  tenantId: string;
  logoUrl: string;
  primaryColor: string;
  companyName: string;
  favicon: string;
  emailFrom: string;
  customDomain: string;
}

export const mockWhiteLabel: WhiteLabelConfig = {
  tenantId: "TEN-001",
  logoUrl: "/placeholder.svg",
  primaryColor: "#2dd4bf",
  companyName: "FactoryAI",
  favicon: "/favicon.ico",
  emailFrom: "alerts@factoryai.com",
  customDomain: "ai.tatasteel.com",
};

// ==================== TENANT ONBOARDING ====================
export const onboardingSteps = [
  { id: 1, title: "Organization Details", description: "Company name, industry, and region" },
  { id: 2, title: "Add Cameras", description: "Connect IP cameras and configure feeds" },
  { id: 3, title: "Define Zones", description: "Map factory zones and set boundaries" },
  { id: 4, title: "Set Alert Thresholds", description: "Configure detection sensitivity and rules" },
  { id: 5, title: "Invite Users", description: "Add team members and assign roles" },
];
