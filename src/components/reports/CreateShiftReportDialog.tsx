import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShiftReport } from "@/data/extendedMockData";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Create Shift Report
          </DialogTitle>
          <DialogDescription>Log a new shift handover report.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select value={shiftName} onValueChange={setShiftName}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Morning Shift">Morning Shift</SelectItem>
                  <SelectItem value="Afternoon Shift">Afternoon Shift</SelectItem>
                  <SelectItem value="Night Shift">Night Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Supervisor *</Label>
              <Input
                placeholder="e.g. Ravi Mehta"
                value={supervisor}
                onChange={(e) => setSupervisor(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Safety Score (0–100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 92"
                value={safetyScore}
                onChange={(e) => setSafetyScore(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Efficiency (0–100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 88"
                value={efficiency}
                onChange={(e) => setEfficiency(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Incidents</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={incidents}
                onChange={(e) => setIncidents(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Defects Found</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={defects}
                onChange={(e) => setDefects(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 border-border" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSubmit}>
              Create Report
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateShiftReportDialog;
