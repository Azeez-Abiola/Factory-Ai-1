import { useState } from "react";
import { Settings2, Webhook, Palette, Plus, CheckCircle2, XCircle, AlertCircle, Globe, Mail, Info, Terminal, Activity, ShieldCheck, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { mockWebhooks, mockWhiteLabel, type WebhookConfig } from "@/data/extendedMockData";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const statusConfig = {
  active: { icon: <CheckCircle2 className="w-4 h-4" />, color: "bg-success/10 text-success border-success/30", label: "Healthy" },
  inactive: { icon: <XCircle className="w-4 h-4" />, color: "bg-muted text-muted-foreground border-border", label: "Disabled" },
  error: { icon: <AlertCircle className="w-4 h-4" />, color: "bg-destructive/10 text-destructive border-destructive/30", label: "Connection Error" },
};

const Settings = () => {
  const [whiteLabel, setWhiteLabel] = useState(mockWhiteLabel);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(mockWebhooks);
  const [addOpen, setAddOpen] = useState(false);
  const [newWhName, setNewWhName] = useState("");
  const [newWhUrl, setNewWhUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const availableEvents = ["alert.critical", "alert.high", "shift.complete", "production.stats", "report.generated"];

  const toggleWebhook = (id: string, checked: boolean) => {
    setWebhooks(prev => prev.map(wh => 
      wh.id === id ? { ...wh, status: checked ? "active" : "inactive" } : wh
    ));
    const wh = webhooks.find(w => w.id === id);
    toast.success(`${wh?.name ?? 'Webhook'} ${checked ? 'activated' : 'deactivated'}`);
  };

  const handleAddWebhook = () => {
    if (!newWhName || !newWhUrl) {
      toast.error("Please provide both a name and a valid destination URL");
      return;
    }
    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event to subscribe to");
      return;
    }

    const newWh: WebhookConfig = {
      id: `WH-${String(webhooks.length + 1).padStart(3, "0")}`,
      name: newWhName,
      url: newWhUrl,
      events: selectedEvents,
      status: "active",
      lastTriggered: new Date().toISOString(),
      successRate: 100
    };

    setWebhooks(prev => [...prev, newWh]);
    setAddOpen(false);
    setNewWhName("");
    setNewWhUrl("");
    setSelectedEvents([]);
    toast.success(`Webhook "${newWhName}" added successfully`);
  };

  const handleSaveBranding = () => {
    toast.success("Branding configuration saved successfully");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-primary" /> Platform Administration
          </h1>
          <p className="text-sm text-muted-foreground">Configure system-wide integrations, branding, and connectivity</p>
        </div>
      </div>

      <Tabs defaultValue="webhooks" className="w-full">
        <TabsList className="bg-muted/50 p-1 border border-border h-11">
          <TabsTrigger value="webhooks" className="gap-2 px-4 data-[state=active]:bg-background"><Webhook className="w-4 h-4" /> System Webhooks</TabsTrigger>
          <TabsTrigger value="whitelabel" className="gap-2 px-4 data-[state=active]:bg-background"><Palette className="w-4 h-4" /> White Labeling</TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Active Webhooks</h2>
                  <p className="text-xs text-muted-foreground">System events are pushed to these endpoints in real-time</p>
                </div>
                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 border-primary/20 text-primary hover:text-primary hover:bg-primary/5">
                      <Plus className="w-4 h-4" /> Add Destination
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="text-foreground">Add Webhook Destination</DialogTitle>
                      <DialogDescription className="text-muted-foreground">
                        Configure a new endpoint to receive real-time notifications from the platform.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Destination Name</Label>
                        <Input 
                          placeholder="e.g., Engineering Slack" 
                          value={newWhName}
                          onChange={(e) => setNewWhName(e.target.value)}
                          className="bg-background border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Payload URL</Label>
                        <Input 
                          placeholder="https://hooks.yourtool.com/..." 
                          value={newWhUrl}
                          onChange={(e) => setNewWhUrl(e.target.value)}
                          className="bg-background border-border"
                        />
                      </div>
                      <div className="space-y-3 pt-2">
                        <Label className="text-xs text-muted-foreground">Subscription Events</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {availableEvents.map(event => (
                            <div key={event} className="flex items-center space-x-2">
                              <Checkbox 
                                id={event} 
                                checked={selectedEvents.includes(event)}
                                onCheckedChange={(checked) => {
                                  if (checked) setSelectedEvents([...selectedEvents, event]);
                                  else setSelectedEvents(selectedEvents.filter(e => e !== event));
                                }}
                              />
                              <label htmlFor={event} className="text-[10px] sm:text-xs font-medium text-foreground cursor-pointer">
                                {event}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="ghost">Cancel</Button>
                      </DialogClose>
                      <Button onClick={handleAddWebhook} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        Test & Add Webhook
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-3">
                {webhooks.map((wh) => {
                  const status = statusConfig[wh.status];
                  return (
                    <Card key={wh.id} className={cn("border-border overflow-hidden transition-all", wh.status === 'inactive' && "opacity-75 grayscale-[0.5]")}>
                      <CardContent className="p-0">
                        <div className="p-4 sm:p-5">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-foreground">{wh.name}</h3>
                                <Badge variant="outline" className={cn("text-[10px] h-5 gap-1 font-medium", status.color)}>
                                  {status.icon} {status.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded w-fit max-w-full overflow-hidden">
                                <Terminal className="w-3 h-3 shrink-0" />
                                <span className="truncate">{wh.url}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right hidden sm:block">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Success Rate</p>
                                <p className={cn("text-sm font-bold", wh.successRate > 95 ? "text-success" : wh.successRate > 80 ? "text-warning" : "text-destructive")}>
                                  {wh.successRate}%
                                </p>
                              </div>
                              <div className="h-8 w-px bg-border hidden sm:block mx-1" />
                              <Switch 
                                checked={wh.status === "active"} 
                                onCheckedChange={(checked) => toggleWebhook(wh.id, checked)}
                              />
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap items-center gap-y-3 gap-x-6">
                            <div className="flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Events:</span>
                              <div className="flex gap-1">
                                {wh.events.map((e) => (
                                  <Badge key={e} variant="secondary" className="text-[9px] h-4 leading-none font-mono bg-accent/50 text-accent-foreground border-none">
                                    {e}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                              <Info className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                Last: {new Date(wh.lastTriggered).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <Card className="border-border bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" /> Webhook Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    All outbound requests are signed using an HMAC signature in the <code className="text-primary">X-FactoryIQ-Signature</code> header.
                  </p>
                  <div className="space-y-2">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Secret Key</Label>
                    <div className="flex gap-2">
                      <Input value="whsec_4ae0b...f2ba" readOnly className="h-8 text-xs font-mono bg-background border-border" />
                      <Button variant="outline" size="sm" className="h-8 px-2 text-[10px]" onClick={() => toast.success("Secret copied")}>Copy</Button>
                    </div>
                  </div>
                  <Button variant="link" className="p-0 h-auto text-xs text-primary font-medium gap-1">
                    Read Documentation <ExternalLink className="w-3 h-3" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold">Integration Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { name: "SMTP Service", status: "Connected", color: "text-success" },
                    { name: "AWS S3 Storage", status: "Connected", color: "text-success" },
                    { name: "Auth0 Provider", status: "Connected", color: "text-success" },
                    { name: "Stripe Billing", status: "Degraded", color: "text-warning" },
                  ].map((s) => (
                    <div key={s.name} className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">{s.name}</span>
                      <span className={cn("font-medium", s.color)}>{s.status}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="whitelabel" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-foreground">Branding Configuration</CardTitle>
                <CardDescription className="text-xs">Customize the look and feel of the platform for your tenants</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-1 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      Company Display Name
                    </Label>
                    <Input 
                      value={whiteLabel.companyName} 
                      onChange={(e) => setWhiteLabel({...whiteLabel, companyName: e.target.value})} 
                      className="bg-background border-border" 
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5">Primary Brand Color</Label>
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg border border-border shrink-0 shadow-sm" 
                        style={{ backgroundColor: whiteLabel.primaryColor }} 
                      />
                      <Input 
                        value={whiteLabel.primaryColor} 
                        onChange={(e) => setWhiteLabel({...whiteLabel, primaryColor: e.target.value})} 
                        className="bg-background border-border font-mono text-xs" 
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Mail className="w-3 h-3" /> Email From Address
                    </Label>
                    <Input 
                      value={whiteLabel.emailFrom} 
                      onChange={(e) => setWhiteLabel({...whiteLabel, emailFrom: e.target.value})} 
                      className="bg-background border-border" 
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Globe className="w-3 h-3" /> Custom Management Domain
                    </Label>
                    <div className="flex">
                      <div className="px-3 flex items-center justify-center bg-muted border border-r-0 border-border rounded-l-lg text-[10px] text-muted-foreground font-medium">https://</div>
                      <Input 
                        value={whiteLabel.customDomain} 
                        onChange={(e) => setWhiteLabel({...whiteLabel, customDomain: e.target.value})} 
                        className="bg-background border-border rounded-l-none" 
                      />
                    </div>
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground mb-1.5">Public Logo URL</Label>
                    <Input 
                      value={whiteLabel.logoUrl} 
                      onChange={(e) => setWhiteLabel({...whiteLabel, logoUrl: e.target.value})} 
                      className="bg-background border-border font-mono text-xs" 
                    />
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border flex justify-end gap-3">
                  <Button variant="ghost" className="text-muted-foreground text-xs">Reset to Defaults</Button>
                  <Button onClick={handleSaveBranding} className="bg-primary hover:bg-primary/90 gap-2 text-xs">
                    <CheckCircle2 className="w-4 h-4" /> Save Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border">
                  <CardTitle className="text-sm font-bold">Live Preview</CardTitle>
                </CardHeader>
                <CardContent className="p-8 flex flex-col items-center justify-center min-h-[300px]">
                   <div className="w-full max-w-sm space-y-6 p-6 rounded-2xl bg-background border border-border shadow-2xl">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: whiteLabel.primaryColor }} />
                        <span className="font-bold text-foreground">{whiteLabel.companyName}</span>
                      </div>
                      <div className="space-y-3">
                        <div className="h-8 w-full bg-muted/50 rounded animate-pulse" />
                        <div className="h-8 w-2/3 bg-muted/50 rounded animate-pulse" />
                      </div>
                      <Button className="w-full h-10 border-none pointer-events-none" style={{ backgroundColor: whiteLabel.primaryColor }}>
                        Sign In to Your Factory
                      </Button>
                      <p className="text-[10px] text-center text-muted-foreground">
                        © 2026 {whiteLabel.companyName} Portal · All Rights Reserved
                      </p>
                   </div>
                   <p className="mt-6 text-[10px] text-muted-foreground italic text-center max-w-xs">
                     This is a mock representation of how your brand color and name will appear on the tenant login page.
                   </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
