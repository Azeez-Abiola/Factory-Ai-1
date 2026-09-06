import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Search, Plus, Mail, Shield, Eye, Wrench, Copy, RefreshCw, Trash2, Clock, CheckCircle2, MoreHorizontal, BriefcaseBusiness, Phone, CalendarDays, Fingerprint, UserRound, ChevronRight } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  job_title: string | null;
  phone: string | null;
  updated_at: string | null;
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
  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null);
  const [detailRole, setDetailRole] = useState<MemberRole>("viewer");
  const [savingRole, setSavingRole] = useState(false);

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
    let profiles: Record<string, { display_name: string | null; avatar_url: string | null; job_title: string | null; phone: string | null; updated_at: string | null }> = {};
    if (userIds.length) {
      const { data: pRows } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url,job_title,phone,updated_at")
        .in("id", userIds);
      profiles = Object.fromEntries((pRows ?? []).map((p) => [p.id, p]));
    }

    setMembers(
      (mRows ?? []).map((r) => ({
        ...r,
        role: r.role as MemberRole,
        display_name: profiles[r.user_id]?.display_name ?? null,
        avatar_url: profiles[r.user_id]?.avatar_url ?? null,
        job_title: profiles[r.user_id]?.job_title ?? null,
        phone: profiles[r.user_id]?.phone ?? null,
        updated_at: profiles[r.user_id]?.updated_at ?? null,
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

  const openMember = (member: MemberRow) => {
    setSelectedMember(member);
    setDetailRole(member.role);
  };

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
      .select("id, token")
      .single();
    if (error) {
      setSubmitting(false);
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

    const { data: sent, error: sendErr } = await supabase.functions.invoke("send-invite", {
      body: { invitation_id: data.id, app_url: window.location.origin },
    });
    setSubmitting(false);
    if (sendErr || !(sent as any)?.ok) {
      toast.warning(
        (sent as any)?.message ?? "Invite created, but the email could not be sent. The link is on your clipboard.",
      );
    } else {
      toast.success(`Invitation emailed to ${inviteEmail.trim()} — link also copied to clipboard`);
    }
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

  const saveMemberRole = async () => {
    if (!selectedMember || detailRole === selectedMember.role) return;
    setSavingRole(true);
    const { error } = await supabase.from("tenant_members").update({ role: detailRole }).eq("id", selectedMember.id);
    if (error) {
      toast.error(error.message);
      setSavingRole(false);
      return;
    }
    await auditLog({ tenantId: activeTenantId, action: "member.role_changed", entityType: "tenant_member", entityId: selectedMember.id, metadata: { previous_role: selectedMember.role, role: detailRole } });
    setMembers((current) => current.map((member) => member.id === selectedMember.id ? { ...member, role: detailRole } : member));
    setSelectedMember((current) => current ? { ...current, role: detailRole } : null);
    setSavingRole(false);
    toast.success("Member access updated");
  };

  const removeMember = async (memberId: string, userId: string) => {
    if (!confirm("Remove this member from the tenant?")) return;
    const { error } = await supabase.from("tenant_members").delete().eq("id", memberId);
    if (error) return toast.error(error.message);
    await auditLog({ tenantId: activeTenantId, action: "member.removed", entityType: "tenant_member", entityId: userId });
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
    // Extend expiry by 14 days, then email the invitation again.
    const newExpiry = new Date(Date.now() + 14 * 86400_000).toISOString();
    const { error } = await supabase
      .from("tenant_invitations")
      .update({ expires_at: newExpiry, status: "pending" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    const { data: sent, error: sendErr } = await supabase.functions.invoke("send-invite", {
      body: { invitation_id: id, app_url: window.location.origin },
    });
    if (sendErr || !(sent as any)?.ok) {
      toast.warning((sent as any)?.message ?? "Expiry extended, but the email could not be sent.");
    } else {
      toast.success("Invitation re-sent and expiry extended by 14 days");
    }
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
    <div className="space-y-7">
      <PageHeader
        eyebrow={activeTenant.name}
        icon={Users}
        title="People & access"
        description="Review team membership, responsibilities, and access across this organization."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
              <Plus className="w-4 h-4" /> Invite member
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 border border-border rounded-lg overflow-hidden bg-card">
        {(["owner", "admin", "operator", "viewer"] as MemberRole[]).map((role) => {
          const config = ROLE_META[role];
          const count = members.filter((m) => m.role === role).length;
          return (
            <div key={role} className="p-4 md:p-5 border-b border-r border-border last:border-r-0 lg:border-b-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground">{config.label}s</p>
                <config.icon className="w-4 h-4 text-primary" />
              </div>
              <p className="font-display text-2xl font-semibold text-foreground">{count}</p>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList className="h-11 bg-muted/60 p-1">
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="pending">
            Pending Invites {pendingInvites.length > 0 && <Badge className="ml-2" variant="secondary">{pendingInvites.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search members…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
             <Select value={roleFilter} onValueChange={setRoleFilter}>
               <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {(Object.keys(ROLE_META) as MemberRole[]).map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border overflow-x-auto bg-card">
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
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-12">Loading members…</TableCell></TableRow>
                ) : filteredMembers.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-12">No members match your filters.</TableCell></TableRow>
                ) : (
                  filteredMembers.map((m) => {
                    const meta = ROLE_META[m.role];
                    return (
                      <TableRow
                        key={m.id}
                        className="group cursor-pointer"
                        tabIndex={0}
                        onClick={() => openMember(m)}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openMember(m); }}
                        aria-label={`View ${m.display_name ?? "member"}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-border">
                              <AvatarImage src={m.avatar_url ?? undefined} alt="" />
                              <AvatarFallback className="text-xs font-semibold text-primary bg-primary/10">{(m.display_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{m.display_name ?? "Unnamed user"}</p>
                              <p className="text-xs text-muted-foreground truncate">{m.job_title ?? `Member ID ${m.user_id.slice(0, 8)}`}</p>
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
                          <div className="inline-flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${m.display_name ?? "member"}`}>
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => openMember(m)}><Eye className="mr-2 h-4 w-4" /> View details</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled={m.user_id === user?.id} className="text-destructive focus:text-destructive" onClick={() => removeMember(m.id, m.user_id)}><Trash2 className="mr-2 h-4 w-4" /> Remove member</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
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
          <div className="rounded-lg border border-border overflow-x-auto bg-card">
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
          <div className="rounded-lg border border-border overflow-x-auto bg-card">
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

      <Sheet open={Boolean(selectedMember)} onOpenChange={(open) => { if (!open) setSelectedMember(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg p-0">
          {selectedMember && (() => {
            const meta = ROLE_META[selectedMember.role];
            return (
              <div className="flex min-h-full flex-col">
                <SheetHeader className="border-b border-border p-6 pr-12">
                  <div className="flex items-center gap-4 text-left">
                    <Avatar className="h-14 w-14 border border-border">
                      <AvatarImage src={selectedMember.avatar_url ?? undefined} alt="" />
                      <AvatarFallback className="font-display font-semibold text-primary bg-primary/10">{(selectedMember.display_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <SheetTitle className="font-display text-xl">{selectedMember.display_name ?? "Unnamed user"}</SheetTitle>
                      <SheetDescription>{selectedMember.job_title ?? "Team member"}</SheetDescription>
                      <Badge variant="outline" className={cn("mt-2 gap-1", meta.color)}><meta.icon className="h-3 w-3" />{meta.label}</Badge>
                    </div>
                  </div>
                </SheetHeader>

                <div className="flex-1 space-y-7 p-6">
                  <section>
                    <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Member details</h3>
                    <dl className="divide-y divide-border rounded-lg border border-border bg-card">
                      <div className="flex items-center gap-3 p-4"><BriefcaseBusiness className="h-4 w-4 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">Position</dt><dd className="text-sm font-medium">{selectedMember.job_title ?? "Not provided"}</dd></div></div>
                      <div className="flex items-center gap-3 p-4"><Phone className="h-4 w-4 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">Phone</dt><dd className="text-sm font-medium">{selectedMember.phone ?? "Not provided"}</dd></div></div>
                      <div className="flex items-center gap-3 p-4"><CalendarDays className="h-4 w-4 text-muted-foreground" /><div><dt className="text-xs text-muted-foreground">Joined organization</dt><dd className="text-sm font-medium">{new Date(selectedMember.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}</dd></div></div>
                      <div className="flex items-center gap-3 p-4"><Fingerprint className="h-4 w-4 text-muted-foreground" /><div className="min-w-0"><dt className="text-xs text-muted-foreground">Member ID</dt><dd className="truncate font-mono text-xs text-foreground">{selectedMember.user_id}</dd></div></div>
                    </dl>
                  </section>

                  <section className="space-y-3">
                    <div>
                      <Label htmlFor="member-access" className="text-sm font-semibold">Access role</Label>
                      <p className="mt-1 text-xs text-muted-foreground">Choose what this member can view and manage.</p>
                    </div>
                    <Select value={detailRole} onValueChange={(value) => setDetailRole(value as MemberRole)} disabled={selectedMember.user_id === user?.id}>
                      <SelectTrigger id="member-access"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_META) as MemberRole[]).map((role) => <SelectItem key={role} value={role}>{ROLE_META[role].label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {selectedMember.user_id === user?.id && <p className="text-xs text-muted-foreground">You cannot change your own access from this page.</p>}
                  </section>
                </div>

                <SheetFooter className="border-t border-border bg-muted/30 p-6">
                  <Button variant="outline" onClick={() => setSelectedMember(null)}>Close</Button>
                  <Button onClick={saveMemberRole} disabled={savingRole || detailRole === selectedMember.role || selectedMember.user_id === user?.id}>{savingRole ? "Saving…" : "Save access"}</Button>
                </SheetFooter>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

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
              <Label htmlFor="invite-email" className="flex items-center gap-1.5 text-sm font-medium">
                Email address <span aria-hidden className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="invite-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="teammate@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="pl-9"
                  aria-invalid={inviteEmail.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                We'll email the invitation and copy a secure link to your clipboard as a backup.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role" className="text-sm font-medium">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
                <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_META) as MemberRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {inviteRole === "owner" && "Full control including billing and destructive actions."}
                {inviteRole === "admin" && "Manage cameras, policies, and members."}
                {inviteRole === "operator" && "Monitor feeds, triage alerts, and resolve incidents."}
                {inviteRole === "viewer" && "Read-only access to dashboards and reports."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              onClick={handleInvite}
              disabled={submitting || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())}
            >
              {submitting ? "Sending…" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
