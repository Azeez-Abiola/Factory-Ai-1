import { useState } from "react";
import { Check, Copy, Camera, HardDrive, Laptop, Network, ShieldCheck, Wifi } from "lucide-react";
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

const EXAMPLE = {
  pcIp: "192.168.10.50",
  nvrIp: "192.168.1.64",
  user: "factoryai",
  pass: "Welcome%2312345", // # written as %23
};

const CHECK_NVR = `:: 1. Check the plant PC can reach the recorder
ping 192.168.1.64
:: 2. Check the recorder's video port answers
Test-NetConnection 192.168.1.64 -Port 554
:: 3. Check the still-picture address works (opens a JPEG in your browser)
start http://factoryai:Welcome%2312345@192.168.1.64/ISAPI/Streaming/channels/601/picture
`;

const MEDIAMTX_YML = `# mediamtx.yml — converter for the plant PC
# Publishes each recorder channel as browser-playable video on the local network.
# Channel numbering (Hikvision): camera 6 main stream = 601, sub stream = 602.

hlsAddress: :8888
hlsAlwaysRemux: yes
hlsVariant: lowLatency
hlsAllowOrigin: "*"

webrtcAddress: :8889
webrtcAllowOrigin: "*"
webrtcLocalUDPAddress: :8189

paths:
  gate-6:
    # A # in the password must be written as %23
    source: rtsp://factoryai:Welcome%2312345@192.168.1.64:554/Streaming/Channels/601
    sourceOnDemand: no
  gate-4:
    source: rtsp://factoryai:Welcome%2312345@192.168.1.64:554/Streaming/Channels/401
    sourceOnDemand: no
`;

const RUN_LOCAL = `:: Run the FactoryAI console on the plant PC (plain HTTP, local network only)
:: Needs Node.js 20+ installed once from https://nodejs.org

cd C:\\FactoryAI\\app
npm install
npm run build
npx serve -s dist -l 8080 --cors

:: Operators then open:  http://192.168.10.50:8080
`;

const FIREWALL = `:: Run once, as Administrator, on the plant PC
netsh advfirewall firewall add rule name="FactoryAI console" dir=in action=allow protocol=TCP localport=8080 profile=private
netsh advfirewall firewall add rule name="FactoryAI video (HLS)" dir=in action=allow protocol=TCP localport=8888 profile=private
netsh advfirewall firewall add rule name="FactoryAI video (WebRTC)" dir=in action=allow protocol=TCP localport=8889 profile=private
netsh advfirewall firewall add rule name="FactoryAI video (WebRTC UDP)" dir=in action=allow protocol=UDP localport=8189 profile=private
`;

const SERVICES = `:: Keep both running after a reboot (WinSW — download WinSW.exe, copy it twice)
:: C:\\FactoryAI\\mediamtx\\mediamtx-service.xml
::   <service><id>factoryai-mediamtx</id><name>FactoryAI Converter</name>
::   <executable>C:\\FactoryAI\\mediamtx\\mediamtx.exe</executable></service>
:: C:\\FactoryAI\\app\\console-service.xml
::   <service><id>factoryai-console</id><name>FactoryAI Console</name>
::   <executable>C:\\Program Files\\nodejs\\npx.cmd</executable>
::   <arguments>serve -s C:\\FactoryAI\\app\\dist -l 8080 --cors</arguments></service>

C:\\FactoryAI\\mediamtx\\mediamtx-service.exe install
C:\\FactoryAI\\mediamtx\\mediamtx-service.exe start
C:\\FactoryAI\\app\\console-service.exe install
C:\\FactoryAI\\app\\console-service.exe start
`;

type Step = { title: string; detail: string; example?: string };

const STEPS: Step[] = [
  {
    title: "Pick the plant PC and give it a fixed address",
    detail:
      "Any Windows 10/11 PC or small server that stays switched on, wired into the same network as the recorder. Ask IT to reserve its address in DHCP so the link operators bookmark never changes.",
    example: "Example: control-room PC, Windows 11, fixed address 192.168.10.50",
  },
  {
    title: "Confirm the PC can see the recorder",
    detail:
      "Open PowerShell on the plant PC and run the three checks below. All three must pass before anything else is worth trying. If the picture opens in the browser, the account and channel number are correct.",
    example: "Recorder 192.168.1.64, account factoryai, channel 6 (601)",
  },
  {
    title: "Install the converter (MediaMTX)",
    detail:
      "Download MediaMTX for Windows, unzip to C:\\FactoryAI\\mediamtx, and replace mediamtx.yml with the file below — one block per recorder channel. Double-click mediamtx.exe once; the window should stay open and list each path.",
    example: "Folder: C:\\FactoryAI\\mediamtx\\  (mediamtx.exe + mediamtx.yml)",
  },
  {
    title: "Check the video plays locally",
    detail:
      "On the plant PC, open the playlist address in VLC (Media → Open Network Stream). A moving picture means the converter is done. Nothing playing means wrong password, wrong channel, or the recorder is refusing extra connections.",
    example: "http://localhost:8888/gate-6/index.m3u8",
  },
  {
    title: "Serve the console from the same PC",
    detail:
      "Copy the app folder to C:\\FactoryAI\\app and start it with the commands below. It keeps using the cloud for alerts, users, AI and history — only the pictures come from the local network.",
    example: "Operators open http://192.168.10.50:8080",
  },
  {
    title: "Open the ports on the plant PC",
    detail:
      "Windows Firewall blocks the ports by default, so video plays on the plant PC but nowhere else. Run the four rules below once as Administrator, on the private network profile only.",
    example: "TCP 8080, 8888, 8889 and UDP 8189 — private profile",
  },
  {
    title: "Point FactoryAI at the converter",
    detail:
      "In the console, open Admin → Cameras and set the gateway address, then update each camera as described in the next section. Camera playback addresses are generated from the gateway address automatically.",
    example: "Gateway address: http://192.168.10.50:8888  •  Type: MediaMTX",
  },
  {
    title: "Make it survive a reboot",
    detail:
      "Install both the converter and the console as Windows services so they come back on their own after a power cut. Then reboot the PC and confirm video still plays without anyone logging in.",
    example: "Services: FactoryAI Converter, FactoryAI Console",
  },
];

type FieldRow = { field: string; value: string; note: string };

const CAMERA_FIELDS: FieldRow[] = [
  { field: "Camera name", value: "UFL Gate (Channel 6)", note: "What operators see on the tile and on every alert." },
  { field: "Site / tenant", value: "UAC Foods Limited", note: "Decides who can see the camera and which rules apply." },
  { field: "Stream type", value: "HLS", note: "Choose HLS from the converter. WebRTC is lower delay but needs UDP 8189 open." },
  { field: "Stream address", value: "http://192.168.10.50:8888/gate-6/index.m3u8", note: "Must match the path name in mediamtx.yml exactly — gate-6, not Gate-6." },
  { field: "Snapshot address", value: "http://192.168.1.64/ISAPI/Streaming/channels/601/picture", note: "Still picture used for AI analysis, alert evidence, and as fallback if the converter stops." },
  { field: "Recorder username", value: "factoryai", note: "Use a view-only recorder account, not the admin account." },
  { field: "Recorder password", value: "Welcome#12345", note: "Typed normally here. Only the mediamtx.yml file needs # written as %23." },
  { field: "Channel", value: "6", note: "Recorder input number. Main stream = 601, sub stream = 602." },
  { field: "Snapshot interval", value: "2 seconds", note: "How often the still picture refreshes when video isn't available." },
  { field: "AI analysis", value: "On, every 30 seconds", note: "Turn on only after the test button passes, so you don't spend AI credit on a dead feed." },
];

const SNAPSHOT_EXAMPLES: [string, string, string][] = [
  ["Hikvision", "http://USER:PASS@192.168.1.64/ISAPI/Streaming/channels/601/picture", "Channel 6 main stream still picture"],
  ["Dahua", "http://USER:PASS@192.168.1.64/cgi-bin/snapshot.cgi?channel=6", "Channel numbering starts at 1"],
  ["Axis", "http://USER:PASS@192.168.1.70/axis-cgi/jpg/image.cgi", "Single camera, no recorder"],
  ["Via converter", "http://192.168.10.50:8888/gate-6/index.m3u8", "Moving video, not a still picture"],
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

  const CopyBlock = ({ label, code }: { label: string; code: string }) => (
    <div className="space-y-2">
      <Button size="sm" variant="secondary" className="gap-2" onClick={() => copy(label, code)}>
        {copied === label ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy
      </Button>
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">{code}</pre>
    </div>
  );

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
          <Badge variant="outline">For IT</Badge>
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
          <p className="text-xs text-muted-foreground">
            Example values used throughout: plant PC <span className="font-mono">{EXAMPLE.pcIp}</span>, recorder{" "}
            <span className="font-mono">{EXAMPLE.nvrIp}</span>, account <span className="font-mono">{EXAMPLE.user}</span>.
            Replace them with your own.
          </p>
        </div>

        <Accordion type="multiple" defaultValue={["steps", "camera"]} className="w-full">
          <AccordionItem value="steps">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Network className="h-4 w-4 text-primary" /> Step by step (IT)</span>
            </AccordionTrigger>
            <AccordionContent>
              <ol className="space-y-4 text-sm">
                {STEPS.map((step, i) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
                    <div className="space-y-1">
                      <p className="font-medium">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.detail}</p>
                      {step.example && (
                        <p className="rounded border border-border/60 bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                          {step.example}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="checks">
            <AccordionTrigger className="text-sm font-semibold">Step 2 — connection checks (PowerShell)</AccordionTrigger>
            <AccordionContent><CopyBlock label="Connection checks" code={CHECK_NVR} /></AccordionContent>
          </AccordionItem>

          <AccordionItem value="yml">
            <AccordionTrigger className="text-sm font-semibold">Step 3 — converter settings (mediamtx.yml)</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <CopyBlock label="Converter settings" code={MEDIAMTX_YML} />
              <p className="text-xs text-muted-foreground">
                One block per channel. The block name (gate-6) becomes part of the playback address, so keep it short,
                lower-case and without spaces.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="run">
            <AccordionTrigger className="text-sm font-semibold">Step 5 — start the console on the plant PC</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <CopyBlock label="Startup commands" code={RUN_LOCAL} />
              <p className="text-xs text-muted-foreground">
                The local copy signs in against the same cloud account, so users, alerts and history are identical to
                the hosted console.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="firewall">
            <AccordionTrigger className="text-sm font-semibold">Step 6 — firewall rules</AccordionTrigger>
            <AccordionContent><CopyBlock label="Firewall rules" code={FIREWALL} /></AccordionContent>
          </AccordionItem>

          <AccordionItem value="camera">
            <AccordionTrigger className="text-sm font-semibold">
              <span className="flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Step 7 — FactoryAI camera settings</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
                <p className="font-medium text-foreground">First, the site-wide setting</p>
                <p className="text-muted-foreground">
                  Admin → Cameras → Gateway address: <span className="font-mono">http://{EXAMPLE.pcIp}:8888</span>, type{" "}
                  <span className="font-mono">MediaMTX</span>. Save. Camera addresses are then generated from it.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 font-medium">Field</th>
                      <th className="py-2 pr-3 font-medium">Example value</th>
                      <th className="py-2 font-medium">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CAMERA_FIELDS.map((row) => (
                      <tr key={row.field} className="border-b border-border/50 align-top">
                        <td className="py-2 pr-3 font-medium text-foreground">{row.field}</td>
                        <td className="py-2 pr-3 font-mono text-[10px] text-primary break-all">{row.value}</td>
                        <td className="py-2 text-muted-foreground">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Snapshot and stream address examples by brand</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {SNAPSHOT_EXAMPLES.map(([brand, url, note]) => (
                        <tr key={brand} className="border-b border-border/50 align-top">
                          <td className="py-2 pr-3 font-medium text-foreground">{brand}</td>
                          <td className="py-2 pr-3 font-mono text-[10px] text-primary break-all">{url}</td>
                          <td className="py-2 text-muted-foreground">{note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Finally press <span className="font-medium text-foreground">Test stream</span> on the camera. A green
                result moves the camera from “configuring” to online; only then switch AI analysis on.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="services">
            <AccordionTrigger className="text-sm font-semibold">Step 8 — run as Windows services</AccordionTrigger>
            <AccordionContent><CopyBlock label="Service commands" code={SERVICES} /></AccordionContent>
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
              <p><span className="font-medium text-foreground">Nothing loads, console opened as https://</span> — you are on the hosted copy. Local video only plays from the local address (http://{EXAMPLE.pcIp}:8080).</p>
              <p><span className="font-medium text-foreground">Converter starts then drops</span> — wrong recorder password or channel. A # in a password must be typed as %23.</p>
              <p><span className="font-medium text-foreground">Plays on the plant PC but not on other PCs</span> — Windows Firewall is blocking ports 8080, 8888 and 8889; run the rules in step 6.</p>
              <p><span className="font-medium text-foreground">Camera stays “configuring”</span> — the test button hasn't passed yet. Check the stream path spelling matches mediamtx.yml exactly.</p>
              <p><span className="font-medium text-foreground">Choppy picture</span> — use the recorder's sub-stream (602 instead of 601) for busy channels, or give the PC a wired connection.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}
