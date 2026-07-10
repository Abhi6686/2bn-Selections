import type { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { UserModel } from "../models/User.js";
import { sendEmail } from "../services/email.service.js";
import { env } from "../config/env.js";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => ({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  }));

  app.get("/api/health/test-email", async (request, reply) => {
    const to = (request.query as any).to || "prosynctool@gmail.com";
    try {
      await sendEmail({
        to,
        subject: "2bn Selections - SMTP Diagnostic Test",
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>SMTP Diagnostic Test</h2>
            <p>If you are reading this, your email configuration on Render is working perfectly!</p>
            <hr/>
            <h3>Configuration Used:</h3>
            <ul>
              <li><strong>SMTP Host:</strong> ${env.smtpHost}</li>
              <li><strong>SMTP Port:</strong> ${env.smtpPort}</li>
              <li><strong>SMTP User:</strong> ${env.smtpUser}</li>
              <li><strong>SMTP From:</strong> ${env.smtpFrom}</li>
            </ul>
          </div>
        `,
      });
      return { success: true, message: `Test email successfully sent to ${to}` };
    } catch (err: any) {
      return reply.code(500).send({
        success: false,
        error: err?.message || String(err),
        details: err,
        config: {
          smtpHost: env.smtpHost,
          smtpPort: env.smtpPort,
          smtpUser: env.smtpUser,
          smtpFrom: env.smtpFrom,
        }
      });
    }
  });

  // TEMPORARY: debug endpoint — remove after fixing production auth
  app.get("/api/health/debug", async () => {
    const dbName = mongoose.connection.db?.databaseName ?? "unknown";
    const users = await UserModel.find({}, { email: 1, status: 1, passwordHash: 1, role: 1 }).lean();
    return {
      dbName,
      users: users.map((u) => ({
        email: u.email,
        status: u.status,
        role: u.role,
        hasPassword: !!u.passwordHash,
        passwordHashPrefix: u.passwordHash ? u.passwordHash.substring(0, 15) : null,
      })),
    };
  });
}
