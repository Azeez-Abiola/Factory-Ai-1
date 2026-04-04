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
    id: "rpt-1",
    title: "Creating & Managing Reports",
    category: "reports",
    tags: ["reports", "compliance", "export", "create"],
    summary: "Generate compliance reports, customize fields, and export to PDF or CSV.",
    content: [
      {
        heading: "Report Types",
        body: "FactoryAI supports four report types:\n\n• Safety Audit — Comprehensive safety compliance assessment\n• Quality Inspection — Product quality metrics and defect analysis\n• Environmental Audit — Environmental compliance and emissions data\n• Productivity Report — Operational efficiency and output metrics",
        snapshot: "📄 Reports Dashboard\n| Report ID | Title | Type | Score | Status |\n| RPT-001 | Q1 Safety Audit | Safety | 94.2% | Completed |\n| RPT-002 | Line 3 Quality | Quality | 87.5% | In Review |\n| RPT-003 | March Environment | Env. Audit | 91.0% | Draft |",
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
    id: "adm-1",
    title: "Admin Panel Overview",
    category: "admin",
    tags: ["admin", "tenants", "users", "billing"],
    summary: "Manage tenants, users, billing, system monitoring, and platform settings.",
    content: [
      {
        heading: "Tenant Management",
        body: "The Admin Panel allows platform administrators to manage multiple factory tenants. Each tenant represents a separate factory or facility with its own cameras, users, and configurations.",
        snapshot: "🏭 Tenants Overview\n| Tenant | Plan | Users | Cameras | Status |\n| Acme Steel | Enterprise | 45 | 24 | Active |\n| BioPharm Inc | Professional | 18 | 12 | Active |\n| GreenEnergy Co | Starter | 6 | 4 | Trial |",
      },
      {
        heading: "User Roles & Permissions",
        body: "FactoryAI uses a role-based access control system:\n\n• Super Admin — Full platform access, tenant management\n• Tenant Admin — Full access within their tenant\n• Supervisor — View dashboards, manage alerts, create reports\n• Operator — View cameras and acknowledge alerts\n• Viewer — Read-only access to dashboards and reports",
        tip: "Always follow the principle of least privilege — assign the minimum role needed for each user's responsibilities.",
      },
    ],
  },
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
