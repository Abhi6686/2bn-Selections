import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useActivityFeed, useActivityStats, useActivityUsers } from "../api/hooks";
import type { ActivityFilters } from "../api/activity";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Activity,
  Users,
  Zap,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Download,
  Library,
  FolderOpen,
  CheckSquare,
  UserCog,
  Settings,
  LogIn,
  Trash2,
  PlusCircle,
  Edit3,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

// ─── Action metadata ──────────────────────────────────────────────────────────

interface ActionMeta {
  label: string;
  color: string;           // Tailwind bg class for badge
  textColor: string;       // Tailwind text class
  ringColor: string;       // ring / border highlight
  Icon: React.ElementType;
}

const ACTION_META: Record<string, ActionMeta> = {
  material_added:                { label: "Material Added",       color: "bg-blue-500/15",   textColor: "text-blue-400",   ringColor: "border-blue-500/30",   Icon: PlusCircle },
  material_updated:              { label: "Material Updated",     color: "bg-blue-500/10",   textColor: "text-blue-300",   ringColor: "border-blue-500/20",   Icon: Edit3 },
  material_deleted:              { label: "Material Deleted",     color: "bg-orange-500/15", textColor: "text-orange-400", ringColor: "border-orange-500/30", Icon: Trash2 },
  material_restored:             { label: "Material Restored",    color: "bg-teal-500/15",   textColor: "text-teal-400",   ringColor: "border-teal-500/30",   Icon: RotateCcw },
  material_permanently_deleted:  { label: "Perm. Deleted",        color: "bg-red-500/15",    textColor: "text-red-400",    ringColor: "border-red-500/30",    Icon: Trash2 },
  project_created:               { label: "Project Created",      color: "bg-emerald-500/15",textColor: "text-emerald-400",ringColor: "border-emerald-500/30",Icon: FolderOpen },
  project_updated:               { label: "Project Updated",      color: "bg-emerald-500/10",textColor: "text-emerald-300",ringColor: "border-emerald-500/20",Icon: Edit3 },
  selection_updated:             { label: "Selection Updated",    color: "bg-purple-500/15", textColor: "text-purple-400", ringColor: "border-purple-500/30", Icon: CheckSquare },
  user_invited:                  { label: "User Invited",         color: "bg-amber-500/15",  textColor: "text-amber-400",  ringColor: "border-amber-500/30",  Icon: UserCog },
  user_created_offline:          { label: "User Created",         color: "bg-amber-500/10",  textColor: "text-amber-300",  ringColor: "border-amber-500/20",  Icon: UserCog },
  invite_resent:                 { label: "Invite Resent",        color: "bg-amber-500/10",  textColor: "text-amber-300",  ringColor: "border-amber-500/20",  Icon: UserCog },
  user_role_changed:             { label: "Role Changed",         color: "bg-violet-500/15", textColor: "text-violet-400", ringColor: "border-violet-500/30", Icon: ShieldAlert },
  user_password_reset:           { label: "Password Reset",       color: "bg-violet-500/10", textColor: "text-violet-300", ringColor: "border-violet-500/20", Icon: ShieldAlert },
  settings_updated:              { label: "Settings Updated",     color: "bg-slate-500/15",  textColor: "text-slate-400",  ringColor: "border-slate-500/30",  Icon: Settings },
  login:                         { label: "Login",                color: "bg-sky-500/15",    textColor: "text-sky-400",    ringColor: "border-sky-500/30",    Icon: LogIn },
};

const DEFAULT_META: ActionMeta = {
  label: "Action",
  color: "bg-slate-500/10",
  textColor: "text-slate-400",
  ringColor: "border-slate-500/20",
  Icon: Zap,
};

function getActionMeta(action: string): ActionMeta {
  return ACTION_META[action] ?? DEFAULT_META;
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    admin:           { label: "Admin",   cls: "bg-red-500/20 text-red-300 border-red-500/30" },
    project_manager: { label: "PM",      cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    end_user:        { label: "Homeowner",cls: "bg-green-500/20 text-green-300 border-green-500/30" },
    client:          { label: "Client",  cls: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  };
  const { label, cls } = map[role] ?? { label: role, cls: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${cls}`}>
      {label}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/3 backdrop-blur-sm p-5 flex items-start gap-4 transition-all hover:border-white/10">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-white/50 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{typeof value === "number" ? value.toLocaleString() : value}</p>
        {sub && <p className="text-xs text-white/40 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Avatar initials ─────────────────────────────────────────────────────────

function Avatar({ name, role }: { name: string; role: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const colors: Record<string, string> = {
    admin:           "from-red-600 to-red-800",
    project_manager: "from-blue-600 to-blue-800",
    end_user:        "from-emerald-600 to-emerald-800",
    client:          "from-violet-600 to-violet-800",
  };
  const gradient = colors[role] ?? "from-slate-600 to-slate-800";
  return (
    <div
      className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold shrink-0`}
    >
      {initials || "?"}
    </div>
  );
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ─── Resource type icon ───────────────────────────────────────────────────────

function ResourceIcon({ type }: { type?: string }) {
  const map: Record<string, React.ElementType> = {
    library_item: Library,
    project:      FolderOpen,
    selection:    CheckSquare,
    user:         UserCog,
    template:     Activity,
    room_type:    Settings,
  };
  const Icon = (type && map[type]) ? map[type] : Zap;
  return <Icon size={12} className="text-white/30" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 30_000; // 30s auto-refresh

export function ActivityPage() {
  const { role } = useAuth();
  const navigate = useNavigate();

  // Guard: admin only
  if (role && role !== "admin") {
    navigate("/", { replace: true });
    return null;
  }

  const [filters, setFilters] = useState<ActivityFilters>({ page: 1, limit: 50 });
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const debouncedFilters = useMemo(
    () => ({ ...filters, search: search || undefined }),
    [filters, search]
  );

  const feedQuery = useActivityFeed(debouncedFilters, {
    refetchInterval: autoRefresh ? REFRESH_INTERVAL : undefined,
  });
  const statsQuery = useActivityStats({ refetchInterval: autoRefresh ? REFRESH_INTERVAL : undefined });
  const usersQuery = useActivityUsers();

  const logs = feedQuery.data?.logs ?? [];
  const stats = statsQuery.data;
  const activityUsers = usersQuery.data?.users ?? [];

  // Filter helpers
  const setFilter = useCallback((key: keyof ActivityFilters, value: string | number | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }, []);

  const clearFilters = () => {
    setFilters({ page: 1, limit: 50 });
    setSearch("");
  };

  const hasActiveFilters = Boolean(
    filters.userId || filters.action || filters.resourceType || filters.dateFrom || filters.dateTo || search
  );

  // CSV export
  const exportCsv = () => {
    const headers = ["Date", "User", "Role", "Action", "Resource", "Details"];
    const rows = logs.map((l) => [
      fullDate(l.createdAt),
      l.userName,
      l.userRole,
      l.action,
      l.resourceName ?? l.resourceType ?? "",
      l.details ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = feedQuery.isLoading || statsQuery.isLoading;
  const total = feedQuery.data?.total ?? 0;
  const pages = feedQuery.data?.pages ?? 1;
  const currentPage = filters.page ?? 1;

  // Action filter options from stats
  const actionOptions = stats?.actionBreakdown ?? [];

  return (
    <div className="min-h-full space-y-7">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={22} className="text-secondary" />
            <h1 className="text-2xl font-bold text-foreground">Activity Monitor</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time log of all user actions across the platform
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-refresh toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
              autoRefresh
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : "bg-white/5 border-white/10 text-white/50"
            }`}
          >
            <RefreshCw size={12} className={autoRefresh ? "animate-spin" : ""} style={{ animationDuration: "3s" }} />
            {autoRefresh ? "Live (30s)" : "Paused"}
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { feedQuery.refetch(); statsQuery.refetch(); }}
            className="gap-1.5 h-9"
          >
            <RefreshCw size={13} />
            Refresh
          </Button>

          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 h-9">
            <Download size={13} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ─── Stats Row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Zap}
          label="Actions Today"
          value={stats?.todayCount ?? "—"}
          sub="since midnight"
          color="bg-amber-500/15 text-amber-400"
        />
        <StatCard
          icon={TrendingUp}
          label="This Week"
          value={stats?.weekCount ?? "—"}
          sub="last 7 days"
          color="bg-blue-500/15 text-blue-400"
        />
        <StatCard
          icon={Activity}
          label="Total Events"
          value={stats?.totalCount ?? "—"}
          sub="all time"
          color="bg-violet-500/15 text-violet-400"
        />
        <StatCard
          icon={Users}
          label="Active Users"
          value={stats?.topUsers?.length ?? "—"}
          sub="with activity"
          color="bg-emerald-500/15 text-emerald-400"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* ─── Feed Column ─────────────────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-4">
          {/* Filters bar */}
          <div className="rounded-2xl border border-white/5 bg-white/3 p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <Input
                  placeholder="Search user, resource, details…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 bg-white/5 border-white/10 text-sm placeholder:text-white/25"
                />
              </div>

              {/* User filter */}
              <select
                value={filters.userId ?? ""}
                onChange={(e) => setFilter("userId", e.target.value || undefined)}
                className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 cursor-pointer focus:outline-none focus:ring-1 focus:ring-secondary/50"
              >
                <option value="">All Users</option>
                {activityUsers.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.userName} ({u.count})
                  </option>
                ))}
              </select>

              {/* Resource type filter */}
              <select
                value={filters.resourceType ?? ""}
                onChange={(e) => setFilter("resourceType", e.target.value || undefined)}
                className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 cursor-pointer focus:outline-none focus:ring-1 focus:ring-secondary/50"
              >
                <option value="">All Resources</option>
                <option value="library_item">Material Library</option>
                <option value="project">Projects</option>
                <option value="selection">Selections</option>
                <option value="user">Users</option>
                <option value="template">Templates</option>
                <option value="room_type">Room Types</option>
              </select>

              {/* Action filter */}
              <select
                value={filters.action ?? ""}
                onChange={(e) => setFilter("action", e.target.value || undefined)}
                className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 cursor-pointer focus:outline-none focus:ring-1 focus:ring-secondary/50"
              >
                <option value="">All Actions</option>
                {actionOptions.map((a) => (
                  <option key={a._id} value={a._id}>
                    {getActionMeta(a._id).label} ({a.count})
                  </option>
                ))}
              </select>

              {/* Date range */}
              <input
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(e) => setFilter("dateFrom", e.target.value || undefined)}
                className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60 cursor-pointer focus:outline-none focus:ring-1 focus:ring-secondary/50"
                title="From date"
              />
              <input
                type="date"
                value={filters.dateTo ?? ""}
                onChange={(e) => setFilter("dateTo", e.target.value || undefined)}
                className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60 cursor-pointer focus:outline-none focus:ring-1 focus:ring-secondary/50"
                title="To date"
              />

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-white/50 gap-1">
                  <Filter size={12} />
                  Clear
                </Button>
              )}
            </div>

            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-xs text-white/30">Active filters:</span>
                {filters.userId && (
                  <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-xs cursor-pointer" onClick={() => setFilter("userId", undefined)}>
                    User: {activityUsers.find(u => u._id === filters.userId)?.userName ?? filters.userId} ×
                  </Badge>
                )}
                {filters.resourceType && (
                  <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-xs cursor-pointer" onClick={() => setFilter("resourceType", undefined)}>
                    Resource: {filters.resourceType} ×
                  </Badge>
                )}
                {filters.action && (
                  <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-xs cursor-pointer" onClick={() => setFilter("action", undefined)}>
                    Action: {getActionMeta(filters.action).label} ×
                  </Badge>
                )}
                {search && (
                  <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-xs cursor-pointer" onClick={() => setSearch("")}>
                    Search: "{search}" ×
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="rounded-2xl border border-white/5 bg-white/3 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-5 py-3 border-b border-white/5 text-[10px] uppercase tracking-widest font-bold text-white/30">
              <span>Event</span>
              <span>Resource</span>
              <span className="text-right">When</span>
            </div>

            {/* Rows */}
            {isLoading ? (
              <div className="py-16 text-center text-white/30 text-sm animate-pulse">Loading activity…</div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <Activity size={32} className="mx-auto text-white/10" />
                <p className="text-white/30 text-sm">No activity found</p>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-secondary text-xs hover:underline">Clear filters</button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {logs.map((log) => {
                  const meta = getActionMeta(log.action);
                  const MetaIcon = meta.Icon;
                  return (
                    <div
                      key={log._id}
                      className="grid grid-cols-[1fr_auto_auto] gap-3 px-5 py-3.5 items-start hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Left: user + action + details */}
                      <div className="flex items-start gap-3 min-w-0">
                        <Avatar name={log.userName} role={log.userRole} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white/90 truncate">
                              {log.userName}
                            </span>
                            <RoleBadge role={log.userRole} />
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${meta.color} ${meta.textColor} ${meta.ringColor}`}
                            >
                              <MetaIcon size={10} />
                              {meta.label}
                            </span>
                          </div>
                          {log.details && (
                            <p className="text-xs text-white/40 mt-0.5 leading-relaxed line-clamp-2">{log.details}</p>
                          )}
                          <p className="text-[10px] text-white/25 mt-0.5">{log.userEmail}</p>
                        </div>
                      </div>

                      {/* Center: resource */}
                      <div className="text-right min-w-0 max-w-44">
                        {log.resourceName ? (
                          <div className="flex items-center gap-1 justify-end">
                            <ResourceIcon type={log.resourceType} />
                            <span className="text-xs text-white/50 truncate">{log.resourceName}</span>
                          </div>
                        ) : log.resourceType ? (
                          <span className="text-xs text-white/30 capitalize">{log.resourceType.replace("_", " ")}</span>
                        ) : null}
                      </div>

                      {/* Right: time */}
                      <div className="text-right shrink-0" title={fullDate(log.createdAt)}>
                        <span className="text-xs text-white/40 tabular-nums">{relativeTime(log.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                <span className="text-xs text-white/30">
                  Showing {((currentPage - 1) * (filters.limit ?? 50)) + 1}–{Math.min(currentPage * (filters.limit ?? 50), total)} of {total.toLocaleString()} events
                </span>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={currentPage <= 1}
                    onClick={() => setFilter("page", currentPage - 1)}
                  >
                    <ChevronLeft size={13} />
                  </Button>
                  <span className="flex items-center px-2 text-xs text-white/50">
                    {currentPage} / {pages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={currentPage >= pages}
                    onClick={() => setFilter("page", currentPage + 1)}
                  >
                    <ChevronRight size={13} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Sidebar: User Leaderboard + Breakdown ────────────────────────── */}
        <div className="xl:col-span-1 space-y-4">
          {/* Top Users */}
          <div className="rounded-2xl border border-white/5 bg-white/3 p-5">
            <h3 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-4">Most Active Users</h3>
            <div className="space-y-3">
              {(stats?.topUsers ?? []).slice(0, 8).map((u, i) => {
                const pct = stats?.totalCount ? Math.round((u.count / stats.totalCount) * 100) : 0;
                return (
                  <div key={u._id.userId} className="space-y-1">
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-white/20 w-4 tabular-nums">{i + 1}</span>
                        <Avatar name={u._id.userName} role={u._id.userRole} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white/80 truncate">{u._id.userName}</p>
                          <RoleBadge role={u._id.userRole} />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-white/60 tabular-nums shrink-0">{u.count}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-secondary to-secondary/60 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {(stats?.topUsers ?? []).length === 0 && (
                <p className="text-xs text-white/25 text-center py-4">No data yet</p>
              )}
            </div>
          </div>

          {/* Action Breakdown */}
          <div className="rounded-2xl border border-white/5 bg-white/3 p-5">
            <h3 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-4">Top Actions</h3>
            <div className="space-y-2">
              {(stats?.actionBreakdown ?? []).slice(0, 10).map((a) => {
                const meta = getActionMeta(a._id);
                const MetaIcon = meta.Icon;
                const pct = stats?.totalCount ? Math.round((a.count / stats.totalCount) * 100) : 0;
                return (
                  <div key={a._id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MetaIcon size={11} className={meta.textColor} />
                        <span className="text-xs text-white/60 truncate">{meta.label}</span>
                      </div>
                      <span className="text-xs font-bold text-white/50 tabular-nums shrink-0">{a.count}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${meta.color.replace("/15", "").replace("/10", "")}`}
                        style={{ width: `${pct}%`, backgroundColor: "currentColor" }}
                      />
                    </div>
                  </div>
                );
              })}
              {(stats?.actionBreakdown ?? []).length === 0 && (
                <p className="text-xs text-white/25 text-center py-4">No data yet</p>
              )}
            </div>
          </div>

          {/* Resource Breakdown */}
          {(stats?.resourceBreakdown ?? []).length > 0 && (
            <div className="rounded-2xl border border-white/5 bg-white/3 p-5">
              <h3 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-4">By Resource Type</h3>
              <div className="space-y-2.5">
                {(stats?.resourceBreakdown ?? []).map((r) => {
                  const pct = stats?.totalCount ? Math.round((r.count / stats.totalCount) * 100) : 0;
                  return (
                    <div key={r._id} className="flex items-center gap-3">
                      <ResourceIcon type={r._id} />
                      <span className="text-xs text-white/50 capitalize flex-1 truncate">
                        {r._id.replace("_", " ")}
                      </span>
                      <span className="text-xs font-bold text-white/40 tabular-nums">{r.count}</span>
                      <div className="w-14 h-1 rounded-full bg-white/5 overflow-hidden shrink-0">
                        <div className="h-full bg-secondary/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
