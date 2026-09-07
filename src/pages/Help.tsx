import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search, BookOpen, AlertTriangle, Camera, FileText, BarChart3, Wrench, Shield,
  ChevronRight, ArrowLeft, Lightbulb, Calculator, Eye, ClipboardList, Users,
  Settings, Bell, Activity, GitBranch, Layers, Sparkles, HelpCircle, Play,
  Info, CheckCircle2, XCircle, Copy, ExternalLink, Zap, Gauge, Building2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import PageHeader from "@/components/app/PageHeader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Knowledge base data model
// ---------------------------------------------------------------------------

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "tip"; text: string }
  | { kind: "warn"; text: string }
  | { kind: "info"; text: string }
  | { kind: "code"; lang?: string; text: string }
  | { kind: "formula"; label: string; formula: string; example?: string }
  | { kind: "table"; head: string[]; rows: (string | number)[][] }
  | { kind: "snapshot"; caption: string; body: string }
  | { kind: "steps"; items: string[] };

type Article = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  readMinutes: number;
  blocks: Block[];
  relatedRoute?: { label: string; to: string };
};

type Category = {
  id: string;
  label: string;
  icon: typeof BookOpen;
  color: string;
  description: string;
};

const categories: Category[] = [
  { id: "getting-started", label: "Getting Started", icon: BookOpen, color: "text-primary", description: "Set up your workspace, roles, tenants and first monitoring session." },
  { id: "dashboard", label: "Dashboard & KPIs", icon: Gauge, color: "text-cyan-500", description: "Metric cards, trend charts, OEE, compliance score and how each number is computed." },
  { id: "alerts", label: "Alerts", icon: Bell, color: "text-destructive", description: "Live event feed, severity, acknowledge / resolve flow, filters and audit trail." },
  { id: "incidents", label: "Incidents", icon: Shield, color: "text-warning", description: "Case management, resolution workflow, bulk triage, timeline and compliance export." },
  { id: "cameras", label: "Camera Feeds", icon: Camera, color: "text-blue-500", description: "Live monitoring, grid layouts, PTZ, audio, health telemetry and RTSP/WebRTC ingest." },
  { id: "insights", label: "AI Insights", icon: Sparkles, color: "text-violet-500", description: "Trend detection, categories, confidence, recommendations and PDF export." },
  { id: "reports", label: "Reports", icon: FileText, color: "text-emerald-500", description: "Custom reports, filters, sort, CSV/PDF export and audit-ready formatting." },
  { id: "shift", label: "Shift Handover", icon: ClipboardList, color: "text-teal-500", description: "End-of-shift summaries, safety & efficiency scores, unresolved issues, recommendations." },
  { id: "maintenance", label: "Maintenance", icon: Wrench, color: "text-amber-500", description: "Predictive maintenance, work orders, MTTR, failure risk and lifecycle." },
  { id: "admin", label: "Admin & Governance", icon: Settings, color: "text-rose-500", description: "Tenants, users, roles, KPI configuration, escalation, notifications and audit log." },
  { id: "rules", label: "Rules & Policies", icon: GitBranch, color: "text-indigo-500", description: "Best-practice templates, natural-language rules, AI guardrails and violations." },
  { id: "security", label: "Security & Compliance", icon: Layers, color: "text-fuchsia-500", description: "RLS, tenant isolation, audit records, exports and standards mapping (OSHA, ISO)." },
];

// ---------------------------------------------------------------------------
// Articles — deep documentation for every module
// ---------------------------------------------------------------------------

const articles: Article[] = [
  // ─────────────── Getting Started ───────────────
  {
    id: "gs-quickstart",
    title: "Quick Start — 10 minutes to your first live alert",
    category: "getting-started",
    tags: ["onboarding", "setup", "first-run"],
    summary: "Sign in, pick a tenant, connect a camera and see AI detections stream in.",
    readMinutes: 10,
    relatedRoute: { label: "Open Dashboard", to: "/app" },
    blocks: [
      { kind: "p", text: "FactoryAI is a multi-tenant industrial monitoring platform. This guide takes you from a fresh account to a live camera feed with AI detections in under ten minutes." },
      { kind: "steps", items: [
        "Sign in with email/password or Google at /auth. First-time sign-ups land as Viewer.",
        "Ask your Tenant Admin to invite you into a tenant, or (if you are the Admin) create one at /admin.",
        "Switch tenant from the top-right tenant switcher — every screen re-scopes instantly.",
        "Go to /admin/cameras → New Camera. Provide an RTSP URL. Save is blocked until the stream test passes.",
        "Enable Inference (5–300s cadence). AI begins analysing frames.",
        "Watch /app for realtime cards, /app/alerts for the event feed, /app/cameras for the wall.",
      ] },
      { kind: "info", text: "Every action you take — acknowledge, assign, resolve, invite, edit policy — writes an entry to the tenant audit log with a stable AUD-… identifier." },
    ],
  },
  {
    id: "gs-navigation",
    title: "Navigating the app — Operator (/app) vs Admin (/admin)",
    category: "getting-started",
    tags: ["navigation", "layout"],
    summary: "How the operator workspace and admin panel are split, when to use each, and how to switch.",
    readMinutes: 4,
    blocks: [
      { kind: "h", text: "Two workspaces, one platform" },
      { kind: "table",
        head: ["Workspace", "Route", "Audience", "Focus"],
        rows: [
          ["Operator", "/app", "Supervisors, operators, viewers", "Live monitoring, response, reporting"],
          ["Admin", "/admin", "Tenant Admin, Super Admin", "Tenants, users, policies, config, billing"],
        ]},
      { kind: "p", text: "The Shield icon in the header switches to /admin when your role permits. Non-admins never see it." },
      { kind: "tip", text: "Bookmark /app/alerts (live feed) and /app/cameras (video wall) — these two views cover 80% of a shift supervisor's day." },
    ],
  },
  {
    id: "gs-roles",
    title: "Roles, permissions and the principle of least privilege",
    category: "getting-started",
    tags: ["rbac", "roles", "permissions"],
    summary: "Full RBAC matrix for Super Admin, Tenant Admin, Supervisor, Operator and Viewer.",
    readMinutes: 5,
    blocks: [
      { kind: "p", text: "FactoryAI enforces role-based access control at both application and database (RLS) layers. Roles are stored in a dedicated table — never on the user or profile — and checked via a SECURITY DEFINER function." },
      { kind: "table",
        head: ["Capability", "Super Admin", "Tenant Admin", "Supervisor", "Operator", "Viewer"],
        rows: [
          ["View dashboards & reports", "✓", "✓", "✓", "✓", "✓"],
          ["Acknowledge alerts", "✓", "✓", "✓", "✓", "—"],
          ["Resolve incidents", "✓", "✓", "✓", "—", "—"],
          ["Create reports", "✓", "✓", "✓", "—", "—"],
          ["Configure cameras", "✓", "✓", "—", "—", "—"],
          ["Manage users & invites", "✓", "✓", "—", "—", "—"],
          ["Edit policies / KPIs", "✓", "✓", "—", "—", "—"],
          ["Manage tenants (create/suspend)", "✓", "—", "—", "—", "—"],
        ]},
      { kind: "warn", text: "Never grant Admin to solve a permission issue mid-shift. Log the intent, request access through your Tenant Admin, and let the audit trail show it." },
    ],
  },

  // ─────────────── Dashboard ───────────────
  {
    id: "dash-overview",
    title: "Dashboard tour — every card explained",
    category: "dashboard",
    tags: ["dashboard", "kpi", "metrics"],
    summary: "What each metric card means, where its number comes from and how to drill in.",
    readMinutes: 6,
    relatedRoute: { label: "Open Dashboard", to: "/app" },
    blocks: [
      { kind: "snapshot", caption: "Dashboard hero", body: "Four stat cards: Live Alerts · Compliance Score · OEE · Active Cameras. Trend chip on each shows change vs. previous 7 days." },
      { kind: "h", text: "Live Alerts" },
      { kind: "p", text: "Count of alerts opened in the tenant over the current time window (default: last 24h). Realtime — updates instantly as cameras stream detections." },
      { kind: "h", text: "Compliance Score" },
      { kind: "formula", label: "Compliance Score",
        formula: "score = passed_checks / total_checks × 100",
        example: "471 passed of 500 checks → 94.2%. Weekly rollup shown; daily hover reveals the split." },
      { kind: "h", text: "Overall Equipment Effectiveness (OEE)" },
      { kind: "formula", label: "OEE",
        formula: "OEE = Availability × Performance × Quality",
        example: "Availability 92% × Performance 88% × Quality 97% = 78.5% (World-Class benchmark is 85%)." },
      { kind: "h", text: "Active Cameras" },
      { kind: "p", text: "cameras.status = 'online' derived from heartbeats within the configured interval. Missed heartbeats flip the tile to offline automatically." },
    ],
  },

  // ─────────────── Alerts ───────────────
  {
    id: "al-lifecycle",
    title: "Alert lifecycle — from detection to audit record",
    category: "alerts",
    tags: ["alerts", "workflow", "lifecycle"],
    summary: "Every state an alert passes through and who moves it there.",
    readMinutes: 7,
    relatedRoute: { label: "Open Alerts", to: "/app/alerts" },
    blocks: [
      { kind: "steps", items: [
        "Detection — Inference worker or heartbeat pushes a row into the alerts table.",
        "Notification — Trigger fires notify-alert (email/SMS via Resend/Twilio) based on tenant preferences.",
        "Open — Alert appears in /app/alerts with severity, zone, camera and risk score.",
        "Acknowledged — Operator confirms they've seen it. Timestamp + user recorded, audit entry alert.acknowledge written.",
        "Investigating — Opening the Resolution Workflow creates (or links) an incident with a timeline seed event.",
        "Resolved — Supervisor closes the incident with resolution notes and root-cause tags. Audit entry incident.resolve written.",
        "Archived — Auto-close after N days per tenant retention policy. Compliance export remains available.",
      ] },
      { kind: "table",
        head: ["Severity", "SLA to acknowledge", "SLA to resolve", "Default channels"],
        rows: [
          ["Critical", "≤ 1 min", "≤ 15 min", "In-app · Email · SMS · Webhook"],
          ["High", "≤ 5 min", "≤ 1 h", "In-app · Email · Webhook"],
          ["Medium", "≤ 15 min", "≤ 4 h", "In-app · Email"],
          ["Low", "≤ 60 min", "Same shift", "In-app"],
        ]},
      { kind: "tip", text: "Use the Severity + Status filter combo to build focused work queues — e.g. 'critical + open' as a supervisor triage view." },
    ],
  },
  {
    id: "al-triage",
    title: "Triaging alerts fast — filters, search & bulk actions",
    category: "alerts",
    tags: ["alerts", "triage", "filters"],
    summary: "How to reduce noise, find the alert you need and take action across many at once.",
    readMinutes: 5,
    blocks: [
      { kind: "list", items: [
        "Search box matches title, zone, type and short ID.",
        "Severity filter: critical / high / medium / low / all.",
        "Status filter: open / acknowledged / resolved / all.",
        "Click any row for the full detail dialog with metadata, risk score and workflow buttons.",
      ] },
      { kind: "info", text: "Bulk actions live on the Incidents page — /app/investigations. Multi-select and use Acknowledge, Assign or Mark False Positive; each row gets an individual audit entry." },
    ],
  },
  {
    id: "al-false-positive",
    title: "Handling false positives without losing signal",
    category: "alerts",
    tags: ["false-positive", "tuning", "ai"],
    summary: "Mark, learn from and reduce false-positive noise across your fleet.",
    readMinutes: 5,
    blocks: [
      { kind: "steps", items: [
        "Mark the alert (or bulk in /app/investigations) as False Positive — audit entry incident.bulk.false_positive.",
        "Add a resolution note explaining what triggered it (glare, reflection, mannequin, etc.).",
        "In /admin/rules → Alert Rules, raise the confidence_threshold for the offending model, or add a zone exclusion.",
        "In /admin/cameras, adjust the camera's confidence_threshold or disable the model that generated the false hit.",
      ] },
      { kind: "warn", text: "False-positive rate is a KPI. Track it weekly — > 15% suggests thresholds are too low; < 2% suggests they may be too high and you are missing real events." },
    ],
  },

  // ─────────────── Incidents ───────────────
  {
    id: "inc-workflow",
    title: "Resolution workflow — turning alerts into closed cases",
    category: "incidents",
    tags: ["incidents", "workflow", "resolution"],
    summary: "How the supervisor resolution workflow generates tasks, tracks progress and writes compliance records.",
    readMinutes: 8,
    relatedRoute: { label: "Open Investigations", to: "/app/investigations" },
    blocks: [
      { kind: "p", text: "Any alert can be promoted into an incident with a full resolution workflow. Incidents carry status, assignee, timeline, tasks and audit references." },
      { kind: "h", text: "Statuses" },
      { kind: "table", head: ["Status", "Meaning"], rows: [
        ["open", "Newly created, not yet acknowledged"],
        ["investigating", "Assigned & work in progress"],
        ["resolved", "Root cause addressed, awaiting close-out"],
        ["closed", "Compliance sign-off complete"],
        ["false_positive", "Confirmed non-event — feeds model tuning"],
      ] },
      { kind: "h", text: "Resolution tasks" },
      { kind: "p", text: "The dialog creates one or more tasks (checklist items) assigned to team members. Tasks track status (open, in_progress, completed, cancelled) and support notes. All state changes emit audit entries." },
      { kind: "h", text: "Escalation" },
      { kind: "p", text: "If next_escalation_at passes and no one has resolved the incident, the escalate-incidents cron reassigns to the next supervisor in the tenant's active escalation policy and logs incident.escalated." },
    ],
  },
  {
    id: "inc-timeline",
    title: "Incident audit timeline — every event, every record ID",
    category: "incidents",
    tags: ["audit", "timeline", "compliance"],
    summary: "Read the timeline view: alerts, tasks, status changes and matching AUD- records.",
    readMinutes: 4,
    blocks: [
      { kind: "p", text: "Click Timeline on any incident row. The dialog shows a strict chronological feed with source (alert, task, status, note), actor, timestamp and the AUD-… reference for the underlying audit record." },
      { kind: "tip", text: "Include the AUD- IDs when exporting or citing an incident in an external system. They are stable across the tenant lifecycle." },
    ],
  },
  {
    id: "inc-bulk",
    title: "Bulk triage — acknowledge, assign or dismiss many incidents",
    category: "incidents",
    tags: ["bulk", "triage"],
    summary: "How to work through backlog quickly without losing audit fidelity.",
    readMinutes: 3,
    blocks: [
      { kind: "steps", items: [
        "Filter to the queue you want to work (e.g. status: open).",
        "Tick the header checkbox to select all filtered rows, or individual rows.",
        "Use the sticky action bar: Acknowledge, Assign (supervisor picker), or Mark False Positive.",
        "Every affected incident gets its own audit_log row — bulk actions are never anonymised.",
      ] },
    ],
  },
  {
    id: "inc-export",
    title: "Compliance export — PDF / CSV of resolution outcomes",
    category: "incidents",
    tags: ["export", "compliance", "audit"],
    summary: "Generate a date-scoped, site-scoped resolution report for auditors.",
    readMinutes: 4,
    blocks: [
      { kind: "steps", items: [
        "Click Compliance Export on the Incidents page.",
        "Pick date range and (optionally) site / zone.",
        "Choose format — PDF for signature-ready reports, CSV for downstream analytics.",
        "The bundle includes: incident, opened/closed times, assignee, resolution notes and the AUD- IDs.",
      ] },
    ],
  },

  // ─────────────── Cameras ───────────────
  {
    id: "cam-wall",
    title: "The video wall — layouts, shortcuts and the operator HUD",
    category: "cameras",
    tags: ["cameras", "wall", "monitoring"],
    summary: "Grid switching, keyboard shortcuts, focus mode, auto-cycle and the live HUD.",
    readMinutes: 7,
    relatedRoute: { label: "Open Camera Feeds", to: "/app/cameras" },
    blocks: [
      { kind: "table", head: ["Layout", "Cameras shown", "Shortcut"], rows: [
        ["Focus", "1", "1"],
        ["2×2", "4", "4"],
        ["3×3", "9", "9"],
        ["4×4", "16", "6"],
      ] },
      { kind: "list", items: [
        "Auto-cycle rotates the visible page every N seconds — hands-free monitoring.",
        "Focus mode enlarges the selected tile and puts detection overlays front-and-centre.",
        "Fullscreen (F) hides all chrome for wall-mounted displays.",
        "Audio button unmutes only cameras with audio_enabled and only the focused tile — browsers refuse to autoplay sound across 16 tiles.",
      ] },
      { kind: "info", text: "The HUD (FPS, latency, resolution, sync clock) is fed by the camera heartbeat, so it reflects real ingest health, not the client's guess." },
    ],
  },
  {
    id: "cam-onboarding",
    title: "Onboarding a new camera — RTSP to live in three steps",
    category: "cameras",
    tags: ["cameras", "rtsp", "onboarding"],
    summary: "Provision, test and go live. Onboarding is blocked until stream test passes.",
    readMinutes: 6,
    blocks: [
      { kind: "steps", items: [
        "Admin → Camera Config → New Camera. Fill in name, zone, RTSP URL, credentials.",
        "Click Test Stream. The test-stream edge function probes HLS / WebRTC / MJPEG endpoints and returns pass/fail with reason.",
        "On pass, Save enables. On fail, the failure reason is shown — fix and re-test.",
        "After save, the gateway heartbeat begins updating status. Flip Inference on when you want AI on this feed.",
      ] },
      { kind: "code", lang: "bash", text: "# Heartbeat example — your gateway posts this every N seconds\ncurl -X POST $SUPABASE_URL/functions/v1/camera-heartbeat \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"camera_id\":\"...\",\"token\":\"...\",\"status\":\"online\",\"resolution\":\"1920x1080\",\"fps\":25}'" },
    ],
  },
  {
    id: "cam-inference",
    title: "Continuous AI inference — cadence, status and confidence",
    category: "cameras",
    tags: ["ai", "inference", "detections"],
    summary: "How the inference worker samples frames, produces detections and pushes alerts.",
    readMinutes: 5,
    blocks: [
      { kind: "p", text: "Each online camera with inference_enabled = true is picked up by run-inference every minute. If last_inference_at is older than inference_interval_seconds, analyze-frame is invoked with the stream URL, AI model list and confidence threshold." },
      { kind: "list", items: [
        "AI models: PPE, Restricted Zone, Fall Detection, Forklift Speed, Quality Defect (extendable).",
        "Confidence threshold — 0–1. Detections below the threshold are dropped.",
        "Status pill on the card shows: 'Inference running · every Ns · last Xs ago'.",
        "Detections above threshold write an alert row → notify-alert fires per tenant preferences.",
      ] },
    ],
  },

  // ─────────────── Insights ───────────────
  {
    id: "ai-what",
    title: "What are AI Insights?",
    category: "insights",
    tags: ["insights", "ai", "analytics"],
    summary: "Patterns detected across alerts, incidents and telemetry — with impact, confidence and a recommendation.",
    readMinutes: 6,
    relatedRoute: { label: "Open Insights", to: "/app/insights" },
    blocks: [
      { kind: "p", text: "Insights are periodic AI-generated observations that go beyond individual alerts. They correlate signals across cameras, shifts and zones to surface systemic issues." },
      { kind: "table", head: ["Category", "What it tracks"], rows: [
        ["Safety", "PPE compliance, restricted-zone entries, near-misses"],
        ["Efficiency", "Downtime clusters, throughput drops, changeover delays"],
        ["Quality", "Defect rates, inspection failures, drift"],
        ["Cost", "Cost of downtime, rework, energy anomalies"],
      ] },
      { kind: "h", text: "Each insight carries" },
      { kind: "list", items: [
        "Impact (high / medium / low) — how much it moves the needle.",
        "Confidence % — the model's certainty.",
        "Trend (↑ ↓ →) — direction over the selected window.",
        "Recommendation — the concrete next action.",
        "Related alerts — one click drills to the raw events that produced it.",
      ] },
    ],
  },
  {
    id: "ai-export",
    title: "Exporting an insight as a PDF report",
    category: "insights",
    tags: ["export", "pdf"],
    summary: "Turn any insight into a signature-ready PDF with impact metrics and action plan.",
    readMinutes: 3,
    blocks: [
      { kind: "steps", items: [
        "Open the insight detail page.",
        "Click Download PDF in the header.",
        "The PDF includes title, category, impact metrics, action plan and generation timestamp.",
      ] },
    ],
  },

  // ─────────────── Reports ───────────────
  {
    id: "rep-create",
    title: "Creating a custom report",
    category: "reports",
    tags: ["reports", "create"],
    summary: "Build a scoped report — pick period, sections, KPIs and export target.",
    readMinutes: 5,
    relatedRoute: { label: "Open Reports", to: "/app/reports" },
    blocks: [
      { kind: "steps", items: [
        "Click Create Report on /app/reports.",
        "Set title, type (daily / weekly / monthly / custom), date range and sections.",
        "Toggle KPIs to include: Safety Score, OEE, Compliance, Incidents, MTTR.",
        "Save — the report becomes shareable, exportable and searchable in the list.",
      ] },
      { kind: "tip", text: "Save recurring shapes (e.g. 'Monday Safety Weekly') as templates by cloning your best report." },
    ],
  },
  {
    id: "rep-export",
    title: "Exporting reports — CSV vs PDF",
    category: "reports",
    tags: ["export", "csv", "pdf"],
    summary: "When to choose each format and what fields land in the file.",
    readMinutes: 3,
    blocks: [
      { kind: "list", items: [
        "CSV — best for downstream analytics, BI tools, Excel pivoting.",
        "PDF — best for auditors, regulatory submissions and printed signatures.",
        "Both include tenant name, generation timestamp and the exporting user.",
      ] },
    ],
  },

  // ─────────────── Shift ───────────────
  {
    id: "shift-anatomy",
    title: "Anatomy of a shift handover report",
    category: "shift",
    tags: ["shift", "handover"],
    summary: "Safety score, efficiency, key events, unresolved issues and recommendations — read them right.",
    readMinutes: 6,
    relatedRoute: { label: "Open Shift Handover", to: "/app/shift-reports" },
    blocks: [
      { kind: "formula", label: "Safety Score",
        formula: "safety = 100 - (weighted_incidents / shift_hours × 10)",
        example: "3 medium incidents over 8h → 100 - (3 × 1 / 8 × 10) = 96.25%" },
      { kind: "formula", label: "Production Efficiency",
        formula: "efficiency = actual_output / planned_output × 100",
        example: "9,200 units of a planned 10,000 → 92%" },
      { kind: "list", items: [
        "Key Events — critical/high alerts and any manually flagged occurrences.",
        "Unresolved Issues — anything the outgoing shift is handing over.",
        "AI Recommendations — trend-based suggestions for the incoming shift.",
      ] },
    ],
  },
  {
    id: "shift-create",
    title: "Filing a shift report (or letting FactoryAI auto-generate it)",
    category: "shift",
    tags: ["shift", "create"],
    summary: "Fill out the handover form or accept the auto-generated draft at shift-end.",
    readMinutes: 4,
    blocks: [
      { kind: "steps", items: [
        "Click Create Report on /app/shift-reports.",
        "Pick the shift, date, supervisor, start/end times.",
        "Enter safety %, efficiency %, incident counts, defects.",
        "Add key events, unresolved issues and recommendations for the next shift.",
        "Save — the report becomes part of the searchable, exportable handover log.",
      ] },
      { kind: "info", text: "End-time must be after start-time. Percentages are capped 0–100. The dialog blocks save until valid." },
    ],
  },

  // ─────────────── Maintenance ───────────────
  {
    id: "maint-overview",
    title: "Predictive maintenance overview",
    category: "maintenance",
    tags: ["maintenance", "predictive"],
    summary: "Failure risk, MTTR, work order lifecycle and how alerts convert to work orders.",
    readMinutes: 7,
    relatedRoute: { label: "Open Maintenance", to: "/app/maintenance" },
    blocks: [
      { kind: "formula", label: "MTTR (Mean Time To Repair)",
        formula: "MTTR = Σ downtime_hours / number_of_repairs",
        example: "12h across 4 repairs → 3h MTTR" },
      { kind: "formula", label: "Failure Risk Score",
        formula: "risk = 0.4 × vibration + 0.3 × temperature + 0.2 × runtime_hours + 0.1 × age",
        example: "vib .8, temp .6, runtime .5, age .9 → 0.32 + 0.18 + 0.10 + 0.09 = 0.69 (High)" },
      { kind: "table", head: ["Work Order Status", "Meaning"], rows: [
        ["draft", "Created, not yet approved"],
        ["approved", "Ready to execute"],
        ["in_progress", "Being worked"],
        ["completed", "Repair done, awaiting sign-off"],
        ["cancelled", "Superseded or not required"],
      ] },
    ],
  },

  // ─────────────── Admin ───────────────
  {
    id: "adm-tenants",
    title: "Managing tenants and sub-tenants",
    category: "admin",
    tags: ["tenants", "hierarchy"],
    summary: "Create, edit, suspend and structure a parent/child tenant hierarchy.",
    readMinutes: 6,
    relatedRoute: { label: "Open Admin", to: "/admin" },
    blocks: [
      { kind: "p", text: "FactoryAI supports parent/child tenant hierarchies. A parent inherits visibility into children; child tenants remain isolated from siblings." },
      { kind: "steps", items: [
        "Admin → Tenants → New Tenant. Set name, plan, contact and address.",
        "To create a sub-tenant, pick a parent when creating.",
        "Suspend from the row action to disable access without deleting data.",
      ] },
    ],
  },
  {
    id: "adm-invites",
    title: "Inviting users and managing membership",
    category: "admin",
    tags: ["users", "invites"],
    summary: "Email invites, role assignment, acceptance flow and revocation.",
    readMinutes: 5,
    blocks: [
      { kind: "steps", items: [
        "Admin → Users → Invite. Enter email and pick role (Owner, Admin, Operator, Viewer).",
        "The invite token expires in 7 days. Recipient opens /invite/:token and accepts.",
        "accept_tenant_invitation validates email match, creates the membership, marks the invite accepted.",
        "Revoke pending invites or remove members from the same page.",
      ] },
      { kind: "warn", text: "Never share invite links publicly — they mint tenant access on the first accept." },
    ],
  },
  {
    id: "adm-kpi",
    title: "KPI & OKR configuration",
    category: "admin",
    tags: ["kpi", "okr", "thresholds"],
    summary: "Define KPIs, set red/amber/green thresholds and tie them to dashboards.",
    readMinutes: 6,
    blocks: [
      { kind: "steps", items: [
        "Admin → KPI Config → Add KPI (name, unit, target, direction).",
        "Set thresholds: red < amber < green (or reversed if lower is better).",
        "Save — dashboards and reports colour the metric accordingly.",
      ] },
      { kind: "formula", label: "Traffic light bucket",
        formula: "bucket = value < red_threshold ? 'red' : value < amber_threshold ? 'amber' : 'green'",
        example: "Safety Score 87 with red<80, amber<90 → amber" },
    ],
  },
  {
    id: "adm-escalation",
    title: "Escalation policies — never let an incident go stale",
    category: "admin",
    tags: ["escalation", "sla"],
    summary: "Configure timeouts, supervisor rotation and automatic reassignment.",
    readMinutes: 5,
    blocks: [
      { kind: "steps", items: [
        "Admin → Escalation → New Policy. Add supervisors in rotation order.",
        "Set timeout_minutes — how long before auto-escalation.",
        "The escalate-incidents cron runs every minute; when next_escalation_at passes, it reassigns and logs incident.escalated.",
      ] },
    ],
  },
  {
    id: "adm-notify",
    title: "Notification preferences per tenant",
    category: "admin",
    tags: ["notifications", "email", "sms"],
    summary: "Recipients, channels, minimum severity and escalation opt-in.",
    readMinutes: 4,
    blocks: [
      { kind: "list", items: [
        "Email — comma-separated recipient list, validated on save.",
        "SMS — E.164 phone numbers via Twilio.",
        "Minimum severity — mute channels for anything below the picked level.",
        "Escalation opt-in — receive a copy when the escalation cron reassigns.",
      ] },
    ],
  },
  {
    id: "adm-audit",
    title: "Audit log — the source of truth for compliance",
    category: "admin",
    tags: ["audit", "compliance"],
    summary: "Every mutation is recorded with actor, action, entity and metadata.",
    readMinutes: 4,
    blocks: [
      { kind: "table", head: ["Column", "Meaning"], rows: [
        ["id", "AUD-… stable identifier"],
        ["tenant_id", "Isolation boundary"],
        ["actor_user_id", "Who did it"],
        ["action", "alert.acknowledge, incident.resolve, camera.create, …"],
        ["entity_type / entity_id", "What was affected"],
        ["metadata", "JSON payload — before/after, notes, IDs"],
        ["created_at", "UTC timestamp"],
      ] },
    ],
  },

  // ─────────────── Rules ───────────────
  {
    id: "rules-templates",
    title: "Policy templates library",
    category: "rules",
    tags: ["policies", "templates", "osha", "iso"],
    summary: "Clone battle-tested templates (Hard Hats, PPE Zones, Forklift Safety) and customise.",
    readMinutes: 5,
    relatedRoute: { label: "Open Rules", to: "/admin/rules" },
    blocks: [
      { kind: "list", items: [
        "12 templates covering PPE, restricted zones, forklift/pedestrian, spill, fire lanes and more.",
        "Each template maps to an OSHA / ISO standard reference for audit traceability.",
        "Clone → edit thresholds → activate. Templates never mutate — cloning is safe.",
      ] },
    ],
  },
  {
    id: "rules-ai",
    title: "AI-compiled rules from natural language",
    category: "rules",
    tags: ["ai", "rules", "nl"],
    summary: "Describe what to detect in plain English; the platform compiles a detection rule.",
    readMinutes: 4,
    blocks: [
      { kind: "code", text: 'Prompt: "Alert me when a person is inside Zone A during shifts outside Mon-Fri 08:00-17:00 without a hard hat"' },
      { kind: "p", text: "The compile-policy edge function converts this into a structured alert_rule with zone, schedule, model requirements and severity." },
      { kind: "warn", text: "Always review the compiled rule before activating. AI is fast, not infallible." },
    ],
  },
  {
    id: "rules-violations",
    title: "Policy violations — what fires, what's tuned out",
    category: "rules",
    tags: ["violations", "audit"],
    summary: "Track policy hits, tune thresholds and export for review.",
    readMinutes: 4,
    blocks: [
      { kind: "list", items: [
        "Every rule hit writes a policy_violations row with the alert reference.",
        "Filter by policy, severity, date to see hot-spots.",
        "Export violations as CSV for internal audit committees.",
      ] },
    ],
  },

  // ─────────────── Security ───────────────
  {
    id: "sec-isolation",
    title: "Multi-tenant isolation — how your data stays yours",
    category: "security",
    tags: ["rls", "isolation", "security"],
    summary: "RLS policies, membership checks and the SECURITY DEFINER pattern.",
    readMinutes: 6,
    blocks: [
      { kind: "list", items: [
        "Every tenant-scoped table has RLS on and policies keyed on tenant_id.",
        "Membership is checked via is_tenant_member() — SECURITY DEFINER, no recursion.",
        "Roles live in the user_roles table, never on profile — prevents privilege escalation.",
        "The service_role bypasses RLS only for edge functions (heartbeat, notify, escalate).",
      ] },
      { kind: "info", text: "Cross-tenant reads are impossible from the client. Admin sees only tenants they belong to; Super Admin sees all via role check." },
    ],
  },
  {
    id: "sec-standards",
    title: "Standards mapping — OSHA, ISO 45001, SOC 2",
    category: "security",
    tags: ["compliance", "standards"],
    summary: "How platform features map to common compliance frameworks.",
    readMinutes: 5,
    blocks: [
      { kind: "table", head: ["Standard", "Requirement", "How FactoryAI delivers"], rows: [
        ["OSHA 1910.132", "PPE assessment & enforcement", "PPE policy templates + AI detection + violation log"],
        ["ISO 45001", "Incident reporting & investigation", "Incident lifecycle, resolution tasks, root-cause notes"],
        ["ISO 9001", "Corrective action tracking", "Work orders, MTTR, closed-loop audit"],
        ["SOC 2 CC7.2", "Anomaly detection & response", "AI Insights + escalation + notification"],
        ["SOC 2 CC6.1", "Logical access controls", "RBAC, RLS, tenant isolation"],
      ] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Rendering primitives
// ---------------------------------------------------------------------------

const BlockRenderer = ({ block }: { block: Block }) => {
  switch (block.kind) {
    case "p":
      return <p className="text-sm leading-relaxed text-muted-foreground">{block.text}</p>;
    case "h":
      return <h3 className="text-base font-semibold text-foreground mt-6 mb-1">{block.text}</h3>;
    case "list":
      return block.ordered ? (
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground">
          {block.items.map((i, idx) => <li key={idx}>{i}</li>)}
        </ol>
      ) : (
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
          {block.items.map((i, idx) => <li key={idx}>{i}</li>)}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-2">
          {block.items.map((i, idx) => (
            <li key={idx} className="flex gap-3 text-sm">
              <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold border border-primary/20">{idx + 1}</span>
              <span className="text-foreground/90 leading-relaxed">{i}</span>
            </li>
          ))}
        </ol>
      );
    case "tip":
      return (
        <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/90"><span className="font-semibold text-primary">Tip · </span>{block.text}</p>
        </div>
      );
    case "warn":
      return (
        <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/90"><span className="font-semibold text-warning">Watch out · </span>{block.text}</p>
        </div>
      );
    case "info":
      return (
        <div className="flex gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/90">{block.text}</p>
        </div>
      );
    case "code":
      return (
        <div className="relative rounded-lg border border-border bg-muted/50 overflow-hidden group">
          {block.lang && <span className="absolute top-2 right-10 text-[10px] uppercase tracking-wider text-muted-foreground">{block.lang}</span>}
          <button
            aria-label="Copy code"
            onClick={() => { navigator.clipboard.writeText(block.text); toast.success("Copied to clipboard"); }}
            className="absolute top-2 right-2 p-1.5 rounded hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
          >
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <pre className="text-xs p-4 overflow-x-auto text-foreground/90 font-mono leading-relaxed"><code>{block.text}</code></pre>
        </div>
      );
    case "formula":
      return (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">{block.label}</span>
          </div>
          <pre className="text-sm font-mono text-foreground bg-muted/40 rounded px-3 py-2 overflow-x-auto">{block.formula}</pre>
          {block.example && <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Example · </span>{block.example}</p>}
        </div>
      );
    case "table":
      return (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>{block.head.map((h) => <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {row.map((cell, j) => <td key={j} className="px-3 py-2 text-foreground/90">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "snapshot":
      return (
        <div className="rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">{block.caption}</span>
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-line">{block.body}</p>
        </div>
      );
  }
};

// ---------------------------------------------------------------------------
// Main Help page
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Global Compliance Standards Matrix (per module)
// ---------------------------------------------------------------------------

type ComplianceStatus = "covered" | "partial" | "gap";

interface ComplianceRow {
  module: string;
  route: string;
  osha: string;
  iso: string;
  soc2: string;
  retention: string;
  auditTrail: ComplianceStatus;
  auditNotes: string;
}

const complianceMatrix: ComplianceRow[] = [
  { module: "Alerts",              route: "/app/alerts",         osha: "29 CFR 1910.132 (PPE), 1910.147 (LOTO)", iso: "ISO 45001 §8.2 (Emergency)",           soc2: "CC7.2 System Monitoring", retention: "365 days hot / 7 yrs cold",     auditTrail: "covered", auditNotes: "Every ack/assign/resolve appended to audit_log with AUD-id." },
  { module: "Investigations",      route: "/app/investigations",      osha: "29 CFR 1904 (Recordkeeping)",           iso: "ISO 45001 §10.2 (Incident Invest.)",   soc2: "CC7.4, CC7.5 Incident Response", retention: "7 yrs (OSHA 1904.33)",        auditTrail: "covered", auditNotes: "Timeline links alerts, tasks, status changes to audit records." },
  { module: "Resolution Tasks",    route: "/app/investigations",      osha: "29 CFR 1910 (Corrective actions)",      iso: "ISO 9001 §10.2 (Nonconformity)",       soc2: "CC7.4 Remediation",       retention: "3 yrs after close",             auditTrail: "covered", auditNotes: "Assignment, reassignment, completion all logged." },
  { module: "Cameras & Live Feed", route: "/app/cameras",        osha: "29 CFR 1910.132(d) (Hazard assess.)",   iso: "ISO 45001 §6.1.2 (Hazard ID)",         soc2: "CC6.1 Logical Access",    retention: "30-90 days video (configurable)", auditTrail: "partial", auditNotes: "Config changes audited; frame retention depends on gateway policy." },
  { module: "AI Insights",         route: "/app/insights",       osha: "General Duty Clause §5(a)(1)",           iso: "ISO 45001 §9.1 (Performance eval.)",   soc2: "CC4.1 Monitoring Activities", retention: "365 days",                  auditTrail: "covered", auditNotes: "PDF export + tenant-scoped storage; category/model changes audited." },
  { module: "Reports",             route: "/app/reports",        osha: "29 CFR 1904.35 (Employee involvement)", iso: "ISO 9001 §9.1.3 (Analysis)",           soc2: "CC4.2 Communication",     retention: "7 yrs",                         auditTrail: "covered", auditNotes: "Create/export events logged; PDF & CSV are audit-ready." },
  { module: "Shift Handover",      route: "/app/shift-reports",  osha: "29 CFR 1910.120(q) (Emergency response)", iso: "ISO 45001 §7.4 (Communication)",     soc2: "CC2.2 Internal comms.",   retention: "3 yrs",                         auditTrail: "covered", auditNotes: "Handover creation, edits, and unresolved-carryover captured." },
  { module: "Maintenance",         route: "/app/maintenance",    osha: "29 CFR 1910.147 (LOTO)",                iso: "ISO 55000 (Asset Mgmt.), ISO 9001",    soc2: "CC7.1 Change Mgmt.",      retention: "Asset lifetime + 3 yrs",        auditTrail: "covered", auditNotes: "Work orders + MTTR/risk history persisted." },
  { module: "Rules & Policy",      route: "/admin/rules",        osha: "Cross-cutting (varies by rule)",         iso: "ISO 45001 §5.2 (Policy)",              soc2: "CC5.2 Policy Enforcement", retention: "Version-history retained indefinitely", auditTrail: "covered", auditNotes: "Compile/create/edit/deactivate logged with actor and diff." },
  { module: "KPI & OKRs",          route: "/admin/kpi-config",   osha: "N/A (management)",                       iso: "ISO 9001 §6.2 (Objectives)",           soc2: "CC4.1 Monitoring",        retention: "Indefinite",                    auditTrail: "covered", auditNotes: "Threshold changes and target edits audited." },
  { module: "Escalation Policies", route: "/admin/escalation",   osha: "29 CFR 1910.38 (Emergency action)",     iso: "ISO 45001 §8.2 (Emergency prep.)",     soc2: "CC7.4 Response",          retention: "Indefinite (policy versions)",  auditTrail: "covered", auditNotes: "Cron reassignments append to audit_log per hop." },
  { module: "Notifications",       route: "/admin/notifications",osha: "N/A",                                    iso: "ISO 27001 A.16.1 (Comms.)",            soc2: "CC2.3 External comms.",   retention: "Delivery log 90 days",          auditTrail: "partial", auditNotes: "Preference edits audited; provider delivery receipts in notification_log." },
  { module: "AI Model & Categories", route: "/admin/ai-config",  osha: "Supports 1910.132 hazard assessments",  iso: "ISO 45001 §6.1.2, ISO 9001",           soc2: "CC7.1 Change Mgmt.",      retention: "Config version history",        auditTrail: "covered", auditNotes: "Prompt/model/category changes captured with actor id." },
  { module: "Tenants & Users",     route: "/admin",              osha: "N/A",                                    iso: "ISO 27001 A.9 (Access control)",       soc2: "CC6.1, CC6.2, CC6.3",     retention: "Indefinite (membership history)", auditTrail: "covered", auditNotes: "Invitations, role changes, removals all logged." },
  { module: "Audit Log",           route: "/admin/audit-log",    osha: "29 CFR 1904.33 (Records 5 yrs)",        iso: "ISO 27001 A.12.4 (Logging)",           soc2: "CC7.2, CC7.3 Logging",    retention: "Append-only, ≥7 yrs",           auditTrail: "covered", auditNotes: "Immutable append-only table with tenant-scoped RLS." },
];

const statusMeta: Record<ComplianceStatus, { label: string; className: string }> = {
  covered: { label: "Covered",  className: "text-success border-success/40 bg-success/10" },
  partial: { label: "Partial",  className: "text-warning border-warning/40 bg-warning/10" },
  gap:     { label: "Gap",      className: "text-destructive border-destructive/40 bg-destructive/10" },
};

// ---------------------------------------------------------------------------
// Main Help page
// ---------------------------------------------------------------------------

const Help = () => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openArticle, setOpenArticle] = useState<Article | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);

  const filtered = useMemo(() => {
    let list = articles;
    if (activeCategory) list = list.filter((a) => a.category === activeCategory);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((a) =>
        [a.title, a.summary, ...a.tags, a.category].some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [query, activeCategory]);

  const countsByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    articles.forEach((a) => { m[a.category] = (m[a.category] ?? 0) + 1; });
    return m;
  }, []);

  // ─────────────── Article view ───────────────
  if (openArticle) {
    const cat = categories.find((c) => c.id === openArticle.category);
    const CatIcon = cat?.icon ?? BookOpen;
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setOpenArticle(null)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Knowledge Base
        </Button>

        <div className="glass rounded-2xl border border-border p-6 md:p-8 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1"><CatIcon className={cn("w-3 h-3", cat?.color)} /> {cat?.label}</Badge>
            <Badge variant="outline" className="gap-1"><Play className="w-3 h-3" /> {openArticle.readMinutes} min read</Badge>
            {openArticle.tags.slice(0, 4).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>)}
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground leading-tight">{openArticle.title}</h1>
          <p className="text-sm md:text-base text-muted-foreground">{openArticle.summary}</p>
          {openArticle.relatedRoute && (
            <Link to={openArticle.relatedRoute.to}>
              <Button size="sm" variant="outline" className="gap-2">
                <ExternalLink className="w-3.5 h-3.5" /> {openArticle.relatedRoute.label}
              </Button>
            </Link>
          )}
        </div>

        <div className="glass rounded-2xl border border-border p-6 md:p-8 space-y-4">
          {openArticle.blocks.map((b, i) => <BlockRenderer key={i} block={b} />)}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-4">
          <span>Was this article helpful?</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => toast.success("Thanks — feedback recorded")}><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Yes</Button>
            <Button size="sm" variant="ghost" onClick={() => toast.info("Thanks — we'll improve this")}><XCircle className="w-3.5 h-3.5 mr-1" /> No</Button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────── Index view ───────────────
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Knowledge Base"
        icon={HelpCircle}
        title="Help & Documentation"
        description={`${articles.length} in-depth articles across ${categories.length} modules — formulas, snapshots, workflows and compliance mapping.`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setShowMatrix((v) => !v)}>
              <Shield className="w-4 h-4" /> {showMatrix ? "Hide" : "View"} Standards Matrix
            </Button>
            <Link to="/app">
              <Button variant="outline" className="gap-2"><Zap className="w-4 h-4" /> Back to App</Button>
            </Link>
          </div>
        }
      />

      {/* Search */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search across every article, tag, formula…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 bg-card border-border h-11"
          aria-label="Search knowledge base"
        />
      </div>

      {/* Compliance Standards Matrix */}
      {showMatrix && (
        <div className="glass rounded-2xl border border-border p-5 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="font-display text-lg md:text-xl font-semibold">Global Compliance Standards Matrix</h2>
              </div>
              <p className="text-sm text-muted-foreground max-w-3xl">
                Per-module mapping to OSHA (29 CFR 1904/1910), ISO 45001 / 9001 / 27001 / 55000, and SOC 2 Trust Services Criteria — with retention windows and audit-trail completeness. Use this checklist during internal audits, SOC 2 walkthroughs, or ISO 45001 certification prep.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              {(["covered","partial","gap"] as ComplianceStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={cn("inline-block w-2.5 h-2.5 rounded-full", s === "covered" ? "bg-success" : s === "partial" ? "bg-warning" : "bg-destructive")} />
                  {statusMeta[s].label}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Module</th>
                  <th className="text-left px-3 py-2 font-medium">OSHA</th>
                  <th className="text-left px-3 py-2 font-medium">ISO</th>
                  <th className="text-left px-3 py-2 font-medium">SOC 2</th>
                  <th className="text-left px-3 py-2 font-medium">Retention</th>
                  <th className="text-left px-3 py-2 font-medium">Audit Trail</th>
                </tr>
              </thead>
              <tbody>
                {complianceMatrix.map((row) => (
                  <tr key={row.module} className="border-t border-border align-top hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <Link to={row.route} className="font-semibold text-foreground hover:text-primary transition-colors">
                        {row.module}
                      </Link>
                      <div className="text-[11px] text-muted-foreground font-mono">{row.route}</div>
                    </td>
                    <td className="px-3 py-2.5 text-foreground/90 text-xs">{row.osha}</td>
                    <td className="px-3 py-2.5 text-foreground/90 text-xs">{row.iso}</td>
                    <td className="px-3 py-2.5 text-foreground/90 text-xs">{row.soc2}</td>
                    <td className="px-3 py-2.5 text-foreground/90 text-xs">{row.retention}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={cn("text-[10px] mb-1", statusMeta[row.auditTrail].className)}>
                        {statusMeta[row.auditTrail].label}
                      </Badge>
                      <div className="text-[11px] text-muted-foreground leading-snug">{row.auditNotes}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-[11px] text-muted-foreground flex flex-wrap gap-4">
            <span>Sources: OSHA 29 CFR Parts 1904 & 1910 · ISO 45001:2018 · ISO 9001:2015 · ISO 27001:2022 · ISO 55000 · AICPA SOC 2 (2017 TSC).</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar categories */}
        <aside className="space-y-1 lg:sticky lg:top-20 self-start">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
              activeCategory === null ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted/50 border border-transparent"
            )}
          >
            <span className="flex items-center gap-2 font-medium"><Layers className="w-4 h-4" /> All articles</span>
            <Badge variant="secondary" className="text-[10px]">{articles.length}</Badge>
          </button>
          {categories.map((c) => {
            const Icon = c.icon;
            const count = countsByCategory[c.id] ?? 0;
            const active = activeCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors border",
                  active ? "bg-primary/10 text-primary border-primary/20" : "text-muted-foreground hover:bg-muted/50 border-transparent"
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  <Icon className={cn("w-4 h-4", c.color)} /> {c.label}
                </span>
                <Badge variant="secondary" className="text-[10px]">{count}</Badge>
              </button>
            );
          })}
        </aside>

        {/* Article list */}
        <div className="space-y-4">
          {/* Category hero */}
          {activeCategory && (() => {
            const cat = categories.find((c) => c.id === activeCategory)!;
            const Icon = cat.icon;
            return (
              <div className="glass rounded-xl border border-border p-5 flex items-start gap-4">
                <div className={cn("w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center shrink-0")}>
                  <Icon className={cn("w-6 h-6", cat.color)} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold text-foreground">{cat.label}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{cat.description}</p>
                </div>
              </div>
            );
          })()}

          {filtered.length === 0 && (
            <div className="glass rounded-xl border border-border p-12 text-center">
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No articles match your search.</p>
              <Button size="sm" variant="ghost" className="mt-3" onClick={() => { setQuery(""); setActiveCategory(null); }}>Clear filters</Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((a) => {
              const cat = categories.find((c) => c.id === a.category);
              const Icon = cat?.icon ?? BookOpen;
              return (
                <button
                  key={a.id}
                  onClick={() => setOpenArticle(a)}
                  className="text-left glass rounded-xl border border-border p-5 hover:border-primary/30 hover:shadow-lg transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                      <Icon className={cn("w-4 h-4", cat?.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                        {a.title}
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{cat?.label} · {a.readMinutes} min</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{a.summary}</p>
                  <div className="flex flex-wrap gap-1">
                    {a.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;
