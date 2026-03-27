import { incidentTimelines, TimelineEvent } from "@/data/extendedMockData";
import { Radar, Bell, ArrowUpCircle, UserCheck, Wrench, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const events = incidentTimelines[alertId];
  if (!events) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No timeline data available for this incident.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-0">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
      {events.map((event, i) => {
        const config = typeConfig[event.type];
        return (
          <div key={event.id} className="relative pb-6 last:pb-0">
            <div className={cn("absolute left-[-17px] w-6 h-6 rounded-full flex items-center justify-center z-10", config.color)}>
              {config.icon}
            </div>
            <div className="ml-4">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-foreground">{event.title}</span>
                {event.actor && (
                  <span className="text-xs text-muted-foreground">by {event.actor}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-1">{event.description}</p>
              <span className="text-[10px] font-mono text-muted-foreground">
                {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default IncidentTimeline;
