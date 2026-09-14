import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldLabelProps extends React.ComponentPropsWithoutRef<typeof Label> {
  required?: boolean;
  optional?: boolean;
  hint?: React.ReactNode;
}

/**
 * FieldLabel — the standard label used across non-RHF forms.
 * Adds a required asterisk or optional tag and optional hint text.
 */
export const FieldLabel = React.forwardRef<React.ElementRef<typeof Label>, FieldLabelProps>(
  ({ className, required, optional, hint, children, ...props }, ref) => (
    <div className="space-y-1">
      <Label
        ref={ref}
        className={cn("flex items-center gap-1.5 text-sm font-medium leading-none", className)}
        {...props}
      >
        <span>{children}</span>
        {required && <span aria-hidden className="text-destructive">*</span>}
        {optional && !required && (
          <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground/70">Optional</span>
        )}
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  ),
);
FieldLabel.displayName = "FieldLabel";

export default FieldLabel;
