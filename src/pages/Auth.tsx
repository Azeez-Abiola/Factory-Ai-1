import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, Shield, Zap, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/app";

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
        emailRedirectTo: `${window.location.origin}/app`,
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

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
      setBusy(false);
    }
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

          <Button
            type="button"
            variant="outline"
            className="w-full mb-4 h-11"
            onClick={handleGoogle}
            disabled={busy}
          >
            <GoogleIcon />
            <span className="ml-2">Continue with Google</span>
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
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
                  <Input id="pw-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11" />
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
                  <Input id="pw-up" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11" />
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
