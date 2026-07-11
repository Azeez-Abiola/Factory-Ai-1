import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Bell, ArrowUpCircle, UserCheck, CheckCircle2, FileText, ShieldAlert, ClipboardList, Radar } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  incidentId: string;
  alertId?: string | null;
  tenantId: string;
  title: string;
}

interface Entry {
  ts: string;
  kind: "alert" | "incident" | "task" | "audit";
  action: string;
  label: string;
  detail?: string;
  auditId?: string;
  actor?: string | null;
}

const iconFor = (kind: Entry["kind"], action: string) => {
  if (kind === "alert") return <Radar className="w-3.5 h-3.5" />;
  if (kind === "task") return <ClipboardList className="w-3.5 h-3.5" />;
  if (action.includes("escalat")) return <ArrowUpCircle className="w-3.5 h-3.5" />;
  if (action.includes("assign")) return <UserCheck className="w-3.5 h-3.5" />;
  if (action.includes("resolve") || action.includes("close")) return <CheckCircle2 className="w-3.5 h-3.5" />;
  if (action.includes("false_positive")) return <ShieldAlert className="w-3.5 h-3.5" />;
  return <Bell className="w-3.5 h-3.5" />;
};

const colorFor = (kind: Entry["kind"], action: string) => {
  if (action.includes("escalat")) return "bg-warning/15 text-warning border-warning/30";
  if (action.includes("resolve") || action.includes("close") || action.includes("completed")) return "bg-success/15 text-success border-success/30";
  if (action.includes("false_positive")) return "bg-destructive/15 text-destructive border-destructive/30";
  if (kind === "alert") return "bg-destructive/10 text-destructive border-destructive/30";
  if (kind === "task") return "bg-primary/10 text-primary border-primary/30";
  return "bg-muted text-muted-foreground border-border";
};

export default function IncidentAuditTimeline({ open, onOpenChange, incidentId, alertId, tenantId, title }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const [incRes, alertRes, tasksRes, auditRes] = await Promise.all([
        supabase.from("incidents").select("*").eq("id", incidentId).maybeSingle(),
        alertId ? supabase.from("alerts").select("*").eq("id", alertId).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("resolution_tasks").select("*").eq("incident_id", incidentId).order("created_at"),
        supabase.from("audit_log").select("*").eq("tenant_id", tenantId).or(`entity_id.eq.${incidentId}${alertId ? `,entity_id.eq.${alertId}` : ""}`).order("created_at"),
      ]);

      const list: Entry[] = [];
      const inc: any = incRes.data;
      const al: any = (alertRes as any).data;

      if (al) {
        list.push({ ts: al.detected_at || al.created_at, kind: "alert", action: "alert.detected", label: "Alert detected", detail: `${al.severity?.toUpperCase() ?? ""} · ${al.title}` });
        if (al.acknowledged_at) list.push({ ts: al.acknowledged_at, kind: "alert", action: "alert.acknowledge", label: "Alert acknowledged" });
        if (al.resolved_at) list.push({ ts: al.resolved_at, kind: "alert", action: "alert.resolve", label: "Alert resolved" });
      }

      if (inc) {
        list.push({ ts: inc.opened_at, kind: "incident", action: "incident.open", label: "Incident opened", detail: inc.title });
        if (inc.last_escalated_at) list.push({ ts: inc.last_escalated_at, kind: "incident", action: "incident.escalate", label: `Escalation L${inc.escalation_level}` });
        if (inc.closed_at) list.push({ ts: inc.closed_at, kind: "incident", action: `incident.${inc.status}`, label: `Incident ${inc.status}` });
      }

      (tasksRes.data ?? []).forEach((t: any) => {
        list.push({ ts: t.created_at, kind: "task", action: "task.create", label: `Task created: ${t.title}`, detail: `Priority ${t.priority}` });
        if (t.completed_at) list.push({ ts: t.completed_at, kind: "task", action: "task.completed", label: `Task completed: ${t.title}` });
      });

      (auditRes.data ?? []).forEach((a: any) => {
        list.push({
          ts: a.created_at, kind: "audit", action: a.action,
          label: a.action,
          detail: a.metadata ? Object.entries(a.metadata).slice(0, 3).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ") : undefined,
          auditId: a.id,
          actor: a.actor_id,
        });
      });

      list.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
      setEntries(list);
      setLoading(false);
    })();
  }, [open, incidentId, alertId, tenantId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Compliance Timeline</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        {loading && <p className="text-xs text-muted-foreground">Loading timeline…</p>}
        {!loading && entries.length === 0 && <p className="text-xs text-muted-foreground italic">No events recorded.</p>}

        <div className="relative pl-6">
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
          {entries.map((e, i) => (
            <div key={i} className="relative pb-5 last:pb-0">
              <div className={cn("absolute left-[-17px] w-6 h-6 rounded-full flex items-center justify-center border", colorFor(e.kind, e.action))}>
                {iconFor(e.kind, e.action)}
              </div>
              <div className="ml-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{e.label}</span>
                  <Badge variant="outline" className="text-[9px] uppercase">{e.kind}</Badge>
                  {e.auditId && (
                    <Badge variant="outline" className="text-[9px] font-mono bg-muted/40">
                      AUD-{e.auditId.slice(0, 8)}
                    </Badge>
                  )}
                </div>
                {e.detail && <p className="text-xs text-muted-foreground mt-0.5">{e.detail}</p>}
                <span className="text-[10px] font-mono text-muted-foreground">
                  {new Date(e.ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
