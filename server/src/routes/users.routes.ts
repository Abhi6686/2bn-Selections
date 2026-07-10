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
        passwordHash: generateSecureToken(), // No need to hash a temp password since status is "invited"
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

      // Send invite email in background (asynchronously)
      setImmediate(async () => {
        try {
          const link = `${env.webOrigin}/auth/magic?token=${rawToken}`;
          await sendEmail({
            to: email,
            subject: "Invitation to join 2bn Selections",
            html: buildInviteEmail(link, body.name, body.role === "project_manager" ? "Project Manager" : "Admin"),
            orgId,
          });
          app.log.info(`[invite] Invitation email sent to ${email}`);
        } catch (emailErr) {
          app.log.error(emailErr, `[invite] Background invitation email failed for ${email}`);
        }
      });

      return {
        user: mapUser(newUser as never),
        emailSent: true,
        message: "Invitation queued successfully",
      };

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

  // Soft-delete user to recycle bin (blocked status)
  app.delete(
    "/api/users/:userId",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const orgId = request.user!.orgId;
      const { userId } = request.params as { userId: string };

      const user = await UserModel.findOne({ _id: userId, orgId });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      if (user._id.toString() === request.user!.sub) {
        return reply.code(400).send({ error: "You cannot delete yourself" });
      }

      const previousStatus = user.status;
      user.status = "blocked";
      await user.save();

      // Log the activity
      const actor = await UserModel.findById(request.user!.sub);
      await ActivityLogModel.create({
        orgId,
        userId: request.user!.sub,
        userName: actor?.name || "System Admin",
        action: "user_deleted",
        details: `Moved ${user.name} (${user.email}) to Recycle Bin (status changed from ${previousStatus} to blocked)`,
      });

      return { success: true, user: mapUser(user as never) };
    }
  );

  // Restore user from recycle bin
  app.post(
    "/api/users/:userId/restore",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const orgId = request.user!.orgId;
      const { userId } = request.params as { userId: string };

      const user = await UserModel.findOne({ _id: userId, orgId });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      if (user.status !== "blocked") {
        return reply.code(400).send({ error: "User is not in the Recycle Bin" });
      }

      // If they have a password configured (and not the placeholder), active, else invited
      const restoredStatus = user.passwordHash && user.passwordHash.length > 30 ? "active" : "invited";
      user.status = restoredStatus;
      await user.save();

      // Log the activity
      const actor = await UserModel.findById(request.user!.sub);
      await ActivityLogModel.create({
        orgId,
        userId: request.user!.sub,
        userName: actor?.name || "System Admin",
        action: "user_restored",
        details: `Restored ${user.name} (${user.email}) from Recycle Bin (status changed to ${restoredStatus})`,
      });

      return { success: true, user: mapUser(user as never) };
    }
  );

  // Permanently delete user from database
  app.delete(
    "/api/users/:userId/permanent",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const orgId = request.user!.orgId;
      const { userId } = request.params as { userId: string };

      const user = await UserModel.findOne({ _id: userId, orgId });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      if (user.status !== "blocked") {
        return reply.code(400).send({ error: "Only blocked users in the Recycle Bin can be permanently deleted" });
      }

      await UserModel.deleteOne({ _id: userId });

      // Log the activity
      const actor = await UserModel.findById(request.user!.sub);
      await ActivityLogModel.create({
        orgId,
        userId: request.user!.sub,
        userName: actor?.name || "System Admin",
        action: "user_permanently_deleted",
        details: `Permanently deleted ${user.name} (${user.email}) from the database`,
      });

      return { success: true };
    }
  );
}
