import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { AlertTriangle, Camera, FileText, LayoutDashboard, LifeBuoy, ShieldAlert, Sparkles, Wrench } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AlertHit { id: string; title: string; severity: string; zone: string | null }
interface CameraHit { id: string; name: string; location: string | null }

const pages = [
  { label: "Dashboard", to: "/app", icon: LayoutDashboard },
  { label: "Alerts", to: "/app/alerts", icon: AlertTriangle },
  { label: "Incidents", to: "/app/incidents", icon: ShieldAlert },
  { label: "Camera Feeds", to: "/app/cameras", icon: Camera },
  { label: "Reports", to: "/app/reports", icon: FileText },
  { label: "Shift Handover", to: "/app/shift-reports", icon: FileText },
  { label: "AI Insights", to: "/app/insights", icon: Sparkles },
  { label: "Maintenance", to: "/app/maintenance", icon: Wrench },
  { label: "Help & Knowledge Base", to: "/app/help", icon: LifeBuoy },
];

const GlobalSearch = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const { activeTenantId } = useTenants();
  const [query, setQuery] = useState("");
  const [alerts, setAlerts] = useState<AlertHit[]>([]);
  const [cameras, setCameras] = useState<CameraHit[]>([]);

  const term = query.trim();

  useEffect(() => {
    if (!open || !activeTenantId || term.length < 2) {
      setAlerts([]);
      setCameras([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const like = `%${term}%`;
      const [a, c] = await Promise.all([
        supabase.from("alerts").select("id,title,severity,zone").eq("tenant_id", activeTenantId)
          .or(`title.ilike.${like},zone.ilike.${like},type.ilike.${like}`)
          .order("detected_at", { ascending: false }).limit(6),
        supabase.from("cameras").select("id,name,location").eq("tenant_id", activeTenantId)
          .or(`name.ilike.${like},location.ilike.${like}`).limit(6),
      ]);
      if (cancelled) return;
      setAlerts((a.data as AlertHit[]) ?? []);
      setCameras((c.data as CameraHit[]) ?? []);
    }, 220);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [term, open, activeTenantId]);

  const go = (to: string) => {
    onOpenChange(false);
    setQuery("");
    navigate(to);
  };

  const pageHits = useMemo(
    () => pages.filter((p) => !term || p.label.toLowerCase().includes(term.toLowerCase())),
    [term],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search alerts, cameras, pages…"
      />
      <CommandList>
        <CommandEmpty>No matches found.</CommandEmpty>
        {pageHits.length > 0 && (
          <CommandGroup heading="Go to">
            {pageHits.map((p) => (
              <CommandItem key={p.to} value={`page ${p.label}`} onSelect={() => go(p.to)}>
                <p.icon className="w-4 h-4 mr-2 text-muted-foreground" />
                {p.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {alerts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Alerts">
              {alerts.map((a) => (
                <CommandItem key={a.id} value={`alert ${a.title} ${a.id}`} onSelect={() => go(`/app/alerts?alert=${a.id}`)}>
                  <AlertTriangle className="w-4 h-4 mr-2 text-warning" />
                  <span className="truncate">{a.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground capitalize">{a.severity}{a.zone ? ` · ${a.zone}` : ""}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {cameras.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Cameras">
              {cameras.map((c) => (
                <CommandItem key={c.id} value={`camera ${c.name} ${c.id}`} onSelect={() => go(`/app/cameras?camera=${c.id}`)}>
                  <Camera className="w-4 h-4 mr-2 text-primary" />
                  <span className="truncate">{c.name}</span>
                  {c.location && <span className="ml-auto text-xs text-muted-foreground">{c.location}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default GlobalSearch;
