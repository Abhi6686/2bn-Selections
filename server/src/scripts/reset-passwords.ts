import { connectDatabase, disconnectDatabase } from "../db/connect.js";
import { UserModel } from "../models/User.js";
import { hashPassword } from "../services/auth.service.js";

async function main(): Promise<void> {
  console.info("Connecting to MongoDB to reset passwords...");
  await connectDatabase();

  const usersToReset = [
    { email: "admin@stepron.com", password: "2BN-Admin-2026!" },
    { email: "client@2bncontracting.com", password: "2BN-Client-2026!" },
    { email: "homeowner@2bncontracting.com", password: "2BN-Homeowner-2026!" }
  ];

  for (const item of usersToReset) {
    const user = await UserModel.findOne({ email: item.email.toLowerCase() });
    if (user) {
      user.passwordHash = await hashPassword(item.password);
      await user.save();
      console.info(`Successfully reset password for ${item.email}`);
    } else {
      console.warn(`User ${item.email} not found in database!`);
    }
  }

  await disconnectDatabase();
  console.info("Password reset complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
