import { useState, useEffect } from "react";
import { useOrgSettings, useUpdateOrgSettings, useTestSmtp, useTestResend } from "../api/hooks";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Settings, Save, Send, AlertTriangle, CheckCircle, Eye, EyeOff, Loader2, Mail, Server } from "lucide-react";
import toast from "react-hot-toast";

export function SettingsPage() {
  const { data: orgSettings, isLoading: settingsLoading, refetch } = useOrgSettings();
  const updateSettingsMutation = useUpdateOrgSettings();
  const testSmtpMutation = useTestSmtp();
  const testResendMutation = useTestResend();

  // Active email delivery provider tab
  const [emailProvider, setEmailProvider] = useState<"smtp" | "resend">("smtp");

  // Form states
  const [name, setName] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);
  const [testDestination, setTestDestination] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; error?: string } | null>(null);

  // Sync form state when query resolves
  useEffect(() => {
    if (orgSettings) {
      setName(orgSettings.name || "");
      setSmtpHost(orgSettings.smtpHost || "");
      setSmtpPort(orgSettings.smtpPort || 587);
      setSmtpUser(orgSettings.smtpUser || "");
      setSmtpFrom(orgSettings.smtpFrom || "");
      setSmtpPass(orgSettings.hasSmtpPass ? "••••••••" : "");
      setResendApiKey(orgSettings.hasResendApiKey ? "••••••••" : "");

      // Auto-select Resend if it was already configured
      if (orgSettings.hasResendApiKey) {
        setEmailProvider("resend");
      } else {
        setEmailProvider("smtp");
      }
    }
  }, [orgSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name,
        smtpHost,
        smtpPort: Number(smtpPort),
        smtpUser,
        smtpFrom,
      };

      if (smtpPass && smtpPass !== "••••••••") {
        payload.smtpPass = smtpPass;
      }

      if (emailProvider === "resend") {
        if (resendApiKey && resendApiKey !== "••••••••") {
          payload.resendApiKey = resendApiKey;
        }
      } else {
        // If switched back to SMTP, clear Resend API Key
        payload.resendApiKey = "";
      }

      await updateSettingsMutation.mutateAsync(payload);
      toast.success("Settings saved successfully!");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    }
  };

  const handleTestEmail = async () => {
    if (!testDestination.trim()) {
      toast.error("Please enter a destination email address for the test");
      return;
    }

    setTestResult(null);
    try {
      if (emailProvider === "resend") {
        const result = await testResendMutation.mutateAsync({
          resendApiKey: resendApiKey === "••••••••" ? undefined : resendApiKey,
          smtpFrom,
          testTo: testDestination,
        });
        setTestResult({
          success: true,
          message: result.message || "Diagnostic test email sent successfully via Resend HTTP API!",
        });
        toast.success("Resend test email sent!");
      } else {
        const result = await testSmtpMutation.mutateAsync({
          smtpHost,
          smtpPort: Number(smtpPort),
          smtpUser,
          smtpPass: smtpPass === "••••••••" ? undefined : smtpPass,
          smtpFrom,
          testTo: testDestination,
        });
        setTestResult({
          success: true,
          message: result.message || "Diagnostic test email sent successfully via SMTP! Please check your inbox.",
        });
        toast.success("SMTP test email sent!");
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Failed to send diagnostic test email via ${emailProvider.toUpperCase()}.`,
        error: err.message || String(err),
      });
      toast.error(`${emailProvider.toUpperCase()} Test Failed`);
    }
  };

  if (settingsLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 h-64 space-y-4">
        <Loader2 className="animate-spin text-primary h-8 w-8" />
        <p className="text-muted-foreground text-sm">Loading configuration settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Settings className="text-primary h-8 w-8" />
          System Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure organization settings, SMTP email servers, Resend HTTP API integrations, and run live diagnostic tests.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Settings Form */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border border-border shadow-md rounded-2xl bg-card">
            <CardHeader>
              <CardTitle className="text-lg">General Settings</CardTitle>
              <CardDescription>Configure organization profile and communication channels.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-6">
                {/* Org Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Organization Name
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. 2BN Contracting"
                    required
                  />
                </div>

                {/* Email Provider Selector Tabs */}
                <div className="border-t border-border/80 pt-6 space-y-4">
                  <div>
                    <h3 className="font-bold text-foreground text-md">Email Delivery Provider</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Choose whether to send emails using a standard SMTP server or Resend's HTTP API (recommended for Render).
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-xl border border-border/60">
                    <button
                      type="button"
                      onClick={() => setEmailProvider("smtp")}
                      className={`flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer ${
                        emailProvider === "smtp"
                          ? "bg-card text-foreground shadow-sm border border-border/40"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Server size={14} />
                      Standard SMTP
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailProvider("resend")}
                      className={`flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer ${
                        emailProvider === "resend"
                          ? "bg-card text-foreground shadow-sm border border-border/40"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Mail size={14} />
                      Resend HTTP API (Recommended)
                    </button>
                  </div>

                  {/* Shared Sender Email Address */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Sender Name & From Address (SMTP_FROM)
                    </label>
                    <Input
                      value={smtpFrom}
                      onChange={(e) => setSmtpFrom(e.target.value)}
                      placeholder='e.g. 2BN Selections <noreply@2bncontracting.com>'
                    />
                    <p className="text-[11px] text-muted-foreground italic">
                      {emailProvider === "resend"
                        ? "Ensure this domain is verified in your Resend account, or use 'onboarding@resend.dev' for sandbox testing."
                        : "The sender address that recipients will see in their email client."}
                    </p>
                  </div>

                  {/* SMTP Form Fields */}
                  {emailProvider === "smtp" && (
                    <div className="space-y-4 border-l-2 border-primary/20 pl-4 py-1 animate-fadeIn">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            SMTP Host
                          </label>
                          <Input
                            value={smtpHost}
                            onChange={(e) => setSmtpHost(e.target.value)}
                            placeholder="smtp.gmail.com"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            SMTP Port
                          </label>
                          <Input
                            type="number"
                            value={smtpPort}
                            onChange={(e) => setSmtpPort(Number(e.target.value))}
                            placeholder="587"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          SMTP User (Authentication Username)
                        </label>
                        <Input
                          value={smtpUser}
                          onChange={(e) => setSmtpUser(e.target.value)}
                          placeholder="user@gmail.com"
                          type="email"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          SMTP Password / App Password
                        </label>
                        <div className="relative">
                          <Input
                            value={smtpPass}
                            onChange={(e) => setSmtpPass(e.target.value)}
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter password or Gmail App Password"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground italic">
                          For Gmail, you must use a 16-character <strong>Google App Password</strong> instead of your regular password.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Resend Form Fields */}
                  {emailProvider === "resend" && (
                    <div className="space-y-4 border-l-2 border-primary/20 pl-4 py-1 animate-fadeIn">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Resend API Key
                        </label>
                        <div className="relative">
                          <Input
                            value={resendApiKey}
                            onChange={(e) => setResendApiKey(e.target.value)}
                            type={showResendKey ? "text" : "password"}
                            placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowResendKey(!showResendKey)}
                            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {showResendKey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Get a free API Key at{" "}
                          <a
                            href="https://resend.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-semibold"
                          >
                            resend.com
                          </a>. The free plan allows sending 3,000 emails per month and bypasses Render's SMTP port blocks completely.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border/80">
                  <Button
                    type="submit"
                    disabled={updateSettingsMutation.isPending}
                    className="flex items-center gap-2 w-full md:w-auto px-6 cursor-pointer"
                  >
                    {updateSettingsMutation.isPending ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                    ) : (
                      <Save size={16} />
                    )}
                    Save Settings
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Live Diagnostics Panel */}
        <div className="space-y-6">
          <Card className="border border-border shadow-md rounded-2xl bg-card h-fit">
            <CardHeader>
              <CardTitle className="text-lg">{emailProvider.toUpperCase()} Diagnostics</CardTitle>
              <CardDescription>
                Test {emailProvider === "resend" ? "HTTP API" : "SMTP Server"} connectivity in real-time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Before saving settings, enter your email below to send a live diagnostic test message using the configuration specified on the left.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Test Destination Email
                </label>
                <Input
                  value={testDestination}
                  onChange={(e) => setTestDestination(e.target.value)}
                  placeholder="e.g. your-email@gmail.com"
                  type="email"
                />
              </div>

              <Button
                variant="outline"
                onClick={handleTestEmail}
                disabled={testSmtpMutation.isPending || testResendMutation.isPending}
                className="w-full flex items-center justify-center gap-2 border-primary/20 text-primary hover:bg-primary/5 cursor-pointer"
              >
                {testSmtpMutation.isPending || testResendMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Send Test Email
                  </>
                )}
              </Button>

              {/* Diagnostic Results */}
              {testResult && (
                <div className="pt-2 animate-fadeIn">
                  {testResult.success ? (
                    <div className="flex gap-2 p-3 bg-emerald-500/10 text-emerald-600 rounded-xl border border-emerald-500/20 text-xs leading-relaxed">
                      <CheckCircle size={16} className="shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Success!</span> {testResult.message}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 p-3 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 text-xs">
                      <div className="flex gap-2">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">{emailProvider.toUpperCase()} Connection Failed</span>
                          <p className="mt-1 text-muted-foreground leading-relaxed">
                            {testResult.error || testResult.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
