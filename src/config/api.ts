export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export const isApiMode = API_BASE_URL.length > 0 || import.meta.env.DEV;

export function apiUrl(path: string): string {
  if (path.startsWith("http")) {
    return path;
  }
  if (import.meta.env.DEV) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}
