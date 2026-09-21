import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, Shield, Zap, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const redirectParam = searchParams.get("redirect");
  const emailParam = searchParams.get("email");

  const [email, setEmail] = useState(emailParam ?? "");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  // A redirect from an invite link (e.g. /invite/:token) takes priority so
  // signing up or in from that link actually finishes accepting the invite,
  // rather than dropping the invitee onto /app with no tenant membership.
  const from = useMemo(() => {
    if (redirectParam && redirectParam.startsWith("/")) return redirectParam;
    return (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/app";
  }, [redirectParam, location.state]);

  useEffect(() => {
    if (!authLoading && user) navigate(from, { replace: true });
  }, [user, authLoading, from, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
      return;
    }
    toast.success("Welcome back.");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${from}`,
        data: { display_name: displayName || email.split("@")[0] },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("already") ? "This email is already registered. Try signing in." : error.message);
      return;
    }
    toast.success("Account created. Check your email to confirm.");
  };

  const handleForgot = async () => {
    if (!email) {
      toast.error("Enter your email above first.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent.");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Left brand column */}
      <div className="hidden md:flex flex-col justify-between p-12 md:w-1/2 relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
        <div className="grid-bg absolute inset-0 opacity-30" />
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <div className="w-3.5 h-3.5 rounded-sm bg-primary" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Factory<span className="text-primary">AI</span>
            </span>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 space-y-8"
        >
          <div>
            <h1 className="text-4xl lg:text-5xl font-display font-bold leading-tight text-foreground">
              Vision AI for the <span className="text-gradient">modern factory floor</span>
            </h1>
            <p className="mt-4 text-muted-foreground text-lg max-w-md">
              Real-time incident detection, predictive maintenance, and shift intelligence — unified.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 max-w-md">
            {[
              { icon: Eye, title: "Live vision AI", desc: "Sub-second PPE, intrusion & downtime detection." },
              { icon: Zap, title: "Predictive maintenance", desc: "Reduce unplanned downtime by up to 40%." },
              { icon: Shield, title: "SOC2 ready", desc: "Multi-tenant isolation & full audit trail." },
            ].map((f) => (
              <div key={f.title} className="glass rounded-xl p-4 flex gap-3 items-start">
                <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{f.title}</div>
                  <div className="text-xs text-muted-foreground">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="relative z-10 text-xs text-muted-foreground">
          Trusted by FMCG and pharmaceutical manufacturers worldwide.
        </div>
      </div>

      {/* Right form column */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="md:hidden flex justify-center mb-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <div className="w-3 h-3 rounded-sm bg-primary" />
              </div>
              <span className="text-lg font-bold">Factory<span className="text-primary">AI</span></span>
            </Link>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-display font-bold text-foreground">
              {tab === "signin" ? "Welcome back" : "Create your workspace"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {tab === "signin" ? "Sign in to access your factory intelligence." : "Start monitoring your operations in minutes."}
            </p>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="email-in">Work email</Label>
                  <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="mt-1.5 h-11" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pw-in">Password</Label>
                    <button type="button" onClick={handleForgot} className="text-xs text-primary hover:underline">Forgot?</button>
                  </div>
                  <PasswordInput id="pw-in" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11" />
                </div>
                <Button type="submit" className="w-full h-11" disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Sign in <ArrowRight className="ml-1.5 w-4 h-4" /></>)}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="name-up">Full name</Label>
                  <Input id="name-up" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ada Lovelace" className="mt-1.5 h-11" />
                </div>
                <div>
                  <Label htmlFor="email-up">Work email</Label>
                  <Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="mt-1.5 h-11" />
                </div>
                <div>
                  <Label htmlFor="pw-up">Password</Label>
                  <PasswordInput id="pw-up" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11" />
                  <p className="text-xs text-muted-foreground mt-1.5">At least 8 characters.</p>
                </div>
                <Button type="submit" className="w-full h-11" disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Create account <ArrowRight className="ml-1.5 w-4 h-4" /></>)}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground text-center mt-6">
            By continuing you agree to our terms and acknowledge our privacy policy.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
