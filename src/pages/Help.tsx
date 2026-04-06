import { useState } from "react";
import { Search, BookOpen, AlertTriangle, Camera, FileText, BarChart3, Wrench, Shield, ChevronRight, ArrowLeft, Lightbulb, Calculator, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type Article = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  content: Section[];
};

type Section = {
  heading: string;
  body: string;
  snapshot?: string;
  calculation?: { label: string; formula: string; example: string };
  tip?: string;
};

const categories = [
  { id: "getting-started", label: "Getting Started", icon: BookOpen, color: "text-primary" },
  { id: "alerts", label: "Alerts & Incidents", icon: AlertTriangle, color: "text-destructive" },
  { id: "cameras", label: "Camera Feeds", icon: Camera, color: "text-blue-500" },
  { id: "reports", label: "Reports", icon: FileText, color: "text-emerald-500" },
  { id: "insights", label: "AI Insights", icon: BarChart3, color: "text-violet-500" },
  { id: "maintenance", label: "Maintenance", icon: Wrench, color: "text-amber-500" },
  { id: "admin", label: "Admin Panel", icon: Shield, color: "text-rose-500" },
];

const articles: Article[] = [
  // ─── Getting Started ───
  {
    id: "gs-1",
    title: "Quick Start Guide",
    category: "getting-started",
    tags: ["onboarding", "setup", "basics"],
    summary: "Learn how to navigate FactoryAI and set up your first monitoring session.",
    content: [
      {
        heading: "Welcome to FactoryAI",
        body: "FactoryAI is an intelligent industrial monitoring platform that uses AI-powered video analytics to detect safety hazards, quality defects, and operational anomalies in real time. This guide walks you through the core features.",
        snapshot: "📊 Dashboard Overview — Your central command center shows live KPIs: total alerts, active cameras, compliance score, and system uptime, all updating in real time.",
      },
      {
        heading: "Navigating the Sidebar",
        body: "The left sidebar provides quick access to all modules: Dashboard, Alerts & Incidents, Camera Feeds, Reports, Shift Handover, AI Insights, and Maintenance. Click the collapse button at the bottom to toggle a compact view.",
        tip: "Use keyboard shortcut Ctrl+B to quickly toggle the sidebar.",
      },
      {
        heading: "Understanding Your Dashboard",
        body: "The dashboard displays four key metric cards at the top. Below, you'll find the alert trend chart showing incident patterns over the past 7 days, and a live incident timeline on the right.",
        snapshot: "📈 Metric Cards — Total Alerts (47), Active Cameras (12/12), Compliance Score (94.2%), System Uptime (99.7%). Each card shows a trend indicator compared to the previous period.",
        calculation: {
          label: "Compliance Score Calculation",
          formula: "Compliance Score = (Passed Checks / Total Checks) × 100",
          example: "If 471 out of 500 safety checks passed: (471 / 500) × 100 = 94.2%",
        },
      },
    ],
  },
  {
    id: "gs-2",
    title: "User Roles & Permissions Guide",
    category: "getting-started",
    tags: ["roles", "permissions", "access"],
    summary: "Understand the different user roles in FactoryAI and what each role can access.",
    content: [
      {
        heading: "Role Hierarchy",
        body: "FactoryAI implements role-based access control (RBAC) with five tiers:\n\n• Super Admin — Full platform access across all tenants\n• Tenant Admin — Complete control within their assigned tenant\n• Supervisor — Dashboard, alerts, reports, shift management\n• Operator — Camera feeds, alert acknowledgement\n• Viewer — Read-only access to dashboards and reports",
        snapshot: "👤 Role Matrix\n| Feature          | Super Admin | Tenant Admin | Supervisor | Operator | Viewer |\n| Dashboard        |     ✅      |      ✅      |     ✅     |    ❌    |   ✅   |\n| Manage Alerts    |     ✅      |      ✅      |     ✅     |    ✅    |   ❌   |\n| Create Reports   |     ✅      |      ✅      |     ✅     |    ❌    |   ❌   |\n| Camera Config    |     ✅      |      ✅      |     ❌     |    ❌    |   ❌   |\n| User Management  |     ✅      |      ✅      |     ❌     |    ❌    |   ❌   |",
      },
      {
        heading: "Requesting Access Changes",
        body: "If you need elevated permissions, contact your Tenant Admin. Access change requests are logged in the audit trail for compliance tracking.",
        tip: "Always follow the principle of least privilege — request only the permissions you need for your daily tasks.",
      },
    ],
  },
  {
    id: "gs-3",
    title: "Notification & Alert Preferences",
    category: "getting-started",
    tags: ["notifications", "preferences", "settings"],
    summary: "Configure how and when you receive notifications from FactoryAI.",
    content: [
      {
        heading: "Notification Channels",
        body: "FactoryAI supports multiple notification channels:\n\n• In-App — Real-time banner and badge notifications within the platform\n• Email — Digest or instant email alerts to your registered address\n• SMS — Critical alerts sent via text message\n• Webhook — Push notifications to external systems (Slack, Teams, PagerDuty)",
        snapshot: "🔔 Notification Settings\n| Channel  | Critical | High | Medium | Low  |\n| In-App   |    ✅    |  ✅  |   ✅   |  ✅  |\n| Email    |    ✅    |  ✅  |   ❌   |  ❌  |\n| SMS      |    ✅    |  ❌  |   ❌   |  ❌  |\n| Webhook  |    ✅    |  ✅  |   ✅   |  ❌  |",
      },
      {
        heading: "Quiet Hours & Escalation",
        body: "Set quiet hours to suppress non-critical notifications during off-shift periods. Critical alerts always bypass quiet hours. Unacknowledged alerts auto-escalate to the next level after configurable SLA windows.",
        tip: "Set up at least two notification channels for critical alerts to ensure you never miss an emergency.",
      },
    ],
  },

  // ─── Alerts ───
  {
    id: "al-1",
    title: "Managing Alerts & Incidents",
    category: "alerts",
    tags: ["alerts", "incidents", "severity", "response"],
    summary: "How to view, filter, acknowledge, and resolve safety and operational alerts.",
    content: [
      {
        heading: "Alert Severity Levels",
        body: "Alerts are categorized into four severity levels to help you prioritize response:\n\n• Critical — Immediate danger to personnel or equipment. Requires instant action.\n• High — Significant risk that needs attention within 15 minutes.\n• Medium — Moderate concern that should be addressed within 1 hour.\n• Low — Informational or minor issues for awareness.",
        snapshot: "🔴 Critical: 'Worker detected in restricted blast zone without PPE — Camera 7, Zone A'\n🟠 High: 'Forklift speed exceeding 15km/h in pedestrian area — Camera 3'\n🟡 Medium: 'Conveyor belt vibration anomaly detected — Sensor B12'\n🟢 Low: 'Lighting level below optimal in Warehouse C'",
      },
      {
        heading: "Alert Lifecycle",
        body: "Every alert follows a defined lifecycle: Open → Acknowledged → Investigating → Resolved. Use the status dropdown on each alert to update its state. Resolved alerts are moved to the history view automatically after 24 hours.",
        tip: "Assign alerts to specific team members using the 'Assign' button to ensure accountability.",
      },
      {
        heading: "Filtering & Searching Alerts",
        body: "Use the search bar to find alerts by keyword, camera ID, or zone name. Apply filters by severity, status, type, and date range. Sort by newest, severity, or time-to-resolve.",
        snapshot: "🔍 Filter Bar — [All Severities ▾] [All Status ▾] [All Types ▾] [Date Range] [Search…]\nShowing 23 of 47 alerts matching your criteria.",
      },
      {
        heading: "Response Time Metrics",
        body: "FactoryAI tracks how quickly your team responds to alerts. These metrics are used in compliance reporting and shift handover reviews.",
        calculation: {
          label: "Average Response Time",
          formula: "Avg Response Time = Σ (Acknowledged Time − Alert Time) / Total Alerts",
          example: "If 10 alerts had total response times of 45 minutes: 45 / 10 = 4.5 min average response time.",
        },
      },
    ],
  },
  {
    id: "al-2",
    title: "Incident Investigation Workflow",
    category: "alerts",
    tags: ["investigation", "root-cause", "workflow"],
    summary: "Step-by-step guide to investigating incidents from alert to resolution report.",
    content: [
      {
        heading: "Starting an Investigation",
        body: "When an alert is escalated, click 'Investigate' to open the investigation panel. This captures the alert context, camera footage timestamp, and any related sensor data automatically.",
        snapshot: "🔎 Investigation Panel\n• Alert: AL-2024-089 — PPE Violation, Zone C\n• Timestamp: 2024-03-12 14:23:17\n• Camera: CAM-007 (auto-bookmarked ±30s footage)\n• Related Alerts: AL-2024-087 (same zone, 10 min prior)\n• Assigned Investigator: Sarah Johnson",
      },
      {
        heading: "Root Cause Analysis (RCA)",
        body: "Use the built-in RCA template to document findings. FactoryAI provides three analysis frameworks:\n\n• 5 Whys — Iterative questioning to drill down to root cause\n• Fishbone Diagram — Categorize contributing factors\n• Fault Tree — Map logical relationships between events",
        tip: "Attach camera snapshots and sensor charts directly to your RCA for a complete evidence package.",
      },
      {
        heading: "Incident Closure Metrics",
        body: "Track how effectively your team resolves incidents with these key metrics.",
        calculation: {
          label: "Mean Time to Resolve (MTTR-Incident)",
          formula: "MTTR = Σ (Resolved Time − Alert Time) / Total Incidents",
          example: "5 incidents resolved in total 6.5 hours: MTTR = 6.5 / 5 = 1.3 hours average.",
        },
      },
    ],
  },
  {
    id: "al-3",
    title: "Escalation Rules & SLAs",
    category: "alerts",
    tags: ["escalation", "SLA", "rules"],
    summary: "Configure automatic escalation rules and service level agreements for alert response.",
    content: [
      {
        heading: "Default SLA Timers",
        body: "Each severity level has a default SLA for acknowledgement and resolution:\n\n• Critical — Acknowledge: 2 min, Resolve: 30 min\n• High — Acknowledge: 10 min, Resolve: 2 hours\n• Medium — Acknowledge: 30 min, Resolve: 8 hours\n• Low — Acknowledge: 2 hours, Resolve: 24 hours",
        snapshot: "⏱ SLA Dashboard\n| Severity | Ack SLA | Resolve SLA | Current Compliance |\n| Critical |  2 min  |    30 min   |       97.3%        |\n| High     | 10 min  |    2 hrs    |       94.1%        |\n| Medium   | 30 min  |    8 hrs    |       98.6%        |\n| Low      |  2 hrs  |   24 hrs    |       99.2%        |",
      },
      {
        heading: "Escalation Chain",
        body: "When an SLA is breached, alerts auto-escalate:\n\n1. Level 1 — Notify assigned operator (original assignee)\n2. Level 2 — Notify shift supervisor + send SMS\n3. Level 3 — Notify plant manager + trigger external webhook\n4. Level 4 — Notify regional director + create emergency incident",
        calculation: {
          label: "SLA Compliance Rate",
          formula: "SLA Compliance = (Alerts Resolved Within SLA / Total Alerts) × 100",
          example: "47 alerts total, 44 resolved within SLA: (44 / 47) × 100 = 93.6% compliance",
        },
      },
    ],
  },

  // ─── Cameras ───
  {
    id: "cam-1",
    title: "Camera Feeds & Zones",
    category: "cameras",
    tags: ["cameras", "video", "zones", "live"],
    summary: "Monitor live camera feeds, configure zones, and understand AI detection overlays.",
    content: [
      {
        heading: "Live Camera Grid",
        body: "The Camera Feeds page shows a grid of all active cameras. Each feed displays the camera name, zone, current status (online/offline), and any active AI detections highlighted with bounding boxes.",
        snapshot: "📹 Camera Grid (4×3 layout)\n• CAM-001: Assembly Line A — 🟢 Online — 2 active detections\n• CAM-002: Loading Dock B — 🟢 Online — No detections\n• CAM-003: Chemical Storage — 🟢 Online — 1 PPE violation\n• CAM-004: Parking Area — 🔴 Offline — Last seen 3m ago",
      },
      {
        heading: "AI Detection Overlays",
        body: "When AI detects an anomaly, it draws a colored bounding box on the feed:\n\n• Red box — Safety violation (no PPE, restricted zone breach)\n• Orange box — Operational anomaly (equipment malfunction)\n• Blue box — Quality defect (product inspection failure)\n• Green box — Tracked object (normal tracking, no issue)",
        tip: "Click on any bounding box to see detection details including confidence score, timestamp, and recommended action.",
      },
      {
        heading: "Detection Confidence Scoring",
        body: "Each AI detection includes a confidence score from 0–100%. Detections below 70% are flagged for manual review. Only detections above 85% trigger automatic alerts.",
        calculation: {
          label: "False Positive Rate",
          formula: "FPR = False Positives / (False Positives + True Negatives) × 100",
          example: "If 5 out of 200 detections were false positives: 5 / 200 × 100 = 2.5% FPR",
        },
      },
    ],
  },
  {
    id: "cam-2",
    title: "Camera Configuration & Setup",
    category: "cameras",
    tags: ["configuration", "setup", "RTSP", "resolution"],
    summary: "How to add, configure, and calibrate cameras within FactoryAI.",
    content: [
      {
        heading: "Adding a New Camera",
        body: "Navigate to Admin → Camera Management → Add Camera. You'll need:\n\n• Camera Name — Descriptive label (e.g., 'Assembly Line A - Overhead')\n• RTSP URL — The camera's streaming endpoint\n• Zone Assignment — Which factory zone this camera covers\n• Resolution — Recommended 1080p or higher for optimal AI detection\n• Frame Rate — 15–30 FPS depending on use case",
        snapshot: "➕ Add Camera Form\n• Name: [Assembly Line A - Overhead]\n• RTSP URL: [rtsp://192.168.1.101:554/stream1]\n• Zone: [Zone A - Assembly ▾]\n• Resolution: [1920×1080 ▾]\n• FPS: [25 ▾]\n• AI Models: [☑ PPE Detection] [☑ Zone Intrusion] [☐ Quality Inspect]",
      },
      {
        heading: "Zone Calibration",
        body: "After adding a camera, calibrate its detection zones by drawing polygons on the camera view. Types of zones:\n\n• Restricted Zone — No unauthorized entry (triggers critical alert)\n• PPE Required — Monitors for proper safety equipment\n• Speed Zone — Tracks vehicle/forklift speed\n• Quality Inspection — Focused on product inspection area",
        tip: "Test your zone configuration by walking through the area and verifying detection accuracy before going live.",
      },
      {
        heading: "Bandwidth Estimation",
        body: "Plan your network capacity based on camera count and resolution settings.",
        calculation: {
          label: "Bandwidth per Camera",
          formula: "Bandwidth (Mbps) = Resolution Factor × FPS × Compression Ratio",
          example: "1080p at 25 FPS with H.264: 2.07 × 25 × 0.07 = ~3.6 Mbps per camera\n12 cameras: 12 × 3.6 = ~43.2 Mbps total required",
        },
      },
    ],
  },
  {
    id: "cam-3",
    title: "Camera Health & Troubleshooting",
    category: "cameras",
    tags: ["health", "troubleshooting", "offline", "diagnostics"],
    summary: "Diagnose camera issues, understand health metrics, and resolve common problems.",
    content: [
      {
        heading: "Camera Health Dashboard",
        body: "Each camera has a health score based on uptime, stream quality, and detection accuracy. Access it via Camera → Details → Health tab.",
        snapshot: "📊 Camera Health — CAM-001\n• Uptime (30d): 99.4%\n• Avg Stream Quality: 94/100\n• Detection Accuracy: 97.2%\n• Last Maintenance: 2024-02-28\n• Firmware: v3.2.1 (up to date)",
      },
      {
        heading: "Common Issues & Fixes",
        body: "• Camera Offline — Check network cable, verify RTSP URL, restart camera power\n• Blurry Feed — Clean lens, check focus settings, verify resolution config\n• False Detections — Recalibrate zones, adjust confidence threshold, check lighting\n• High Latency — Reduce resolution/FPS, check network bandwidth, use wired connection\n• Night Vision Issues — Enable IR mode, check IR LED array, adjust exposure settings",
        tip: "Set up automated health checks to receive alerts when camera quality drops below 80%.",
      },
    ],
  },

  // ─── Reports ───
  {
    id: "rpt-1",
    title: "Creating & Managing Reports",
    category: "reports",
    tags: ["reports", "compliance", "export", "create"],
    summary: "Generate compliance reports, customize fields, and export to PDF or CSV.",
    content: [
      {
        heading: "Report Types",
        body: "FactoryAI supports four report types:\n\n• Safety Audit — Comprehensive safety compliance assessment\n• Quality Inspection — Product quality metrics and defect analysis\n• Environmental Audit — Environmental compliance and emissions data\n• Productivity Report — Operational efficiency and output metrics",
        snapshot: "📄 Reports Dashboard\n| Report ID | Title              | Type        | Score  | Status    |\n| RPT-001   | Q1 Safety Audit    | Safety      | 94.2%  | Completed |\n| RPT-002   | Line 3 Quality     | Quality     | 87.5%  | In Review |\n| RPT-003   | March Environment  | Env. Audit  | 91.0%  | Draft     |",
      },
      {
        heading: "Creating a New Report",
        body: "Click the '+ Create Report' button at the top of the Reports page. Fill in the title, select the report type, set the initial status, enter the compliance score, list key findings, and choose the generation method (AI-generated or manual).",
        tip: "Use 'AI-Generated' to let FactoryAI automatically compile data from cameras, alerts, and sensors into a structured report draft.",
      },
      {
        heading: "Score Calculations",
        body: "Each report includes a compliance score based on the findings and check results from the reporting period.",
        calculation: {
          label: "Weighted Compliance Score",
          formula: "Score = Σ (Category Weight × Category Score) / Σ Category Weights",
          example: "Safety (40% weight, 95 score) + Quality (30%, 88) + Environment (30%, 91):\n(0.4×95 + 0.3×88 + 0.3×91) / 1.0 = 38 + 26.4 + 27.3 = 91.7%",
        },
      },
    ],
  },
  {
    id: "sr-1",
    title: "Shift Handover Reports",
    category: "reports",
    tags: ["shift", "handover", "supervisor"],
    summary: "Create and review shift handover reports to ensure continuity across shifts.",
    content: [
      {
        heading: "Shift Report Structure",
        body: "Each shift report captures key operational data for a shift period including the supervisor name, shift timing, safety score, operational efficiency, number of incidents, and defects found.",
        snapshot: "📋 Shift Report Example\n• Shift: Morning (06:00 – 14:00)\n• Supervisor: John Smith\n• Safety Score: 96/100\n• Efficiency: 94.2%\n• Incidents: 1 (minor — resolved)\n• Defects Found: 3",
      },
      {
        heading: "Efficiency Calculation",
        body: "Shift efficiency is calculated based on actual output versus planned output, adjusted for downtime.",
        calculation: {
          label: "Shift Efficiency",
          formula: "Efficiency = (Actual Output / Planned Output) × (1 − Unplanned Downtime / Total Shift Hours) × 100",
          example: "Planned: 500 units, Actual: 470, Unplanned downtime: 25 min in 8hr shift:\n(470/500) × (1 − 25/480) × 100 = 94% × 94.8% = 89.1%",
        },
      },
    ],
  },
  {
    id: "rpt-2",
    title: "Exporting & Scheduling Reports",
    category: "reports",
    tags: ["export", "PDF", "CSV", "schedule"],
    summary: "Export reports in multiple formats and set up automated report schedules.",
    content: [
      {
        heading: "Export Formats",
        body: "FactoryAI supports three export formats:\n\n• PDF — Formatted document with charts, tables, and branding. Ideal for stakeholder presentations.\n• CSV — Raw data export for further analysis in Excel or BI tools.\n• JSON — Machine-readable format for integration with external systems.",
        snapshot: "📥 Export Dialog\n• Format: [PDF ▾] [CSV ▾] [JSON ▾]\n• Include Charts: [☑ Yes]\n• Date Range: [Last 30 days ▾]\n• Sections: [☑ Summary] [☑ Findings] [☑ Metrics] [☐ Raw Data]\n[Download Report]",
      },
      {
        heading: "Scheduled Reports",
        body: "Automate report generation by setting up schedules:\n\n1. Go to Reports → Schedules → New Schedule\n2. Select report template and type\n3. Set frequency (daily, weekly, monthly)\n4. Choose recipients (email distribution list)\n5. Configure format and included sections",
        tip: "Schedule weekly safety reports for Monday mornings so supervisors start the week with full visibility.",
      },
    ],
  },

  // ─── Insights ───
  {
    id: "ins-1",
    title: "Understanding AI Insights",
    category: "insights",
    tags: ["ai", "analytics", "predictions", "trends"],
    summary: "Leverage AI-powered analytics to identify trends, predict risks, and optimize operations.",
    content: [
      {
        heading: "Insight Categories",
        body: "AI Insights are organized into three categories:\n\n• Predictive — Forward-looking risk assessments and failure predictions\n• Diagnostic — Root cause analysis of recurring issues\n• Prescriptive — Actionable recommendations to improve operations",
        snapshot: "🤖 AI Insight Example\n[PREDICTIVE] Conveyor Belt B3 — Predicted failure in 72 hours\nConfidence: 89% | Based on: vibration trend, temperature anomaly\nRecommendation: Schedule preventive maintenance before Thursday 14:00",
      },
      {
        heading: "Trend Analysis",
        body: "The trend view shows patterns over time for alerts, compliance scores, and equipment health. Use the time range selector (7d, 30d, 90d) to adjust the analysis window.",
        calculation: {
          label: "Trend Direction Score",
          formula: "Trend = (Current Period Average − Previous Period Average) / Previous Period Average × 100",
          example: "Current week avg alerts: 6.2, Previous week: 8.4:\n(6.2 − 8.4) / 8.4 × 100 = −26.2% (improving trend ↓)",
        },
      },
    ],
  },
  {
    id: "ins-2",
    title: "Anomaly Detection & Pattern Recognition",
    category: "insights",
    tags: ["anomaly", "pattern", "detection", "machine-learning"],
    summary: "How FactoryAI's ML models detect unusual patterns and operational anomalies.",
    content: [
      {
        heading: "How Anomaly Detection Works",
        body: "FactoryAI uses a multi-layer anomaly detection approach:\n\n1. Statistical Baseline — Learns 'normal' patterns over 14-day rolling window\n2. Real-Time Comparison — Compares current readings against the baseline\n3. Contextual Analysis — Considers time of day, shift patterns, and seasonal factors\n4. Correlation Engine — Checks if anomaly in one sensor correlates with others",
        snapshot: "📉 Anomaly Detection Example\nSensor: Vibration Monitor — Conveyor B3\n• Baseline: 2.1–3.4 mm/s (normal range)\n• Current: 5.8 mm/s (⚠ 2.7σ above mean)\n• Trend: Increasing over 48 hours\n• Correlated: Temperature sensor B3 also elevated (+4°C)\n• Verdict: ANOMALY — Likely bearing wear",
      },
      {
        heading: "Detection Accuracy Metrics",
        body: "Monitor the performance of AI models with these key metrics tracked on the Insights dashboard.",
        calculation: {
          label: "F1 Score (Model Accuracy)",
          formula: "F1 = 2 × (Precision × Recall) / (Precision + Recall)\nPrecision = True Positives / (True Positives + False Positives)\nRecall = True Positives / (True Positives + False Negatives)",
          example: "TP=180, FP=8, FN=12:\nPrecision = 180/188 = 95.7%, Recall = 180/192 = 93.8%\nF1 = 2 × (0.957 × 0.938) / (0.957 + 0.938) = 94.7%",
        },
      },
    ],
  },
  {
    id: "ins-3",
    title: "Custom Dashboards & KPI Tracking",
    category: "insights",
    tags: ["dashboard", "KPI", "custom", "widgets"],
    summary: "Build custom dashboards and track the KPIs that matter most to your operation.",
    content: [
      {
        heading: "Creating Custom KPI Widgets",
        body: "Navigate to Insights → Custom Dashboard → Add Widget. Available widget types:\n\n• Metric Card — Single KPI with trend arrow\n• Line Chart — Time series data (alerts, scores, output)\n• Bar Chart — Comparison data (zone performance, shift comparison)\n• Pie Chart — Distribution data (alert types, defect categories)\n• Table — Detailed data with sorting and filtering",
        snapshot: "📊 Custom Dashboard — 'Plant Manager View'\n┌─────────────┬──────────────┬─────────────┐\n│ OEE: 87.3%  │ Yield: 96.1% │ MTBF: 420h  │\n│    ↑ 2.1%   │    ↑ 0.8%    │   ↑ 15h     │\n├─────────────┴──────────────┴─────────────┤\n│   [Alert Trend Chart — 7 day view]       │\n├──────────────────┬───────────────────────┤\n│ [Zone Heatmap]   │ [Top 5 Issues Table]  │\n└──────────────────┴───────────────────────┘",
      },
      {
        heading: "OEE Calculation",
        body: "Overall Equipment Effectiveness (OEE) is the gold standard manufacturing KPI, combining availability, performance, and quality.",
        calculation: {
          label: "OEE (Overall Equipment Effectiveness)",
          formula: "OEE = Availability × Performance × Quality\nAvailability = Run Time / Planned Production Time\nPerformance = (Ideal Cycle Time × Total Count) / Run Time\nQuality = Good Count / Total Count",
          example: "Availability: 90%, Performance: 95%, Quality: 99%:\nOEE = 0.90 × 0.95 × 0.99 = 84.6%\nWorld-class OEE benchmark: 85%+",
        },
      },
    ],
  },

  // ─── Maintenance ───
  {
    id: "mt-1",
    title: "Maintenance Management",
    category: "maintenance",
    tags: ["maintenance", "work orders", "preventive", "equipment"],
    summary: "Track equipment health, schedule preventive maintenance, and manage work orders.",
    content: [
      {
        heading: "Work Order Lifecycle",
        body: "Maintenance work orders follow this lifecycle: Requested → Approved → In Progress → Completed → Verified. Each stage has a responsible party and SLA timer.",
        snapshot: "🔧 Work Order #WO-2024-047\n• Equipment: Conveyor Belt B3\n• Type: Preventive Maintenance\n• Priority: High\n• Assigned: Mike Chen (Maintenance Lead)\n• Due: 2024-03-15 14:00\n• Status: In Progress (2h 15m elapsed)",
      },
      {
        heading: "Equipment Health Score",
        body: "Each piece of equipment has a health score from 0–100 based on sensor data, maintenance history, and AI predictions.",
        calculation: {
          label: "Equipment Health Score",
          formula: "Health = Base Score − Σ Deductions + Maintenance Bonus",
          example: "Base: 100, Deductions: vibration anomaly (−8), age factor (−5), Maintenance bonus: recent service (+3):\n100 − 8 − 5 + 3 = 90 (Good condition)",
        },
      },
      {
        heading: "MTBF & MTTR Metrics",
        body: "Two critical maintenance KPIs tracked by FactoryAI:\n\n• MTBF (Mean Time Between Failures) — Average operating time between breakdowns\n• MTTR (Mean Time To Repair) — Average time to restore equipment to operation",
        calculation: {
          label: "MTBF & MTTR",
          formula: "MTBF = Total Operating Hours / Number of Failures\nMTTR = Total Repair Hours / Number of Repairs",
          example: "Equipment ran 2,000 hours with 4 failures, total repair time 12 hours:\nMTBF = 2000 / 4 = 500 hours\nMTTR = 12 / 4 = 3 hours per repair",
        },
      },
    ],
  },
  {
    id: "mt-2",
    title: "Preventive Maintenance Scheduling",
    category: "maintenance",
    tags: ["preventive", "schedule", "calendar", "planning"],
    summary: "Set up and manage preventive maintenance schedules to minimize unplanned downtime.",
    content: [
      {
        heading: "Creating a PM Schedule",
        body: "Go to Maintenance → Schedules → New Schedule:\n\n1. Select equipment or equipment group\n2. Choose maintenance type (inspection, lubrication, replacement, calibration)\n3. Set frequency (hours-based, calendar-based, or condition-based)\n4. Assign default technician or team\n5. Attach checklist or SOP document",
        snapshot: "📅 PM Schedule — Conveyor System\n| Task                  | Frequency    | Next Due   | Assigned     |\n| Belt tension check    | Weekly       | 2024-03-18 | Mike Chen    |\n| Bearing lubrication   | Monthly      | 2024-04-01 | James Park   |\n| Motor inspection      | Quarterly    | 2024-06-15 | Mike Chen    |\n| Full overhaul         | Annually     | 2024-12-01 | Ext. Vendor  |",
      },
      {
        heading: "Condition-Based Triggers",
        body: "Instead of fixed schedules, set maintenance triggers based on real-time sensor data:\n\n• Vibration exceeds threshold → Schedule bearing inspection\n• Temperature delta > 10°C → Schedule cooling system check\n• Operating hours > limit → Schedule component replacement\n• AI prediction confidence > 85% → Auto-create work order",
        tip: "Condition-based maintenance can reduce maintenance costs by 25–30% compared to fixed-schedule preventive maintenance.",
      },
      {
        heading: "PM Compliance Rate",
        body: "Track how well your team adheres to the preventive maintenance schedule.",
        calculation: {
          label: "PM Compliance Rate",
          formula: "PM Compliance = (PM Tasks Completed On Time / Total PM Tasks Due) × 100",
          example: "In March: 28 PM tasks due, 25 completed on time:\n(25 / 28) × 100 = 89.3% PM compliance\nTarget: > 90%",
        },
      },
    ],
  },
  {
    id: "mt-3",
    title: "Spare Parts & Inventory",
    category: "maintenance",
    tags: ["spare parts", "inventory", "stock", "reorder"],
    summary: "Manage spare parts inventory, set reorder points, and track usage patterns.",
    content: [
      {
        heading: "Inventory Dashboard",
        body: "The spare parts inventory tracks all maintenance consumables and replacement parts. Each item shows current stock, reorder point, lead time, and usage trend.",
        snapshot: "📦 Spare Parts Inventory\n| Part              | Stock | Reorder Point | Lead Time | Status     |\n| Conveyor Belt 12m | 3     | 2             | 5 days    | 🟢 OK     |\n| Bearing SKF 6205  | 8     | 5             | 3 days    | 🟢 OK     |\n| Motor Drive V-Belt| 1     | 3             | 7 days    | 🔴 Low    |\n| Hydraulic Filter  | 0     | 2             | 4 days    | 🔴 Order  |",
      },
      {
        heading: "Reorder Calculations",
        body: "FactoryAI automatically calculates optimal reorder points based on usage history and lead times.",
        calculation: {
          label: "Reorder Point (ROP)",
          formula: "ROP = (Average Daily Usage × Lead Time in Days) + Safety Stock\nSafety Stock = Z-score × σ(demand) × √(Lead Time)",
          example: "Avg daily usage: 0.5 units, Lead time: 5 days, Safety stock: 2 units:\nROP = (0.5 × 5) + 2 = 4.5 → Reorder when stock hits 5 units",
        },
      },
    ],
  },

  // ─── Admin ───
  {
    id: "adm-1",
    title: "Admin Panel Overview",
    category: "admin",
    tags: ["admin", "tenants", "users", "billing"],
    summary: "Manage tenants, users, billing, system monitoring, and platform settings.",
    content: [
      {
        heading: "Tenant Management",
        body: "The Admin Panel allows platform administrators to manage multiple factory tenants. Each tenant represents a separate factory or facility with its own cameras, users, and configurations.",
        snapshot: "🏭 Tenants Overview\n| Tenant         | Plan        | Users | Cameras | Status  |\n| Acme Steel     | Enterprise  | 45    | 24      | Active  |\n| BioPharm Inc   | Professional| 18    | 12      | Active  |\n| GreenEnergy Co | Starter     | 6     | 4       | Trial   |",
      },
      {
        heading: "User Roles & Permissions",
        body: "FactoryAI uses a role-based access control system:\n\n• Super Admin — Full platform access, tenant management\n• Tenant Admin — Full access within their tenant\n• Supervisor — View dashboards, manage alerts, create reports\n• Operator — View cameras and acknowledge alerts\n• Viewer — Read-only access to dashboards and reports",
        tip: "Always follow the principle of least privilege — assign the minimum role needed for each user's responsibilities.",
      },
    ],
  },
  {
    id: "adm-2",
    title: "Billing & Subscription Management",
    category: "admin",
    tags: ["billing", "subscription", "pricing", "invoices"],
    summary: "Understand pricing tiers, manage subscriptions, and view billing history.",
    content: [
      {
        heading: "Pricing Tiers",
        body: "FactoryAI offers three subscription tiers:\n\n• Starter — Up to 4 cameras, 10 users, basic AI detection, email support\n• Professional — Up to 16 cameras, 50 users, advanced AI, priority support\n• Enterprise — Unlimited cameras & users, custom AI models, dedicated support, SLA guarantee",
        snapshot: "💳 Subscription — Acme Steel (Enterprise)\n• Monthly Cost: $2,400/month\n• Cameras: 24/Unlimited\n• Users: 45/Unlimited\n• AI Models: 6 active (PPE, Zone, Quality, Speed, Smoke, Spill)\n• Support: Dedicated CSM + 24/7 phone\n• Next Invoice: April 1, 2024",
      },
      {
        heading: "Usage-Based Add-ons",
        body: "Beyond the base subscription, usage-based charges may apply:\n\n• Additional AI model training: $200/model/month\n• Video storage beyond 30 days: $0.50/camera/day\n• API calls beyond 10,000/month: $0.01/call\n• Custom report templates: $50/template (one-time)",
        tip: "Monitor your usage dashboard monthly to avoid unexpected charges. Set up usage alerts at 80% of your plan limits.",
      },
    ],
  },
  {
    id: "adm-3",
    title: "Audit Log & Compliance",
    category: "admin",
    tags: ["audit", "log", "compliance", "tracking"],
    summary: "Track all user actions, system changes, and access events for compliance purposes.",
    content: [
      {
        heading: "Audit Log Overview",
        body: "Every action in FactoryAI is logged with a timestamp, user, action type, and details. The audit log is immutable and retained for the duration of your subscription (minimum 1 year).",
        snapshot: "📝 Audit Log (Recent Entries)\n| Timestamp           | User          | Action              | Details                    |\n| 2024-03-12 14:23:17 | sarah.j       | Alert Acknowledged  | AL-2024-089 (Critical)     |\n| 2024-03-12 14:20:05 | mike.c        | Work Order Created  | WO-2024-048 (Conveyor B3)  |\n| 2024-03-12 14:15:30 | admin         | User Role Changed   | john.d: Operator → Supervisor |\n| 2024-03-12 14:10:12 | system        | Camera Offline      | CAM-004 (Parking Area)     |",
      },
      {
        heading: "Compliance Frameworks",
        body: "FactoryAI's audit logging supports compliance with:\n\n• ISO 45001 — Occupational Health & Safety\n• ISO 9001 — Quality Management Systems\n• OSHA — Occupational Safety and Health Administration\n• FDA 21 CFR Part 11 — Electronic Records (pharma)\n• SOC 2 Type II — Service Organization Controls",
        tip: "Export audit logs quarterly and store them in your organization's long-term archival system for regulatory compliance.",
      },
    ],
  },

  // ─── FAQ ───
  {
    id: "faq-1",
    title: "Frequently Asked Questions",
    category: "getting-started",
    tags: ["faq", "common", "questions"],
    summary: "Answers to the most common questions about using FactoryAI.",
    content: [
      {
        heading: "General Questions",
        body: "Below are answers to frequently asked questions about the platform.",
      },
    ],
  },
];

const faqs = [
  { q: "How often does the dashboard refresh?", a: "The dashboard refreshes every 30 seconds by default. Critical alerts trigger an immediate push notification regardless of the refresh cycle." },
  { q: "Can I export reports to PDF?", a: "Yes. On any report detail page, click the 'Export' button and choose PDF or CSV format. PDF exports include all charts and images." },
  { q: "What happens when a camera goes offline?", a: "An automatic alert is generated with 'Medium' severity. The system retries connection every 60 seconds for 10 minutes, then escalates to 'High' if still offline." },
  { q: "How is the compliance score calculated?", a: "Compliance Score = (Passed Checks / Total Checks) × 100. Weights can be configured per category in Admin → Settings." },
  { q: "Can I customize alert thresholds?", a: "Yes. Go to Admin → Settings → Alert Configuration. You can set custom thresholds for detection confidence, response time SLAs, and escalation rules." },
  { q: "How does predictive maintenance work?", a: "AI models analyze sensor data (vibration, temperature, pressure) and historical patterns to predict equipment failures 24–72 hours in advance with 85%+ accuracy." },
  { q: "What browsers are supported?", a: "FactoryAI supports the latest versions of Chrome, Firefox, Safari, and Edge. For best performance with live camera feeds, Chrome is recommended." },
  { q: "Can I integrate with existing ERP systems?", a: "Yes. FactoryAI provides REST APIs and webhook integrations for SAP, Oracle, Microsoft Dynamics, and other ERP systems. Contact support for custom integration setup." },
  { q: "How is data backed up?", a: "All data is backed up continuously with point-in-time recovery available for the last 30 days. Full backups are stored in geographically redundant data centers." },
  { q: "What is the uptime SLA?", a: "Enterprise plans include a 99.9% uptime SLA. Professional plans target 99.5%. Scheduled maintenance windows are communicated 72 hours in advance." },
];

const Help = () => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const filtered = articles.filter((a) => {
    const matchesSearch =
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.summary.toLowerCase().includes(search.toLowerCase()) ||
      a.tags.some((t) => t.includes(search.toLowerCase()));
    const matchesCategory = !selectedCategory || a.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (selectedArticle) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setSelectedArticle(null)} className="gap-2 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Knowledge Base
        </Button>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">{categories.find((c) => c.id === selectedArticle.category)?.label}</Badge>
            {selectedArticle.tags.map((t) => (
              <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
            ))}
          </div>
          <h1 className="text-3xl font-bold text-foreground">{selectedArticle.title}</h1>
          <p className="text-muted-foreground mt-2">{selectedArticle.summary}</p>
        </div>

        <div className="space-y-8">
          {selectedArticle.content.map((section, i) => (
            <div key={i} className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">{section.heading}</h2>
              <div className="text-muted-foreground whitespace-pre-line leading-relaxed">{section.body}</div>

              {section.snapshot && (
                <Card className="bg-muted/50 border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <Eye className="w-4 h-4 text-primary mt-1 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-wider">Snapshot Preview</p>
                        <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">{section.snapshot}</pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {section.calculation && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <Calculator className="w-4 h-4 text-primary mt-1 shrink-0" />
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider">{section.calculation.label}</p>
                        <div className="bg-background/80 rounded-md p-3 border border-border">
                          <code className="text-sm font-mono text-foreground">{section.calculation.formula}</code>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Example: </span>
                          <span className="whitespace-pre-wrap">{section.calculation.example}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {section.tip && (
                <Card className="border-amber-500/20 bg-amber-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground"><span className="font-semibold">Pro Tip:</span> {section.tip}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ))}

          {selectedArticle.id === "faq-1" && (
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Help & Knowledge Base</h1>
        <p className="text-muted-foreground mt-1">Find documentation, examples, calculations, and answers to common questions.</p>
      </div>

      {/* Search */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search articles, topics, or keywords…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          All Topics
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat.id)}
            className="gap-1.5"
          >
            <cat.icon className="w-3.5 h-3.5" />
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Articles grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((article) => {
          const cat = categories.find((c) => c.id === article.category);
          return (
            <Card
              key={article.id}
              className="cursor-pointer hover:border-primary/40 transition-colors group"
              onClick={() => setSelectedArticle(article)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">{cat?.label}</Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">{article.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{article.summary}</p>
                <div className="flex gap-1.5 mt-3">
                  {article.tags.slice(0, 3).map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No articles found</p>
          <p className="text-sm">Try adjusting your search or category filter.</p>
        </div>
      )}
    </div>
  );
};

export default Help;
