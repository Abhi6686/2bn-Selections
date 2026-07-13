import type { ApiUser } from "@2bn/shared";
import { apiFetch } from "./client";

export interface ApiActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  createdAt: string;
}

export async function fetchUsers(): Promise<ApiUser[]> {
  return apiFetch("/api/users");
}

export async function inviteUser(input: {
  name: string;
  email: string;
  role: "admin" | "project_manager";
  sendEmail?: boolean;
  temporaryPassword?: string;
}): Promise<{ user: ApiUser; emailSent?: boolean; temporaryPassword?: string; message?: string }> {
  return apiFetch("/api/users/invite", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchActivities(): Promise<ApiActivityLog[]> {
  return apiFetch("/api/users/activity");
}

export async function deleteUser(userId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/users/${userId}`, {
    method: "DELETE",
  });
}

export async function restoreUser(userId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/users/${userId}/restore`, {
    method: "POST",
  });
}

export async function permanentlyDeleteUser(userId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/users/${userId}/permanent`, {
    method: "DELETE",
  });
}

export async function setUserPassword(userId: string, password: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/users/${userId}/set-password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function sendResetLink(userId: string): Promise<{ success: boolean; message: string }> {
  return apiFetch(`/api/users/${userId}/send-reset`, {
    method: "POST",
  });
}

export async function resendInvite(userId: string): Promise<{ success: boolean; message: string }> {
  return apiFetch(`/api/users/${userId}/resend-invite`, {
    method: "POST",
  });
}
