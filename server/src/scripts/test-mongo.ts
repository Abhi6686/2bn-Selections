import { connectDatabase, disconnectDatabase } from "../db/connect.js";

async function main(): Promise<void> {
  console.info("Testing MongoDB connection...");
  await connectDatabase();
  console.info("SUCCESS — connected to MongoDB.");
  await disconnectDatabase();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
