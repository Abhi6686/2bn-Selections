import type { FastifyReply, FastifyRequest } from "fastify";
import type { AccessTokenPayload } from "../services/jwt.service.js";
import { verifyAccessToken } from "../services/jwt.service.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const cookieToken = request.cookies.access_token;
  const headerToken = request.headers.authorization?.replace("Bearer ", "");
  const token = cookieToken ?? headerToken;

  if (!token) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }

  try {
    request.user = await verifyAccessToken(token);
  } catch {
    reply.code(401).send({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return async function roleGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    console.info(`[auth] requireRole check: allowed=[${roles.join(", ")}], user=${request.user.email}, role=${request.user.role}`);
    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  };
}
