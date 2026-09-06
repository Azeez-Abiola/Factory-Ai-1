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
    <div className={cn("border-b border-border pb-6", className)}>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase text-primary mb-2">
              {Icon && <Icon className="w-3 h-3" />}
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground leading-tight">
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
