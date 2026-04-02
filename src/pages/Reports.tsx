import { useState, useMemo } from "react";
import { FileText, Download, CheckCircle, XCircle, Clock, TrendingUp, Search, ArrowUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { mockReports, ComplianceReport } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import CreateReportDialog from "@/components/reports/CreateReportDialog";
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

type SortField = "date" | "score" | "findings" | "title";
type SortDir = "asc" | "desc";

const Reports = () => {
  const [reports, setReports] = useState<ComplianceReport[]>([...mockReports]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedReport, setSelectedReport] = useState<ComplianceReport | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    let result = [...reports];

    if (filterType !== "all") result = result.filter((r) => r.type === filterType);
    if (filterStatus !== "all") result = result.filter((r) => r.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.generatedBy.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date":
          cmp = a.date.localeCompare(b.date);
          break;
        case "score":
          cmp = a.score - b.score;
          break;
        case "findings":
          cmp = a.findings - b.findings;
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [filterType, filterStatus, search, sortField, sortDir, reports]);

  const totalPassed = reports.filter((r) => r.status === "passed").length;
  const totalFailed = reports.filter((r) => r.status === "failed").length;
  const totalPending = reports.filter((r) => r.status === "pending").length;
  const avgScore = Math.round(
    reports.filter((r) => r.score > 0).reduce((a, b) => a + b.score, 0) /
      (reports.filter((r) => r.score > 0).length || 1)
  );

  const handleCreateReport = (report: ComplianceReport) => {
    setReports((prev) => [report, ...prev]);
  };

  const handleExportAll = () => {
    toast.success(`Exporting ${filtered.length} report(s) as CSV...`);
  };

  const handleDownloadPdf = (report: ComplianceReport) => {
    toast.success(`Downloading ${report.id} – ${report.title} as PDF`);
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => toggleSort(field)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium transition-colors",
        sortField === field ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Compliance</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {reports.length} reports shown
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create Report
          </Button>
          <Button variant="outline" className="border-border" onClick={handleExportAll}>
            <Download className="w-4 h-4 mr-2" /> Export All
          </Button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
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
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="passed">Passed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: CheckCircle, value: totalPassed, label: "Passed", iconClass: "text-success", bgClass: "bg-success/10" },
          { icon: XCircle, value: totalFailed, label: "Failed", iconClass: "text-destructive", bgClass: "bg-destructive/10" },
          { icon: Clock, value: totalPending, label: "Pending", iconClass: "text-warning", bgClass: "bg-warning/10" },
          { icon: TrendingUp, value: `${avgScore}%`, label: "Avg Score", iconClass: "text-primary", bgClass: "bg-primary/10" },
        ].map((card) => (
          <div key={card.label} className="glass rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", card.bgClass)}>
                <card.icon className={cn("w-4 h-4", card.iconClass)} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Report Table */}
      <div className="glass rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_80px_80px_80px_100px] gap-4 px-5 py-3 border-b border-border">
          <SortButton field="title" label="Report" />
          <span className="text-xs text-muted-foreground font-medium">Type</span>
          <span className="text-xs text-muted-foreground font-medium">Status</span>
          <SortButton field="score" label="Score" />
          <SortButton field="findings" label="Findings" />
          <SortButton field="date" label="Date" />
        </div>

        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-muted-foreground text-sm">
            No reports match your filters.
          </div>
        )}

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

      {/* Report Detail Dialog */}
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

                <Button variant="outline" className="w-full border-border" onClick={() => handleDownloadPdf(selectedReport)}>
                  <Download className="w-4 h-4 mr-2" /> Download Report PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Report Dialog */}
      <CreateReportDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreateReport={handleCreateReport}
        reportCount={reports.length}
      />
    </div>
  );
};

export default Reports;
