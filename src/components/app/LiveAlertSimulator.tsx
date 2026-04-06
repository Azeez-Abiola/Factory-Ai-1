import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Shield, Zap, Eye } from "lucide-react";
import { toast } from "sonner";
import { simulationAlerts } from "@/data/extendedMockData";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const categoryIcons: Record<string, React.ReactNode> = {
  safety: <Shield className="w-4 h-4" />,
  downtime: <Zap className="w-4 h-4" />,
  quality: <Eye className="w-4 h-4" />,
  productivity: <AlertTriangle className="w-4 h-4" />,
};

const severityStyles: Record<string, string> = {
  critical: "text-destructive",
  high: "text-warning",
  medium: "text-primary",
  low: "text-muted-foreground",
};

const LiveAlertSimulator = () => {
  const [active, setActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(() => {
        const alert = simulationAlerts[Math.floor(Math.random() * simulationAlerts.length)];
        toast(alert.title, {
          description: `${alert.zone} · ${alert.camera} · ${alert.severity.toUpperCase()}`,
          icon: categoryIcons[alert.category],
          duration: 5000,
          className: cn("border", alert.severity === "critical" ? "border-destructive/30" : "border-border"),
        });
      }, 4000 + Math.random() * 3000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active]);

  return (
    <Button
      variant={active ? "destructive" : "outline"}
      size="sm"
      onClick={() => setActive(!active)}
      className="gap-2"
    >
      <div className={cn("w-2 h-2 rounded-full", active ? "bg-destructive-foreground animate-pulse" : "bg-muted-foreground")} />
      {active ? "Stop Simulation" : "Live Simulation"}
    </Button>
  );
};

export default LiveAlertSimulator;
