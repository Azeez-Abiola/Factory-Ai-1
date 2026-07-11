import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { auditLog } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Circle, Clock, ListTodo, Plus, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface ResolutionTask {
  id: string;
  tenant_id: string;
  incident_id: string | null;
  alert_id: string | null;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "blocked" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  assigned_to: string | null;
  created_by: string | null;
  due_at: string | null;
  completed_at: string | null;
  completion_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  alertId?: string | null;
  incidentId?: string | null;
  title: string;
  onResolved?: () => void;
}

const statusOrder: ResolutionTask["status"][] = ["pending", "in_progress", "blocked", "completed", "cancelled"];
const statusMeta: Record<ResolutionTask["status"], { label: string; color: string; icon: JSX.Element }> = {
  pending: { label: "Pending", color: "bg-muted text-muted-foreground", icon: <Circle className="w-3.5 h-3.5" /> },
  in_progress: { label: "In progress", color: "bg-primary/10 text-primary border-primary/30", icon: <Clock className="w-3.5 h-3.5" /> },
  blocked: { label: "Blocked", color: "bg-warning/10 text-warning border-warning/30", icon: <XCircle className="w-3.5 h-3.5" /> },
  completed: { label: "Completed", color: "bg-success/10 text-success border-success/30", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground", icon: <XCircle className="w-3.5 h-3.5" /> },
};

const priorityColors: Record<ResolutionTask["priority"], string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-warning/10 text-warning",
  critical: "bg-destructive/10 text-destructive",
};

export default function ResolutionWorkflowDialog({
  open, onOpenChange, tenantId, alertId, incidentId, title, onResolved,
}: Props) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<ResolutionTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<ResolutionTask["priority"]>("medium");
  const [completionNotes, setCompletionNotes] = useState("");

  const loadTasks = async () => {
    setLoading(true);
    let q = supabase.from("resolution_tasks").select("*").eq("tenant_id", tenantId);
    if (incidentId) q = q.eq("incident_id", incidentId);
    else if (alertId) q = q.eq("alert_id", alertId);
    const { data, error } = await q.order("created_at", { ascending: true });
    if (error) toast.error("Failed to load tasks");
    else setTasks((data ?? []) as ResolutionTask[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    loadTasks();
    const key = incidentId ?? alertId ?? "none";
    const channel = supabase
      .channel(`resolution_tasks:${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "resolution_tasks" }, loadTasks)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, alertId, incidentId, tenantId]);

  const addTask = async () => {
    if (!newTitle.trim() || !user) return;
    const { error } = await supabase.from("resolution_tasks").insert({
      tenant_id: tenantId,
      incident_id: incidentId ?? null,
      alert_id: alertId ?? null,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      priority: newPriority,
      created_by: user.id,
    });
    if (error) return toast.error(error.message);
    await auditLog({
      tenantId, action: "resolution_task.create", entityType: "resolution_task",
      metadata: { title: newTitle.trim(), alert_id: alertId, incident_id: incidentId, priority: newPriority },
    });
    setNewTitle(""); setNewDescription(""); setNewPriority("medium");
    toast.success("Task added");
  };

  const updateStatus = async (task: ResolutionTask, status: ResolutionTask["status"]) => {
    const patch: Partial<ResolutionTask> = { status };
    if (status === "completed") patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from("resolution_tasks").update(patch).eq("id", task.id);
    if (error) return toast.error(error.message);
    await auditLog({
      tenantId, action: `resolution_task.${status}`, entityType: "resolution_task",
      entityId: task.id, metadata: { title: task.title, previous: task.status },
    });
  };

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalCount = tasks.length;
  const canClose = totalCount > 0 && completedCount === totalCount;

  const closeIncident = async () => {
    if (!canClose) return toast.error("Complete all tasks first");
    if (incidentId) {
      const { error } = await supabase
        .from("incidents")
        .update({ status: "resolved", closed_at: new Date().toISOString(), notes: completionNotes || null })
        .eq("id", incidentId);
      if (error) return toast.error(error.message);
    }
    if (alertId) {
      await supabase.from("alerts").update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id ?? null,
      }).eq("id", alertId);
    }
    await auditLog({
      tenantId, action: "incident.resolve", entityType: "incident",
      entityId: incidentId ?? alertId ?? undefined,
      metadata: { tasks: totalCount, notes: completionNotes, alert_id: alertId },
    });
    toast.success("Incident closed and audit record written");
    onResolved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Supervisor Resolution Workflow
          </DialogTitle>
          <DialogDescription className="text-xs">{title}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><ListTodo className="w-3.5 h-3.5" /> {completedCount}/{totalCount} tasks complete</span>
          <div className="h-1.5 flex-1 mx-4 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-success transition-all"
              style={{ width: totalCount ? `${(completedCount / totalCount) * 100}%` : "0%" }} />
          </div>
        </div>

        {/* Task list */}
        <div className="space-y-2">
          {loading && <p className="text-xs text-muted-foreground">Loading tasks…</p>}
          {!loading && tasks.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No tasks yet. Add the first remediation step below.</p>
          )}
          {tasks.map((t) => (
            <div key={t.id} className="rounded-lg border border-border p-3 space-y-2 bg-background/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn("text-sm font-medium", t.status === "completed" && "line-through text-muted-foreground")}>
                      {t.title}
                    </p>
                    <Badge variant="outline" className={cn("text-[10px]", priorityColors[t.priority])}>{t.priority}</Badge>
                    <Badge variant="outline" className={cn("text-[10px] gap-1", statusMeta[t.status].color)}>
                      {statusMeta[t.status].icon} {statusMeta[t.status].label}
                    </Badge>
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                </div>
                <Select value={t.status} onValueChange={(v) => updateStatus(t, v as ResolutionTask["status"])}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-background border-border shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOrder.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">{statusMeta[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        {/* Add task */}
        <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add remediation task</p>
          <Input placeholder="Task title (e.g. Inspect conveyor belt)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="bg-background border-border" />
          <Textarea placeholder="Optional description or SOP reference" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="bg-background border-border min-h-[60px]" />
          <div className="flex gap-2">
            <Select value={newPriority} onValueChange={(v) => setNewPriority(v as ResolutionTask["priority"])}>
              <SelectTrigger className="w-32 bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={addTask} disabled={!newTitle.trim()} className="ml-auto">
              <Plus className="w-4 h-4 mr-1" /> Add Task
            </Button>
          </div>
        </div>

        {/* Close incident */}
        <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Close & write audit record</p>
          <Textarea
            placeholder="Compliance resolution summary (visible in audit log)…"
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
            className="bg-background border-border min-h-[60px]"
          />
          <div className="flex justify-end">
            <Button onClick={closeIncident} disabled={!canClose} className="bg-success hover:bg-success/90 text-primary-foreground">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Close Incident
            </Button>
          </div>
          {!canClose && totalCount > 0 && (
            <p className="text-[11px] text-muted-foreground">All tasks must be marked complete before closing.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
