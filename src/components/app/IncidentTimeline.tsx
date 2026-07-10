import { useState } from "react";
import { Radar, Bell, ArrowUpCircle, UserCheck, Wrench, CheckCircle2, Plus, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimeline, addTimelineNote, logAudit } from "@/lib/incidentStore";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const typeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  detection: { icon: <Radar className="w-4 h-4" />, color: "bg-destructive text-destructive-foreground" },
  notification: { icon: <Bell className="w-4 h-4" />, color: "bg-warning text-primary-foreground" },
  escalation: { icon: <ArrowUpCircle className="w-4 h-4" />, color: "bg-destructive text-destructive-foreground" },
  assignment: { icon: <UserCheck className="w-4 h-4" />, color: "bg-primary text-primary-foreground" },
  action: { icon: <Wrench className="w-4 h-4" />, color: "bg-muted-foreground text-background" },
  resolution: { icon: <CheckCircle2 className="w-4 h-4" />, color: "bg-success text-primary-foreground" },
};

interface Props {
  alertId: string;
}

const IncidentTimeline = ({ alertId }: Props) => {
  const events = useTimeline(alertId);
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  const submitNote = () => {
    if (!note.trim()) return;
    addTimelineNote(alertId, note, "Ravi Mehta");
    logAudit({
      actor: "Ravi Mehta",
      actorRole: "Tenant Admin",
      tenant: "Tata Steel Works",
      action: "alert.note",
      resource: alertId,
      details: `Added investigation note: "${note.trim().slice(0, 80)}${note.trim().length > 80 ? "…" : ""}"`,
    });
    toast.success("Note added to incident timeline");
    setNote("");
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      <div className="relative pl-6 space-y-0">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
        {events.map((event) => {
          const config = typeConfig[event.type];
          return (
            <div key={event.id} className="relative pb-6 last:pb-0">
              <div className={cn("absolute left-[-17px] w-6 h-6 rounded-full flex items-center justify-center z-10", config.color)}>
                {config.icon}
              </div>
              <div className="ml-4">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{event.title}</span>
                  {event.actor && (
                    <span className="text-xs text-muted-foreground">by {event.actor}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-1">{event.description}</p>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {new Date(event.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add note affordance */}
      <div className="border-t border-border pt-3">
        {adding ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <StickyNote className="w-3 h-3" /> New investigation note
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Interviewed operator, PPE was in locker – coached on-shift."
              className="text-sm bg-background border-border min-h-[70px]"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setNote(""); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitNote} disabled={!note.trim()}>
                Post Note
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="w-full">
            <Plus className="w-3 h-3 mr-1" /> Add investigation note
          </Button>
        )}
      </div>
    </div>
  );
};

export default IncidentTimeline;
