import type { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { UserModel } from "../models/User.js";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => ({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  }));

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
