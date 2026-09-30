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

    // End the sign-in when the browser is closed. sessionStorage is wiped on
    // browser close; other open tabs vouch for a still-running session.
    const FLAG = "factoryai.browserSession";
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("factoryai-auth") : null;
    if (channel) {
      channel.onmessage = (e) => {
        if (e.data === "ping" && sessionStorage.getItem(FLAG)) channel.postMessage("pong");
      };
    }
    const isContinuingSession = (): Promise<boolean> => {
      if (sessionStorage.getItem(FLAG)) return Promise.resolve(true);
      if (!channel) return Promise.resolve(false);
      return new Promise((resolve) => {
        const timer = setTimeout(() => { channel.removeEventListener("message", onMsg); resolve(false); }, 400);
        const onMsg = (e: MessageEvent) => {
          if (e.data === "pong") { clearTimeout(timer); channel.removeEventListener("message", onMsg); resolve(true); }
        };
        channel.addEventListener("message", onMsg);
        channel.postMessage("ping");
      });
    };

    supabase.auth.getSession().then(async ({ data }) => {
      let current = data.session;
      if (current && !(await isContinuingSession())) {
        await supabase.auth.signOut({ scope: "local" });
        current = null;
      }
      sessionStorage.setItem(FLAG, "1");
      setSession(current);
      setUser(current?.user ?? null);
      if (current?.user) await loadAccount(current.user.id);
      setLoading(false);
    });

    return () => { sub.subscription.unsubscribe(); channel?.close(); };
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
