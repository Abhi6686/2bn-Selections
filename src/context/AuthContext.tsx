import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ADMIN_PASSWORD, ADMIN_USERNAME, AUTH_STORAGE_KEY } from "../config/auth";

interface AuthContextValue {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredAuth(): { username: string } | null {
  const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { username: string; token: string };
    if (parsed.token === "authenticated") {
      return { username: parsed.username };
    }
  } catch {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ username: string } | null>(() =>
    readStoredAuth(),
  );

  const login = useCallback((username: string, password: string): boolean => {
    const trimmedUsername = username.trim();
    if (trimmedUsername === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const nextSession = { username: trimmedUsername };
      sessionStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ username: trimmedUsername, token: "authenticated" }),
      );
      setSession(nextSession);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: session !== null,
      username: session?.username ?? null,
      login,
      logout,
    }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
