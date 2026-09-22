import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Search, UserCheck, XCircle, Building2, Plus, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/app/PageHeader";
import { auditLog } from "@/lib/audit";
import type { TenantRole } from "@/lib/permissions";

type ApprovalStatus = "pending" | "approved" | "rejected";

interface PlatformUserRow {
  user_id: string;
  email: string;
  display_name: string | null;
  approval_status: ApprovalStatus;
  created_at: string;
  last_sign_in_at: string | null;
}

interface TenantOption {
  id: string;
  name: string;
}

interface MembershipRow {
  id: string;
  user_id: string;
  tenant_id: string;
  role: TenantRole;
  tenant_name: string;
}

const STATUS_META: Record<ApprovalStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20" },
  approved: { label: "Approved", color: "bg-success/10 text-[hsl(var(--success))] border-success/20" },
  rejected: { label: "Declined", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const ROLE_OPTIONS: TenantRole[] = ["owner", "admin", "manager", "operator", "viewer"];

const PlatformUsers = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<PlatformUserRow[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [assignFor, setAssignFor] = useState<PlatformUserRow | null>(null);
  const [assignTenantId, setAssignTenantId] = useState<string>("");
  const [assignRole, setAssignRole] = useState<TenantRole>("viewer");
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: userRows, error: userErr }, { data: tenantRows }, { data: memberRows }] = await Promise.all([
      supabase.rpc("platform_users"),
      supabase.from("tenants").select("id,name").order("name"),
      supabase.from("tenant_members").select("id,user_id,tenant_id,role,tenants(name)"),
    ]);
    if (userErr) toast.error(userErr.message);
    setUsers((userRows ?? []) as PlatformUserRow[]);
    setTenants((tenantRows ?? []) as TenantOption[]);
    setMemberships(
      ((memberRows ?? []) as any[]).map((m) => ({
        id: m.id, user_id: m.user_id, tenant_id: m.tenant_id, role: m.role,
        tenant_name: m.tenants?.name ?? "Unknown tenant",
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("platform-users")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tenant_members" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const membershipsByUser = useMemo(() => {
    const map: Record<string, MembershipRow[]> = {};
    for (const m of memberships) (map[m.user_id] ??= []).push(m);
    return map;
  }, [memberships]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch = !q || u.email.toLowerCase().includes(q) || (u.display_name ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || u.approval_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [users, search, statusFilter]);

  const reviewSignup = async (row: PlatformUserRow, approve: boolean) => {
    setBusyId(row.user_id);
    const { error } = await supabase
      .from("profiles")
      .update({ approval_status: approve ? "approved" : "rejected", approved_by: currentUser?.id, approved_at: new Date().toISOString() })
      .eq("id", row.user_id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    await auditLog({ action: approve ? "signup.approved" : "signup.rejected", entityType: "profile", entityId: row.user_id, metadata: { email: row.email } });
    toast.success(approve ? `${row.email} approved` : `${row.email} declined`);
    setUsers((current) => current.map((u) => u.user_id === row.user_id ? { ...u, approval_status: approve ? "approved" : "rejected" } : u));
  };

  const openAssign = (row: PlatformUserRow) => {
    setAssignFor(row);
    setAssignTenantId(tenants[0]?.id ?? "");
    setAssignRole("viewer");
  };

  const submitAssign = async () => {
    if (!assignFor || !assignTenantId) return;
    setAssigning(true);
    const { error } = await supabase
      .from("tenant_members")
      .upsert({ tenant_id: assignTenantId, user_id: assignFor.user_id, role: assignRole }, { onConflict: "tenant_id,user_id" });
    setAssigning(false);
    if (error) { toast.error(error.message); return; }
    const tenantName = tenants.find((t) => t.id === assignTenantId)?.name ?? "tenant";
    await auditLog({ tenantId: assignTenantId, action: "member.added", entityType: "tenant_member", entityId: assignFor.user_id, metadata: { email: assignFor.email, role: assignRole } });
    toast.success(`${assignFor.email} added to ${tenantName} as ${assignRole}`);
    setAssignFor(null);
    load();
  };

  const removeMembership = async (m: MembershipRow) => {
    if (!confirm(`Remove ${m.tenant_name} access for this user?`)) return;
    const { error } = await supabase.from("tenant_members").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    await auditLog({ tenantId: m.tenant_id, action: "member.removed", entityType: "tenant_member", entityId: m.user_id });
    toast.success("Access removed");
    setMemberships((current) => current.filter((row) => row.id !== m.id));
  };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Platform"
        icon={Users}
        title="All users"
        description="Every account that has signed up, across every tenant. Approve new sign-ups and assign people to a workspace."
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tenants</TableHead>
              <TableHead>Signed up</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Loading users…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">No users match your filters.</TableCell></TableRow>
            ) : (
              filtered.map((u) => {
                const meta = STATUS_META[u.approval_status];
                const userMemberships = membershipsByUser[u.user_id] ?? [];
                return (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarFallback className="text-xs font-semibold text-primary bg-primary/10">{(u.display_name ?? u.email).slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{u.display_name ?? "Unnamed user"}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {userMemberships.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No tenant access</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {userMemberships.map((m) => (
                            <Badge key={m.id} variant="outline" className="gap-1 pr-1 bg-muted text-foreground border-border">
                              <Building2 className="w-3 h-3" />
                              {m.tenant_name} · {m.role}
                              <button
                                type="button"
                                onClick={() => removeMembership(m)}
                                className="ml-1 rounded-full hover:bg-destructive/10 hover:text-destructive p-0.5"
                                aria-label={`Remove ${m.tenant_name} access`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(u.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        {u.approval_status === "pending" && (
                          <>
                            <Button
                              variant="ghost" size="sm"
                              className="text-[hsl(var(--success))] hover:text-[hsl(var(--success))]"
                              disabled={busyId === u.user_id}
                              onClick={() => reviewSignup(u, true)}
                            >
                              <UserCheck className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={busyId === u.user_id}
                              onClick={() => reviewSignup(u, false)}
                            >
                              <XCircle className="w-4 h-4 mr-1" /> Decline
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openAssign(u)}>
                          <Plus className="w-4 h-4 mr-1" /> Add to tenant
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

      <Dialog open={Boolean(assignFor)} onOpenChange={(open) => { if (!open) setAssignFor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to tenant</DialogTitle>
            <DialogDescription>
              Give <span className="font-medium">{assignFor?.email}</span> access to a workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select value={assignTenantId} onValueChange={setAssignTenantId}>
                <SelectTrigger><SelectValue placeholder="Select a tenant" /></SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={assignRole} onValueChange={(v) => setAssignRole(v as TenantRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignFor(null)}>Cancel</Button>
            <Button onClick={submitAssign} disabled={assigning || !assignTenantId}>
              {assigning ? "Adding…" : "Add to tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlatformUsers;
