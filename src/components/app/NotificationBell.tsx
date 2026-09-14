import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertRow {
  id: string;
  title: string;
  severity: string;
  zone: string | null;
  status: string;
  detected_at: string;
}

const OPEN_STATUSES = ["open", "new", "active"];

const severityTone: Record<string, string> = {
  critical: "text-destructive",
  high: "text-warning",
  medium: "text-primary",
  low: "text-muted-foreground",
};

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const { activeTenantId } = useTenants();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!activeTenantId) return setAlerts([]);
    const { data } = await supabase
      .from("alerts")
      .select("id,title,severity,zone,status,detected_at")
      .eq("tenant_id", activeTenantId)
      .in("status", OPEN_STATUSES)
      .order("detected_at", { ascending: false })
      .limit(8);
    setAlerts((data as AlertRow[]) ?? []);
  }, [activeTenantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeTenantId) return;
    const channel = supabase
      .channel(`header-alerts:${activeTenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `tenant_id=eq.${activeTenantId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTenantId, load]);

  const count = alerts.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${count} open alerts`}>
          <Bell className="w-5 h-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-[18px] w-[18px] min-w-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold ring-2 ring-background">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">Open alerts</p>
          <span className="text-xs text-muted-foreground">{count} unresolved</span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {count === 0 && (
            <p className="px-4 py-8 text-sm text-muted-foreground text-center">No open alerts right now.</p>
          )}
          {alerts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => { setOpen(false); navigate(`/app/alerts?alert=${a.id}`); }}
              className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors border-b border-border/60 last:border-0"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className={cn("w-4 h-4 mt-0.5 shrink-0", severityTone[a.severity] ?? "text-muted-foreground")} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="capitalize">{a.severity}</span>
                    {a.zone ? ` · ${a.zone}` : ""} · {timeAgo(a.detected_at)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="p-2 border-t border-border">
          <Button variant="ghost" className="w-full h-9" onClick={() => { setOpen(false); navigate("/app/alerts"); }}>
            View all alerts
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
