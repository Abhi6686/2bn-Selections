/**
 * In-memory token store — keeps access + refresh tokens in JS memory.
 * This avoids cross-origin third-party cookie blocking (onrender.com is on the
 * Public Suffix List, so browsers treat the web and API subdomains as
 * separate sites and block cookies between them in strict privacy modes).
 *
 * Tokens are also persisted to sessionStorage as a fallback across tab refreshes.
 * sessionStorage is tab-scoped (clears on tab close) which is the right
 * security trade-off for tokens that rotate on every use.
 */

const ACCESS_KEY = "2bn_at";
const REFRESH_KEY = "2bn_rt";

// Hot tokens (always prefer these)
let _access: string | null = null;
let _refresh: string | null = null;

// Restore from sessionStorage on module load
try {
  _access = sessionStorage.getItem(ACCESS_KEY);
  _refresh = sessionStorage.getItem(REFRESH_KEY);
} catch {
  // sessionStorage may be unavailable in some private modes — silently ignore
}

export function getAccessToken(): string | null {
  return _access;
}

export function getRefreshToken(): string | null {
  return _refresh;
}

export function setTokens(access: string, refresh: string): void {
  _access = access;
  _refresh = refresh;
  try {
    sessionStorage.setItem(ACCESS_KEY, access);
    sessionStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    // ignore
  }
}

export function clearTokens(): void {
  _access = null;
  _refresh = null;
  try {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
  }
}
