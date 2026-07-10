import { loginSchema, magicLinkRequestSchema } from "@2bn/shared";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { UserModel } from "../models/User.js";
import {
  authenticateWithPassword,
  createSessionTokens,
  refreshSession,
  requestMagicLink,
  revokeRefreshToken,
  verifyMagicLink,
  hashPassword,
} from "../services/auth.service.js";
import { mapUser } from "../utils/mappers.js";

function setAuthCookies(
  reply: { setCookie: (name: string, value: string, options: object) => void },
  accessToken: string,
  refreshToken: string,
): void {
  const isProduction = !env.isDevelopment;
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    // "none" is required for cross-origin cookie sharing (frontend and API on different subdomains).
    // "lax" blocks cookies on cross-origin requests in the browser.
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    path: "/",
  };

  reply.setCookie("access_token", accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60,
  });
  reply.setCookie("refresh_token", refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await authenticateWithPassword(body.email, body.password);
    if (!user) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const tokens = await createSessionTokens(user);
    setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
    return { user: mapUser(user as never) };
  });

  app.post("/api/auth/magic-link", async (request, reply) => {
    const body = magicLinkRequestSchema.parse(request.body);
    await requestMagicLink(body.email);
    return { ok: true, message: "If the email exists, a sign-in link was sent." };
  });

  app.get("/api/auth/magic-link/verify", async (request, reply) => {
    const token = (request.query as { token?: string }).token;
    if (!token) {
      return reply.code(400).send({ error: "Missing token" });
    }

    const user = await verifyMagicLink(token);
    if (!user) {
      return reply.code(400).send({ error: "Invalid or expired link" });
    }

    const tokens = await createSessionTokens(user);
    setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
    return { user: mapUser(user as never) };
  });

  app.post("/api/auth/refresh", async (request, reply) => {
    const refreshToken = request.cookies.refresh_token;
    if (!refreshToken) {
      return reply.code(401).send({ error: "No refresh token" });
    }

    const tokens = await refreshSession(refreshToken);
    if (!tokens) {
      return reply.code(401).send({ error: "Invalid refresh token" });
    }

    setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
    return { ok: true };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const refreshToken = request.cookies.refresh_token;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    reply.clearCookie("access_token", { path: "/" });
    reply.clearCookie("refresh_token", { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (request, reply) => {
    const user = await UserModel.findById(request.user!.sub);
    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }
    return { user: mapUser(user as never) };
  });

  app.post("/api/auth/configure-password", { preHandler: requireAuth }, async (request, reply) => {
    const { password } = request.body as { password?: string };
    if (!password || password.length < 6) {
      return reply.code(400).send({ error: "Password must be at least 6 characters long" });
    }

    const user = await UserModel.findById(request.user!.sub);
    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }

    user.passwordHash = await hashPassword(password);
    user.status = "active";
    await user.save();

    return { user: mapUser(user as never) };
  });
}
