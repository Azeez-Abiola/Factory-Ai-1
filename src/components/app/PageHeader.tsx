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
 * Shared operator page heading with a compact, scan-first hierarchy.
 */
const PageHeader = ({ eyebrow, icon: Icon, title, description, actions, className }: PageHeaderProps) => {
  return (
    <div className={cn("border-b border-border pb-5", className)}>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase text-primary mb-2">
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-2xl md:text-[28px] font-bold text-foreground leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1.5 max-w-3xl leading-relaxed">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};

export default PageHeader;
