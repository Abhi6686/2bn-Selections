import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { OrganizationModel } from "../models/Organization.js";
import nodemailer from "nodemailer";

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  // Get org settings (Admin only)
  app.get(
    "/api/settings/org",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const orgId = request.user!.orgId;
      if (!orgId) {
        return reply.code(400).send({ error: "User is not associated with an organization" });
      }

      const org = await OrganizationModel.findById(orgId);
      if (!org) {
        return reply.code(404).send({ error: "Organization not found" });
      }

      return {
        id: org._id.toString(),
        name: org.name,
        slug: org.slug,
        smtpHost: org.smtpHost || "",
        smtpPort: org.smtpPort || 587,
        smtpUser: org.smtpUser || "",
        smtpFrom: org.smtpFrom || "",
        hasSmtpPass: !!org.smtpPass,
      };
    }
  );

  // Update org settings (Admin only)
  app.put(
    "/api/settings/org",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const orgId = request.user!.orgId;
      if (!orgId) {
        return reply.code(400).send({ error: "User is not associated with an organization" });
      }

      const body = request.body as {
        name?: string;
        smtpHost?: string;
        smtpPort?: number;
        smtpUser?: string;
        smtpPass?: string;
        smtpFrom?: string;
      };

      const org = await OrganizationModel.findById(orgId);
      if (!org) {
        return reply.code(404).send({ error: "Organization not found" });
      }

      if (body.name !== undefined) org.name = body.name;
      if (body.smtpHost !== undefined) org.smtpHost = body.smtpHost;
      if (body.smtpPort !== undefined) org.smtpPort = Number(body.smtpPort);
      if (body.smtpUser !== undefined) org.smtpUser = body.smtpUser;
      if (body.smtpFrom !== undefined) org.smtpFrom = body.smtpFrom;

      // Only update password if they sent a new non-empty password
      if (body.smtpPass !== undefined && body.smtpPass.trim() !== "" && body.smtpPass !== "••••••••") {
        org.smtpPass = body.smtpPass;
      }

      await org.save();

      return {
        success: true,
        org: {
          id: org._id.toString(),
          name: org.name,
          slug: org.slug,
          smtpHost: org.smtpHost || "",
          smtpPort: org.smtpPort || 587,
          smtpUser: org.smtpUser || "",
          smtpFrom: org.smtpFrom || "",
          hasSmtpPass: !!org.smtpPass,
        },
      };
    }
  );

  // Test custom SMTP configuration before saving (Admin only)
  app.post(
    "/api/settings/test-smtp",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const body = request.body as {
        smtpHost: string;
        smtpPort: number;
        smtpUser: string;
        smtpPass?: string; // If empty/masked, try to load saved password from DB
        smtpFrom: string;
        testTo: string;
      };

      const orgId = request.user!.orgId;
      if (!orgId) {
        return reply.code(400).send({ error: "User is not associated with an organization" });
      }

      let password = body.smtpPass;
      if (!password || password === "••••••••") {
        const org = await OrganizationModel.findById(orgId);
        if (org && org.smtpPass) {
          password = org.smtpPass;
        }
      }

      if (!body.smtpHost || !body.smtpPort || !body.smtpUser || !password) {
        return reply.code(400).send({ error: "Missing required SMTP credentials" });
      }

      try {
        const testTransporter = nodemailer.createTransport({
          host: body.smtpHost,
          port: Number(body.smtpPort),
          secure: Number(body.smtpPort) === 465,
          auth: {
            user: body.smtpUser,
            pass: password,
          },
        });

        const testDestination = body.testTo || body.smtpUser;

        await testTransporter.sendMail({
          from: body.smtpFrom || body.smtpUser,
          to: testDestination,
          subject: "2bn Selections — SMTP Realtime Diagnostic Test",
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #C5A028; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              <h2 style="color: #0f3e20; margin-top: 0; border-bottom: 2px solid #C5A028; padding-bottom: 8px;">SMTP Diagnostic Success!</h2>
              <p>Your custom SMTP email configuration has been tested successfully!</p>
              <div style="background-color: #f5f7f5; padding: 12px; border-radius: 6px; font-size: 13px; color: #444; border-left: 4px solid #0f3e20; margin: 16px 0;">
                <strong>Tested Host:</strong> ${body.smtpHost}<br/>
                <strong>Tested Port:</strong> ${body.smtpPort}<br/>
                <strong>Tested User:</strong> ${body.smtpUser}<br/>
                <strong>Tested From:</strong> ${body.smtpFrom || body.smtpUser}
              </div>
              <p style="font-size: 12px; color: #666; margin-bottom: 0;">This email confirms that your configuration is correct. You can now save your settings.</p>
            </div>
          `,
        });

        return { success: true, message: `Diagnostic test email sent successfully to ${testDestination}` };
      } catch (err: any) {
        return reply.code(500).send({
          success: false,
          error: err?.message || String(err),
          details: err,
        });
      }
    }
  );
}
