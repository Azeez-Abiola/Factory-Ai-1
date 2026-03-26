import { Users, Search, Plus, Mail, Shield, Eye, Wrench } from "lucide-react";
import { useState } from "react";
import { mockAdminUsers, type AdminUser, type UserRole } from "@/data/adminMockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const roleConfig: Record<UserRole, { label: string; icon: React.ElementType; color: string }> = {
  super_admin: { label: "Super Admin", icon: Shield, color: "bg-destructive/10 text-destructive border-destructive/20" },
  tenant_admin: { label: "Tenant Admin", icon: Users, color: "bg-primary/10 text-primary border-primary/20" },
  operator: { label: "Operator", icon: Wrench, color: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20" },
  viewer: { label: "Viewer", icon: Eye, color: "bg-muted text-muted-foreground border-border" },
};

const statusColors = {
  active: "bg-success/10 text-[hsl(var(--success))] border-success/20",
  inactive: "bg-muted text-muted-foreground border-border",
  invited: "bg-primary/10 text-primary border-primary/20",
};

const UserManagement = () => {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const filtered = mockAdminUsers.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage platform and tenant-level access</p>
        </div>
        <Button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
          <Plus className="w-4 h-4 mr-2" /> Invite User
        </Button>
      </div>

      {/* Role Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(["super_admin", "tenant_admin", "operator", "viewer"] as UserRole[]).map((role) => {
          const config = roleConfig[role];
          const count = mockAdminUsers.filter((u) => u.role === role).length;
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

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-background border-border"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-48 bg-background border-border">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
            <SelectItem value="operator">Operator</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="glass rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => {
              const config = roleConfig[user.role];
              return (
                <TableRow key={user.id} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                        {user.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs", config.color)}>
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.tenantName || <span className="text-xs italic">Platform</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs capitalize", statusColors[user.status])}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLogin
                      ? new Date(user.lastLogin).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Resend invite">
                        <Mail className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UserManagement;
