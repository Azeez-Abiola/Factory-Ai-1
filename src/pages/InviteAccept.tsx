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
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [creating, setCreating] = useState(false);
  const [sentConfirm, setSentConfirm] = useState(false);

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirmPw) return toast.error("Passwords don't match.");
    setCreating(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/invite/${token}`,
        data: { display_name: fullName || invite.email.split("@")[0] },
      },
    });
    setCreating(false);
    if (signUpError) {
      toast.error(
        signUpError.message.includes("already")
          ? "This email already has an account. Sign in instead."
          : signUpError.message,
      );
      return;
    }
    if (data.session) {
      toast.success("Account created.");
      return;
    }
    setSentConfirm(true);
  };

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
              sentConfirm ? (
                <div className="text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Almost there — we sent a confirmation email to{" "}
                    <span className="font-medium text-foreground">{invite.email}</span>. Open it to activate your
                    account, then come back to this link to join {tenantName}.
                  </p>
                </div>
              ) : (
                <form onSubmit={createAccount} className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Choose a password to create your account for{" "}
                    <span className="font-medium text-foreground">{invite.email}</span>.
                  </p>
                  <div>
                    <Label htmlFor="inv-name">Full name</Label>
                    <Input id="inv-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ada Lovelace" className="mt-1.5 h-11" />
                  </div>
                  <div>
                    <Label htmlFor="inv-pw">Create password</Label>
                    <Input id="inv-pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11" />
                    <p className="text-xs text-muted-foreground mt-1.5">At least 8 characters. Only you will know it.</p>
                  </div>
                  <div>
                    <Label htmlFor="inv-pw2">Confirm password</Label>
                    <Input id="inv-pw2" type="password" required value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="mt-1.5 h-11" />
                  </div>
                  <Button type="submit" className="w-full" disabled={creating}>
                    {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating account…</> : "Create account & join"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => navigate(`/auth?redirect=/invite/${token}`)}
                    className="w-full text-xs text-primary hover:underline"
                  >
                    I already have an account — sign in
                  </button>
                </form>
              )
            ) : user.email?.toLowerCase() !== invite.email.toLowerCase() ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive text-center">
                  You're signed in as {user.email}. Please sign in with {invite.email} to accept this invite.
                </p>
                <Button variant="outline" className="w-full" onClick={async () => { await supabase.auth.signOut(); navigate(`/auth?redirect=/invite/${token}`); }}>
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
