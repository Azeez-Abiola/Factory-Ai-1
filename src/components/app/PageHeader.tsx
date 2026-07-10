import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  eyebrow?: string;
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * Enterprise page header — eyebrow chip, display title, subtitle, actions.
 * Mirrors the visual register of the marketing hero.
 */
const PageHeader = ({ eyebrow, icon: Icon, title, description, actions, className }: PageHeaderProps) => {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-xl px-6 py-6 md:px-8 md:py-7", className)}>
      {/* Accent glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.12),transparent_60%)]" />
      <div className="pointer-events-none absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-medium tracking-wider uppercase text-primary mb-3">
              {Icon && <Icon className="w-3 h-3" />}
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};

export default PageHeader;
