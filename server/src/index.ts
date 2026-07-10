import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./db/connect.js";

async function main(): Promise<void> {
  await connectDatabase();
  const app = await buildApp();

  await app.listen({ port: env.port, host: env.host });
  app.log.info(`API listening on http://${env.host}:${env.port}`);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
