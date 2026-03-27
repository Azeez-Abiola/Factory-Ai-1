import { useState } from "react";
import { Clock, Shield, AlertTriangle, CheckCircle, TrendingUp, ChevronRight, FileText, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockShiftReports, ShiftReport } from "@/data/extendedMockData";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const ShiftReports = () => {
  const [selectedReport, setSelectedReport] = useState<ShiftReport | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Shift Handover Reports</h1>
        <p className="text-sm text-muted-foreground">Auto-generated end-of-shift summaries</p>
      </div>

      <div className="space-y-4">
        {mockShiftReports.map((report) => (
          <div
            key={report.id}
            onClick={() => setSelectedReport(report)}
            className="glass rounded-xl p-5 border border-border hover:border-primary/30 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{report.shiftName}</h3>
                  <p className="text-xs text-muted-foreground">{report.date} · {report.startTime}–{report.endTime} · {report.supervisor}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Safety:</span>
                <span className={cn("font-semibold", report.safetyScore >= 90 ? "text-success" : report.safetyScore >= 80 ? "text-warning" : "text-destructive")}>
                  {report.safetyScore}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-muted-foreground">Incidents:</span>
                <span className="text-foreground font-semibold">{report.incidentsCount}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-muted-foreground">Resolved:</span>
                <span className="text-foreground font-semibold">{report.resolvedCount}/{report.incidentsCount}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Efficiency:</span>
                <span className="text-foreground font-semibold">{report.productionEfficiency}%</span>
              </div>
            </div>

            {report.unresolvedCount > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                  {report.unresolvedCount} unresolved
                </Badge>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          {selectedReport && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  {selectedReport.shiftName} – {selectedReport.date}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Safety Score", value: `${selectedReport.safetyScore}%`, color: selectedReport.safetyScore >= 90 ? "text-success" : "text-warning" },
                    { label: "Incidents", value: selectedReport.incidentsCount, color: "text-foreground" },
                    { label: "Resolved", value: `${selectedReport.resolvedCount}/${selectedReport.incidentsCount}`, color: "text-success" },
                    { label: "Efficiency", value: `${selectedReport.productionEfficiency}%`, color: "text-primary" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                      <p className={cn("text-lg font-bold", stat.color)}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Key Events</h4>
                  <ul className="space-y-2">
                    {selectedReport.keyEvents.map((evt, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ArrowRight className="w-3 h-3 mt-1 shrink-0 text-primary" />
                        {evt}
                      </li>
                    ))}
                  </ul>
                </div>

                {selectedReport.unresolvedIssues.length > 0 && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-destructive mb-2">Unresolved Issues</h4>
                    <ul className="space-y-1">
                      {selectedReport.unresolvedIssues.map((issue, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <AlertTriangle className="w-3 h-3 mt-1 shrink-0 text-destructive" />
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-primary mb-2">AI Recommendations</h4>
                  <ul className="space-y-1">
                    {selectedReport.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-foreground flex items-start gap-2">
                        <CheckCircle className="w-3 h-3 mt-1 shrink-0 text-primary" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="w-4 h-4" /> Export PDF
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftReports;
