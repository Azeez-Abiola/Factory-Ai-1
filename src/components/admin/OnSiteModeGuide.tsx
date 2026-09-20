import { useState } from "react";
import { Check, Copy, HardDrive, Laptop, Network, ShieldCheck, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";

/**
 * On-site mode: the console is served from a PC on the camera network, so the
 * browser can load streams from a converter running on that same network.
 * This removes the public domain, TLS certificate and firewall work that a
 * published gateway needs — everything stays inside the plant.
 */

const MEDIAMTX_YML = `# mediamtx.yml — converter for the plant PC
# Publishes each recorder channel as browser-playable video on the local network.

hlsAddress: :8888
hlsAlwaysRemux: yes
hlsVariant: lowLatency
hlsAllowOrigin: "*"

webrtcAddress: :8889
webrtcAllowOrigin: "*"
webrtcLocalUDPAddress: :8189

paths:
  gate-6:
    # Channel 6 main stream. # in a password must be written as %23
    source: rtsp://factoryai:PASSWORD@192.168.1.64:554/Streaming/Channels/601
    sourceOnDemand: no
  gate-4:
    source: rtsp://factoryai:PASSWORD@192.168.1.64:554/Streaming/Channels/401
    sourceOnDemand: no
`;

const RUN_LOCAL = `:: Run the FactoryAI console on the plant PC (plain HTTP, local network only)
:: Needs Node.js 20+ installed once from https://nodejs.org

cd C:\\FactoryAI\\app
npm install
npm run build
npx serve -s dist -l 8080 --cors

:: Operators then open:  http://<plant-pc-ip>:8080
`;

const STEPS: [string, string][] = [
  ["Pick the plant PC", "Any Windows PC or small server that stays switched on, plugged into the same network as the recorder. Give it a fixed address (for example 192.168.10.50) so the link never changes."],
  ["Install the converter", "Download MediaMTX, unzip it to C:\\FactoryAI\\mediamtx, and replace mediamtx.yml with the file below — one entry per recorder channel. Run mediamtx.exe once to check it starts."],
  ["Check the video plays", "On the plant PC open http://localhost:8888/gate-6/index.m3u8 in VLC, or the console's own test button. If the picture appears, the converter is done."],
  ["Serve the console locally", "Copy the app folder onto the same PC and start it with the commands below. It keeps using the cloud for alerts, users and history — only the pictures come from the local network."],
  ["Point the site at the converter", "Set the gateway address on this page to http://<plant-pc-ip>:8888 and choose MediaMTX. Camera addresses are generated from it automatically."],
  ["Open it from the plant floor", "Operators browse to http://<plant-pc-ip>:8080 on any PC or tablet on the factory network. No certificate, no domain, no firewall changes."],
  ["Keep it running", "Install both the converter and the console as Windows services (WinSW or NSSM) so they come back on their own after a reboot or power cut."],
];

export default function OnSiteModeGuide() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Laptop className="h-4 w-4" /> Run on the plant network
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" /> On-site mode — no public gateway
          </DialogTitle>
          <DialogDescription>
            Run the console from a PC on the camera network so live video plays without a public address or certificate.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Est. 1 hour</Badge>
          <Badge variant="outline">One PC per site</Badge>
          <Badge variant="outline">No domain or certificate</Badge>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
          <p className="flex items-center gap-2 font-medium"><Wifi className="h-4 w-4 text-primary" /> What changes</p>
          <p className="text-muted-foreground">
            Opened from the internet, the console cannot touch anything on your private network, which is why a public
            gateway is normally required. Opened from a PC inside the plant, it can — so the converter only needs a
            local address. Recorder passwords never leave the building.
          </p>
          <p className="text-muted-foreground">
            Trade-off: live video plays for people on the factory network. Anyone logging in from outside still gets
            refreshing still pictures, alerts and reports as they do today.
          </p>
        </div>

        <Accordion type="multiple" defaultValue={["steps"]} className="w-full">
          <AccordionItem value="steps">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Network className="h-4 w-4 text-primary" /> Step by step</span>
            </AccordionTrigger>
            <AccordionContent>
              <ol className="space-y-3 text-sm">
                {STEPS.map(([title, detail], i) => (
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

          <AccordionItem value="yml">
            <AccordionTrigger className="text-sm font-semibold">Converter settings (mediamtx.yml)</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <Button size="sm" variant="secondary" className="gap-2" onClick={() => copy("Converter settings", MEDIAMTX_YML)}>
                {copied === "Converter settings" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy
              </Button>
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">{MEDIAMTX_YML}</pre>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="run">
            <AccordionTrigger className="text-sm font-semibold">Start the console on the plant PC</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <Button size="sm" variant="secondary" className="gap-2" onClick={() => copy("Startup commands", RUN_LOCAL)}>
                {copied === "Startup commands" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy
              </Button>
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">{RUN_LOCAL}</pre>
              <p className="text-xs text-muted-foreground">
                The local copy signs in against the same cloud account, so users, alerts and history are identical to
                the hosted console.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="security">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Security notes</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              <p>Nothing on the camera network is published to the internet — the converter listens on the local network only.</p>
              <p>Do not port-forward the recorder or the converter. If outside viewing is needed later, add the published gateway from the IT guide instead.</p>
              <p>Use a read-only recorder account for the converter, and rotate any password that has been shared by email or chat.</p>
              <p>Keep the plant PC on the same patching and antivirus policy as other factory machines.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="trouble">
            <AccordionTrigger className="text-sm font-semibold">If video still doesn't play</AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">Nothing loads, console opened as https://</span> — you are on the hosted copy. Local video only plays from the local address (http://plant-pc-ip:8080).</p>
              <p><span className="font-medium text-foreground">Converter starts then drops</span> — wrong recorder password or channel. A # in a password must be typed as %23.</p>
              <p><span className="font-medium text-foreground">Plays on the plant PC but not on other PCs</span> — Windows Firewall is blocking ports 8080, 8888 and 8889; allow them for the private network.</p>
              <p><span className="font-medium text-foreground">Choppy picture</span> — use the recorder's sub-stream for busy channels, or give the PC a wired connection.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}
