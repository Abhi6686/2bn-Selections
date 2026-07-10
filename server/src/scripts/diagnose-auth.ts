import { connectDatabase, disconnectDatabase } from "../db/connect.js";
import { UserModel } from "../models/User.js";
import argon2 from "argon2";

async function main(): Promise<void> {
  console.info("Connecting to MongoDB...");
  await connectDatabase();

  const emails = ["admin@stepron.com", "client@2bncontracting.com", "homeowner@2bncontracting.com"];
  const passwords = {
    "admin@stepron.com": "2BN-Admin-2026!",
    "client@2bncontracting.com": "2BN-Client-2026!",
    "homeowner@2bncontracting.com": "2BN-Homeowner-2026!",
  } as Record<string, string>;

  for (const email of emails) {
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.error(`User ${email} NOT FOUND in database`);
      continue;
    }
    console.info(`Found user: ${email}`);
    console.info(`  status: ${user.status}`);
    console.info(`  passwordHash: ${user.passwordHash ? user.passwordHash.substring(0, 20) + "..." : "MISSING"}`);

    if (user.passwordHash) {
      const testPassword = passwords[email];
      const valid = await argon2.verify(user.passwordHash, testPassword);
      console.info(`  Password "${testPassword}" is VALID: ${valid}`);
    } else {
      console.warn(`  No passwordHash set! Setting now...`);
      user.passwordHash = await argon2.hash(passwords[email]);
      user.status = "active";
      await user.save();
      console.info(`  Password set successfully.`);
    }
  }

  await disconnectDatabase();
  console.info("Done.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
