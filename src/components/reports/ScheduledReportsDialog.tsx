import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Play, Plus, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import FieldLabel from "@/components/forms/FieldLabel";
import MultiSelect from "@/components/admin/MultiSelect";
import { supabase } from "@/integrations/supabase/client";
import { REPORT_TYPE_LABELS } from "@/lib/reportBuilder";
import { useFocusAreas } from "@/hooks/useFocusAreas";
import {
  computeNextRun, describeSchedule, WEEKDAYS, type ScheduleFrequency,
} from "../../../supabase/functions/_shared/reportSchedule";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Schedule {
  id: string; name: string; type: string; frequency: ScheduleFrequency; run_hour: number; weekday: number;
  month_day: number; timezone: string; camera_ids: string[]; zones: string[]; recipients: string[];
  enabled: boolean; next_run_at: string; last_run_at: string | null; last_status: string | null; last_error: string | null;
}

interface Props { open: boolean; onOpenChange: (o: boolean) => void; tenantId: string | null; onRan: () => void }

const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fmt = (iso: string, tz: string) => {
  try { return new Date(iso).toLocaleString(undefined, { timeZone: tz, dateStyle: "medium", timeStyle: "short" }); }
  catch { return new Date(iso).toLocaleString(); }
};

const ScheduledReportsDialog = ({ open, onOpenChange, tenantId, onRan }: Props) => {
  const [items, setItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; name: string; zone: string | null }[]>([]);

  const [name, setName] = useState("");
  const [type, setType] = useState<string>("audit");
  const { areas } = useFocusAreas(open ? tenantId : null);
  const focus = areas.find((a) => a.value === type) ?? areas[areas.length - 1];
  const labelOf = (t: string) => areas.find((a) => a.value === t)?.label ?? REPORT_TYPE_LABELS[t] ?? t.replace(/^cat:/, "");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("weekly");
  const [hour, setHour] = useState(7);
  const [weekday, setWeekday] = useState(1);
  const [monthDay, setMonthDay] = useState(1);
  const [cameraIds, setCameraIds] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [recipients, setRecipients] = useState("");

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase.from("report_schedules").select("*").eq("tenant_id", tenantId).order("created_at");
    if (error) toast.error("Could not load schedules");
    setItems((data ?? []) as Schedule[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (!open || !tenantId) return;
    load();
    supabase.from("cameras").select("id,name,zone").eq("tenant_id", tenantId).order("name").then(({ data }) => setCameras(data ?? []));
  }, [open, tenantId, load]);

  const zoneOptions = useMemo(
    () => [...new Set(cameras.map((c) => c.zone).filter((z): z is string => !!z?.trim()))].sort().map((z) => ({ value: z, label: z })),
    [cameras],
  );

  const timing = { frequency, run_hour: hour, weekday, month_day: monthDay, timezone: browserTz };

  const create = async () => {
    if (!tenantId) return;
    const emails = recipients.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
    const bad = emails.find((e) => !EMAIL_RE.test(e));
    if (bad) return toast.error(`"${bad}" is not a valid email address`);
    setCreating(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("report_schedules").insert({
      tenant_id: tenantId,
      name: name.trim() || `${focus.label} ${frequency} report`,
      type: focus.value, frequency, run_hour: hour, weekday, month_day: monthDay, timezone: browserTz,
      camera_ids: cameraIds, zones, recipients: emails,
      next_run_at: computeNextRun(timing).toISOString(),
      created_by: u?.user?.id ?? null,
    });
    setCreating(false);
    if (error) return toast.error(error.message.includes("row-level") ? "You don't have permission to schedule reports for this site" : "Could not save the schedule");
    toast.success(`Scheduled — ${describeSchedule(timing).toLowerCase()}`);
    setName(""); setCameraIds([]); setZones([]); setRecipients("");
    load();
  };

  const toggle = async (s: Schedule) => {
    const patch: Partial<Schedule> = { enabled: !s.enabled };
    if (!s.enabled) patch.next_run_at = computeNextRun(s).toISOString();
    const { error } = await supabase.from("report_schedules").update(patch).eq("id", s.id);
    if (error) return toast.error("Could not update the schedule");
    load();
  };

  const remove = async (s: Schedule) => {
    const { error } = await supabase.from("report_schedules").delete().eq("id", s.id);
    if (error) return toast.error("Could not delete the schedule");
    toast.success("Schedule deleted");
    load();
  };

  const runNow = async (s: Schedule) => {
    setBusy(s.id);
    const { data, error } = await supabase.functions.invoke("run-report-schedules", { body: { schedule_id: s.id } });
    setBusy(null);
    const failed = error || data?.error || data?.results?.[0]?.error;
    if (failed) return toast.error(typeof failed === "string" ? failed : "The report could not be generated");
    toast.success("Report generated — it's now in your Reports list");
    load(); onRan();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5 text-primary" /> Scheduled reports</DialogTitle>
          <DialogDescription>
            Reports are built automatically from this site's live activity and saved to the Reports list. Times use your time zone ({browserTz}).
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border p-4 space-y-4">
          <p className="text-sm font-medium text-foreground">New schedule</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="sch-name">Name</FieldLabel>
              <Input id="sch-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly safety summary" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Focus area</FieldLabel>
              <Select value={focus.value} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{areas.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>How often</FieldLabel>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as ScheduleFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily (covers last 24 hours)</SelectItem>
                  <SelectItem value="weekly">Weekly (covers last 7 days)</SelectItem>
                  <SelectItem value="monthly">Monthly (covers last 30 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {frequency === "weekly" && (
                <div className="space-y-1.5">
                  <FieldLabel>Day</FieldLabel>
                  <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{WEEKDAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {frequency === "monthly" && (
                <div className="space-y-1.5">
                  <FieldLabel>Day of month</FieldLabel>
                  <Select value={String(monthDay)} onValueChange={(v) => setMonthDay(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 28 }, (_, i) => <SelectItem key={i} value={String(i + 1)}>{i + 1}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className={frequency === "daily" ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
                <FieldLabel>Time</FieldLabel>
                <Select value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({ length: 24 }, (_, i) => <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Zones (optional)</FieldLabel>
              <MultiSelect options={zoneOptions} value={zones} onChange={setZones} placeholder="All zones" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Cameras (optional)</FieldLabel>
              <MultiSelect options={cameras.map((c) => ({ value: c.id, label: c.name }))} value={cameraIds} onChange={setCameraIds} placeholder="All cameras" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel htmlFor="sch-rcp">Email to (optional)</FieldLabel>
              <Input id="sch-rcp" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="manager@factory.com, hse@factory.com" />
              <p className="text-xs text-muted-foreground">Emails start sending once your company's sender email address is set up. Reports are always saved to the list.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">First run: {fmt(computeNextRun(timing).toISOString(), browserTz)}</p>
            <Button onClick={create} disabled={creating || !tenantId}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Add schedule
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading schedules…</p>}
          {!loading && items.length === 0 && <p className="text-sm text-muted-foreground">No scheduled reports yet.</p>}
          {items.map((s) => (
            <div key={s.id} className="rounded-xl border border-border p-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                  <Badge variant="outline" className="text-xs">{labelOf(s.type)}</Badge>
                  {s.last_status === "failed" && <Badge variant="outline" className="text-xs bg-destructive/10 border-destructive/30">Last run failed</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {describeSchedule(s)} · {s.enabled ? `next ${fmt(s.next_run_at, s.timezone)}` : "paused"}
                  {s.last_run_at && ` · last ${fmt(s.last_run_at, s.timezone)}`}
                </p>
                {s.recipients.length > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> {s.recipients.join(", ")}</p>
                )}
                {s.last_status === "failed" && s.last_error && <p className="text-xs text-destructive">{s.last_error}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={s.enabled} onCheckedChange={() => toggle(s)} aria-label={s.enabled ? "Pause schedule" : "Resume schedule"} />
                <Button variant="outline" size="sm" onClick={() => runNow(s)} disabled={busy === s.id}>
                  {busy === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}<span className="ml-1">Run now</span>
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Delete ${s.name}`} onClick={() => remove(s)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduledReportsDialog;
