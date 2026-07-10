import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDatabase, disconnectDatabase } from "../db/connect.js";
import { env } from "../config/env.js";
import { OrganizationModel } from "../models/Organization.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { ThemeModel } from "../models/Theme.js";
import { ProjectModel } from "../models/Project.js";
import { ProjectSelectionModel } from "../models/ProjectSelection.js";
import { UserModel } from "../models/User.js";
import { ensureSeedUser } from "../services/auth.service.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const libraryJsonPath = path.resolve(
  currentDirectory,
  "../../../src/data/selectionLibrary.json",
);
const masterCategoriesPath = path.resolve(
  currentDirectory,
  "../../../src/data/masterCategories.json",
);

interface RawLibraryItem {
  category: string;
  categoryKey?: string;
  selectionSlot?: string;
  manufacturer: string;
  model: string;
  product: string;
  finish: string;
  priceMin: number;
  priceMax: number;
  group?: string;
  optional?: boolean;
  imageUrl?: string;
}

async function seed(): Promise<void> {
  await connectDatabase();

  const org =
    (await OrganizationModel.findOne({ slug: "2bn" })) ??
    (await OrganizationModel.create({
      name: "2BN Contracting",
      slug: "2bn",
      status: "active",
    }));

  console.info(`Organization: ${org.name} (${org._id})`);

  await ensureSeedUser({
    email: env.seedAdminEmail,
    name: "Stepron Admin",
    role: "admin",
    password: env.seedAdminPassword,
  });

  const client = await ensureSeedUser({
    email: env.seedClientEmail,
    name: "2BN Client",
    role: "client",
    password: env.seedClientPassword,
    orgId: org._id,
  });

  console.info(`Admin: ${env.seedAdminEmail}`);
  console.info(`Client: ${env.seedClientEmail}`);

  const libraryData = JSON.parse(fs.readFileSync(libraryJsonPath, "utf-8")) as {
    levels: Record<string, { items: RawLibraryItem[] }>;
    meta: { vendor: string };
  };

  const masterData = JSON.parse(fs.readFileSync(masterCategoriesPath, "utf-8")) as {
    meta: { styleThemesFromDocument: string[] };
  };

  let libraryCount = 0;
  for (const level of ["1", "2", "3"]) {
    const levelItems = libraryData.levels[level]?.items ?? [];
    for (const rawItem of levelItems) {
      const legacyId = `lib-${level}-${rawItem.model.replace(/\s+/g, "-")}`;
      let category = rawItem.category;
      let selectionSlot = rawItem.selectionSlot;
      let categoryKey = rawItem.categoryKey;

      if (category === "Kitchen - Appliances" && selectionSlot === "JVM3160RFSS") {
        selectionSlot = "Microwave";
        categoryKey = "Kitchen - Appliances - Microwave";
      } else if (category === "Kitchen - Appliances" && selectionSlot === "ZIP364") {
        selectionSlot = "Refrigerator";
        categoryKey = "Kitchen - Appliances - Refrigerator";
      } else if (category === "Kitchen - Appliances" && selectionSlot === "ZDP364") {
        selectionSlot = "Range / Cooking";
        categoryKey = "Kitchen - Appliances - Range / Cooking";
      } else if (category === "Kitchen - Appliances" && selectionSlot === "ZDT925") {
        selectionSlot = "Dishwasher";
        categoryKey = "Kitchen - Appliances - Dishwasher";
      } else if (category === "Kitchen - Sink & Faucet" && selectionSlot === "Faucet") {
        category = "Kitchen - Kitchen Sink & Faucet";
        selectionSlot = "Faucet style";
        categoryKey = "Kitchen - Kitchen Sink & Faucet - Faucet style";
      } else if (category === "Bathroom - Plumbing Fixtures" && selectionSlot === "Faucet") {
        category = "Bathroom - Faucets";
        selectionSlot = "Style";
        categoryKey = "Bathroom - Faucets - Style";
      } else if (category === "Bathroom - Plumbing Fixtures" && selectionSlot === "Shower / Tub") {
        category = "Bathroom - Shower";
        selectionSlot = "Shower head";
        categoryKey = "Bathroom - Shower - Shower head";
      } else if (category === "Bathroom - Plumbing Fixtures" && selectionSlot === "Toilet") {
        category = "Bathroom - Toilet";
        selectionSlot = "Comfort height";
        categoryKey = "Bathroom - Toilet - Comfort height";
      }

      if (!categoryKey) {
        categoryKey = selectionSlot ? `${category} - ${selectionSlot}` : category;
      }

      await LibraryItemModel.findOneAndUpdate(
        { orgId: org._id, legacyId },
        {
          orgId: org._id,
          category,
          categoryKey,
          selectionSlot,
          manufacturer: rawItem.manufacturer,
          model: rawItem.model,
          product: rawItem.product,
          finish: rawItem.finish,
          priceMin: rawItem.priceMin,
          priceMax: rawItem.priceMax,
          level,
          imageUrl: rawItem.imageUrl,
          vendor: libraryData.meta.vendor,
          legacyId,
          active: true,
          custom: false,
        },
        { upsert: true, new: true },
      );
      libraryCount += 1;
    }
  }

  console.info(`Seeded ${libraryCount} library items`);

  for (const themeName of masterData.meta.styleThemesFromDocument) {
    const tag = themeName.toLowerCase();
    await ThemeModel.findOneAndUpdate(
      { orgId: org._id, name: themeName },
      {
        orgId: org._id,
        name: themeName,
        description: `Style theme from Master Selections List`,
        tagWeights: new Map([[tag, 10]]),
        active: true,
      },
      { upsert: true },
    );
  }
  console.info(`Seeded ${masterData.meta.styleThemesFromDocument.length} themes`);

  // Seed dynamic selection sections
  const { SelectionSectionModel } = await import("../models/SelectionSection.js");
  const existingSectionsCount = await SelectionSectionModel.countDocuments({ orgId: org._id });
  if (existingSectionsCount === 0) {
    const masterCategories = JSON.parse(fs.readFileSync(masterCategoriesPath, "utf-8")) as { sections: any[] };
    for (const sec of masterCategories.sections) {
      await SelectionSectionModel.create({
        orgId: org._id,
        order: sec.order,
        name: sec.name,
        slug: sec.slug,
        groups: sec.groups || [],
      });
    }
    console.info(`Seeded ${masterCategories.sections.length} selection sections from master list.`);
  }

  console.info(`Default client user id: ${(client as { _id: { toString(): string } })._id}`);

  // Seed Test Homeowner User
  const homeowner = await ensureSeedUser({
    email: "homeowner@2bncontracting.com",
    name: "John Doe (Homeowner)",
    role: "end_user",
    password: "2BN-Homeowner-2026!",
    orgId: org._id,
  });
  console.info(`Seeded Homeowner User: homeowner@2bncontracting.com / 2BN-Homeowner-2026!`);

  // Seed Test Project
  const existingProject = await ProjectModel.findOne({ orgId: org._id, name: "Highland Estate Custom Build" });
  let project;
  if (!existingProject) {
    const defaultTheme = await ThemeModel.findOne({ orgId: org._id });
    project = await ProjectModel.create({
      orgId: org._id,
      name: "Highland Estate Custom Build",
      clientName: "John Doe",
      address: "123 Luxury Hill Drive, Seattle, WA",
      ownerClientId: client._id,
      endUserIds: [homeowner._id],
      themeId: defaultTheme?._id,
      status: "active",
      initialBudget: 120000,
      currentBudget: 120000,
    });
    console.info(`Seeded Test Project: ${project.name}`);

    // Seed some initial draft selections so the visualizer has some colors
    const fridgeItem = await LibraryItemModel.findOne({ orgId: org._id, categoryKey: "Kitchen - Appliances - Refrigerator" });
    if (fridgeItem) {
      await ProjectSelectionModel.create({
        projectId: project._id,
        categoryKey: "Kitchen - Appliances - Refrigerator",
        state: "confirmed",
        libraryItemId: fridgeItem._id,
        manufacturer: fridgeItem.manufacturer,
        model: fridgeItem.model,
        product: fridgeItem.product,
        priceUsed: fridgeItem.priceMin,
        level: fridgeItem.level,
        finish: fridgeItem.finish,
        imageUrl: fridgeItem.imageUrl,
        selectedBy: homeowner._id,
        quantity: 1,
        slotLabel: "Main Kitchen",
      });
    }

    const faucetItem = await LibraryItemModel.findOne({ orgId: org._id, categoryKey: "Bathroom - Faucets - Style" });
    if (faucetItem) {
      await ProjectSelectionModel.create({
        projectId: project._id,
        categoryKey: "Bathroom - Faucets - Style",
        state: "confirmed",
        libraryItemId: faucetItem._id,
        manufacturer: faucetItem.manufacturer,
        model: faucetItem.model,
        product: faucetItem.product,
        priceUsed: faucetItem.priceMin,
        level: faucetItem.level,
        finish: faucetItem.finish,
        imageUrl: faucetItem.imageUrl,
        selectedBy: homeowner._id,
        quantity: 1,
        slotLabel: "Master Bath",
      });
    }
  } else {
    project = existingProject;
    console.info(`Test Project already exists: ${project.name}`);
  }

  await disconnectDatabase();
  console.info("Seed complete.");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
