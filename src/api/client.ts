import { apiUrl } from "../config/api";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokens";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T);

  if (!response.ok) {
    throw new ApiError(
      (data as { error?: string }).error ?? `Request failed (${response.status})`,
      response.status,
      data,
    );
  }

  return data;
}

let refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;

  try {
    const res = await fetch(apiUrl("/api/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      // Send refresh token in body as a fallback when cookies are blocked
      body: JSON.stringify({ refreshToken: rt }),
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const data = await res.json() as { accessToken?: string; refreshToken?: string };
    if (data.accessToken && data.refreshToken) {
      setTokens(data.accessToken, data.refreshToken);
    }
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  // Prefer Bearer token over cookies (works cross-origin even when cookies are blocked)
  const accessToken = getAccessToken();
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const makeRequest = () =>
    fetch(apiUrl(path), {
      ...options,
      credentials: "include",
      headers: {
        ...headers,
        ...(options.headers ?? {}),
      },
    });

  let response = await makeRequest();

  // If unauthorized and this is not a login/refresh request, try to refresh
  if (
    response.status === 401 &&
    !path.includes("/auth/login") &&
    !path.includes("/auth/refresh")
  ) {
    if (!refreshPromise) {
      refreshPromise = attemptTokenRefresh().finally(() => {
        refreshPromise = null;
      });
    }

    const refreshSuccess = await refreshPromise;

    if (refreshSuccess) {
      // Update the Authorization header with the new access token
      const newToken = getAccessToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
      }
      response = await makeRequest();
    }
  }

  return parseResponse<T>(response);
}


