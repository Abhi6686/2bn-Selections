import { useState, useRef, useEffect } from "react";
import {
  useUsers,
  useInviteUser,
  useActivities,
  useDeleteUser,
  useRestoreUser,
  usePermanentlyDeleteUser,
  useSetUserPassword,
  useSendResetLink,
  useResendInvite,
} from "../api/hooks";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Users,
  UserPlus,
  ClipboardList,
  Shield,
  Briefcase,
  Mail,
  Calendar,
  Clock,
  RefreshCw,
  Trash2,
  RotateCcw,
  Ban,
  MoreVertical,
  Eye,
  EyeOff,
  Clipboard,
  Check,
  Send,
  KeyRound,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDateTime } from "../utils/format";
import type { ApiUser } from "@2bn/shared";
import { useAuth } from "../context/AuthContext";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function InviteModal({ isOpen, onClose }: InviteModalProps) {
  const inviteMutation = useInviteUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "project_manager">("project_manager");
  const [creationMethod, setCreationMethod] = useState<"email" | "offline">("email");
  const [passwordOption, setPasswordOption] = useState<"auto" | "manual">("auto");
  const [manualPassword, setManualPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Success view state for offline password display
  const [offlineSuccessData, setOfflineSuccessData] = useState<{
    name: string;
    email: string;
    role: string;
    password?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Please fill out all fields");
      return;
    }

    const payload: any = {
      name,
      email,
      role,
      sendEmail: creationMethod === "email",
    };

    if (creationMethod === "offline") {
      if (passwordOption === "manual") {
        if (manualPassword.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }
        payload.temporaryPassword = manualPassword;
      }
    }

    try {
      const result = await inviteMutation.mutateAsync(payload);
      
      if (creationMethod === "email") {
        if (result.emailSent === false) {
          toast.success(`${name} added — but invite email failed to send. Check SMTP settings in Render.`, { duration: 6000 });
        } else {
          toast.success(`Invitation email sent to ${email}!`);
        }
        handleClose();
      } else {
        setOfflineSuccessData({
          name: name,
          email: email,
          role: role === "project_manager" ? "Project Manager" : "Admin",
          password: result.temporaryPassword,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    }
  };

  const handleClose = () => {
    setName("");
    setEmail("");
    setRole("project_manager");
    setCreationMethod("email");
    setPasswordOption("auto");
    setManualPassword("");
    setShowPassword(false);
    setOfflineSuccessData(null);
    setCopied(false);
    onClose();
  };

  const handleCopyPassword = () => {
    if (offlineSuccessData?.password) {
      navigator.clipboard.writeText(offlineSuccessData.password);
      setCopied(true);
      toast.success("Password copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
        
        {offlineSuccessData ? (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xl mx-auto">
              ✓
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-foreground">User Created Offline</h3>
              <p className="text-sm text-muted-foreground">
                <strong>{offlineSuccessData.name}</strong> has been created as <strong>{offlineSuccessData.role}</strong> without sending an email.
              </p>
            </div>

            <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-3 font-medium text-sm">
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Email:</span>
                <span className="text-foreground">{offlineSuccessData.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Password:</span>
                <div className="flex items-center gap-2">
                  <code className="text-primary font-mono font-bold bg-primary/5 px-2 py-0.5 rounded text-sm select-all">
                    {offlineSuccessData.password}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    title="Copy Password"
                  >
                    {copied ? <Check size={15} className="text-emerald-500" /> : <Clipboard size={15} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 font-medium">
              ⚠️ Please copy and share this temporary password securely. It is only shown once and cannot be recovered after closing this window.
            </div>

            <div className="pt-2">
              <Button onClick={handleClose} className="w-full">
                Close & Continue
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-foreground mb-4">Add Team Member</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={inviteMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="e.g. jane@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={inviteMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("project_manager")}
                    disabled={inviteMutation.isPending}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                      role === "project_manager"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Briefcase size={15} />
                    Project Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("admin")}
                    disabled={inviteMutation.isPending}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                      role === "admin"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Shield size={15} />
                    Admin
                  </button>
                </div>
              </div>

              {/* Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Creation Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCreationMethod("email")}
                    disabled={inviteMutation.isPending}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      creationMethod === "email"
                        ? "border-primary bg-primary/5 text-primary animate-in fade-in"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Mail size={16} className="mb-1" />
                    <span className="text-sm font-bold">Email Invite</span>
                    <span className="text-[10px] text-muted-foreground/80 mt-0.5">Send magic link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationMethod("offline")}
                    disabled={inviteMutation.isPending}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      creationMethod === "offline"
                        ? "border-primary bg-primary/5 text-primary animate-in fade-in"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Shield size={16} className="mb-1" />
                    <span className="text-sm font-bold">Offline / Direct</span>
                    <span className="text-[10px] text-muted-foreground/80 mt-0.5">Create with password</span>
                  </button>
                </div>
              </div>

              {/* Offline Custom Options */}
              {creationMethod === "offline" && (
                <div className="space-y-3 p-3.5 bg-muted/40 border border-border/80 rounded-xl animate-in slide-in-from-top-2 duration-200">
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-2">Password Setup</label>
                    <div className="flex gap-4 text-xs font-semibold">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="passwordOption"
                          checked={passwordOption === "auto"}
                          onChange={() => setPasswordOption("auto")}
                          className="accent-primary cursor-pointer"
                        />
                        Auto-generate password
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="passwordOption"
                          checked={passwordOption === "manual"}
                          onChange={() => setPasswordOption("manual")}
                          className="accent-primary cursor-pointer"
                        />
                        Set manually
                      </label>
                    </div>
                  </div>

                  {passwordOption === "manual" && (
                    <div className="space-y-1 animate-in fade-in duration-200">
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase">Manual Password</label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Min 8 characters"
                          value={manualPassword}
                          onChange={(e) => setManualPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {inviteMutation.isPending && (
                <div className="text-center space-y-1 py-1 text-xs text-muted-foreground animate-pulse font-medium">
                  <p>⏳ Creating user account and processing...</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={inviteMutation.isPending}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <Button type="submit" disabled={inviteMutation.isPending} className="flex-1">
                  {inviteMutation.isPending ? "Processing..." : creationMethod === "email" ? "Send Invite" : "Create User"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

interface SetPasswordModalProps {
  isOpen: boolean;
  member: ApiUser | null;
  onClose: () => void;
}

function SetPasswordModal({ isOpen, member, onClose }: SetPasswordModalProps) {
  const setPasswordMutation = useSetUserPassword();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      await setPasswordMutation.mutateAsync({ userId: member.id, password });
      toast.success(`Password set successfully for ${member.name}`);
      setPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to set password");
    }
  };

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold text-foreground mb-1">Set Password Directly</h3>
        <p className="text-xs text-muted-foreground mb-4 font-medium">
          Set a new password for <strong className="text-foreground">{member.name}</strong> ({member.email}). This will activate their account immediately (bypassing email requirements).
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={setPasswordMutation.isPending}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={setPasswordMutation.isPending}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={setPasswordMutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted/50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <Button type="submit" disabled={setPasswordMutation.isPending} className="flex-1">
              {setPasswordMutation.isPending ? "Saving..." : "Set Password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ActionsDropdown({
  member,
  currentUser,
  onSetPassword,
  onSendReset,
  onResendInvite,
  onDelete,
}: {
  member: ApiUser;
  currentUser: ApiUser | null;
  onSetPassword: (member: ApiUser) => void;
  onSendReset: (member: ApiUser) => void;
  onResendInvite: (member: ApiUser) => void;
  onDelete: (member: ApiUser) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const isSelf = currentUser?.id === member.id;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
      >
        <MoreVertical size={16} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-52 rounded-xl bg-card border border-border shadow-xl z-30 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {member.status === "invited" && (
            <button
              onClick={() => {
                setIsOpen(false);
                onResendInvite(member);
              }}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors flex items-center gap-2 cursor-pointer font-medium"
            >
              <Send size={14} className="text-primary" />
              Resend Invite Email
            </button>
          )}

          <button
            onClick={() => {
              setIsOpen(false);
              onSendReset(member);
            }}
            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors flex items-center gap-2 cursor-pointer font-medium"
          >
            <KeyRound size={14} className="text-amber-500" />
            Send Reset Link (Email)
          </button>

          <button
            onClick={() => {
              setIsOpen(false);
              onSetPassword(member);
            }}
            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors flex items-center gap-2 cursor-pointer font-medium"
          >
            <Shield size={14} className="text-emerald-500" />
            Set Password Directly
          </button>

          {!isSelf && (
            <button
              onClick={() => {
                setIsOpen(false);
                onDelete(member);
              }}
              className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2 border-t border-border mt-1 pt-2 cursor-pointer font-medium"
            >
              <Trash2 size={14} />
              Move to Recycle Bin
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function UsersPage() {
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useUsers();
  const { data: activities = [], isLoading: activitiesLoading, refetch: refetchActivities } = useActivities();
  const deleteMutation = useDeleteUser();
  const restoreMutation = useRestoreUser();
  const permanentDeleteMutation = usePermanentlyDeleteUser();

  const sendResetMutation = useSendResetLink();
  const resendInviteMutation = useResendInvite();

  const { user: currentUser } = useAuth();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"directory" | "recycle" | "activity">("directory");

  // Confirmation Modals State
  const [userToDelete, setUserToDelete] = useState<ApiUser | null>(null);
  const [userToRestore, setUserToRestore] = useState<ApiUser | null>(null);
  const [userToPermanentlyDelete, setUserToPermanentlyDelete] = useState<ApiUser | null>(null);

  // Set password modal state
  const [userForPasswordSet, setUserForPasswordSet] = useState<ApiUser | null>(null);

  const activeUsers = users.filter((u) => u.status !== "blocked");
  const blockedUsers = users.filter((u) => u.status === "blocked");

  const handleRefresh = () => {
    refetchUsers();
    refetchActivities();
    toast.success("Refreshed user directory");
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      await deleteMutation.mutateAsync(userToDelete.id);
      toast.success(`${userToDelete.name} moved to Recycle Bin`);
      setUserToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  const handleRestoreConfirm = async () => {
    if (!userToRestore) return;
    try {
      await restoreMutation.mutateAsync(userToRestore.id);
      toast.success(`${userToRestore.name} restored successfully`);
      setUserToRestore(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to restore user");
    }
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!userToPermanentlyDelete) return;
    try {
      await permanentDeleteMutation.mutateAsync(userToPermanentlyDelete.id);
      toast.success(`${userToPermanentlyDelete.name} permanently deleted`);
      setUserToPermanentlyDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user permanently");
    }
  };

  const handleSendReset = async (member: ApiUser) => {
    try {
      await sendResetMutation.mutateAsync(member.id);
      toast.success(`Password reset email sent to ${member.email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    }
  };

  const handleResendInvite = async (member: ApiUser) => {
    try {
      await resendInviteMutation.mutateAsync(member.id);
      toast.success(`Invitation resent to ${member.email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to resend invitation");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Users className="text-primary h-8 w-8" />
            Team Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Manage roles, invite team members, and monitor user registration status and activity.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} className="h-10 w-10">
            <RefreshCw size={16} />
          </Button>
          <Button onClick={() => setIsInviteOpen(true)} className="flex items-center gap-2">
            <UserPlus size={16} />
            Add Member
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setActiveSubTab("directory")}
          className={`pb-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeSubTab === "directory"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Users size={16} />
            Team Directory ({activeUsers.length})
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab("recycle")}
          className={`pb-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeSubTab === "recycle"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Trash2 size={16} />
            Recycle Bin ({blockedUsers.length})
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab("activity")}
          className={`pb-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeSubTab === "activity"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <ClipboardList size={16} />
            Activity Log ({activities.length})
          </span>
        </button>
      </div>

      {/* Content */}
      {activeSubTab === "directory" && (
        <Card className="border border-border shadow-md rounded-2xl overflow-hidden bg-card animate-in fade-in duration-200">
          <CardContent className="p-0">
            {usersLoading ? (
              <div className="p-12 text-center text-muted-foreground font-medium">Loading directory…</div>
            ) : activeUsers.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground font-medium">No active users found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                      <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                      <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Registration</th>
                      <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Login</th>
                      <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {activeUsers.map((member) => (
                      <tr key={member.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground text-sm">{member.name}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <Mail size={12} />
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          {member.role === "admin" ? (
                            <Badge className="bg-destructive/10 text-destructive border-transparent hover:bg-destructive/10 flex items-center gap-1 w-fit font-bold text-xs py-0.5 px-2.5">
                              <Shield size={12} />
                              Admin
                            </Badge>
                          ) : member.role === "project_manager" ? (
                            <Badge className="bg-primary/10 text-primary border-transparent hover:bg-primary/10 flex items-center gap-1 w-fit font-bold text-xs py-0.5 px-2.5">
                              <Briefcase size={12} />
                              Project Manager
                            </Badge>
                          ) : (
                            <Badge className="bg-secondary/15 text-secondary-foreground border-transparent hover:bg-secondary/15 w-fit text-xs font-semibold py-0.5 px-2.5">
                              {member.role}
                            </Badge>
                          )}
                        </td>
                        <td className="p-4">
                          {member.status === "active" ? (
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-transparent hover:bg-emerald-500/10 font-bold text-xs py-0.5 px-2.5 rounded-full">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/10 text-amber-500 border-transparent hover:bg-amber-500/10 font-bold text-xs py-0.5 px-2.5 rounded-full">
                              Invited
                            </Badge>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-xs text-foreground font-medium flex items-center gap-1.5">
                            <Calendar size={13} className="text-muted-foreground" />
                            {member.status === "active" ? "Registered" : "Invited"}
                          </div>
                        </td>
                        <td className="p-4">
                          {member.lastLoginAt ? (
                            <div className="text-xs text-foreground font-medium flex items-center gap-1.5">
                              <Clock size={13} className="text-muted-foreground" />
                              {formatDateTime(member.lastLoginAt)}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Never logged in</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <ActionsDropdown
                            member={member}
                            currentUser={currentUser}
                            onSetPassword={setUserForPasswordSet}
                            onSendReset={handleSendReset}
                            onResendInvite={handleResendInvite}
                            onDelete={setUserToDelete}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSubTab === "recycle" && (
        <Card className="border border-border shadow-md rounded-2xl overflow-hidden bg-card animate-in fade-in duration-200">
          <CardContent className="p-0">
            {usersLoading ? (
              <div className="p-12 text-center text-muted-foreground font-medium">Loading Recycle Bin…</div>
            ) : blockedUsers.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground font-medium">Recycle Bin is empty.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                      <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                      <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {blockedUsers.map((member) => (
                      <tr key={member.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center font-bold text-sm">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground text-sm">{member.name}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <Mail size={12} />
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge className="bg-muted text-muted-foreground border-transparent hover:bg-muted font-semibold text-xs py-0.5 px-2.5">
                            {member.role === "admin" ? "Admin" : member.role === "project_manager" ? "Project Manager" : member.role}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge className="bg-destructive/15 text-destructive border-transparent hover:bg-destructive/15 font-bold text-xs py-0.5 px-2.5 rounded-full flex items-center gap-1 w-fit">
                            <Ban size={11} />
                            Blocked
                          </Badge>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUserToRestore(member)}
                            className="flex items-center gap-1 h-8 px-2.5 rounded-lg border-emerald-200 text-emerald-600 hover:bg-emerald-50 cursor-pointer font-bold"
                          >
                            <RotateCcw size={13} />
                            Restore
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUserToPermanentlyDelete(member)}
                            className="flex items-center gap-1 h-8 px-2.5 rounded-lg border-destructive/20 text-destructive hover:bg-destructive/5 cursor-pointer font-bold"
                          >
                            <Trash2 size={13} />
                            Delete Permanently
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSubTab === "activity" && (
        <Card className="border border-border shadow-md rounded-2xl overflow-hidden bg-card animate-in fade-in duration-200">
          <CardContent className="p-6">
            {activitiesLoading ? (
              <div className="text-center text-muted-foreground p-6 font-medium">Loading activities…</div>
            ) : activities.length === 0 ? (
              <div className="text-center text-muted-foreground p-6 font-medium">No recent activity logged.</div>
            ) : (
              <div className="relative border-l border-border/80 pl-6 ml-4 space-y-6">
                {activities.map((activity) => (
                  <div key={activity.id} className="relative">
                    <div className="absolute -left-[31px] top-1 w-4.5 h-4.5 rounded-full bg-background border-2 border-primary flex items-center justify-center z-10 shadow-sm" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {activity.userName}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 font-medium">{activity.details}</p>
                      <div className="text-[10px] text-muted-foreground/80 flex items-center gap-1 mt-1 font-medium">
                        <Clock size={10} />
                        {formatDateTime(activity.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Unified Add Member Modal */}
      <InviteModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} />

      {/* Set Password Modal */}
      <SetPasswordModal
        isOpen={Boolean(userForPasswordSet)}
        member={userForPasswordSet}
        onClose={() => setUserForPasswordSet(null)}
      />

      {/* Confirmation Modal: Soft Delete */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-foreground">Move to Recycle Bin</h3>
            <p className="text-sm text-muted-foreground font-medium">
              Are you sure you want to move <strong>{userToDelete.name}</strong> to the Recycle Bin? They will be blocked from accessing the system.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setUserToDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleDeleteConfirm}>
                Move to Bin
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Restore */}
      {userToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-foreground">Restore User</h3>
            <p className="text-sm text-muted-foreground font-medium">
              Are you sure you want to restore <strong>{userToRestore.name}</strong>? They will regain access to the system with their previous role.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setUserToRestore(null)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleRestoreConfirm}>
                Restore Access
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Permanent Delete */}
      {userToPermanentlyDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-destructive">Delete User Permanently</h3>
            <p className="text-sm text-muted-foreground font-medium">
              Are you absolutely sure you want to permanently delete <strong>{userToPermanentlyDelete.name}</strong>? This action is irreversible.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setUserToPermanentlyDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handlePermanentDeleteConfirm}>
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
