import { useState } from "react";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import FieldLabel from "@/components/forms/FieldLabel";
import { supabase } from "@/integrations/supabase/client";
import { buildReport, REPORT_TYPE_LABELS, type ReportType } from "@/lib/reportBuilder";
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
  tenantId: string | null;
  tenantName?: string;
  reportCount: number;
  onCreated: () => void;
}

const PERIODS = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last quarter" },
];

const CreateReportDialog = ({ open, onOpenChange, tenantId, tenantName, reportCount, onCreated }: CreateReportDialogProps) => {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ReportType>("safety");
  const [days, setDays] = useState("7");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setType("safety");
    setDays("7");
  };

  const handleSubmit = async () => {
    if (!tenantId) return toast.error("Select a site first");
    setSaving(true);
    try {
      const end = new Date();
      const start = new Date(end.getTime() - Number(days) * 24 * 60 * 60 * 1000);
      const built = await buildReport(tenantId, type, start, end);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user ?? null;
      let name = "AI System";
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
        name = profile?.display_name || user.email || "AI System";
      }

      const label = PERIODS.find((p) => p.value === days)?.label ?? `Last ${days} days`;
      const { error } = await supabase.from("reports").insert({
        tenant_id: tenantId,
        reference: `RPT-${String(reportCount + 1).padStart(4, "0")}`,
        title: title.trim() || `${REPORT_TYPE_LABELS[type]} report — ${tenantName ?? "site"} (${label})`,
        type,
        status: built.status,
        score: built.score,
        findings_count: built.findings_count,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        summary: built.summary,
        data: built.data as unknown as Record<string, unknown>,
        generated_by: user?.id ?? null,
        generated_by_name: name,
      });
      if (error) throw error;

      toast.success("Report generated from live site activity");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the report");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Generate report
          </DialogTitle>
          <DialogDescription>
            We read the real alerts, cameras and investigations for this site over the period you choose, then score it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <FieldLabel optional htmlFor="rpt-title">Report title</FieldLabel>
            <Input
              id="rpt-title"
              placeholder="Leave blank to name it automatically"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel required>Focus</FieldLabel>
              <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="audit">Audit (everything)</SelectItem>
                  <SelectItem value="productivity">Productivity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FieldLabel required>Period</FieldLabel>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/5 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">
              The score starts at 100 and drops with every open issue — critical issues weigh most, closed ones count far less.
              Below 75% the report is marked failed.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !tenantId}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Generating…" : "Generate report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateReportDialog;
