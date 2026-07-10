import type { ApiUser } from "@2bn/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import * as authApi from "../api/auth";
import { queryKeys } from "../api/hooks";
import { ADMIN_PASSWORD, ADMIN_USERNAME, AUTH_STORAGE_KEY } from "../config/auth";
import { isApiMode } from "../config/api";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: ApiUser | null;
  username: string | null;
  role: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithMagicLink: (token: string) => Promise<boolean>;
  requestMagicLink: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  configurePassword: (password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readLegacySession(): { username: string } | null {
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
  const queryClient = useQueryClient();
  const legacySession = !isApiMode ? readLegacySession() : null;

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.fetchCurrentUser().then((response) => response.user),
    enabled: isApiMode,
    retry: false,
  });

  const user = isApiMode ? (meQuery.data ?? null) : legacySession
    ? ({
        id: "legacy",
        email: legacySession.username,
        name: legacySession.username,
        role: "admin",
        status: "active",
      } satisfies ApiUser)
    : null;

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      if (isApiMode) {
        const response = await authApi.loginWithPassword(email, password);
        queryClient.setQueryData(queryKeys.me, response.user);
        return true;
      }

      const trimmed = email.trim();
      if (trimmed === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        sessionStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ username: trimmed, token: "authenticated" }),
        );
        window.location.reload();
        return true;
      }
      return false;
    },
    [queryClient],
  );

  const loginWithMagicLink = useCallback(
    async (token: string): Promise<boolean> => {
      const response = await authApi.verifyMagicLink(token);
      queryClient.setQueryData(queryKeys.me, response.user);
      return true;
    },
    [queryClient],
  );

  const requestMagicLink = useCallback(async (email: string): Promise<void> => {
    await authApi.requestMagicLink(email);
  }, []);

  const configurePassword = useCallback(
    async (password: string): Promise<boolean> => {
      if (isApiMode) {
        const response = await authApi.configurePassword(password);
        queryClient.setQueryData(queryKeys.me, response.user);
        return true;
      }
      return false;
    },
    [queryClient],
  );

  const logout = useCallback(async (): Promise<void> => {
    if (isApiMode) {
      await authApi.logoutApi();
      queryClient.setQueryData(queryKeys.me, null);
      queryClient.clear();
      return;
    }
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.reload();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(user),
      isLoading: isApiMode ? meQuery.isLoading : false,
      user,
      username: user?.email ?? user?.name ?? null,
      role: user?.role ?? null,
      login,
      loginWithMagicLink,
      requestMagicLink,
      logout,
      configurePassword,
    }),
    [user, meQuery.isLoading, login, loginWithMagicLink, requestMagicLink, logout, configurePassword],
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
