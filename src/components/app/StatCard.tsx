import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  variant?: "default" | "success" | "warning" | "danger";
}

const accent = {
  default: {
    border: "hover:border-primary/40",
    ring: "ring-primary/10",
    icon: "bg-primary/10 text-primary ring-1 ring-primary/15",
  },
  success: {
    border: "hover:border-success/40",
    ring: "ring-success/10",
    icon: "bg-success/10 text-success ring-1 ring-success/20",
  },
  warning: {
    border: "hover:border-warning/40",
    ring: "ring-warning/10",
    icon: "bg-warning/10 text-warning ring-1 ring-warning/20",
  },
  danger: {
    border: "hover:border-destructive/40",
    ring: "ring-destructive/10",
    icon: "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
  },
};

const StatCard = ({ title, value, subtitle, icon: Icon, trend, variant = "default" }: StatCardProps) => {
  const a = accent[variant];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-card p-5 transition-[border-color,box-shadow] duration-200 shadow-sm",
        "hover:shadow-md",
        a.border
      )}
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase text-muted-foreground font-bold">{title}</p>
          <p className="font-display text-3xl md:text-[2rem] font-bold text-foreground mt-2 leading-none tabular-nums">
            {value}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
          {trend && (
            <div
              className={cn(
                "inline-flex items-center gap-1 mt-2.5 text-xs font-semibold rounded px-2 py-0.5",
                trend.positive
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {trend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend.value)}% vs yesterday
            </div>
          )}
        </div>
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", a.icon)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
