import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShiftReport } from "@/data/extendedMockData";
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

interface CreateShiftReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateReport: (report: ShiftReport) => void;
  reportCount: number;
}

const CreateShiftReportDialog = ({ open, onOpenChange, onCreateReport, reportCount }: CreateShiftReportDialogProps) => {
  const [shiftName, setShiftName] = useState("Morning Shift");
  const [supervisor, setSupervisor] = useState("");
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("14:00");
  const [safetyScore, setSafetyScore] = useState("");
  const [efficiency, setEfficiency] = useState("");
  const [incidents, setIncidents] = useState("");
  const [defects, setDefects] = useState("");

  const resetForm = () => {
    setShiftName("Morning Shift");
    setSupervisor("");
    setStartTime("06:00");
    setEndTime("14:00");
    setSafetyScore("");
    setEfficiency("");
    setIncidents("");
    setDefects("");
  };

  const handleSubmit = () => {
    if (!supervisor.trim()) {
      toast.error("Supervisor name is required");
      return;
    }
    if (startTime >= endTime) {
      toast.error("End time must be after start time");
      return;
    }

    const incidentCount = Math.max(0, Number(incidents) || 0);

    const newReport: ShiftReport = {
      id: `SR-${String(reportCount + 1).padStart(3, "0")}`,
      shiftName,
      date: new Date().toISOString().split("T")[0],
      startTime,
      endTime,
      supervisor: supervisor.trim(),
      safetyScore: Math.min(100, Math.max(0, Number(safetyScore) || 0)),
      incidentsCount: incidentCount,
      resolvedCount: 0,
      unresolvedCount: incidentCount,
      productionEfficiency: Math.min(100, Math.max(0, Number(efficiency) || 0)),
      defectsFound: Math.max(0, Number(defects) || 0),
      keyEvents: [],
      unresolvedIssues: [],
      recommendations: [],
    };

    onCreateReport(newReport);
    toast.success(`Shift report ${newReport.id} created successfully`);
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Create Shift Report
          </DialogTitle>
          <DialogDescription>Log a new shift handover with key operational metrics.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel required>Shift</FieldLabel>
              <Select value={shiftName} onValueChange={setShiftName}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Morning Shift">Morning Shift</SelectItem>
                  <SelectItem value="Afternoon Shift">Afternoon Shift</SelectItem>
                  <SelectItem value="Night Shift">Night Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <FieldLabel required htmlFor="sr-supervisor">Supervisor</FieldLabel>
              <Input
                id="sr-supervisor"
                autoComplete="name"
                placeholder="e.g. Ravi Mehta"
                value={supervisor}
                onChange={(e) => setSupervisor(e.target.value)}
                maxLength={80}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel required htmlFor="sr-start">Start Time</FieldLabel>
              <Input
                id="sr-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel required htmlFor="sr-end">End Time</FieldLabel>
              <Input
                id="sr-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-invalid={endTime <= startTime}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel hint="Compliance %.">Safety Score</FieldLabel>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="92"
                  value={safetyScore}
                  onChange={(e) => setSafetyScore(e.target.value)}
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/100</span>
              </div>
            </div>
            <div className="space-y-2">
              <FieldLabel hint="Throughput vs target.">Efficiency</FieldLabel>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="88"
                  value={efficiency}
                  onChange={(e) => setEfficiency(e.target.value)}
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/100</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel>Incidents</FieldLabel>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={incidents}
                onChange={(e) => setIncidents(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Defects Found</FieldLabel>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={defects}
                onChange={(e) => setDefects(e.target.value)}
              />
            </div>
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

export default CreateShiftReportDialog;
