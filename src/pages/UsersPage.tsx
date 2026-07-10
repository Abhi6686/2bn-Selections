import { useState } from "react";
import { useUsers, useInviteUser, useActivities } from "../api/hooks";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Users, UserPlus, ClipboardList, Shield, Briefcase, Mail, Calendar, Clock, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { formatDateTime } from "../utils/format";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function InviteModal({ isOpen, onClose }: InviteModalProps) {
  const inviteMutation = useInviteUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "project_manager">("project_manager");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Please fill out all fields");
      return;
    }

    try {
      await inviteMutation.mutateAsync({ name, email, role });
      toast.success("Invitation sent successfully!");
      setName("");
      setEmail("");
      setRole("project_manager");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold text-foreground mb-4">Invite Team Member</h3>
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
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                  role === "project_manager"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Briefcase size={16} />
                Project Manager
              </button>
              <button
                type="button"
                onClick={() => setRole("admin")}
                disabled={inviteMutation.isPending}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                  role === "admin"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Shield size={16} />
                Admin
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={inviteMutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted/50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <Button type="submit" disabled={inviteMutation.isPending} className="flex-1">
              {inviteMutation.isPending ? "Sending..." : "Send Invite"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function UsersPage() {
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useUsers();
  const { data: activities = [], isLoading: activitiesLoading, refetch: refetchActivities } = useActivities();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"directory" | "activity">("directory");

  const handleRefresh = () => {
    refetchUsers();
    refetchActivities();
    toast.success("Refreshed user directory");
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
          <p className="text-sm text-muted-foreground mt-1">
            Manage roles, invite team members, and monitor user registration status and activity.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} className="h-10 w-10">
            <RefreshCw size={16} />
          </Button>
          <Button onClick={() => setIsInviteOpen(true)} className="flex items-center gap-2">
            <UserPlus size={16} />
            Invite Member
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
            Team Directory ({users.length})
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
      {activeSubTab === "directory" ? (
        <Card className="border border-border shadow-md rounded-2xl overflow-hidden bg-card">
          <CardContent className="p-0">
            {usersLoading ? (
              <div className="p-12 text-center text-muted-foreground">Loading directory…</div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No users found.</div>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {users.map((member) => (
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
                          {/* registration timestamp is derived from ObjectID or createdAt. But we don't have createdAt on ApiUser yet. Let's just mock or display Date Invited if available, or if they are active, they are registered */}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border shadow-md rounded-2xl overflow-hidden bg-card">
          <CardContent className="p-6">
            {activitiesLoading ? (
              <div className="text-center text-muted-foreground p-6">Loading activities…</div>
            ) : activities.length === 0 ? (
              <div className="text-center text-muted-foreground p-6">No recent activity logged.</div>
            ) : (
              <div className="relative border-l border-border/80 pl-6 ml-4 space-y-6">
                {activities.map((activity) => (
                  <div key={activity.id} className="relative">
                    {/* Circle icon marker on line */}
                    <div className="absolute -left-[31px] top-1 w-4.5 h-4.5 rounded-full bg-background border-2 border-primary flex items-center justify-center z-10 shadow-sm" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {activity.userName}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{activity.details}</p>
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

      {/* Invite Modal */}
      <InviteModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
    </div>
  );
}
