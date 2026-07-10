import { connectDatabase, disconnectDatabase } from "../db/connect.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { UserModel } from "../models/User.js";

async function main() {
  await connectDatabase();
  const items = await LibraryItemModel.find({});
  console.log(`Total library items in DB: ${items.length}`);
  for (const item of items) {
    if (item.categoryKey.includes("Roof")) {
      console.log(`- [Roof Item] ID: ${item._id}, categoryKey: "${item.categoryKey}", category: "${item.category}", selectionSlot: "${item.selectionSlot}", manufacturer: "${item.manufacturer}", model: "${item.model}", active: ${item.active}, isDeleted: ${item.isDeleted}, orgId: ${item.orgId}`);
    }
  }
  
  const homeowner = await UserModel.findOne({ email: "homeowner@2bncontracting.com" });
  console.log(`Homeowner User in DB:`, homeowner ? { _id: homeowner._id, email: homeowner.email, orgId: homeowner.orgId } : "Not found");
  
  await disconnectDatabase();
}

main().catch(console.error);
