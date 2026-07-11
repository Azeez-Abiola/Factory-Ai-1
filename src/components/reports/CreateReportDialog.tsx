import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComplianceReport } from "@/data/mockData";
import { toast } from "sonner";
import FieldLabel from "@/components/forms/FieldLabel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateReport: (report: ComplianceReport) => void;
  reportCount: number;
}

const CreateReportDialog = ({ open, onOpenChange, onCreateReport, reportCount }: CreateReportDialogProps) => {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ComplianceReport["type"]>("safety");
  const [status, setStatus] = useState<ComplianceReport["status"]>("pending");
  const [score, setScore] = useState("");
  const [findings, setFindings] = useState("");
  const [generatedBy, setGeneratedBy] = useState("");

  const resetForm = () => {
    setTitle("");
    setType("safety");
    setStatus("pending");
    setScore("");
    setFindings("");
    setGeneratedBy("");
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Report title is required");
      return;
    }

    const newReport: ComplianceReport = {
      id: `RPT-${String(reportCount + 1).padStart(3, "0")}`,
      title: title.trim(),
      type,
      date: new Date().toISOString().split("T")[0],
      status,
      score: status === "pending" ? 0 : Math.min(100, Math.max(0, Number(score) || 0)),
      findings: Math.max(0, Number(findings) || 0),
      generatedBy: generatedBy.trim() || "Manual Entry",
    };

    onCreateReport(newReport);
    toast.success(`Report ${newReport.id} created successfully`);
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Create New Report
          </DialogTitle>
          <DialogDescription>Fill in the details to generate a new compliance report.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <FieldLabel required htmlFor="rpt-title">Report Title</FieldLabel>
            <Input
              id="rpt-title"
              placeholder="e.g. Daily Safety Compliance Report"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel required>Type</FieldLabel>
              <Select value={type} onValueChange={(v) => setType(v as ComplianceReport["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="audit">Audit</SelectItem>
                  <SelectItem value="productivity">Productivity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FieldLabel required>Status</FieldLabel>
              <Select value={status} onValueChange={(v) => setStatus(v as ComplianceReport["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {status !== "pending" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel hint="Compliance percentage.">Score</FieldLabel>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="87"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/100</span>
                </div>
              </div>
              <div className="space-y-2">
                <FieldLabel hint="Total issues discovered.">Findings</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  placeholder="3"
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <FieldLabel optional>Generated By</FieldLabel>
            <Input
              placeholder="e.g. AI System, Inspector Name"
              value={generatedBy}
              onChange={(e) => setGeneratedBy(e.target.value)}
              maxLength={80}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Create Report</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateReportDialog;
