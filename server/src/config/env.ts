import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(currentDirectory, "../../../.env") });
config({ path: path.resolve(currentDirectory, "../../../.env.local") });

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? "3001"),
  host: process.env.HOST ?? "0.0.0.0",
  mongodbUri: requireEnv("MONGODB_URI"),
  mongodbUriStandard: process.env.MONGODB_URI_STANDARD,
  jwtSecret: requireEnv("JWT_SECRET", "dev-only-change-in-production-32chars!!"),
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES ?? "15m",
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES ?? "7d",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  uploadsDir: path.resolve(
    process.env.UPLOADS_DIR ??
      path.join(path.dirname(currentDirectory), "../../../uploads"),
  ),
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? process.env.SMIP_PORT ?? "587"),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? process.env.SMIP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "noreply@2bncontracting.com",
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@stepron.com",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? "2BN-Admin-2026!",
  seedClientEmail: process.env.SEED_CLIENT_EMAIL ?? "client@2bncontracting.com",
  seedClientPassword: process.env.SEED_CLIENT_PASSWORD ?? "2BN-Client-2026!",
  changeOrderMinimum: Number(process.env.CHANGE_ORDER_MINIMUM ?? "500"),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  isDevelopment: (process.env.NODE_ENV ?? "development") !== "production",
};
