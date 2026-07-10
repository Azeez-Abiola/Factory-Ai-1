import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

type AppRole = "super_admin" | "tenant_admin" | "operator" | "viewer";

interface Props {
  children: React.ReactNode;
  requireRoles?: AppRole[];
}

const ProtectedRoute = ({ children, requireRoles }: Props) => {
  const { user, roles, loading } = useAuth();
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
