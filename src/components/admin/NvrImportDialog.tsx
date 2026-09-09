import { useMemo, useState } from "react";
import { Loader2, Router, Wand2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getGatewayPattern, type GatewayVendor } from "@/lib/gatewayPatterns";

type Brand = "hikvision" | "dahua" | "uniview" | "custom";

const RTSP_TEMPLATES: Record<Brand, { label: string; rtsp: (h: string, ch: number) => string; snapshot: (h: string, ch: number) => string }> = {
  hikvision: {
    label: "Hikvision / HiLook",
    rtsp: (h, c) => `rtsp://${h}:554/Streaming/Channels/${c}01`,
    snapshot: (h, c) => `http://${h}/ISAPI/Streaming/channels/${c}01/picture`,
  },
  dahua: {
    label: "Dahua / Lorex / Amcrest",
    rtsp: (h, c) => `rtsp://${h}:554/cam/realmonitor?channel=${c}&subtype=0`,
    snapshot: (h, c) => `http://${h}/cgi-bin/snapshot.cgi?channel=${c}`,
  },
  uniview: {
    label: "Uniview",
    rtsp: (h, c) => `rtsp://${h}:554/unicast/c${c}/s0/live`,
    snapshot: (h, c) => `http://${h}/images/snapshot.jpg?channel=${c}`,
  },
  custom: {
    label: "Custom template",
    rtsp: (h, c) => `rtsp://${h}:554/channel/${c}`,
    snapshot: () => "",
  },
};

interface Channel {
  channel: number;
  name: string;
  zone: string;
  include: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  gatewayBase?: string;
  gatewayVendor?: GatewayVendor;
  onImported: () => void;
}

const NvrImportDialog = ({ open, onOpenChange, tenantId, gatewayBase, gatewayVendor, onImported }: Props) => {
  const [brand, setBrand] = useState<Brand>("hikvision");
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [first, setFirst] = useState(1);
  const [count, setCount] = useState(8);
  const [prefix, setPrefix] = useState("Camera");
  const [zone, setZone] = useState("");
  const [customRtsp, setCustomRtsp] = useState("rtsp://{host}:554/channel/{channel}");
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [saving, setSaving] = useState(false);

  const template = RTSP_TEMPLATES[brand];

  const rtspFor = (ch: number) =>
    brand === "custom"
      ? customRtsp.replaceAll("{host}", host).replaceAll("{channel}", String(ch))
      : template.rtsp(host, ch);

  const selectedCount = useMemo(() => channels?.filter((c) => c.include).length ?? 0, [channels]);

  const scan = () => {
    if (!host.trim()) return toast.error("Enter the NVR address first");
    const list: Channel[] = Array.from({ length: Math.max(1, Math.min(64, count)) }, (_, i) => {
      const ch = first + i;
      return { channel: ch, name: `${prefix.trim() || "Camera"} ${ch}`, zone: zone.trim(), include: true };
    });
    setChannels(list);
  };

  const update = (ch: number, patch: Partial<Channel>) =>
    setChannels((prev) => prev?.map((c) => (c.channel === ch ? { ...c, ...patch } : c)) ?? prev);

  const importAll = async () => {
    if (!channels?.length) return;
    const chosen = channels.filter((c) => c.include);
    if (!chosen.length) return toast.error("Select at least one channel");
    setSaving(true);
    const pattern = gatewayBase ? getGatewayPattern(gatewayVendor) : null;

    const rows = chosen.map((c) => ({
      tenant_id: tenantId,
      name: c.name.trim() || `Channel ${c.channel}`,
      zone: c.zone.trim() || null,
      type: "Vision",
      status: "configuring",
      resolution: "1920x1080",
      rtsp_url: rtspFor(c.channel),
      snapshot_url: template.snapshot(host, c.channel) || null,
      stream_type: "hls",
      retention_days: 30,
      heartbeat_interval_seconds: 60,
      ai_models: { ppe: true, quality: false, intrusion: false, downtime: false, ergonomics: false },
      confidence_threshold: 75,
      credentials: { username, password, onvif_port: 80 },
      fps: 25,
      recording_enabled: true,
      inference_enabled: false,
      inference_interval_seconds: 30,
      scene_gating_enabled: true,
      metadata: { source: "nvr_import", nvr_host: host, channel: c.channel },
    }));

    const { data, error } = await supabase.from("cameras").insert(rows as any).select("id");
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    // Fill in gateway playback addresses once the ids exist.
    if (pattern && gatewayBase && data) {
      await Promise.all(
        data.map((row: any) =>
          supabase.from("cameras")
            .update({ stream_url: pattern.hls(gatewayBase, row.id) })
            .eq("id", row.id),
        ),
      );
    }

    setSaving(false);
    toast.success(`${rows.length} camera${rows.length > 1 ? "s" : ""} imported from the NVR`);
    setChannels(null);
    onOpenChange(false);
    onImported();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Router className="w-5 h-5 text-primary" /> Bulk import from NVR
          </DialogTitle>
          <DialogDescription>
            List every channel on your recorder, name each one, and add them all in a single step.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Recorder brand</Label>
              <Select value={brand} onValueChange={(v) => setBrand(v as Brand)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RTSP_TEMPLATES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>NVR address <span className="text-destructive">*</span></Label>
              <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="10.20.0.5" />
            </div>
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label>First channel</Label>
              <Input type="number" min={1} value={first} onChange={(e) => setFirst(Number(e.target.value) || 1)} />
            </div>
            <div className="space-y-1.5">
              <Label>How many channels</Label>
              <Input type="number" min={1} max={64} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
            </div>
            <div className="space-y-1.5">
              <Label>Name prefix</Label>
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Line A Camera" />
            </div>
            <div className="space-y-1.5">
              <Label>Default zone</Label>
              <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Packing Hall" />
            </div>
          </div>

          {brand === "custom" && (
            <div className="space-y-1.5">
              <Label>RTSP template</Label>
              <Input value={customRtsp} onChange={(e) => setCustomRtsp(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                Use <code>{"{host}"}</code> and <code>{"{channel}"}</code> — they are replaced per channel.
              </p>
            </div>
          )}

          <Button variant="outline" className="gap-2" onClick={scan}>
            <Wand2 className="w-4 h-4" /> List channels
          </Button>

          {channels && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
                <span className="text-xs font-semibold text-foreground">
                  {channels.length} channels · {selectedCount} selected
                </span>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => setChannels(channels.map((c) => ({ ...c, include: selectedCount !== channels.length })))}
                >
                  {selectedCount === channels.length ? "Clear all" : "Select all"}
                </Button>
              </div>
              <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
                {channels.map((c) => (
                  <div key={c.channel} className="flex items-center gap-3 px-4 py-2.5">
                    <Checkbox
                      checked={c.include}
                      onCheckedChange={(v) => update(c.channel, { include: !!v })}
                      aria-label={`Include channel ${c.channel}`}
                    />
                    <Badge variant="outline" className="tabular-nums shrink-0">CH {c.channel}</Badge>
                    <Input
                      className="h-8"
                      value={c.name}
                      onChange={(e) => update(c.channel, { name: e.target.value })}
                      aria-label={`Name for channel ${c.channel}`}
                    />
                    <Input
                      className="h-8 w-40"
                      value={c.zone}
                      placeholder="Zone"
                      onChange={(e) => update(c.channel, { zone: e.target.value })}
                      aria-label={`Zone for channel ${c.channel}`}
                    />
                  </div>
                ))}
              </div>
              <p className="px-4 py-2.5 text-[11px] text-muted-foreground border-t border-border break-all">
                Example address: {rtspFor(channels[0]?.channel ?? 1)}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={importAll} disabled={!selectedCount || saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Import {selectedCount || ""} camera{selectedCount === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NvrImportDialog;
