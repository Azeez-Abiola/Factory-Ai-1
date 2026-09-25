import { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import FieldLabel from "@/components/forms/FieldLabel";
import MultiSelect from "@/components/admin/MultiSelect";
import { supabase } from "@/integrations/supabase/client";
import { buildReport } from "@/lib/reportBuilder";
import { useFocusAreas } from "@/hooks/useFocusAreas";
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
  { value: "365", label: "Last 12 months" },
  { value: "custom", label: "Custom date range" },
];

const toDateInput = (d: Date) => d.toISOString().slice(0, 10);

const CreateReportDialog = ({ open, onOpenChange, tenantId, tenantName, reportCount, onCreated }: CreateReportDialogProps) => {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("audit");
  const { areas } = useFocusAreas(tenantId);
  const focus = areas.find((a) => a.value === type) ?? areas[areas.length - 1];
  const [days, setDays] = useState("7");
  const [from, setFrom] = useState(toDateInput(new Date(Date.now() - 7 * 864e5)));
  const [to, setTo] = useState(toDateInput(new Date()));
  const [cameras, setCameras] = useState<{ id: string; name: string; zone: string | null }[]>([]);
  const [cameraIds, setCameraIds] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !tenantId) return;
    supabase
      .from("cameras")
      .select("id,name,zone")
      .eq("tenant_id", tenantId)
      .order("name")
      .then(({ data }) => setCameras(data ?? []));
  }, [open, tenantId]);

  const zoneOptions = useMemo(() => {
    const set = new Set(cameras.map((c) => c.zone).filter((z): z is string => !!z && z.trim() !== ""));
    return [...set].sort().map((z) => ({ value: z, label: z }));
  }, [cameras]);

  const reset = () => {
    setTitle("");
    setType("audit");
    setDays("7");
    setCameraIds([]);
    setZones([]);
  };

  const resolvePeriod = (): { start: Date; end: Date; label: string } | null => {
    if (days === "custom") {
      const start = new Date(`${from}T00:00:00`);
      const end = new Date(`${to}T23:59:59`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        toast.error("Pick a valid start and end date");
        return null;
      }
      if (start > end) {
        toast.error("The start date must come before the end date");
        return null;
      }
      return { start, end, label: `${from} to ${to}` };
    }
    const end = new Date();
    const start = new Date(end.getTime() - Number(days) * 864e5);
    return { start, end, label: PERIODS.find((p) => p.value === days)?.label ?? `Last ${days} days` };
  };

  const handleSubmit = async () => {
    if (!tenantId) return toast.error("Select a site first");
    const period = resolvePeriod();
    if (!period) return;
    setSaving(true);
    try {
      const built = await buildReport(tenantId, focus.value, period.start, period.end, { cameraIds, zones }, focus);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user ?? null;
      let name = "AI System";
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
        name = profile?.display_name || user.email || "AI System";
      }

      // Next reference number, based on the highest one already used for this site.
      const { data: last } = await supabase
        .from("reports")
        .select("reference")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);
      const highest = (last ?? []).reduce((max, r) => {
        const n = Number(String(r.reference).replace(/\D/g, ""));
        return Number.isFinite(n) && n > max ? n : max;
      }, reportCount);

      const scopeNote =
        cameraIds.length || zones.length
          ? ` · ${[zones.length ? `${zones.length} zone${zones.length > 1 ? "s" : ""}` : "", cameraIds.length ? `${cameraIds.length} camera${cameraIds.length > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ")}`
          : "";

      const { error } = await supabase.from("reports").insert({
        tenant_id: tenantId,
        reference: `RPT-${String(highest + 1).padStart(4, "0")}`,
        title: title.trim() || `${focus.label} report — ${tenantName ?? "site"} (${period.label})`,
        type: focus.value,
        status: built.status,
        score: built.score,
        findings_count: built.findings_count,
        period_start: period.start.toISOString(),
        period_end: period.end.toISOString(),
        summary: `${built.summary}${scopeNote ? ` Scope:${scopeNote.replace(" · ", " ")}.` : ""}`,
        data: JSON.parse(JSON.stringify({ ...built.data, scope: { cameraIds, zones } })),
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
      <DialogContent className="max-w-lg bg-card max-h-[90vh] overflow-y-auto">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel required>Focus area</FieldLabel>
              <Select value={focus.value} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Focus areas are this site's detection categories. Add or rename them in Admin → AI Model &amp; Categories.
              </p>
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

          {days === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel required htmlFor="rpt-from">From</FieldLabel>
                <Input id="rpt-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <FieldLabel required htmlFor="rpt-to">To</FieldLabel>
                <Input id="rpt-to" type="date" value={to} min={from} max={toDateInput(new Date())} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel optional htmlFor="rpt-zones">Limit to zones</FieldLabel>
              <MultiSelect
                id="rpt-zones"
                options={zoneOptions}
                value={zones}
                onChange={setZones}
                placeholder="All zones"
                emptyText="No zones set on this site's cameras yet."
              />
            </div>
            <div className="space-y-2">
              <FieldLabel optional htmlFor="rpt-cameras">Limit to cameras</FieldLabel>
              <MultiSelect
                id="rpt-cameras"
                options={cameras.map((c) => ({ value: c.id, label: c.name, hint: c.zone ?? undefined }))}
                value={cameraIds}
                onChange={setCameraIds}
                placeholder="All cameras"
                emptyText="No cameras on this site yet."
              />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/5 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">
              The score starts at 100 and drops with every open issue — critical issues weigh most, closed ones count far less.
              Below 75% the report is marked failed. Choosing "Audit" covers every focus area at once.
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
