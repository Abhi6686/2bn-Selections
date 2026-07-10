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
}): Promise<{ user: ApiUser; emailSent?: boolean; message?: string }> {
  return apiFetch("/api/users/invite", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchActivities(): Promise<ApiActivityLog[]> {
  return apiFetch("/api/users/activity");
}
