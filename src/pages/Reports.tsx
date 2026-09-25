import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Download, CheckCircle, XCircle, Clock, TrendingUp, Search, ArrowUpDown, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import CreateReportDialog from "@/components/reports/CreateReportDialog";
import ScheduledReportsDialog from "@/components/reports/ScheduledReportsDialog";
import { CalendarClock } from "lucide-react";
import { downloadCSV } from "@/lib/exporters";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { reportTypeLabel, type ReportRow } from "@/lib/reportBuilder";
import { useFocusAreas } from "@/hooks/useFocusAreas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageHeader from "@/components/app/PageHeader";

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  passed: { icon: CheckCircle, color: "text-success", bg: "bg-success/10 border-success/30", label: "Passed" },
  failed: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", label: "Failed" },
  pending: { icon: Clock, color: "text-warning", bg: "bg-warning/10 border-warning/30", label: "Pending" },
};

type SortField = "date" | "score" | "findings" | "title";
type SortDir = "asc" | "desc";

const Reports = () => {
  const { activeTenantId, activeTenant } = useTenants();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [createOpen, setCreateOpen] = useState(false);
  const { areas } = useFocusAreas(activeTenantId);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!activeTenantId) {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("tenant_id", activeTenantId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Could not load reports");
    setReports((data ?? []) as unknown as ReportRow[]);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeTenantId) return;
    const channel = supabase
      .channel(`reports-${activeTenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reports", filter: `tenant_id=eq.${activeTenantId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTenantId, load]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
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
          (r.reference ?? "").toLowerCase().includes(q) ||
          (r.generated_by_name ?? "").toLowerCase().includes(q),
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date": cmp = a.created_at.localeCompare(b.created_at); break;
        case "score": cmp = a.score - b.score; break;
        case "findings": cmp = a.findings_count - b.findings_count; break;
        case "title": cmp = a.title.localeCompare(b.title); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [filterType, filterStatus, search, sortField, sortDir, reports]);

  const totalPassed = reports.filter((r) => r.status === "passed").length;
  const totalFailed = reports.filter((r) => r.status === "failed").length;
  const totalPending = reports.filter((r) => r.status === "pending").length;
  const scored = reports.filter((r) => r.score > 0);
  const avgScore = Math.round(scored.reduce((a, b) => a + b.score, 0) / (scored.length || 1));

  const handleExportAll = () => {
    if (filtered.length === 0) return toast.info("No reports to export");
    const rows: (string | number)[][] = [
      ["Reference", "Title", "Type", "Status", "Score", "Findings", "Period start", "Period end", "Created", "Generated by"],
      ...filtered.map((r) => [
        r.reference, r.title, reportTypeLabel(r), r.status, r.score, r.findings_count,
        r.period_start?.slice(0, 10) ?? "", r.period_end?.slice(0, 10) ?? "",
        r.created_at.slice(0, 10), r.generated_by_name,
      ]),
    ];
    downloadCSV(`reports-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success(`Exported ${filtered.length} report${filtered.length > 1 ? "s" : ""}`);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) return toast.error("Could not delete that report");
    toast.success("Report deleted");
    load();
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => toggleSort(field)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium transition-colors",
        sortField === field ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance"
        icon={FileText}
        title="Reports & Compliance"
        description={
          loading
            ? "Loading reports…"
            : `${filtered.length} of ${reports.length} reports for ${activeTenant?.name ?? "this site"} · generated from live camera activity.`
        }
        actions={
          <>
            <Button onClick={() => setCreateOpen(true)} disabled={!activeTenantId}>
              <Plus className="w-4 h-4 mr-2" /> Generate Report
            </Button>
            <Button variant="outline" className="border-border" onClick={() => setScheduleOpen(true)} disabled={!activeTenantId}>
              <CalendarClock className="w-4 h-4 mr-2" /> Schedules
            </Button>
            <Button variant="outline" className="border-border" onClick={load}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Refresh
            </Button>
            <Button variant="outline" className="border-border" onClick={handleExportAll}>
              <Download className="w-4 h-4 mr-2" /> Export All
            </Button>
          </>
        }
      />

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
          <SelectTrigger className="w-full sm:w-56 bg-card border-border">
            <SelectValue placeholder="Focus area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All focus areas</SelectItem>
            {[...new Map<string, string>([
              ...areas.map((a) => [a.value, a.label] as const),
              ...reports.map((r) => [r.type, reportTypeLabel(r)] as const),
            ]).entries()].map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: CheckCircle, value: totalPassed, label: "Passed", iconClass: "text-success", bgClass: "bg-success/10" },
          { icon: XCircle, value: totalFailed, label: "Failed", iconClass: "text-destructive", bgClass: "bg-destructive/10" },
          { icon: Clock, value: totalPending, label: "Pending", iconClass: "text-warning", bgClass: "bg-warning/10" },
          { icon: TrendingUp, value: `${scored.length ? avgScore : 0}%`, label: "Avg Score", iconClass: "text-primary", bgClass: "bg-primary/10" },
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

      <div className="glass rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_80px_80px_80px_100px_40px] gap-4 px-5 py-3 border-b border-border">
          <SortButton field="title" label="Report" />
          <span className="text-xs text-muted-foreground font-medium">Type</span>
          <span className="text-xs text-muted-foreground font-medium">Status</span>
          <SortButton field="score" label="Score" />
          <SortButton field="findings" label="Findings" />
          <SortButton field="date" label="Date" />
          <span className="sr-only">Actions</span>
        </div>

        {!loading && filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-muted-foreground text-sm">
            {reports.length === 0
              ? "No reports yet — use Generate Report to build one from this site's live activity."
              : "No reports match your filters."}
          </div>
        )}

        {loading && (
          <div className="px-5 py-12 text-center text-muted-foreground text-sm">Loading reports…</div>
        )}

        {filtered.map((report) => {
          const config = statusConfig[report.status] ?? statusConfig.pending;
          return (
            <div
              key={report.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/app/reports/${report.id}`)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/app/reports/${report.id}`); } }}
              className="grid grid-cols-[1fr_100px_80px_80px_80px_100px_40px] gap-4 px-5 py-4 border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{report.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">{report.reference}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs w-fit">
                {reportTypeLabel(report)}
              </Badge>
              <Badge variant="outline" className={cn("text-xs w-fit", config.bg)}>
                {config.label}
              </Badge>
              <span className="text-sm font-mono text-foreground">
                {report.status === "pending" ? "—" : `${report.score}%`}
              </span>
              <span className="text-sm text-foreground">{report.findings_count}</span>
              <span className="text-xs text-muted-foreground">{report.created_at.slice(0, 10)}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${report.reference}`}
                title="Delete report"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <ScheduledReportsDialog open={scheduleOpen} onOpenChange={setScheduleOpen} tenantId={activeTenantId} onRan={load} />
      <CreateReportDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        tenantId={activeTenantId}
        tenantName={activeTenant?.name}
        reportCount={reports.length}
        onCreated={load}
      />
    </div>
  );
};

export default Reports;
