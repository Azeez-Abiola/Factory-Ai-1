import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRightLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveShift } from "@/hooks/useActiveShift";

const formatSince = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

/**
 * Soft prompt: operators are reminded to open a shift, never blocked from
 * responding to what's happening on the floor.
 */
const ShiftStatusBanner = () => {
  const { shift, pending, loading } = useActiveShift();
  if (loading) return null;

  if (pending) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
        <ArrowRightLeft className="h-4 w-4 shrink-0 text-warning" />
        <p className="text-sm font-medium text-foreground">
          Handover from <span className="font-semibold">{pending.name}</span> is waiting to be accepted.
        </p>
        <Button asChild size="sm" variant="outline" className="ml-auto">
          <Link to="/app/shift-reports">Review handover</Link>
        </Button>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        <p className="text-sm font-medium text-foreground">
          No shift is on duty. Start a shift so activity, alerts and handover notes are recorded against someone.
        </p>
        <Button asChild size="sm" className="ml-auto">
          <Link to="/app/shift-reports">Start shift</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2.5">
      <Clock className="h-4 w-4 shrink-0 text-primary" />
      <p className="text-sm text-muted-foreground">
        On duty: <span className="font-semibold text-foreground">{shift.name}</span> · running {formatSince(shift.started_at)}
      </p>
      <Button asChild size="sm" variant="ghost" className="ml-auto h-8">
        <Link to="/app/shift-reports">Shift &amp; handover</Link>
      </Button>
    </div>
  );
};

export default ShiftStatusBanner;
