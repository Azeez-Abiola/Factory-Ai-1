import { useState } from "react";
import { BookOpen, Check, Copy, Server, ShieldCheck, Network, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { GATEWAY_PATTERNS, CAMERA_SNAPSHOT_PATTERNS } from "@/lib/gatewayPatterns";

/**
 * A self-service brief the platform admin can hand to the factory IT team.
 * Explains what a streaming gateway is, what must be provisioned, and the
 * exact information the platform needs back per camera / NVR channel.
 */

const REQUIREMENTS = [
  { label: "Gateway host", detail: "One small Linux VM or industrial PC on the same network as the cameras. 4 vCPU / 8 GB RAM handles ~16 cameras at 1080p." },
  { label: "Public HTTPS address", detail: "A DNS name with a valid TLS certificate, e.g. streams.factory.com. Browsers refuse mixed content, so plain HTTP will not play inside the console." },
  { label: "Outbound internet", detail: "The gateway must be able to reach the platform for heartbeats (HTTPS 443 outbound only)." },
  { label: "Inbound ports", detail: "443/TCP for HLS + WHEP signalling, and 8189/UDP (or a configured range) for WebRTC media if low latency is required." },
  { label: "Camera access", detail: "RTSP (554/TCP) and HTTP (80/443) from the gateway to every camera or NVR channel." },
  { label: "Service account", detail: "A read-only camera/NVR user per site. Never the vendor default admin account." },
  { label: "Snapshot route", detail: "A JPEG still per camera the AI worker can fetch — from the gateway or directly from the camera." },
  { label: "Clock sync", detail: "NTP on gateway, NVR and cameras so evidence timestamps line up with the audit trail." },
];

const HANDOVER_FIELDS = [
  "Gateway base URL (https://…)",
  "Gateway software and version (MediaMTX, go2rtc, Frigate, Ant Media…)",
  "Stream key or channel name per camera",
  "RTSP source URL per camera (main stream and sub stream)",
  "JPEG snapshot URL per camera, if not served by the gateway",
  "Read-only username and password for cameras / NVR",
  "Physical zone each camera watches (e.g. Line 2 – Packing)",
  "Resolution and frame rate per camera",
];

export default function GatewaySetupGuide() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const brief = [
    "FACTORY STREAMING GATEWAY — IT REQUIREMENTS",
    "",
    "PURPOSE",
    "Cameras speak RTSP, which browsers cannot play. A streaming gateway on the factory network republishes each camera as HLS/WebRTC over HTTPS, and serves a JPEG still per camera for AI analysis.",
    "",
    "INFRASTRUCTURE REQUIREMENTS",
    ...REQUIREMENTS.map((r, i) => `${i + 1}. ${r.label}: ${r.detail}`),
    "",
    "STEP BY STEP",
    "1. Provision the gateway host on the camera VLAN.",
    "2. Install the gateway software (MediaMTX or go2rtc recommended).",
    "3. Add one path/stream key per camera pointing at its RTSP URL.",
    "4. Enable HLS and WebRTC (WHEP) output and the JPEG snapshot endpoint.",
    "5. Put the gateway behind a reverse proxy with a valid TLS certificate and enable CORS for the console origin.",
    "6. Publish the DNS name and open 443/TCP (plus UDP media ports for WebRTC).",
    "7. Create a read-only camera/NVR service account.",
    "8. Verify each stream plays in a browser and each snapshot returns a JPEG.",
    "9. Hand back the details listed below.",
    "",
    "INFORMATION TO HAND BACK",
    ...HANDOVER_FIELDS.map((f) => `- ${f}`),
    "",
    "SECURITY",
    "- Cameras stay on an isolated VLAN; only the gateway is exposed.",
    "- Gateway endpoints protected by TLS and, where supported, token or basic auth.",
    "- No inbound access to cameras from the internet.",
    "- Retention and recording remain on the NVR; the platform stores evidence stills only.",
  ].join("\n");

  const copyBrief = async () => {
    await navigator.clipboard.writeText(brief);
    setCopied(true);
    toast.success("IT brief copied — paste it into an email or ticket");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <BookOpen className="h-4 w-4" /> IT setup guide
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" /> Camera streaming — IT setup guide
          </DialogTitle>
          <DialogDescription>
            Everything the factory IT team must provision, and the details they need to hand back before cameras go live.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Est. 2–4 hours</Badge>
          <Badge variant="outline">One gateway per site</Badge>
          <Button size="sm" variant="secondary" className="ml-auto gap-2" onClick={copyBrief}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy brief for IT
          </Button>
        </div>

        <Accordion type="multiple" defaultValue={["why", "steps"]} className="w-full">
          <AccordionItem value="why">
            <AccordionTrigger className="text-sm font-semibold">Why a gateway is needed</AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Factory cameras publish RTSP, a protocol browsers cannot play, and they normally sit on a private
                network with no route from the internet. A streaming gateway runs inside the factory, pulls each
                camera once, and republishes it as HLS or WebRTC over HTTPS plus a JPEG still per camera.
              </p>
              <p>
                One gateway serves every camera on the site, so cameras are never exposed directly and their
                credentials never leave the plant.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="req">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Network className="h-4 w-4 text-primary" /> Infrastructure requirements</span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 text-sm">
                {REQUIREMENTS.map((r) => (
                  <li key={r.label} className="rounded-lg border border-border p-3">
                    <p className="font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.detail}</p>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="steps">
            <AccordionTrigger className="text-sm font-semibold">Step by step for IT</AccordionTrigger>
            <AccordionContent>
              <ol className="space-y-3 text-sm">
                {[
                  ["Place the gateway", "Deploy a Linux host on the same VLAN as the cameras. Give it a static IP."],
                  ["Install gateway software", "MediaMTX or go2rtc are the lightest options; Frigate or Ant Media also work."],
                  ["Register each camera", "Add one path / stream key per camera pointing at its RTSP URL. Use the camera's sub-stream for AI and the main stream for viewing where possible."],
                  ["Enable outputs", "Turn on HLS, WebRTC (WHEP) and the JPEG snapshot endpoint."],
                  ["Terminate TLS", "Front the gateway with Nginx/Caddy, install a valid certificate, and allow CORS from the console domain."],
                  ["Open the network path", "Publish the DNS name, allow 443/TCP inbound and the WebRTC UDP media range; allow 443 outbound for heartbeats."],
                  ["Create a service account", "A read-only camera/NVR user, unique per site, rotated on the normal credential schedule."],
                  ["Verify", "Open each HLS URL in a browser and each snapshot URL — the still must load as a JPEG."],
                  ["Hand back the details", "Send the fields listed in the next section so cameras can be registered here."],
                ].map(([title, detail], i) => (
                  <li key={title} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
                    <div>
                      <p className="font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">{detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="handover">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> What IT must hand back</span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="grid gap-2 sm:grid-cols-2 text-sm">
                {HANDOVER_FIELDS.map((f) => (
                  <li key={f} className="flex items-start gap-2 rounded-lg border border-border p-3">
                    <Check className="mt-0.5 h-4 w-4 text-success" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="patterns">
            <AccordionTrigger className="text-sm font-semibold">Address patterns by gateway</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 text-xs">
                {GATEWAY_PATTERNS.filter((p) => p.id !== "custom").map((p) => (
                  <div key={p.id} className="rounded-lg border border-border p-3 space-y-1">
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="font-mono text-muted-foreground">Playback · {p.hls("https://gateway", "<stream-key>")}</p>
                    <p className="font-mono text-muted-foreground">WebRTC · {p.webrtc("https://gateway", "<stream-key>")}</p>
                    <p className="font-mono text-muted-foreground">Snapshot · {p.snapshot("https://gateway", "<stream-key>")}</p>
                    <p className="text-muted-foreground">{p.note}</p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="nosnap">
            <AccordionTrigger className="text-sm font-semibold">Cameras without a snapshot URL</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                AI analysis needs a still image. If the gateway cannot produce one, use the camera's own JPEG route —
                most brands have a fixed pattern (replace host and channel):
              </p>
              <div className="space-y-1 text-xs">
                {CAMERA_SNAPSHOT_PATTERNS.map((b) => (
                  <p key={b.brand} className="font-mono">
                    {b.brand} · {b.path("<camera-ip>", 1)}
                  </p>
                ))}
              </div>
              <p>
                If no still is available at all, leave the snapshot blank and set the playback type to MJPEG — the AI
                worker can pull frames from an MJPEG stream. Otherwise scheduled AI stays off for that camera and it
                remains view-only.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="security">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Security expectations</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              <p>Cameras remain on an isolated VLAN with no inbound internet route; only the gateway is published.</p>
              <p>Camera credentials are stored encrypted per camera and are never sent to the operator console.</p>
              <p>Recording and retention stay on the NVR; this platform stores evidence stills and analysis results only.</p>
              <p>Each camera receives a unique ingest token for heartbeats, revocable from this page.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}
