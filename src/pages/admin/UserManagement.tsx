import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Search, Plus, Mail, Shield, Eye, Wrench, Copy, RefreshCw, Trash2, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/app/PageHeader";
import { auditLog } from "@/lib/audit";

type MemberRole = "owner" | "admin" | "operator" | "viewer";

const ROLE_META: Record<MemberRole, { label: string; icon: React.ElementType; color: string }> = {
  owner: { label: "Owner", icon: Shield, color: "bg-destructive/10 text-destructive border-destructive/20" },
  admin: { label: "Admin", icon: Shield, color: "bg-primary/10 text-primary border-primary/20" },
  operator: { label: "Operator", icon: Wrench, color: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20" },
  viewer: { label: "Viewer", icon: Eye, color: "bg-muted text-muted-foreground border-border" },
};

interface MemberRow {
  id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface InvitationRow {
  id: string;
  email: string;
  role: MemberRole;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
}

const UserManagement = () => {
  const { user } = useAuth();
  const { activeTenant, activeTenantId } = useTenants();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("viewer");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!activeTenantId) {
      setMembers([]);
      setInvitations([]);
      return;
    }
    setLoading(true);
    const [{ data: mRows }, { data: iRows }] = await Promise.all([
      supabase
        .from("tenant_members")
        .select("id,user_id,role,created_at")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: true }),
      supabase
        .from("tenant_invitations")
        .select("id,email,role,status,token,expires_at,created_at")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false }),
    ]);

    // Attach profile info
    const userIds = (mRows ?? []).map((r) => r.user_id);
    let profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
    if (userIds.length) {
      const { data: pRows } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url")
        .in("id", userIds);
      profiles = Object.fromEntries((pRows ?? []).map((p) => [p.id, p]));
    }

    setMembers(
      (mRows ?? []).map((r) => ({
        ...r,
        role: r.role as MemberRole,
        display_name: profiles[r.user_id]?.display_name ?? null,
        avatar_url: profiles[r.user_id]?.avatar_url ?? null,
      })),
    );
    setInvitations((iRows ?? []) as InvitationRow[]);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const q = search.toLowerCase();
      const matchSearch = !q || (m.display_name ?? "").toLowerCase().includes(q) || m.user_id.includes(q);
      const matchRole = roleFilter === "all" || m.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [members, search, roleFilter]);

  const pendingInvites = invitations.filter((i) => i.status === "pending");

  const handleInvite = async () => {
    if (!activeTenantId || !inviteEmail.trim()) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("tenant_invitations")
      .insert({
        tenant_id: activeTenantId,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        invited_by: user?.id,
      })
      .select("token")
      .single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "An invite for this email is already pending." : error.message);
      return;
    }
    await auditLog({
      tenantId: activeTenantId,
      action: "member.invited",
      entityType: "tenant_invitation",
      metadata: { email: inviteEmail, role: inviteRole },
    });
    const link = `${window.location.origin}/invite/${data.token}`;
    await navigator.clipboard.writeText(link).catch(() => undefined);
    toast.success("Invitation created — link copied to clipboard");
    setInviteEmail("");
    setInviteRole("viewer");
    setInviteOpen(false);
    load();
  };

  const changeRole = async (memberId: string, role: MemberRole) => {
    const { error } = await supabase.from("tenant_members").update({ role }).eq("id", memberId);
    if (error) return toast.error(error.message);
    await auditLog({ tenantId: activeTenantId, action: "member.role_changed", entityType: "tenant_member", entityId: memberId, metadata: { role } });
    toast.success("Role updated");
    load();
  };

  const removeMember = async (memberId: string, userId: string) => {
    if (!confirm("Remove this member from the tenant?")) return;
    const { error } = await supabase.from("tenant_members").delete().eq("id", memberId);
    if (error) return toast.error(error.message);
    await logAudit({ tenant_id: activeTenantId!, action: "member.removed", entity_type: "tenant_member", entity_id: userId });
    toast.success("Member removed");
    load();
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase.from("tenant_invitations").update({ status: "revoked" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invitation revoked");
    load();
  };

  const resendInvite = async (id: string) => {
    // Extend expiry by 14 days
    const newExpiry = new Date(Date.now() + 14 * 86400_000).toISOString();
    const { error } = await supabase.from("tenant_invitations").update({ expires_at: newExpiry }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Expiration extended by 14 days");
    load();
  };

  if (!activeTenant) {
    return (
      <div className="glass rounded-xl p-8 text-center border border-border">
        <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Select a tenant to manage members.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={activeTenant.name}
        icon={Users}
        title="Members & Invitations"
        description="Invite teammates, assign roles, and control access to this tenant."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Invite Member
          </Button>
        }
      />

      {/* Role Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["owner", "admin", "operator", "viewer"] as MemberRole[]).map((role) => {
          const config = ROLE_META[role];
          const count = members.filter((m) => m.role === role).length;
          return (
            <div key={role} className="glass rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <config.icon className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{config.label}s</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{count}</p>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="pending">
            Pending Invites {pendingInvites.length > 0 && <Badge className="ml-2" variant="secondary">{pendingInvites.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search members…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {(Object.keys(ROLE_META) as MemberRole[]).map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="glass rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : filteredMembers.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No members match your filters.</TableCell></TableRow>
                ) : (
                  filteredMembers.map((m) => {
                    const meta = ROLE_META[m.role];
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {(m.display_name ?? "?").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{m.display_name ?? "Unnamed user"}</p>
                              <p className="text-xs text-muted-foreground font-mono">{m.user_id.slice(0, 8)}…</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("gap-1", meta.color)}>
                            <meta.icon className="w-3 h-3" />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(m.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-2">
                            <Select value={m.role} onValueChange={(v) => changeRole(m.id, v as MemberRole)}>
                              <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(Object.keys(ROLE_META) as MemberRole[]).map((r) => (
                                  <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={m.user_id === user?.id}
                              onClick={() => removeMember(m.id, m.user_id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <div className="glass rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No pending invitations.</TableCell></TableRow>
                ) : (
                  pendingInvites.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{inv.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ROLE_META[inv.role].color}>{ROLE_META[inv.role].label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(inv.expires_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => copyInviteLink(inv.token)}>
                            <Copy className="w-4 h-4 mr-1" /> Copy link
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => resendInvite(inv.id)}>
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => revokeInvite(inv.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="glass rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.filter((i) => i.status !== "pending").length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No historical invitations.</TableCell></TableRow>
                ) : (
                  invitations.filter((i) => i.status !== "pending").map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.email}</TableCell>
                      <TableCell><Badge variant="outline" className={ROLE_META[inv.role].color}>{ROLE_META[inv.role].label}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={inv.status === "accepted" ? "bg-success/10 text-[hsl(var(--success))] border-success/20" : "bg-muted text-muted-foreground"}>
                          {inv.status === "accepted" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Send an invite to join <span className="font-medium">{activeTenant.name}</span>. They'll get a link to accept.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input id="invite-email" type="email" placeholder="teammate@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
                <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_META) as MemberRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={submitting || !inviteEmail.trim()}>
              {submitting ? "Sending…" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
