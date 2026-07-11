import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { auditLog } from "@/lib/audit";
import PageHeader from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Timer, Plus, Trash2, ArrowUp, ArrowDown, Users2 } from "lucide-react";
import { toast } from "sonner";

interface Policy {
  id: string;
  tenant_id: string;
  name: string;
  timeout_minutes: number;
  supervisor_ids: string[];
  is_active: boolean;
}

interface Member {
  user_id: string;
  role: string;
  display_name: string | null;
}

export default function EscalationPolicies() {
  const { activeTenant, activeTenantId } = useTenants();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!activeTenantId) return setLoading(false);
    setLoading(true);
    const [{ data: pol }, { data: mem }] = await Promise.all([
      supabase.from("escalation_policies").select("*").eq("tenant_id", activeTenantId).order("created_at"),
      supabase.from("tenant_members").select("user_id, role, profiles(display_name)").eq("tenant_id", activeTenantId),
    ]);
    setPolicies((pol ?? []) as Policy[]);
    setMembers(((mem ?? []) as any[]).map((m) => ({
      user_id: m.user_id, role: m.role,
      display_name: m.profiles?.display_name ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeTenantId]);

  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.display_name || id.slice(0, 8);

  const create = async () => {
    if (!activeTenantId) return;
    const { data, error } = await supabase.from("escalation_policies").insert({
      tenant_id: activeTenantId, name: "New Policy", timeout_minutes: 30, supervisor_ids: [],
    }).select().single();
    if (error) return toast.error(error.message);
    setPolicies((p) => [...p, data as Policy]);
    await auditLog({ tenantId: activeTenantId, action: "escalation_policy.create", entityType: "escalation_policy", entityId: data!.id });
  };

  const update = async (id: string, patch: Partial<Policy>) => {
    const { error } = await supabase.from("escalation_policies").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setPolicies((p) => p.map((x) => x.id === id ? { ...x, ...patch } : x));
    await auditLog({ tenantId: activeTenantId!, action: "escalation_policy.update", entityType: "escalation_policy", entityId: id, metadata: patch as Record<string, unknown> });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this policy?")) return;
    const { error } = await supabase.from("escalation_policies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setPolicies((p) => p.filter((x) => x.id !== id));
    await auditLog({ tenantId: activeTenantId!, action: "escalation_policy.delete", entityType: "escalation_policy", entityId: id });
  };

  const move = (p: Policy, idx: number, dir: -1 | 1) => {
    const next = [...p.supervisor_ids];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    update(p.id, { supervisor_ids: next });
  };

  const addSupervisor = (p: Policy, uid: string) => {
    if (p.supervisor_ids.includes(uid)) return;
    update(p.id, { supervisor_ids: [...p.supervisor_ids, uid] });
  };
  const removeSupervisor = (p: Policy, uid: string) => {
    update(p.id, { supervisor_ids: p.supervisor_ids.filter((x) => x !== uid) });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        icon={Timer}
        title="Escalation Policies"
        description={activeTenant ? `Auto-reassign unresolved incidents · ${activeTenant.name}` : "Select a tenant"}
        action={<Button onClick={create}><Plus className="w-4 h-4 mr-1" /> New Policy</Button>}
      />

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && policies.length === 0 && (
        <div className="glass rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          No escalation policies yet. Create one to auto-rotate unresolved incidents to the next supervisor on a timer.
        </div>
      )}

      <div className="space-y-4">
        {policies.map((p) => (
          <div key={p.id} className="glass rounded-xl border border-border p-5 space-y-4">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[240px] space-y-2">
                <Label className="text-xs">Policy name</Label>
                <Input value={p.name} onChange={(e) => setPolicies((ps) => ps.map((x) => x.id === p.id ? { ...x, name: e.target.value } : x))}
                  onBlur={(e) => update(p.id, { name: e.target.value })} className="bg-background border-border" />
              </div>
              <div className="space-y-2 w-40">
                <Label className="text-xs">Timeout (minutes)</Label>
                <Input type="number" min={1} value={p.timeout_minutes}
                  onChange={(e) => setPolicies((ps) => ps.map((x) => x.id === p.id ? { ...x, timeout_minutes: parseInt(e.target.value || "0") } : x))}
                  onBlur={(e) => update(p.id, { timeout_minutes: Math.max(1, parseInt(e.target.value || "1")) })}
                  className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Active</Label>
                <div className="h-10 flex items-center">
                  <Switch checked={p.is_active} onCheckedChange={(v) => update(p.id, { is_active: v })} />
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => remove(p.id)} className="text-destructive mt-6">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div>
              <Label className="text-xs flex items-center gap-1.5 mb-2"><Users2 className="w-3.5 h-3.5" /> Supervisor rotation ({p.supervisor_ids.length})</Label>
              {p.supervisor_ids.length === 0 && (
                <p className="text-xs text-muted-foreground italic mb-2">Add supervisors — order determines rotation.</p>
              )}
              <ol className="space-y-1.5 mb-2">
                {p.supervisor_ids.map((uid, i) => (
                  <li key={uid} className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5">
                    <Badge variant="outline" className="text-[10px]">L{i + 1}</Badge>
                    <span className="text-sm flex-1 truncate">{nameOf(uid)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(p, i, -1)} disabled={i === 0}><ArrowUp className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(p, i, 1)} disabled={i === p.supervisor_ids.length - 1}><ArrowDown className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSupervisor(p, uid)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-1.5">
                {members.filter((m) => !p.supervisor_ids.includes(m.user_id) && ["owner","admin","supervisor"].includes(m.role)).map((m) => (
                  <Button key={m.user_id} variant="outline" size="sm" onClick={() => addSupervisor(p, m.user_id)} className="text-xs h-7">
                    <Plus className="w-3 h-3 mr-1" /> {m.display_name || m.user_id.slice(0, 8)} <span className="ml-1 text-muted-foreground">· {m.role}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
