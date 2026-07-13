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
  // Get all users in the organization (Admins only)
  app.get(
    "/api/users",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const orgId = request.user!.orgId;
      if (!orgId) {
        return reply.code(400).send({ error: "User is not associated with an organization" });
      }

      const users = await UserModel.find({ orgId }).sort({ createdAt: -1 });
      return users.map((u) => mapUser(u as never));
    }
  );

  // Invite or directly create an Admin or PM (Admins only)
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

      const sendEmailFlag = body.sendEmail !== false;

      let tempPassword = "";
      let passwordHash = "";

      if (!sendEmailFlag) {
        tempPassword = body.temporaryPassword || generateSecureToken().substring(0, 10);
        passwordHash = await hashPassword(tempPassword);
      } else {
        passwordHash = generateSecureToken(); // placeholder
      }

      // Create new user
      const newUser = await UserModel.create({
        email,
        name: body.name,
        role: body.role,
        orgId,
        status: sendEmailFlag ? "invited" : "active",
        passwordHash,
      });

      // Log the activity
      const actor = await UserModel.findById(request.user!.sub);
      await ActivityLogModel.create({
        orgId,
        userId: request.user!.sub,
        userName: actor?.name || "System Admin",
        action: sendEmailFlag ? "user_invited" : "user_created_offline",
        details: sendEmailFlag
          ? `Invited ${body.name} (${email}) as ${body.role === "project_manager" ? "Project Manager" : "Admin"}`
          : `Created ${body.name} (${email}) as ${body.role === "project_manager" ? "Project Manager" : "Admin"} offline`,
      });

      if (sendEmailFlag) {
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
      }

      return {
        user: mapUser(newUser as never),
        emailSent: sendEmailFlag,
        temporaryPassword: sendEmailFlag ? undefined : tempPassword,
        message: sendEmailFlag ? "Invitation queued successfully" : "User created offline successfully",
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

  // Set user password directly (Admins only)
  app.post(
    "/api/users/:userId/set-password",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const orgId = request.user!.orgId;
      const { userId } = request.params as { userId: string };
      const body = request.body as { password?: string };

      if (!body.password || body.password.length < 8) {
        return reply.code(400).send({ error: "Password must be at least 8 characters long" });
      }

      const user = await UserModel.findOne({ _id: userId, orgId });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      user.passwordHash = await hashPassword(body.password);
      if (user.status === "invited") {
        user.status = "active";
      }
      await user.save();

      // Invalidate any active invites for this user's email
      await InviteModel.deleteMany({ email: user.email.toLowerCase() });

      // Log the activity
      const actor = await UserModel.findById(request.user!.sub);
      await ActivityLogModel.create({
        orgId,
        userId: request.user!.sub,
        userName: actor?.name || "System Admin",
        action: "user_password_set",
        details: `Set password directly for ${user.name} (${user.email})`,
      });

      return { success: true, user: mapUser(user as never) };
    }
  );

  // Send password reset magic link (Admins only)
  app.post(
    "/api/users/:userId/send-reset",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const orgId = request.user!.orgId;
      const { userId } = request.params as { userId: string };

      const user = await UserModel.findOne({ _id: userId, orgId });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      // Generate verification token
      const rawToken = generateSecureToken();
      
      // Delete existing invites for this email to prevent duplicate tokens
      await InviteModel.deleteMany({ email: user.email.toLowerCase() });

      await InviteModel.create({
        orgId,
        email: user.email.toLowerCase(),
        role: user.role,
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
        action: "password_reset_sent",
        details: `Sent password reset invitation to ${user.name} (${user.email})`,
      });

      // Send email
      setImmediate(async () => {
        try {
          const link = `${env.webOrigin}/auth/magic?token=${rawToken}`;
          await sendEmail({
            to: user.email,
            subject: "Reset your 2bn Selections password",
            html: buildInviteEmail(link, user.name, user.role === "project_manager" ? "Project Manager" : "Admin"),
            orgId,
          });
          app.log.info(`[reset] Password reset email sent to ${user.email}`);
        } catch (emailErr) {
          app.log.error(emailErr, `[reset] Background password reset email failed for ${user.email}`);
        }
      });

      return { success: true, message: "Password reset link queued successfully" };
    }
  );

  // Resend user invitation (Admins only)
  app.post(
    "/api/users/:userId/resend-invite",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const orgId = request.user!.orgId;
      const { userId } = request.params as { userId: string };

      const user = await UserModel.findOne({ _id: userId, orgId });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      if (user.status !== "invited") {
        return reply.code(400).send({ error: "User is already registered and active" });
      }

      // Generate verification token
      const rawToken = generateSecureToken();

      // Delete existing invites for this email
      await InviteModel.deleteMany({ email: user.email.toLowerCase() });

      await InviteModel.create({
        orgId,
        email: user.email.toLowerCase(),
        role: user.role,
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
        action: "invite_resent",
        details: `Resent invitation email to ${user.name} (${user.email})`,
      });

      // Send email
      setImmediate(async () => {
        try {
          const link = `${env.webOrigin}/auth/magic?token=${rawToken}`;
          await sendEmail({
            to: user.email,
            subject: "Invitation to join 2bn Selections",
            html: buildInviteEmail(link, user.name, user.role === "project_manager" ? "Project Manager" : "Admin"),
            orgId,
          });
          app.log.info(`[resend] Invite email sent to ${user.email}`);
        } catch (emailErr) {
          app.log.error(emailErr, `[resend] Background invite email failed for ${user.email}`);
        }
      });

      return { success: true, message: "Invitation resent successfully" };
    }
  );
}
