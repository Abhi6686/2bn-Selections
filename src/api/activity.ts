import { apiFetch } from "./client";

export interface ActivityLog {
  _id: string;
  orgId: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  details?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityFeedResponse {
  logs: ActivityLog[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ActivityStats {
  todayCount: number;
  weekCount: number;
  totalCount: number;
  topUsers: Array<{
    _id: { userId: string; userName: string; userEmail: string; userRole: string };
    count: number;
    lastActionAt: string;
    lastAction: string;
  }>;
  actionBreakdown: Array<{ _id: string; count: number }>;
  resourceBreakdown: Array<{ _id: string; count: number }>;
}

export interface ActivityUsersResponse {
  users: Array<{
    _id: string;
    userName: string;
    userEmail: string;
    userRole: string;
    count: number;
  }>;
}

export interface ActivityFilters {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  resourceType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export async function fetchActivityFeed(filters: ActivityFilters = {}): Promise<ActivityFeedResponse> {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.action) params.set("action", filters.action);
  if (filters.resourceType) params.set("resourceType", filters.resourceType);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return apiFetch<ActivityFeedResponse>(`/api/activity${qs ? `?${qs}` : ""}`);
}

export async function fetchActivityStats(): Promise<ActivityStats> {
  return apiFetch<ActivityStats>("/api/activity/stats");
}

export async function fetchActivityUsers(): Promise<ActivityUsersResponse> {
  return apiFetch<ActivityUsersResponse>("/api/activity/users");
}
