import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { UserModel } from "../models/User.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI in environment");
    process.exit(1);
  }

  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(uri);
  console.log("Connected!");

  const users = await UserModel.find({});
  console.log(`Found ${users.length} users:`);
  for (const user of users) {
    console.log(`- Email: ${user.email}, Role: ${user.role}, Status: ${user.status}, OrgId: ${user.orgId}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(console.error);
