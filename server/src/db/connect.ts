import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "../config/env.js";

function configureDnsForAtlas(): void {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  dns.setDefaultResultOrder("ipv4first");
}

function formatMongoConnectionError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const isSrvFailure =
    message.includes("querySrv") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND");

  if (isSrvFailure) {
    return new Error(
      [
        "MongoDB connection failed (DNS SRV lookup).",
        "",
        "This is common on Windows networks that block SRV DNS queries.",
        "",
        "Fix — use Atlas STANDARD connection string (not mongodb+srv):",
        "  1. Atlas → your cluster → Connect → Drivers",
        "  2. Choose \"Standard connection string\" (or copy the non-SRV URI)",
        "  3. Add to .env as MONGODB_URI= (replace the mongodb+srv:// line)",
        "",
        "Also verify:",
        "  - Atlas cluster is Running (not Paused)",
        "  - Network Access allows your IP (or 0.0.0.0/0 for testing)",
        "  - Username/password are correct",
        "",
        `Original error: ${message}`,
      ].join("\n"),
    );
  }

  return error instanceof Error ? error : new Error(message);
}

export async function connectDatabase(): Promise<void> {
  configureDnsForAtlas();
  mongoose.set("strictQuery", true);

  const connectionCandidates = [env.mongodbUri, env.mongodbUriStandard].filter(
    (uri): uri is string => Boolean(uri),
  );

  let lastError: unknown;

  for (const uri of connectionCandidates) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15_000,
        connectTimeoutMS: 15_000,
        maxPoolSize: 20,
        minPoolSize: 2,
        socketTimeoutMS: 45_000,
      });
      return;
    } catch (error) {
      lastError = error;
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    }
  }

  throw formatMongoConnectionError(lastError);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
