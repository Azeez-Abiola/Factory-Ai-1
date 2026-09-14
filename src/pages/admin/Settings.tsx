import { useCallback, useEffect, useState } from "react";
import { Settings2, Webhook, Palette, Plus, CheckCircle2, XCircle, AlertCircle, Globe, Mail, Info, Terminal, Activity, ShieldCheck, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import PageHeader from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: string;
  last_triggered_at: string | null;
  success_rate: number;
}

interface Branding {
  companyName: string;
  primaryColor: string;
  emailFrom: string;
  customDomain: string;
  logoUrl: string;
}

const emptyBranding: Branding = {
  companyName: "",
  primaryColor: "#2dd4bf",
  emailFrom: "",
  customDomain: "",
  logoUrl: "",
};

const statusConfig: Record<string, { icon: JSX.Element; color: string; label: string }> = {
  active: { icon: <CheckCircle2 className="w-4 h-4" />, color: "bg-success/10 text-success border-success/30", label: "Healthy" },
  inactive: { icon: <XCircle className="w-4 h-4" />, color: "bg-muted text-muted-foreground border-border", label: "Disabled" },
  error: { icon: <AlertCircle className="w-4 h-4" />, color: "bg-destructive/10 text-destructive border-destructive/30", label: "Connection Error" },
};

const availableEvents = ["alert.critical", "alert.high", "incident.escalated", "shift.complete", "report.generated"];

const Settings = () => {
  const { activeTenant, activeTenantId, reload: reloadTenants } = useTenants();
  const [branding, setBranding] = useState<Branding>(emptyBranding);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingBranding, setSavingBranding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newWhName, setNewWhName] = useState("");
  const [newWhUrl, setNewWhUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [integrations, setIntegrations] = useState<{ name: string; status: string; color: string }[]>([]);

  const load = useCallback(async () => {
    if (!activeTenantId) { setWebhooks([]); setLoading(false); return; }
    setLoading(true);
    const [whRes, cameraRes, notifRes] = await Promise.all([
      supabase.from("tenant_webhooks").select("*").eq("tenant_id", activeTenantId).order("created_at"),
      supabase.from("cameras").select("id,status").eq("tenant_id", activeTenantId),
      supabase.from("notification_log").select("channel,status").eq("tenant_id", activeTenantId).limit(200),
    ]);

    if (whRes.error) { console.error(whRes.error); toast.error("Could not load webhooks"); }
    setWebhooks((whRes.data ?? []) as WebhookRow[]);

    const cams = cameraRes.data ?? [];
    const notifs = notifRes.data ?? [];
    const emailOk = notifs.some((n) => n.channel === "email" && n.status === "sent");
    const smsOk = notifs.some((n) => n.channel === "sms" && n.status === "sent");
    const online = cams.filter((c) => c.status === "online").length;

    setIntegrations([
      { name: "Email delivery", status: emailOk ? "Connected" : "Not configured", color: emailOk ? "text-success" : "text-warning" },
      { name: "SMS delivery", status: smsOk ? "Connected" : "Not configured", color: smsOk ? "text-success" : "text-warning" },
      { name: "Camera gateway", status: cams.length ? `${online}/${cams.length} online` : "No cameras", color: cams.length && online === cams.length ? "text-success" : cams.length ? "text-warning" : "text-muted-foreground" },
      { name: "Outbound webhooks", status: `${(whRes.data ?? []).filter((w: WebhookRow) => w.status === "active").length} active`, color: "text-success" },
    ]);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeTenant) { setBranding(emptyBranding); return; }
    const b = (activeTenant.branding ?? {}) as Partial<Branding>;
    setBranding({
      companyName: b.companyName ?? activeTenant.name,
      primaryColor: b.primaryColor ?? "#2dd4bf",
      emailFrom: b.emailFrom ?? activeTenant.contact_email ?? "",
      customDomain: b.customDomain ?? "",
      logoUrl: b.logoUrl ?? "",
    });
  }, [activeTenant]);

  const toggleWebhook = async (wh: WebhookRow, checked: boolean) => {
    const status = checked ? "active" : "inactive";
    setWebhooks((prev) => prev.map((w) => (w.id === wh.id ? { ...w, status } : w)));
    const { error } = await supabase.from("tenant_webhooks").update({ status }).eq("id", wh.id);
    if (error) { toast.error(error.message); load(); }
    else toast.success(`${wh.name} ${checked ? "activated" : "deactivated"}`);
  };

  const handleAddWebhook = async () => {
    if (!activeTenantId) { toast.error("Select a tenant first"); return; }
    if (!newWhName || !newWhUrl) { toast.error("Please provide both a name and a valid destination URL"); return; }
    if (selectedEvents.length === 0) { toast.error("Please select at least one event to subscribe to"); return; }

    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from("tenant_webhooks").insert({
      tenant_id: activeTenantId,
      name: newWhName,
      url: newWhUrl,
      events: selectedEvents,
      status: "active",
      created_by: userRes.user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }

    setAddOpen(false);
    setNewWhName("");
    setNewWhUrl("");
    setSelectedEvents([]);
    toast.success(`Webhook "${newWhName}" added`);
    load();
  };

  const deleteWebhook = async (wh: WebhookRow) => {
    const { error } = await supabase.from("tenant_webhooks").delete().eq("id", wh.id);
    if (error) toast.error(error.message);
    else { toast.success(`${wh.name} removed`); load(); }
  };

  const handleSaveBranding = async () => {
    if (!activeTenantId) { toast.error("Select a tenant first"); return; }
    setSavingBranding(true);
    const { error } = await supabase
      .from("tenants")
      .update({ branding: JSON.parse(JSON.stringify(branding)) })
      .eq("id", activeTenantId);
    setSavingBranding(false);
    if (error) toast.error(error.message);
    else { toast.success("Branding saved"); reloadTenants(); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        icon={Settings2}
        title="Platform Administration"
        description={activeTenant ? `Integrations and branding for ${activeTenant.name}` : "Select a tenant to configure integrations and branding."}
      />

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
                    <Button variant="outline" size="sm" disabled={!activeTenantId} className="gap-2 border-primary/20 text-primary hover:text-primary hover:bg-primary/5">
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
                        <Input placeholder="e.g., Engineering Slack" value={newWhName} onChange={(e) => setNewWhName(e.target.value)} className="bg-background border-border" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Payload URL</Label>
                        <Input placeholder="https://hooks.yourtool.com/..." value={newWhUrl} onChange={(e) => setNewWhUrl(e.target.value)} className="bg-background border-border" />
                      </div>
                      <div className="space-y-3 pt-2">
                        <Label className="text-xs text-muted-foreground">Subscription Events</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {availableEvents.map((event) => (
                            <div key={event} className="flex items-center space-x-2">
                              <Checkbox
                                id={event}
                                checked={selectedEvents.includes(event)}
                                onCheckedChange={(checked) => {
                                  if (checked) setSelectedEvents([...selectedEvents, event]);
                                  else setSelectedEvents(selectedEvents.filter((e) => e !== event));
                                }}
                              />
                              <label htmlFor={event} className="text-[10px] sm:text-xs font-medium text-foreground cursor-pointer">{event}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                      <Button onClick={handleAddWebhook} className="bg-primary hover:bg-primary/90 text-primary-foreground">Add Webhook</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading destinations…
                </div>
              ) : webhooks.length === 0 ? (
                <Card className="border-border border-dashed">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    {activeTenantId ? "No webhook destinations configured yet." : "Select a tenant to manage webhooks."}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((wh) => {
                    const status = statusConfig[wh.status] ?? statusConfig.inactive;
                    return (
                      <Card key={wh.id} className={cn("border-border overflow-hidden transition-all", wh.status === "inactive" && "opacity-75")}>
                        <CardContent className="p-0">
                          <div className="p-4 sm:p-5">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="space-y-1 min-w-0">
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
                                  <p className={cn("text-sm font-bold", Number(wh.success_rate) > 95 ? "text-success" : Number(wh.success_rate) > 80 ? "text-warning" : "text-destructive")}>
                                    {Number(wh.success_rate)}%
                                  </p>
                                </div>
                                <div className="h-8 w-px bg-border hidden sm:block mx-1" />
                                <Switch checked={wh.status === "active"} onCheckedChange={(checked) => toggleWebhook(wh, checked)} />
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteWebhook(wh)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap items-center gap-y-3 gap-x-6">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Events:</span>
                                <div className="flex gap-1 flex-wrap">
                                  {wh.events.map((e) => (
                                    <Badge key={e} variant="secondary" className="text-[9px] h-4 leading-none font-mono bg-accent/50 text-accent-foreground border-none">{e}</Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  Last: {wh.last_triggered_at ? new Date(wh.last_triggered_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "never"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <Card className="border-border bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" /> Webhook Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Outbound requests are signed with an HMAC signature in the <code className="text-primary">X-FactoryIQ-Signature</code> header.
                    The signing secret is held in the backend and is never exposed in the browser.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold">Integration Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {integrations.map((s) => (
                    <div key={s.name} className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">{s.name}</span>
                      <span className={cn("font-medium", s.color)}>{s.status}</span>
                    </div>
                  ))}
                  {integrations.length === 0 && <p className="text-xs text-muted-foreground">No tenant selected.</p>}
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
                <CardDescription className="text-xs">Saved against {activeTenant?.name ?? "the selected tenant"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-1 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">Company Display Name</Label>
                    <Input value={branding.companyName} onChange={(e) => setBranding({ ...branding, companyName: e.target.value })} className="bg-background border-border" />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5">Primary Brand Color</Label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border border-border shrink-0 shadow-sm" style={{ backgroundColor: branding.primaryColor }} />
                      <Input value={branding.primaryColor} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} className="bg-background border-border font-mono text-xs" />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><Mail className="w-3 h-3" /> Email From Address</Label>
                    <Input value={branding.emailFrom} onChange={(e) => setBranding({ ...branding, emailFrom: e.target.value })} className="bg-background border-border" />
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><Globe className="w-3 h-3" /> Custom Management Domain</Label>
                    <div className="flex">
                      <div className="px-3 flex items-center justify-center bg-muted border border-r-0 border-border rounded-l-lg text-[10px] text-muted-foreground font-medium">https://</div>
                      <Input value={branding.customDomain} onChange={(e) => setBranding({ ...branding, customDomain: e.target.value })} className="bg-background border-border rounded-l-none" />
                    </div>
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground mb-1.5">Public Logo URL</Label>
                    <Input value={branding.logoUrl} onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })} className="bg-background border-border font-mono text-xs" />
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border flex justify-end gap-3">
                  <Button variant="ghost" className="text-muted-foreground text-xs" onClick={() => setBranding({ ...emptyBranding, companyName: activeTenant?.name ?? "" })}>
                    Reset to Defaults
                  </Button>
                  <Button onClick={handleSaveBranding} disabled={savingBranding || !activeTenantId} className="bg-primary hover:bg-primary/90 gap-2 text-xs">
                    <CheckCircle2 className="w-4 h-4" /> {savingBranding ? "Saving…" : "Save Configuration"}
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
                      <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: branding.primaryColor }} />
                      <span className="font-bold text-foreground">{branding.companyName || "Your company"}</span>
                    </div>
                    <div className="space-y-3">
                      <div className="h-8 w-full bg-muted/50 rounded" />
                      <div className="h-8 w-2/3 bg-muted/50 rounded" />
                    </div>
                    <Button className="w-full h-10 border-none pointer-events-none" style={{ backgroundColor: branding.primaryColor }}>
                      Sign In to Your Factory
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground">
                      © {new Date().getFullYear()} {branding.companyName || "Your company"} Portal · All Rights Reserved
                    </p>
                  </div>
                  <p className="mt-6 text-[10px] text-muted-foreground italic text-center max-w-xs">
                    Preview of how the saved brand colour and name appear on the tenant login page.
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
