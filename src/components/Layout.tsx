import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { LayoutDashboard, Library, Plus, FileText, LogOut, Sun, Moon, Sparkles, LayoutPanelLeft, Users, Settings } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { PasswordModal } from "./PasswordModal";
import { Badge } from "./ui/badge";

export function Layout() {
  const { role, username, logout, user } = useAuth();
  const { theme, isDark, toggleDark, setTheme, themes } = useTheme();
  const navigate = useNavigate();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const isHomeowner = role === "end_user";

  const navItems = isHomeowner
    ? [{ to: "/", label: "My Selections", icon: LayoutDashboard, end: true }]
    : [
        { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/library", label: "Material Library", icon: Library },
        { to: "/projects/new", label: "New Project", icon: Plus },
        { to: "/templates", label: "Templates", icon: FileText },
        { to: "/room-configurator", label: "Room Configurator", icon: LayoutPanelLeft },
        ...(role === "admin"
          ? [{ to: "/team", label: "Team Management", icon: Users }]
          : []),
        ...(role === "admin"
          ? [{ to: "/settings", label: "System Settings", icon: Settings }]
          : []),
      ];


  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-primary text-white flex flex-col h-screen sticky top-0 shadow-xl border-r border-white/5 z-20">
        {/* Brand Header */}
        <div className="p-6 border-b border-white/10 bg-primary-950/20 luxury-logo-container">
          <div className="flex items-center gap-3">
            <div className="luxury-logo-transparent w-14 h-10 shrink-0 flex items-center justify-center">
              <img src="/logo_transparent.png" alt="2bn Logo" className="w-full h-full object-contain filter drop-shadow-[0_2px_6px_rgba(234,179,8,0.15)]" />
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-wide font-serif bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">2bn Selections</div>
            </div>
          </div>
          <div className="mt-3">
            <Badge variant="secondary" className="bg-white/10 hover:bg-white/10 border-transparent text-secondary-foreground text-[10px] py-0 px-2 rounded-md font-bold flex items-center gap-1 w-fit">
              <Sparkles size={10} /> {isHomeowner ? "Homeowner View" : "Builder Console"}
            </Badge>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 flex flex-col gap-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-secondary text-secondary-foreground font-bold shadow-md scale-[1.02]"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer Info */}
        <div className="p-4 border-t border-white/10 bg-primary-950/20 space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Signed in as</p>
            <p className="text-sm text-white/90 truncate font-semibold">{username}</p>
          </div>

          {/* Theme Switcher Dots */}
          <div className="flex items-center justify-between gap-2 bg-primary-950/40 p-2 rounded-xl border border-white/5">
            <div className="flex gap-1.5">
              {themes.map((t) => {
                let dotBg = "bg-primary-800";
                if (t.id === "emerald-gold") dotBg = "bg-emerald-600";
                else if (t.id === "slate-indigo") dotBg = "bg-indigo-600";
                else if (t.id === "warm-sand") dotBg = "bg-amber-600";
                else if (t.id === "royal-navy") dotBg = "bg-blue-900";
                
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    title={t.name}
                    className={`w-5 h-5 rounded-full border transition-all duration-200 cursor-pointer ${dotBg} ${
                      theme === t.id
                        ? "border-secondary scale-125 ring-2 ring-white/30"
                        : "border-white/10 hover:border-white/40"
                    }`}
                  />
                );
              })}
            </div>
            <button
              type="button"
              onClick={toggleDark}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
              title={isDark ? "Light mode" : "Dark mode"}
            >
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>

          {/* User Settings Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 rounded-lg bg-white/5 border-white/10 hover:bg-white/10 hover:text-white text-white/80"
              onClick={() => setIsPasswordModalOpen(true)}
            >
              {user?.hasPassword ? "Change PW" : "Set PW"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="px-3 h-9 rounded-lg bg-white/5 border-white/10 hover:bg-white/10 hover:text-white text-white/80"
              onClick={handleLogout}
            >
              <LogOut size={14} />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-8 overflow-auto">
        {user && !user.hasPassword && (
          <div className="mb-6 p-4 rounded-xl bg-secondary/15 border border-secondary/20 flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-lg">🔒</span>
              <p className="text-sm font-medium text-foreground">
                Configure a password for your account so you can sign in directly using email and password next time.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setIsPasswordModalOpen(true)} className="shrink-0">
              Configure Password
            </Button>
          </div>
        )}
        <Outlet />
      </main>

      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        hasPassword={!!user?.hasPassword}
      />
    </div>
  );
}
