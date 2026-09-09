import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  id?: string;
  disabled?: boolean;
}

/** Searchable, checkbox-style multi select used for policy scoping. */
export default function MultiSelect({
  options, value, onChange, placeholder = "Select…",
  emptyText = "Nothing to choose from yet.",
  searchPlaceholder = "Search…", id, disabled,
}: Props) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);

  const labelFor = (v: string) => options.find(o => o.value === v)?.label ?? v;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-between font-normal h-auto min-h-10 py-2"
        >
          <span className="flex flex-wrap gap-1 items-center text-left">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              value.slice(0, 3).map(v => (
                <Badge key={v} variant="secondary" className="gap-1">
                  {labelFor(v)}
                  <X
                    className="w-3 h-3 opacity-60 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); toggle(v); }}
                  />
                </Badge>
              ))
            )}
            {value.length > 3 && (
              <Badge variant="secondary">+{value.length - 3} more</Badge>
            )}
          </span>
          <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map(o => (
                <CommandItem key={o.value} value={`${o.label} ${o.hint ?? ""}`} onSelect={() => toggle(o.value)}>
                  <Check className={cn("mr-2 h-4 w-4", value.includes(o.value) ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1">{o.label}</span>
                  {o.hint && <span className="text-xs text-muted-foreground ml-2">{o.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
