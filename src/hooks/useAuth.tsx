import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "super_admin" | "tenant_admin" | "manager" | "operator" | "viewer";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles((data ?? []).map((r: { role: AppRole }) => r.role));
  };

  useEffect(() => {
    // Listener first to avoid missed events
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer to prevent deadlock
        setTimeout(() => fetchRoles(newSession.user.id), 0);
      } else {
        setRoles([]);
      }
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
      if (current?.user) await fetchRoles(current.user.id);
      setLoading(false);
    });

    return () => { sub.subscription.unsubscribe(); channel?.close(); };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider value={{ user, session, roles, loading, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
