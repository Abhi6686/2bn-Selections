import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

const secretKey = new TextEncoder().encode(env.jwtSecret);

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  orgId?: string;
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(env.jwtAccessExpires)
    .sign(secretKey);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey);
  return {
    sub: String(payload.sub),
    email: String(payload.email),
    role: String(payload.role),
    orgId: payload.orgId ? String(payload.orgId) : undefined,
  };
}
