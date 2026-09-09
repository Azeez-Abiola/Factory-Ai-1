import { useParams, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, FileText, Download, CheckCircle, XCircle, Clock,
  TrendingUp, AlertTriangle, BarChart3, Shield, ClipboardList, Calendar,
  User, Printer, Share2, RefreshCw, Camera as CameraIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { downloadTablePDF } from "@/lib/exporters";
import { supabase } from "@/integrations/supabase/client";
import { buildReport, emptyReportData, REPORT_TYPE_LABELS, type ReportRow } from "@/lib/reportBuilder";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar
} from "recharts";

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  passed: { icon: CheckCircle, color: "text-success", bg: "bg-success/10 border-success/30", label: "Passed" },
  failed: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", label: "Failed" },
  pending: { icon: Clock, color: "text-warning", bg: "bg-warning/10 border-warning/30", label: "Pending" },
};

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

const sliceColors = ["hsl(0 72% 51%)", "hsl(38 92% 50%)", "hsl(172 66% 50%)", "hsl(215 20% 65%)"];

const ReportDetail = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!reportId) return;
    setLoading(true);
    const { data } = await supabase.from("reports").select("*").eq("id", reportId).maybeSingle();
    setReport((data as unknown as ReportRow) ?? null);
    setLoading(false);
  }, [reportId]);

  useEffect(() => { load(); }, [load]);

  const handleRegenerate = async () => {
    if (!report) return;
    setRefreshing(true);
    try {
      const start = report.period_start ? new Date(report.period_start) : new Date(Date.now() - 7 * 864e5);
      const end = report.period_end ? new Date(report.period_end) : new Date();
      const built = await buildReport(report.tenant_id, report.type, start, end);
      const { error } = await supabase
        .from("reports")
        .update({
          score: built.score,
          status: built.status,
          findings_count: built.findings_count,
          summary: built.summary,
          data: JSON.parse(JSON.stringify(built.data)),
        })
        .eq("id", report.id);
      if (error) throw error;
      toast.success("Report refreshed against the latest activity");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not refresh the report");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading report…</div>;
  }

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

  const data = report.data ?? emptyReportData();
  const findings = data.findings ?? [];
  const config = statusConfig[report.status] ?? statusConfig.pending;
  const StatusIcon = config.icon;
  const typeLabel = REPORT_TYPE_LABELS[report.type] ?? report.type;
  const scoreColor = report.score >= 90 ? "text-success" : report.score >= 75 ? "text-warning" : "text-destructive";
  const created = report.created_at.slice(0, 10);
  const periodLabel =
    report.period_start && report.period_end
      ? `${report.period_start.slice(0, 10)} → ${report.period_end.slice(0, 10)}`
      : created;
  const pieData = (data.bySeverity ?? []).filter((s) => s.value > 0);

  return (
    <div className="space-y-6">
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
                <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
                <Badge variant="outline" className={cn("text-xs", config.bg)}>
                  <StatusIcon className={cn("w-3 h-3 mr-1", config.color)} />
                  {config.label}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{report.reference}</span>
                <span className="text-xs text-muted-foreground">{periodLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="border-border" onClick={handleRegenerate} disabled={refreshing}>
              <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                toast.success("Report link copied");
              }}
            >
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
            <Button variant="outline" size="sm" className="border-border" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            <Button size="sm" onClick={() => {
              downloadTablePDF({
                filename: `${report.reference}.pdf`,
                title: report.title,
                subtitle: `${typeLabel} · ${config.label} · ${periodLabel} · Generated by ${report.generated_by_name}`,
                head: ["Finding", "Severity", "Zone", "Camera", "Occurrences", "Status"],
                body: findings.length
                  ? findings.map((f) => [f.title, f.severity, f.zone, f.camera, f.occurrences, f.status])
                  : [["No findings recorded in this period", "—", "—", "—", 0, "—"]],
                orientation: "landscape",
              });
              toast.success(`Downloaded ${report.reference}.pdf`);
            }}>
              <Download className="w-4 h-4 mr-2" /> Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Compliance Score</p>
                <p className={cn("text-2xl font-bold", scoreColor)}>{report.score}%</p>
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
                <p className="text-xs text-muted-foreground">Findings</p>
                <p className="text-2xl font-bold text-foreground">{report.findings_count}</p>
                <p className="text-[11px] text-muted-foreground">{data.totals?.open ?? 0} still open</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CameraIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cameras covered</p>
                <p className="text-2xl font-bold text-foreground">{data.totals?.cameras ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">{data.totals?.alerts ?? 0} events reviewed</p>
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
                <p className="text-xs text-muted-foreground">Generated by</p>
                <p className="text-base font-bold text-foreground truncate">{report.generated_by_name}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {created}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Overall Compliance Score</p>
              <p className="text-xs text-muted-foreground">Based on {report.findings_count} finding(s) across all categories</p>
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

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" /> Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground leading-relaxed">{report.summary}</p>
          <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
            <p className="text-xs font-semibold text-primary mb-1">Recommended next step</p>
            <p className="text-sm text-foreground">
              {report.status === "failed"
                ? "Immediate corrective actions are required. Work the critical and high-severity findings first, then re-run this report within 7 days to verify the fix."
                : report.score < 90
                ? "This period passed, but there is room to improve. Close the open findings below before they repeat."
                : "Strong performance. Keep current practices and continue routine monitoring."}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Score trend (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Severity mix</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {pieData.length === 0 ? (
              <p className="py-16 text-sm text-muted-foreground">No events in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((_, i) => <Cell key={i} fill={sliceColors[i % sliceColors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Performance by area</CardTitle>
          </CardHeader>
          <CardContent>
            {(data.byArea ?? []).length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Nothing to chart yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart cx="50%" cy="50%" outerRadius={70} data={data.byArea}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="area" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Events by category
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(data.byCategory ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No events recorded in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.byCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="category" type="category" width={140} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Events" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Detailed findings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {findings.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing was flagged in this period — no corrective action needed.
            </p>
          )}
          {findings.map((finding) => (
            <div key={finding.id} className="border border-border rounded-xl p-4 hover:border-primary/20 transition-colors">
              <div className="flex items-start gap-3">
                <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5 shrink-0", severityDotColors[finding.severity] ?? "bg-muted-foreground")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{finding.title}</span>
                    <Badge variant="outline" className={cn("text-xs", severityColors[finding.severity] ?? severityColors.low)}>
                      {finding.severity}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{finding.zone}</Badge>
                    <Badge variant="outline" className="text-xs">{finding.camera}</Badge>
                    <Badge variant="outline" className={cn("text-xs", finding.status === "resolved" ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30")}>
                      {finding.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{finding.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span>First seen {new Date(finding.detected_at).toLocaleString()}</span>
                    <span>·</span>
                    <span>{finding.occurrences} occurrence{finding.occurrences !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="bg-primary/5 border border-primary/15 rounded-lg p-2.5">
                    <p className="text-xs font-semibold text-primary mb-0.5">Corrective action</p>
                    <p className="text-xs text-foreground">{finding.correctiveAction}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportDetail;
