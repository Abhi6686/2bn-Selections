import type { ApiUser } from "@2bn/shared";
import { apiFetch } from "./client";

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<{ user: ApiUser }> {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function requestMagicLink(email: string): Promise<{ ok: boolean; message: string }> {
  return apiFetch("/api/auth/magic-link", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyMagicLink(token: string): Promise<{ user: ApiUser }> {
  return apiFetch(`/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`);
}

export async function fetchCurrentUser(): Promise<{ user: ApiUser }> {
  return apiFetch("/api/auth/me");
}

export async function logoutApi(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
}

export async function configurePassword(password: string): Promise<{ user: ApiUser }> {
  return apiFetch("/api/auth/configure-password", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}
