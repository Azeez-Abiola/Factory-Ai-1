import { Loader2, LockKeyhole } from "lucide-react";
import { useTenantPermissions } from "@/hooks/useTenantPermissions";
import type { PermissionKey } from "@/lib/permissions";

export default function PermissionRoute({ permission, children }: { permission: PermissionKey; children: React.ReactNode }) {
  const { can, loading } = useTenantPermissions();
  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!can(permission)) return <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center"><LockKeyhole className="h-8 w-8 text-muted-foreground" /><h1 className="text-xl font-semibold">Access restricted</h1><p className="max-w-md text-sm text-muted-foreground">Your role does not include this module for the selected site. Contact a site owner if you need access.</p></div>;
  return <>{children}</>;
}
