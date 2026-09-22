import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";
import { toast } from "sonner";

const InviteAccept = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<{ email: string; role: string; status: string; expires_at: string } | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      // Read through a secure lookup so the page works before sign-in and for
      // people signed in with a different email.
      const { data, error } = await supabase.rpc("invitation_preview", { _token: token });
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) {
        setError("This invitation link is invalid or has been removed.");
      } else {
        setInvite({ email: row.email, role: row.role, status: row.status, expires_at: row.expires_at });
        setTenantName(row.tenant_name ?? "the workspace");
      }
      setLoading(false);
    })();
  }, [token]);

  const accept = async () => {
    if (!token) return;
    setAccepting(true);
    const { data, error } = await supabase.rpc("accept_tenant_invitation", { _token: token });
    setAccepting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      localStorage.setItem("factoryai.activeTenantId", data as string);
    }
    toast.success(`Welcome to ${tenantName}!`);
    navigate("/app");
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-2xl border border-border p-8 max-w-md w-full space-y-6">
        {error || !invite ? (
          <div className="text-center space-y-3">
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold">Invitation Unavailable</h1>
            <p className="text-muted-foreground text-sm">{error ?? "This invitation could not be found."}</p>
            <Button onClick={() => navigate("/")}>Go home</Button>
          </div>
        ) : invite.status !== "pending" ? (
          <div className="text-center space-y-3">
            <XCircle className="w-12 h-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-semibold">Invitation {invite.status}</h1>
            <p className="text-muted-foreground text-sm">This invitation has already been {invite.status}.</p>
            <Button onClick={() => navigate("/app")}>Go to app</Button>
          </div>
        ) : new Date(invite.expires_at) < new Date() ? (
          <div className="text-center space-y-3">
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold">Invitation expired</h1>
            <p className="text-muted-foreground text-sm">Ask the sender to resend a new invitation.</p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-xl font-semibold">You're invited to {tenantName}</h1>
              <p className="text-muted-foreground text-sm">
                Invited as <span className="font-medium text-foreground">{invite.role}</span> — sent to <span className="font-medium text-foreground">{invite.email}</span>
              </p>
            </div>

            {!user ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Sign in or create an account with <span className="font-medium">{invite.email}</span> to accept.
                </p>
                <Button className="w-full" onClick={() => navigate(`/auth?redirect=/invite/${token}&email=${encodeURIComponent(invite.email)}`)}>
                  Sign in to accept
                </Button>
              </div>
            ) : user.email?.toLowerCase() !== invite.email.toLowerCase() ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive text-center">
                  You're signed in as {user.email}. Please sign in with {invite.email} to accept this invite.
                </p>
                <Button variant="outline" className="w-full" onClick={async () => { await supabase.auth.signOut(); navigate(`/auth?redirect=/invite/${token}&email=${encodeURIComponent(invite.email)}`); }}>
                  Switch account
                </Button>
              </div>
            ) : (
              <Button className="w-full" onClick={accept} disabled={accepting}>
                {accepting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Accepting…</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Accept invitation</>}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default InviteAccept;
