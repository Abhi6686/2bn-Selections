import { inviteUserSchema } from "@2bn/shared";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { UserModel } from "../models/User.js";
import { InviteModel } from "../models/Invite.js";
import { ActivityLogModel } from "../models/ActivityLog.js";
import { hashPassword } from "../services/auth.service.js";
import { generateSecureToken, hashToken } from "../utils/tokens.js";
import { buildInviteEmail, sendEmail } from "../services/email.service.js";
import { mapUser } from "../utils/mappers.js";

export async function registerUsersRoutes(app: FastifyInstance): Promise<void> {
  // Get all users in the organization (Admins and PMs only)
  app.get(
    "/api/users",
    { preHandler: [requireAuth, requireRole("admin", "project_manager")] },
    async (request, reply) => {
      const orgId = request.user!.orgId;
      if (!orgId) {
        return reply.code(400).send({ error: "User is not associated with an organization" });
      }

      const users = await UserModel.find({ orgId }).sort({ createdAt: -1 });
      return users.map((u) => mapUser(u as never));
    }
  );

  // Invite an Admin or PM to the organization (Admins only)
  app.post(
    "/api/users/invite",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const orgId = request.user!.orgId;
      if (!orgId) {
        return reply.code(400).send({ error: "User is not associated with an organization" });
      }

      const body = inviteUserSchema.parse(request.body);
      const email = body.email.toLowerCase();

      // Check if user already exists
      const existingUser = await UserModel.findOne({ email });
      if (existingUser) {
        return reply.code(400).send({ error: "User with this email already exists" });
      }

      // Create new user in invited state
      const newUser = await UserModel.create({
        email,
        name: body.name,
        role: body.role,
        orgId,
        status: "invited",
        passwordHash: await hashPassword(generateSecureToken()), // Temp random password
      });

      // Generate verification token
      const rawToken = generateSecureToken();
      await InviteModel.create({
        orgId,
        email,
        role: body.role,
        tokenHash: hashToken(rawToken),
        invitedBy: request.user!.sub,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      // Log the activity
      const actor = await UserModel.findById(request.user!.sub);
      await ActivityLogModel.create({
        orgId,
        userId: request.user!.sub,
        userName: actor?.name || "System Admin",
        action: "user_invited",
        details: `Invited ${body.name} (${email}) as ${body.role === "project_manager" ? "Project Manager" : "Admin"}`,
      });

      // Send invite email
      const link = `${env.webOrigin}/auth/magic?token=${rawToken}`;
      await sendEmail({
        to: email,
        subject: "Invitation to join 2bn Selections",
        html: buildInviteEmail(link, body.name, body.role === "project_manager" ? "Project Manager" : "Admin"),
      });

      return { user: mapUser(newUser as never) };
    }
  );

  // Get activity history for the organization (Admins only)
  app.get(
    "/api/users/activity",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const orgId = request.user!.orgId;
      if (!orgId) {
        return reply.code(400).send({ error: "User is not associated with an organization" });
      }

      const activities = await ActivityLogModel.find({ orgId })
        .sort({ createdAt: -1 })
        .limit(100);

      return activities.map((a) => ({
        id: a._id.toString(),
        userId: a.userId.toString(),
        userName: a.userName,
        action: a.action,
        details: a.details,
        createdAt: a.createdAt.toISOString(),
      }));
    }
  );
}
