import { useState } from "react";
import { Settings2, Webhook, Palette, Plus, CheckCircle, XCircle, AlertCircle, Globe, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockWebhooks, mockWhiteLabel } from "@/data/extendedMockData";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

const statusConfig = {
  active: { icon: <CheckCircle className="w-4 h-4" />, color: "bg-success/10 text-success border-success/30" },
  inactive: { icon: <XCircle className="w-4 h-4" />, color: "bg-muted text-muted-foreground border-border" },
  error: { icon: <AlertCircle className="w-4 h-4" />, color: "bg-destructive/10 text-destructive border-destructive/30" },
};

const Settings = () => {
  const [whiteLabel, setWhiteLabel] = useState(mockWhiteLabel);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-destructive" /> Platform Settings
        </h1>
        <p className="text-sm text-muted-foreground">Webhooks, integrations, and white-label configuration</p>
      </div>

      <Tabs defaultValue="webhooks">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="webhooks" className="gap-2"><Webhook className="w-4 h-4" /> Webhooks</TabsTrigger>
          <TabsTrigger value="whitelabel" className="gap-2"><Palette className="w-4 h-4" /> White Label</TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{mockWebhooks.length} configured webhooks</p>
            <Button variant="outline" size="sm" className="gap-2"><Plus className="w-4 h-4" /> Add Webhook</Button>
          </div>

          <div className="space-y-3">
            {mockWebhooks.map((wh) => {
              const status = statusConfig[wh.status];
              return (
                <div key={wh.id} className="glass rounded-xl p-4 border border-border">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-foreground">{wh.name}</h3>
                        <Badge variant="outline" className={cn("text-xs gap-1", status.color)}>
                          {status.icon} {wh.status}
                        </Badge>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground">{wh.url}</p>
                    </div>
                    <Switch checked={wh.status === "active"} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Events: {wh.events.map((e) => <Badge key={e} variant="outline" className="text-[10px] mx-0.5">{e}</Badge>)}</span>
                    <span>Success: {wh.successRate}%</span>
                    <span>Last: {new Date(wh.lastTriggered).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="whitelabel" className="space-y-4 mt-4">
          <div className="glass rounded-xl p-6 border border-border max-w-xl space-y-5">
            <h3 className="text-sm font-semibold text-foreground">Branding Configuration</h3>
            
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Company Name</Label>
                <Input value={whiteLabel.companyName} onChange={(e) => setWhiteLabel({...whiteLabel, companyName: e.target.value})} className="bg-background border-border mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Primary Brand Color</Label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-10 h-10 rounded-lg border border-border" style={{ backgroundColor: whiteLabel.primaryColor }} />
                  <Input value={whiteLabel.primaryColor} onChange={(e) => setWhiteLabel({...whiteLabel, primaryColor: e.target.value})} className="bg-background border-border flex-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> Custom Domain</Label>
                <Input value={whiteLabel.customDomain} onChange={(e) => setWhiteLabel({...whiteLabel, customDomain: e.target.value})} className="bg-background border-border mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> Email From Address</Label>
                <Input value={whiteLabel.emailFrom} onChange={(e) => setWhiteLabel({...whiteLabel, emailFrom: e.target.value})} className="bg-background border-border mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Logo URL</Label>
                <Input value={whiteLabel.logoUrl} onChange={(e) => setWhiteLabel({...whiteLabel, logoUrl: e.target.value})} className="bg-background border-border mt-1" />
              </div>
            </div>

            <Button className="bg-destructive hover:bg-destructive/90 gap-2">
              <CheckCircle className="w-4 h-4" /> Save Branding
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
