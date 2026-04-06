import { useParams, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import {
  ArrowLeft, FileText, Download, CheckCircle, XCircle, Clock,
  TrendingUp, AlertTriangle, BarChart3, Shield, ClipboardList, Calendar,
  User, Printer, Share2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockReports, ComplianceReport } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar
} from "recharts";

const statusConfig = {
  passed: { icon: CheckCircle, color: "text-success", bg: "bg-success/10 border-success/30", label: "Passed" },
  failed: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", label: "Failed" },
  pending: { icon: Clock, color: "text-warning", bg: "bg-warning/10 border-warning/30", label: "Pending" },
};

const typeLabels: Record<string, string> = {
  safety: "Safety",
  quality: "Quality",
  audit: "Audit",
  productivity: "Productivity",
};

const typeColors: Record<string, string> = {
  safety: "hsl(0 72% 51%)",
  quality: "hsl(38 92% 50%)",
  audit: "hsl(262 83% 58%)",
  productivity: "hsl(172 66% 50%)",
};

const findingsData = [
  { category: "PPE Compliance", count: 3, severity: "high" },
  { category: "Machine Safety Guards", count: 2, severity: "medium" },
  { category: "Chemical Storage", count: 1, severity: "low" },
  { category: "Emergency Exit Access", count: 1, severity: "medium" },
  { category: "Electrical Safety", count: 2, severity: "high" },
];

const complianceTimeline = [
  { month: "Oct", score: 78 },
  { month: "Nov", score: 82 },
  { month: "Dec", score: 85 },
  { month: "Jan", score: 80 },
  { month: "Feb", score: 88 },
  { month: "Mar", score: 87 },
];

const radarData = [
  { area: "PPE", score: 85, fullMark: 100 },
  { area: "Machine Safety", score: 90, fullMark: 100 },
  { area: "Chemical", score: 75, fullMark: 100 },
  { area: "Fire Safety", score: 92, fullMark: 100 },
  { area: "Ergonomics", score: 88, fullMark: 100 },
  { area: "Electrical", score: 70, fullMark: 100 },
];

const findingsList = [
  {
    id: "F-001",
    title: "PPE violation in Zone B – Hard hat not worn",
    severity: "critical",
    zone: "Zone B",
    occurrences: 2,
    status: "open",
    description: "Two workers detected without hard hats in the heavy machinery area during the 09:00–10:00 window. Camera CAM-04 flagged both incidents.",
    correctiveAction: "Immediate verbal warning issued. Extra PPE stock deployed to Zone B entry point.",
  },
  {
    id: "F-002",
    title: "Machine idle time exceeded threshold on Line 3",
    severity: "high",
    zone: "Zone D",
    occurrences: 1,
    status: "resolved",
    description: "Packaging Line 3 idle for 18 minutes during peak production. No operator detected at station.",
    correctiveAction: "Backup operator assigned. Shift roster updated to prevent recurrence.",
  },
  {
    id: "F-003",
    title: "Label misalignment on packaging Line 3",
    severity: "medium",
    zone: "Zone E",
    occurrences: 3,
    status: "open",
    description: "3 consecutive units had misaligned labels. Likely caused by humidity exceeding 65% threshold in Zone E.",
    correctiveAction: "Dehumidifier installation recommended. Temporary adhesive adjustment applied.",
  },
  {
    id: "F-004",
    title: "Emergency exit partially obstructed in Zone A",
    severity: "high",
    zone: "Zone A",
    occurrences: 1,
    status: "resolved",
    description: "Storage crates placed near emergency exit reducing clearance below minimum required width.",
    correctiveAction: "Crates relocated immediately. Floor markings refreshed to prevent recurrence.",
  },
  {
    id: "F-005",
    title: "Electrical panel cover missing in maintenance bay",
    severity: "critical",
    zone: "Zone A",
    occurrences: 1,
    status: "open",
    description: "Panel cover removed during maintenance and not replaced, creating electrical hazard.",
    correctiveAction: "Maintenance team notified. Lockout/tagout procedure review scheduled.",
  },
];

const severityColors: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-warning/10 text-warning border-warning/30",
  medium: "bg-primary/10 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
};

const severityDotColors: Record<string, string> = {
  critical: "bg-destructive",
  high: "bg-warning",
  medium: "bg-primary",
  low: "bg-muted-foreground",
};

const pieData = [
  { name: "Critical", value: 2, color: "hsl(0 72% 51%)" },
  { name: "High", value: 2, color: "hsl(38 92% 50%)" },
  { name: "Medium", value: 3, color: "hsl(172 66% 50%)" },
  { name: "Low", value: 1, color: "hsl(215 20% 65%)" },
];

const ReportDetail = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();

  const report = useMemo(() => {
    return mockReports.find((r) => r.id === reportId) || null;
  }, [reportId]);

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Report Not Found</h2>
        <p className="text-muted-foreground mb-6">The report you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => navigate("/app/reports")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Reports
        </Button>
      </div>
    );
  }

  const config = statusConfig[report.status];
  const StatusIcon = config.icon;
  const scoreColor = report.score >= 90 ? "text-success" : report.score >= 75 ? "text-warning" : "text-destructive";
  const scoreBarColor = report.score >= 90 ? "bg-success" : report.score >= 75 ? "bg-warning" : "bg-destructive";
  const adjustedFindings = findingsList.slice(0, Math.max(report.findings, 3));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit -ml-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/app/reports")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Reports
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{report.title}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">{typeLabels[report.type]}</Badge>
                <Badge variant="outline" className={cn("text-xs", config.bg)}>
                  <StatusIcon className={cn("w-3 h-3 mr-1", config.color)} />
                  {config.label}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{report.id}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="border-border" onClick={() => toast.success("Report shared via link")}>
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
            <Button variant="outline" size="sm" className="border-border" onClick={() => toast.success("Preparing print view...")}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            <Button size="sm" onClick={() => toast.success(`Downloading ${report.id} as PDF`)}>
              <Download className="w-4 h-4 mr-2" /> Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", report.score > 0 ? "bg-primary/10" : "bg-muted")}>
                <TrendingUp className={cn("w-5 h-5", report.score > 0 ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Compliance Score</p>
                <p className={cn("text-2xl font-bold", report.score > 0 ? scoreColor : "text-muted-foreground")}>
                  {report.score > 0 ? `${report.score}%` : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Findings</p>
                <p className="text-2xl font-bold text-foreground">{report.findings}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Report Date</p>
                <p className="text-lg font-bold text-foreground">{report.date}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Generated By</p>
                <p className="text-lg font-bold text-foreground">{report.generatedBy}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score Bar */}
      {report.score > 0 && (
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Overall Compliance Score</p>
                <p className="text-xs text-muted-foreground">Based on {report.findings} findings across all categories</p>
              </div>
              <span className={cn("text-3xl font-bold", scoreColor)}>{report.score}%</span>
            </div>
            <Progress value={report.score} className="h-3" />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>0%</span>
              <span className="text-destructive">Below 75% = Failed</span>
              <span>100%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Executive Summary */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" /> Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground leading-relaxed">
            This {typeLabels[report.type].toLowerCase()} report was generated on {report.date} by the {report.generatedBy}.
            {report.status === "passed"
              ? ` The assessment resulted in a ${config.label.toLowerCase()} status with a compliance score of ${report.score}%. While ${report.findings} finding(s) were identified, none were critical enough to warrant a failed status.`
              : report.status === "failed"
              ? ` The assessment resulted in a ${config.label.toLowerCase()} status with a score of ${report.score}%, below the 75% passing threshold. A total of ${report.findings} finding(s) require immediate attention and corrective action.`
              : ` This report is currently ${config.label.toLowerCase()} review. Findings and scores will be updated once the assessment is complete.`}
          </p>
          <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
            <p className="text-xs font-semibold text-primary mb-1">💡 AI Recommendation</p>
            <p className="text-sm text-foreground">
              {report.status === "failed"
                ? "Immediate corrective actions are required. Focus on the critical and high-severity findings first. Schedule a follow-up audit within 7 days to verify remediation."
                : report.score < 90
                ? "While the report passed, there's room for improvement. Consider addressing the identified findings proactively to prevent future failures."
                : "Excellent compliance performance. Maintain current practices and continue regular monitoring."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Compliance Trend */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Compliance Trend (6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={complianceTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[60, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Severity Distribution */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Finding Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Compliance Radar */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Compliance by Area</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart cx="50%" cy="50%" outerRadius={70} data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="area" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Findings by Category */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Findings by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={findingsData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="category" type="category" width={140} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Findings" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Findings List */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Detailed Findings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {adjustedFindings.map((finding) => (
            <div key={finding.id} className="border border-border rounded-xl p-4 hover:border-primary/20 transition-colors">
              <div className="flex items-start gap-3">
                <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5 shrink-0", severityDotColors[finding.severity])} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{finding.title}</span>
                    <Badge variant="outline" className={cn("text-xs", severityColors[finding.severity])}>
                      {finding.severity}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{finding.zone}</Badge>
                    <Badge variant="outline" className={cn("text-xs", finding.status === "resolved" ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30")}>
                      {finding.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{finding.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span>ID: <span className="font-mono text-foreground">{finding.id}</span></span>
                    <span>·</span>
                    <span>{finding.occurrences} occurrence{finding.occurrences !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="bg-primary/5 border border-primary/15 rounded-lg p-2.5">
                    <p className="text-xs font-semibold text-primary mb-0.5">Corrective Action</p>
                    <p className="text-xs text-foreground">{finding.correctiveAction}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Report Metadata */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Report Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground">Report ID</p>
              <p className="font-mono text-sm text-foreground">{report.id}</p>
            </div>
            <div className="glass rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground">Report Type</p>
              <p className="text-sm text-foreground">{typeLabels[report.type]}</p>
            </div>
            <div className="glass rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground">Generated By</p>
              <p className="text-sm text-foreground">{report.generatedBy}</p>
            </div>
            <div className="glass rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground">Date Generated</p>
              <p className="text-sm text-foreground">{report.date}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportDetail;
