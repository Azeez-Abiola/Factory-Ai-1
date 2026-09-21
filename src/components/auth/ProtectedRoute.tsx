import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type AppRole = "super_admin" | "tenant_admin" | "manager" | "operator" | "viewer";

interface Props {
  children: React.ReactNode;
  requireRoles?: AppRole[];
}

const ProtectedRoute = ({ children, requireRoles }: Props) => {
  const { user, roles, approvalStatus, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (approvalStatus === "pending" || approvalStatus === "rejected") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground p-6">
        <div className="text-2xl font-display font-bold">
          {approvalStatus === "rejected" ? "Access declined" : "Awaiting approval"}
        </div>
        <p className="text-muted-foreground text-sm max-w-md text-center">
          {approvalStatus === "rejected"
            ? "Your account request was declined. Contact your workspace administrator if you believe this is a mistake."
            : "Your account is pending approval from a workspace administrator. You'll get access as soon as it's approved."}
        </p>
        <Button variant="outline" onClick={signOut}>Sign out</Button>
      </div>
    );
  }

  if (requireRoles && requireRoles.length > 0) {
    const ok = requireRoles.some((r) => roles.includes(r));
    if (!ok) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground p-6">
          <div className="text-2xl font-display font-bold">Access denied</div>
          <p className="text-muted-foreground text-sm max-w-md text-center">
            Your role doesn't grant access to this area. Contact your workspace administrator if you believe this is a mistake.
          </p>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
