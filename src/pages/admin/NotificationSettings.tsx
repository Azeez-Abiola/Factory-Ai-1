import { useEffect, useState } from "react";
import { Bell, Mail, MessageSquare, Save, Loader2, Plus, X, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { auditLog } from "@/lib/audit";

interface Prefs {
  tenant_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  email_recipients: string[];
  sms_recipients: string[];
  min_severity: "low" | "medium" | "high" | "critical";
  notify_on_escalation: boolean;
}

const DEFAULTS = (tenantId: string): Prefs => ({
  tenant_id: tenantId,
  email_enabled: true,
  sms_enabled: false,
  email_recipients: [],
  sms_recipients: [],
  min_severity: "medium",
  notify_on_escalation: true,
});

const emailValid = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const phoneValid = (s: string) => /^\+?[0-9\s\-()]{7,20}$/.test(s.trim());

const NotificationSettings = () => {
  const { activeTenantId, activeTenant } = useTenants();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    if (!activeTenantId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tenant_notification_prefs")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .maybeSingle();
      if (error) toast.error(error.message);
      setPrefs((data as any) ?? DEFAULTS(activeTenantId));
      setLoading(false);
    })();
  }, [activeTenantId]);

  const save = async () => {
    if (!prefs || !activeTenantId) return;
    setSaving(true);
    const { error } = await supabase
      .from("tenant_notification_prefs")
      .upsert(prefs, { onConflict: "tenant_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Notification preferences saved");
    auditLog({
      action: "notification_prefs.updated",
      entity_type: "tenant",
      entity_id: activeTenantId,
      metadata: {
        email_enabled: prefs.email_enabled,
        sms_enabled: prefs.sms_enabled,
        recipients: prefs.email_recipients.length + prefs.sms_recipients.length,
      },
    });
  };

  const addEmail = () => {
    if (!prefs) return;
    const v = newEmail.trim();
    if (!emailValid(v)) return toast.error("Enter a valid email address");
    if (prefs.email_recipients.includes(v)) return toast.error("Already on the list");
    setPrefs({ ...prefs, email_recipients: [...prefs.email_recipients, v] });
    setNewEmail("");
  };

  const addPhone = () => {
    if (!prefs) return;
    const v = newPhone.trim();
    if (!phoneValid(v)) return toast.error("Enter a valid phone number (E.164 preferred, e.g. +15555550100)");
    if (prefs.sms_recipients.includes(v)) return toast.error("Already on the list");
    setPrefs({ ...prefs, sms_recipients: [...prefs.sms_recipients, v] });
    setNewPhone("");
  };

  const removeEmail = (v: string) =>
    prefs && setPrefs({ ...prefs, email_recipients: prefs.email_recipients.filter((x) => x !== v) });
  const removePhone = (v: string) =>
    prefs && setPrefs({ ...prefs, sms_recipients: prefs.sms_recipients.filter((x) => x !== v) });

  if (!activeTenantId) {
    return <div className="p-8 text-center text-muted-foreground">Select a tenant to configure notifications.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Alerts"
        icon={Bell}
        title="Notification Preferences"
        description={`Route incidents and escalations for ${activeTenant?.name ?? "this tenant"} to email and SMS recipients.`}
        actions={
          <Button onClick={save} disabled={saving || loading} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save preferences
          </Button>
        }
      />

      {loading || !prefs ? (
        <div className="p-12 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading preferences…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Global rules */}
          <div className="glass rounded-xl border border-border p-5 space-y-4 lg:col-span-2">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-primary mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Notifications are sent whenever a new alert or incident meets the minimum severity below.
                Escalations follow your Escalation Policies and can be muted separately.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Minimum severity to notify</Label>
                <Select
                  value={prefs.min_severity}
                  onValueChange={(v: any) => setPrefs({ ...prefs, min_severity: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low and above</SelectItem>
                    <SelectItem value="medium">Medium and above</SelectItem>
                    <SelectItem value="high">High and above</SelectItem>
                    <SelectItem value="critical">Critical only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="text-sm font-medium">Notify on escalation</p>
                  <p className="text-xs text-muted-foreground">Send when an unresolved incident is reassigned to the next supervisor.</p>
                </div>
                <Switch
                  checked={prefs.notify_on_escalation}
                  onCheckedChange={(v) => setPrefs({ ...prefs, notify_on_escalation: v })}
                />
              </div>
            </div>
          </div>

          {/* Email panel */}
          <div className="glass rounded-xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Email recipients</h3>
              </div>
              <Switch
                checked={prefs.email_enabled}
                onCheckedChange={(v) => setPrefs({ ...prefs, email_enabled: v })}
              />
            </div>
            <div className="flex gap-2">
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
                placeholder="ops@example.com"
                type="email"
                disabled={!prefs.email_enabled}
              />
              <Button variant="outline" onClick={addEmail} disabled={!prefs.email_enabled} className="gap-1">
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[2rem]">
              {prefs.email_recipients.length === 0 && (
                <p className="text-xs text-muted-foreground">No email recipients yet.</p>
              )}
              {prefs.email_recipients.map((e) => (
                <Badge key={e} variant="outline" className="gap-1 pl-2 pr-1 py-1">
                  {e}
                  <button
                    type="button"
                    onClick={() => removeEmail(e)}
                    className="hover:text-destructive rounded p-0.5"
                    aria-label={`Remove ${e}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* SMS panel */}
          <div className="glass rounded-xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">SMS recipients</h3>
              </div>
              <Switch
                checked={prefs.sms_enabled}
                onCheckedChange={(v) => setPrefs({ ...prefs, sms_enabled: v })}
              />
            </div>
            <div className="flex gap-2">
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPhone())}
                placeholder="+15555550100"
                disabled={!prefs.sms_enabled}
              />
              <Button variant="outline" onClick={addPhone} disabled={!prefs.sms_enabled} className="gap-1">
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[2rem]">
              {prefs.sms_recipients.length === 0 && (
                <p className="text-xs text-muted-foreground">No SMS recipients yet.</p>
              )}
              {prefs.sms_recipients.map((p) => (
                <Badge key={p} variant="outline" className="gap-1 pl-2 pr-1 py-1 font-mono">
                  {p}
                  <button
                    type="button"
                    onClick={() => removePhone(p)}
                    className="hover:text-destructive rounded p-0.5"
                    aria-label={`Remove ${p}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              SMS is delivered via the platform's configured provider. Use E.164 format (starting with +country code) for reliable delivery.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;
