import { connectDatabase, disconnectDatabase } from "../db/connect.js";
import { ProjectModel } from "../models/Project.js";
import { ProjectSelectionModel } from "../models/ProjectSelection.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { ChangeOrderModel } from "../models/ChangeOrder.js";
import { TimelineEventModel } from "../models/TimelineEvent.js";
import { BudgetSnapshotModel } from "../models/BudgetSnapshot.js";
import { InviteModel } from "../models/Invite.js";
import { MagicLinkTokenModel } from "../models/MagicLinkToken.js";
import { RefreshTokenModel } from "../models/RefreshToken.js";
import { ProjectMemberModel } from "../models/ProjectMember.js";
import { UserModel } from "../models/User.js";
import { ThemeModel } from "../models/Theme.js";

async function clean() {
  await connectDatabase();
  console.info("Cleaning selections, projects, and change orders...");
  
  await ProjectModel.deleteMany({});
  await ProjectSelectionModel.deleteMany({});
  await LibraryItemModel.deleteMany({});
  await ChangeOrderModel.deleteMany({});
  await TimelineEventModel.deleteMany({});
  await BudgetSnapshotModel.deleteMany({});
  await InviteModel.deleteMany({});
  await MagicLinkTokenModel.deleteMany({});
  await RefreshTokenModel.deleteMany({});
  await ProjectMemberModel.deleteMany({});
  
  // Wipe all end-user (homeowner) accounts to start fresh
  const usersWiped = await UserModel.deleteMany({ role: "end_user" });
  console.info(`Wiped ${usersWiped.deletedCount} homeowner user accounts.`);

  // Wipe seeded themes so we can re-populate them with custom tagWeights
  await ThemeModel.deleteMany({});
  console.info("Wiped old themes.");

  // Also clean the dynamic categories SelectionSection model if it exists
  try {
    const mongoose = await import("mongoose");
    if (mongoose.connection.models["SelectionSection"]) {
      await mongoose.connection.models["SelectionSection"].deleteMany({});
      console.info("Wiped categories database.");
    }
  } catch (err) {}

  console.info("Database clean completed successfully!");
  await disconnectDatabase();
}

clean().catch((error) => {
  console.error("Clean script failed:", error);
  process.exit(1);
});
