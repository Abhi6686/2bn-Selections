import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { OrganizationModel } from "../models/Organization.js";
import nodemailer from "nodemailer";
import dns from "node:dns";

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
        hasResendApiKey: !!org.resendApiKey,
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
        resendApiKey?: string;
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

      // Only update Resend API Key if they sent a new non-empty key
      if (body.resendApiKey !== undefined && body.resendApiKey.trim() !== "" && body.resendApiKey !== "••••••••") {
        org.resendApiKey = body.resendApiKey;
      } else if (body.resendApiKey === "") {
        org.resendApiKey = ""; // allow clearing
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
          hasResendApiKey: !!org.resendApiKey,
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
          family: 4, // Force IPv4 to bypass Render IPv6 routing issues
          lookup: (hostname, options, callback) => dns.lookup(hostname, { family: 4 }, callback),
          auth: {
            user: body.smtpUser,
            pass: password,
          },
        } as any);

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

  // Test custom Resend configuration before saving (Admin only)
  app.post(
    "/api/settings/test-resend",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const body = request.body as {
        resendApiKey?: string;
        smtpFrom?: string;
        testTo: string;
      };

      const orgId = request.user!.orgId;
      if (!orgId) {
        return reply.code(400).send({ error: "User is not associated with an organization" });
      }

      let apiKey = body.resendApiKey;
      if (!apiKey || apiKey === "••••••••") {
        const org = await OrganizationModel.findById(orgId);
        if (org && org.resendApiKey) {
          apiKey = org.resendApiKey;
        }
      }

      if (!apiKey) {
        return reply.code(400).send({ error: "Missing Resend API Key" });
      }

      const fromEmail = body.smtpFrom || "onboarding@resend.dev";
      const testDestination = body.testTo;

      try {
        const resendBody = {
          from: fromEmail,
          to: [testDestination],
          subject: "2bn Selections — Resend Realtime Diagnostic Test",
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #C5A028; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              <h2 style="color: #0f3e20; margin-top: 0; border-bottom: 2px solid #C5A028; padding-bottom: 8px;">Resend Diagnostic Success!</h2>
              <p>Your custom Resend HTTP API email configuration has been tested successfully!</p>
              <div style="background-color: #f5f7f5; padding: 12px; border-radius: 6px; font-size: 13px; color: #444; border-left: 4px solid #0f3e20; margin: 16px 0;">
                <strong>API Provider:</strong> Resend (HTTP Port 443)<br/>
                <strong>Tested Sender:</strong> ${fromEmail}<br/>
                <strong>Tested Destination:</strong> ${testDestination}
              </div>
              <p style="font-size: 12px; color: #666; margin-bottom: 0;">This email confirms that your configuration is correct and bypasses Render SMTP port blocks. You can now save your settings.</p>
            </div>
          `,
        };

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(resendBody),
        });

        if (!response.ok) {
          const errText = await response.text();
          return reply.code(400).send({
            success: false,
            error: `Resend HTTP API error (status ${response.status}): ${errText}`,
          });
        }

        return { success: true, message: `Diagnostic test email sent successfully to ${testDestination} via Resend` };
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
