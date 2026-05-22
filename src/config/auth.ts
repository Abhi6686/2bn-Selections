/**
 * Prototype admin credentials.
 * Override in production via Vercel env: VITE_ADMIN_USERNAME, VITE_ADMIN_PASSWORD
 */
export const ADMIN_USERNAME =
  import.meta.env.VITE_ADMIN_USERNAME ?? "admin";

export const ADMIN_PASSWORD =
  import.meta.env.VITE_ADMIN_PASSWORD ?? "2BN-Admin-2026!";

export const AUTH_STORAGE_KEY = "2bn-selections-auth";
