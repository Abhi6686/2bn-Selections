import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";
import { useAuth } from "../context/AuthContext";
import { isApiMode } from "../config/api";
import { Sparkles, Hammer, Mail, Lock } from "lucide-react";

export function LoginPage() {
  const { isAuthenticated, isLoading, login, requestMagicLink } = useAuth();
  const [tab, setTab] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner color="accent" size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    login(email, password)
      .then((success: boolean) => {
        if (!success) setErrorMessage("Invalid email or password.");
      })
      .catch(() => setErrorMessage("Unable to sign in."))
      .finally(() => setIsSubmitting(false));
  };

  const handleMagicLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setInfoMessage("");
    setIsSubmitting(true);
    requestMagicLink(email)
      .then(() => setInfoMessage("Check your email for a sign-in link."))
      .catch(() => setErrorMessage("Unable to send magic link."))
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left side: Premium branding & showcase */}
      <div className="md:w-1/2 bg-gradient-to-br from-[#020703] via-[#05140b] to-[#010301] text-white p-8 md:p-16 flex flex-col justify-between items-center text-center relative overflow-hidden">
        {/* Subtle decorative mesh background overlay & luxury glow */}
        <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.06)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center gap-4 w-full luxury-logo-container">
          <div className="luxury-logo-transparent w-64 h-24 shrink-0 flex items-center justify-center">
            <img src="/logo_transparent.png" alt="2bn Logo" className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(234,179,8,0.25)]" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-wider font-serif text-white bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
              2bn Selections
            </h1>
          </div>
        </div>

        <div className="my-auto py-12 relative z-10 max-w-lg w-full flex flex-col items-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold font-serif leading-tight text-white drop-shadow-sm">
              Curate Beautiful Materials for Your Next Build.
            </h2>
            <p className="text-slate-300 text-base leading-relaxed max-w-md mx-auto">
              A premium selections platform designed for builders to coordinate libraries and for homeowners to finalize their dream home choices.
            </p>
          </div>

          <div className="space-y-4 pt-6 border-t border-white/10 w-full max-w-md">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 text-left">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 mt-0.5 shrink-0">
                <Hammer size={18} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Builder Mode</h4>
                <p className="text-xs text-slate-300 mt-0.5">Configure material options, structure categories, and handle budgets.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 text-left">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 mt-0.5 shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Client Portal</h4>
                <p className="text-xs text-slate-300 mt-0.5">Browse visually cataloged selections sorted by value, mid, and premium levels.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-400 flex justify-between w-full max-w-lg border-t border-white/5 pt-4">
          <span>&copy; {new Date().getFullYear()} 2bn Selections</span>
          <span>Authorized Access Only</span>
        </div>
      </div>

      {/* Right side: Login forms */}
      <div className="md:w-1/2 flex items-center justify-center p-8 bg-muted/30">
        <Card className="w-full max-w-md border-border shadow-xl bg-card">
          <CardContent className="pt-8">
            <div className="mb-6 space-y-1.5 text-center md:text-left">
              <h3 className="text-2xl font-bold font-serif text-foreground">Sign In</h3>
              <p className="text-sm text-muted-foreground">
                Enter your credentials to access the selections portal.
              </p>
            </div>

            {isApiMode && (
              <div className="flex mb-6 bg-muted rounded-lg p-1 border border-border">
                <button
                  type="button"
                  onClick={() => { setTab("password"); setErrorMessage(""); setInfoMessage(""); }}
                  className={`flex-1 py-2 rounded-md text-xs font-semibold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                    tab === "password" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => { setTab("magic"); setErrorMessage(""); setInfoMessage(""); }}
                  className={`flex-1 py-2 rounded-md text-xs font-semibold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                    tab === "magic" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Magic Link
                </button>
              </div>
            )}

            {tab === "password" ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Mail size={12} /> {isApiMode ? "Email Address" : "User ID"}
                  </label>
                  <Input
                    type={isApiMode ? "email" : "text"}
                    placeholder={isApiMode ? "you@example.com" : "Enter your user ID"}
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Lock size={12} /> Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                    {errorMessage}
                  </div>
                )}

                <Button type="submit" variant="premium" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Spinner size="sm" className="mr-2" /> : null}
                  {isSubmitting ? "Signing in..." : "Access Portal"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Mail size={12} /> Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                    {errorMessage}
                  </div>
                )}

                {infoMessage && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                    {infoMessage}
                  </div>
                )}

                <Button type="submit" variant="premium" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Spinner size="sm" className="mr-2" /> : null}
                  {isSubmitting ? "Sending..." : "Send Secure Magic Link"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
