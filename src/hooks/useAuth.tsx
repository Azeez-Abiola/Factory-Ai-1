import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "super_admin" | "tenant_admin" | "manager" | "operator" | "viewer";
type ApprovalStatus = "pending" | "approved" | "rejected" | null;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  approvalStatus: ApprovalStatus;
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(null);
  const [loading, setLoading] = useState(true);

  const loadAccount = async (userId: string) => {
    const [{ data: roleRows }, { data: profileRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("approval_status").eq("id", userId).maybeSingle(),
    ]);
    setRoles((roleRows ?? []).map((r: { role: AppRole }) => r.role));
    setApprovalStatus((profileRow?.approval_status as ApprovalStatus) ?? null);
  };

  useEffect(() => {
    // Listener first to avoid missed events
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (!newSession?.user) {
        setRoles([]);
        setApprovalStatus(null);
        return;
      }
      // TOKEN_REFRESHED fires whenever the client silently renews the
      // session — notably whenever the browser tab regains focus — even
      // though nothing about the account actually changed. Refetching
      // roles/profile on every one of those caused a visible reload of
      // every page reading them each time the user switched back to this
      // tab. Only re-fetch for events that can actually change the account.
      if (event === "TOKEN_REFRESHED") return;
      // Defer to prevent deadlock
      setTimeout(() => loadAccount(newSession.user.id), 0);
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadAccount(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider value={{ user, session, roles, approvalStatus, loading, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
