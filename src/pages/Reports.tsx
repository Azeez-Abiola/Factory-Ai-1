import { useState } from "react";
import { FileText, Download, CheckCircle, XCircle, Clock, Filter, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockReports, ComplianceReport } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

const Reports = () => {
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<ComplianceReport | null>(null);

  const filtered = filterType === "all" ? mockReports : mockReports.filter((r) => r.type === filterType);

  const totalPassed = mockReports.filter((r) => r.status === "passed").length;
  const totalFailed = mockReports.filter((r) => r.status === "failed").length;
  const avgScore = Math.round(mockReports.filter((r) => r.score > 0).reduce((a, b) => a + b.score, 0) / mockReports.filter((r) => r.score > 0).length);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Compliance</h1>
          <p className="text-sm text-muted-foreground">{mockReports.length} reports generated</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40 bg-card border-border">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="safety">Safety</SelectItem>
              <SelectItem value="quality">Quality</SelectItem>
              <SelectItem value="audit">Audit</SelectItem>
              <SelectItem value="productivity">Productivity</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="border-border">
            <Download className="w-4 h-4 mr-2" /> Export All
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-5 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalPassed}</p>
              <p className="text-xs text-muted-foreground">Reports Passed</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-5 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalFailed}</p>
              <p className="text-xs text-muted-foreground">Reports Failed</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-5 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{avgScore}%</p>
              <p className="text-xs text-muted-foreground">Avg Compliance Score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Report List */}
      <div className="glass rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_80px_80px_80px_100px] gap-4 px-5 py-3 border-b border-border text-xs text-muted-foreground font-medium">
          <span>Report</span>
          <span>Type</span>
          <span>Status</span>
          <span>Score</span>
          <span>Findings</span>
          <span>Date</span>
        </div>
        {filtered.map((report) => {
          const config = statusConfig[report.status];
          return (
            <div
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className="grid grid-cols-[1fr_100px_80px_80px_80px_100px] gap-4 px-5 py-4 border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors items-center"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{report.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">{report.id}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs w-fit">
                {typeLabels[report.type]}
              </Badge>
              <Badge variant="outline" className={cn("text-xs w-fit", config.bg)}>
                {config.label}
              </Badge>
              <span className="text-sm font-mono text-foreground">
                {report.score > 0 ? `${report.score}%` : "—"}
              </span>
              <span className="text-sm text-foreground">{report.findings}</span>
              <span className="text-xs text-muted-foreground">{report.date}</span>
            </div>
          );
        })}
      </div>

      {/* Report Detail */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-lg bg-card border-border">
          {selectedReport && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  {selectedReport.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Badge variant="outline">{typeLabels[selectedReport.type]}</Badge>
                  <Badge variant="outline" className={cn(statusConfig[selectedReport.status].bg)}>
                    {statusConfig[selectedReport.status].label}
                  </Badge>
                </div>

                {selectedReport.score > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Compliance Score</span>
                      <span className={cn("text-lg font-bold", selectedReport.score >= 80 ? "text-success" : "text-destructive")}>
                        {selectedReport.score}%
                      </span>
                    </div>
                    <Progress value={selectedReport.score} className="h-2" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="glass rounded-lg p-3 border border-border">
                    <p className="text-xs text-muted-foreground">Report ID</p>
                    <p className="font-mono text-foreground">{selectedReport.id}</p>
                  </div>
                  <div className="glass rounded-lg p-3 border border-border">
                    <p className="text-xs text-muted-foreground">Generated By</p>
                    <p className="text-foreground">{selectedReport.generatedBy}</p>
                  </div>
                  <div className="glass rounded-lg p-3 border border-border">
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="text-foreground">{selectedReport.date}</p>
                  </div>
                  <div className="glass rounded-lg p-3 border border-border">
                    <p className="text-xs text-muted-foreground">Findings</p>
                    <p className="text-foreground">{selectedReport.findings} issue{selectedReport.findings !== 1 ? "s" : ""}</p>
                  </div>
                </div>

                {selectedReport.findings > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Findings Summary</p>
                    {Array.from({ length: Math.min(selectedReport.findings, 3) }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-sm">
                        <div className={cn("w-2 h-2 rounded-full", i === 0 ? "bg-destructive" : "bg-warning")} />
                        <span className="text-foreground">
                          {["PPE violation in Zone B - 2 occurrences", "Machine idle time exceeded threshold", "Label misalignment on Line 3"][i % 3]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <Button variant="outline" className="w-full border-border">
                  <Download className="w-4 h-4 mr-2" /> Download Report PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;
