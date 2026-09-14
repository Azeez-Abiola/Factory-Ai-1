import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AddressValue = {
  street?: string;
  city?: string;
  region?: string; // state/province
  postal_code?: string;
  country?: string;
};

interface AddressFieldsProps {
  /** Serialized single-line address (backward compatible with legacy free-text column) */
  value?: string | null;
  /** Emits the serialized single-line address */
  onChange: (formatted: string, parts: AddressValue) => void;
  /** When true, marks the label with a required asterisk */
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Optional label override */
  label?: string;
  description?: string;
  /** Optional error message shown below the block */
  error?: string;
}

// Best-effort parser for the legacy "street, city, region postal, country" style.
// It never throws — anything unparseable ends up in the street line.
const parseAddress = (raw?: string | null): AddressValue => {
  if (!raw) return {};
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { street: parts[0] };
  if (parts.length === 2) return { street: parts[0], city: parts[1] };
  const country = parts[parts.length - 1];
  const cityRegion = parts.slice(1, -1).join(", ");
  return { street: parts[0], city: cityRegion, country };
};

const formatAddress = (v: AddressValue): string => {
  const line2 = [v.city, [v.region, v.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [v.street, line2, v.country].filter(Boolean).join(", ").trim();
};

export const AddressFields = ({
  value,
  onChange,
  required,
  disabled,
  className,
  label = "Address",
  description = "Physical location used for compliance, alerts routing, and reports.",
  error,
}: AddressFieldsProps) => {
  const initial = useMemo(() => parseAddress(value), [value]);
  const [parts, setParts] = useState<AddressValue>(initial);

  // Sync when parent value changes externally (e.g. editing a different tenant).
  useEffect(() => {
    setParts(parseAddress(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const update = (patch: Partial<AddressValue>) => {
    const next = { ...parts, ...patch };
    setParts(next);
    onChange(formatAddress(next), next);
  };

  return (
    <div className={cn("space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            {label}
            {required && <span aria-hidden className="text-destructive">*</span>}
          </Label>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="addr-street" className="text-xs text-muted-foreground">
            Street address
          </Label>
          <Input
            id="addr-street"
            autoComplete="street-address"
            placeholder="123 Industrial Way, Building B"
            value={parts.street ?? ""}
            disabled={disabled}
            onChange={(e) => update({ street: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="addr-city" className="text-xs text-muted-foreground">City</Label>
            <Input
              id="addr-city"
              autoComplete="address-level2"
              placeholder="Detroit"
              value={parts.city ?? ""}
              disabled={disabled}
              onChange={(e) => update({ city: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addr-region" className="text-xs text-muted-foreground">State / Region</Label>
            <Input
              id="addr-region"
              autoComplete="address-level1"
              placeholder="MI"
              value={parts.region ?? ""}
              disabled={disabled}
              onChange={(e) => update({ region: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="addr-postal" className="text-xs text-muted-foreground">Postal code</Label>
            <Input
              id="addr-postal"
              autoComplete="postal-code"
              placeholder="48201"
              value={parts.postal_code ?? ""}
              disabled={disabled}
              onChange={(e) => update({ postal_code: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addr-country" className="text-xs text-muted-foreground">Country</Label>
            <Input
              id="addr-country"
              autoComplete="country-name"
              placeholder="United States"
              value={parts.country ?? ""}
              disabled={disabled}
              onChange={(e) => update({ country: e.target.value })}
            />
          </div>
        </div>
      </div>

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
};

export default AddressFields;
