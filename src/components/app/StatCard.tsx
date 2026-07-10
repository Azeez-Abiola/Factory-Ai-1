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
    icon: "bg-primary/10 text-primary ring-1 ring-primary/20",
    glow: "bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.14),transparent_60%)]",
  },
  success: {
    border: "hover:border-success/40",
    ring: "ring-success/10",
    icon: "bg-success/10 text-success ring-1 ring-success/20",
    glow: "bg-[radial-gradient(ellipse_at_top_right,hsl(var(--success)/0.14),transparent_60%)]",
  },
  warning: {
    border: "hover:border-warning/40",
    ring: "ring-warning/10",
    icon: "bg-warning/10 text-warning ring-1 ring-warning/20",
    glow: "bg-[radial-gradient(ellipse_at_top_right,hsl(var(--warning)/0.14),transparent_60%)]",
  },
  danger: {
    border: "hover:border-destructive/40",
    ring: "ring-destructive/10",
    icon: "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
    glow: "bg-[radial-gradient(ellipse_at_top_right,hsl(var(--destructive)/0.14),transparent_60%)]",
  },
};

const StatCard = ({ title, value, subtitle, icon: Icon, trend, variant = "default" }: StatCardProps) => {
  const a = accent[variant];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur-xl p-5 transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_hsl(var(--primary)/0.35)]",
        a.border
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 opacity-70", a.glow)} />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{title}</p>
          <p className="font-display text-3xl md:text-[2rem] font-bold text-foreground mt-2 leading-none tabular-nums">
            {value}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
          {trend && (
            <div
              className={cn(
                "inline-flex items-center gap-1 mt-2.5 text-xs font-semibold rounded-full px-2 py-0.5",
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
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", a.icon)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
