import argon2 from "argon2";
import type { Types } from "mongoose";
import { env } from "../config/env.js";
import { MagicLinkTokenModel } from "../models/MagicLinkToken.js";
import { RefreshTokenModel } from "../models/RefreshToken.js";
import { UserModel } from "../models/User.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserRecord = any;
import { generateSecureToken, hashToken } from "../utils/tokens.js";
import { buildMagicLinkEmail, sendEmail } from "./email.service.js";
import { signAccessToken, type AccessTokenPayload } from "./jwt.service.js";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return argon2.verify(passwordHash, password);
}

export async function authenticateWithPassword(
  email: string,
  password: string,
): Promise<UserRecord> {
  const user = await UserModel.findOne({ email: email.toLowerCase(), status: "active" });
  if (!user?.passwordHash) {
    return null;
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return null;
  }
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export async function createSessionTokens(user: NonNullable<UserRecord>): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const payload: AccessTokenPayload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
    orgId: user.orgId?.toString(),
  };

  const accessToken = await signAccessToken(payload);
  const refreshToken = generateSecureToken();

  await RefreshTokenModel.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return { accessToken, refreshToken };
}

export async function refreshSession(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  const tokenRecord = await RefreshTokenModel.findOne({
    tokenHash: hashToken(refreshToken),
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!tokenRecord) {
    return null;
  }

  const user = await UserModel.findById(tokenRecord.userId);
  if (!user || user.status !== "active") {
    return null;
  }

  tokenRecord.revokedAt = new Date();
  await tokenRecord.save();

  return createSessionTokens(user);
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  await RefreshTokenModel.updateOne(
    { tokenHash: hashToken(refreshToken) },
    { revokedAt: new Date() },
  );
}

export async function requestMagicLink(email: string): Promise<void> {
  const user = await UserModel.findOne({ email: email.toLowerCase(), status: "active" });
  if (!user) {
    return;
  }

  const rawToken = generateSecureToken();
  await MagicLinkTokenModel.create({
    userId: user._id,
    tokenHash: hashToken(rawToken),
    purpose: "login",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  const link = `${env.webOrigin}/auth/magic?token=${rawToken}`;
  await sendEmail({
    to: user.email,
    subject: "Your 2bn Selections sign-in link",
    html: buildMagicLinkEmail(link),
    orgId: user.orgId?.toString(),
  });
}

export async function verifyMagicLink(rawToken: string): Promise<UserRecord> {
  const tokenHash = hashToken(rawToken);

  // 1. Try standard magic link login
  const tokenRecord = await MagicLinkTokenModel.findOne({
    tokenHash,
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (tokenRecord) {
    tokenRecord.usedAt = new Date();
    await tokenRecord.save();

    const user = await UserModel.findById(tokenRecord.userId);
    if (!user || user.status !== "active") {
      return null;
    }

    user.lastLoginAt = new Date();
    await user.save();
    return user;
  }

  // 2. Try invitation verification
  const inviteRecord = await import("../models/Invite.js").then((m) =>
    m.InviteModel.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    }),
  );

  if (inviteRecord) {
    const user = await UserModel.findOne({
      email: inviteRecord.email.toLowerCase(),
    });

    if (!user) {
      return null;
    }

    if (user.status === "invited") {
      user.status = "active";
    }
    user.lastLoginAt = new Date();
    await user.save();

    await inviteRecord.deleteOne();
    return user;
  }

  return null;
}

export async function ensureSeedUser(input: {
  email: string;
  name: string;
  role: "admin" | "client" | "end_user";
  password: string;
  orgId?: Types.ObjectId;
}): Promise<NonNullable<UserRecord>> {
  const existing = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    return existing;
  }

  return UserModel.create({
    email: input.email.toLowerCase(),
    name: input.name,
    role: input.role,
    orgId: input.orgId,
    passwordHash: await hashPassword(input.password),
    status: "active",
  });
}
