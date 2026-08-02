import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Auth = () => {
  const navigate = useNavigate();
  const { user, isPasswordRecovery, clearPasswordRecovery, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => { document.title = "Sign in - Céilí Brisbane"; }, []);

  useEffect(() => {
    if (loading) return;
    if (isPasswordRecovery) return;
    if (user) navigate("/", { replace: true });
  }, [user, navigate, isPasswordRecovery, loading]);

  const onSetNewPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated — you're signed in!");
    clearPasswordRecovery();
    navigate("/", { replace: true });
  };

  const onForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("reset_email") ?? "").trim();
    if (!email) return toast.error("Enter your email address");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Check your inbox for a password reset link");
  };

  const onEmail = async (mode: "in" | "up", e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const display_name = String(fd.get("display_name") ?? "").trim();
    if (!email || !password) return toast.error("Email and password required");
    if (mode === "up" && !agreed) return toast.error("Please agree to the Terms & Conditions to create an account");

    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast.error(error.message);
      if (!rememberMe) {
        sessionStorage.setItem("ceili_session_active", "1");
        localStorage.setItem("ceili_no_persist", "1");
      } else {
        localStorage.removeItem("ceili_no_persist");
      }
      toast.success("Welcome back!");
      navigate("/");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth`, data: { display_name } },
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      if (!data.session) {
        toast.success("Check your inbox to confirm your email — if it's not there, check your spam folder.");
      } else {
        toast.success("Account created - you're in!");
        navigate("/");
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="container flex-1 py-10">
        <div className="mx-auto max-w-md">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <h1 className="mt-4 font-display text-3xl font-bold">{isPasswordRecovery ? "Set new password" : "Sign in"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isPasswordRecovery ? "Choose a new password for your account." : "Optional - accounts let you save favourites and manage your listings."}
          </p>

          {isPasswordRecovery ? (
            <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
              <form onSubmit={onSetNewPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new_password">New password</Label>
                  <Input
                    id="new_password"
                    type="password"
                    minLength={6}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                  />
                </div>
                <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Set new password
                </Button>
              </form>
            </div>
          ) : (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
            <Tabs defaultValue="in">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="in">Sign in</TabsTrigger>
                <TabsTrigger value="up">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="in">
                <form onSubmit={(e) => onEmail("in", e)} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" name="password" type="password" required />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember_me"
                      checked={rememberMe}
                      onCheckedChange={(v) => setRememberMe(v === true)}
                    />
                    <Label htmlFor="remember_me" className="text-sm font-normal text-muted-foreground cursor-pointer">
                      Remember me
                    </Label>
                  </div>
                  <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
                  </Button>
                </form>
                <details className="mt-4 rounded-lg border border-border bg-secondary/30 p-3 text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Forgot your password?</summary>
                  <form onSubmit={onForgotPassword} className="mt-3 space-y-3">
                    <Input name="reset_email" type="email" placeholder="Your email address" required />
                    <Button type="submit" variant="outline" size="sm" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send reset link
                    </Button>
                  </form>
                </details>
              </TabsContent>
              <TabsContent value="up">
                <form onSubmit={(e) => onEmail("up", e)} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label htmlFor="display_name">Name</Label><Input id="display_name" name="display_name" required /></div>
                  <div className="space-y-2"><Label htmlFor="email2">Email</Label><Input id="email2" name="email" type="email" required /></div>
                  <div className="space-y-2"><Label htmlFor="password2">Password</Label><Input id="password2" name="password" type="password" minLength={6} required /></div>
                  <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/30 p-3">
                    <Checkbox
                      id="agree"
                      checked={agreed}
                      onCheckedChange={(v) => setAgreed(v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="agree" className="text-xs font-normal leading-relaxed text-muted-foreground">
                      I have read and agree to the{" "}
                      <Link to="/terms" target="_blank" className="underline hover:text-foreground">Terms & Conditions</Link>
                      {" "}and{" "}
                      <Link to="/privacy" target="_blank" className="underline hover:text-foreground">Privacy Policy</Link>,
                      including the liability disclaimer.
                    </Label>
                  </div>
                  <Button type="submit" variant="hero" className="w-full" disabled={busy || !agreed}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
          )}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            By continuing you agree to our{" "}
            <Link to="/terms" className="underline hover:text-foreground">Terms</Link> and{" "}
            <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Auth;
