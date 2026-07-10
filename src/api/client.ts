import { apiUrl } from "../config/api";

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

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body) {
    headers["Content-Type"] = "application/json";
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
      refreshPromise = fetch(apiUrl("/api/auth/refresh"), {
        method: "POST",
        credentials: "include",
      })
        .then((r) => r.ok)
        .catch(() => false)
        .finally(() => {
          refreshPromise = null;
        });
    }

    const refreshSuccess = await refreshPromise;

    if (refreshSuccess) {
      response = await makeRequest();
    }
  }

  return parseResponse<T>(response);
}

