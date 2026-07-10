import { createLibraryItemSchema, updateLibraryItemSchema } from "@2bn/shared";
import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { ProjectModel } from "../models/Project.js";
import { SelectionSectionModel } from "../models/SelectionSection.js";
import { ThemeModel } from "../models/Theme.js";
import { verifyAccessToken } from "../services/jwt.service.js";
import { scoreLibraryItems, sortByRecommendation } from "../services/recommendation.service.js";
import { mapLibraryItem } from "../utils/mappers.js";
import masterCategories from "../../../src/data/masterCategories.json" with { type: "json" };

export async function registerLibraryRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/master-categories", async (request) => {
    let orgId: string | undefined;
    const cookieToken = request.cookies.access_token;
    const headerToken = request.headers.authorization?.replace("Bearer ", "");
    const token = cookieToken ?? headerToken;
    if (token) {
      try {
        const decoded = await verifyAccessToken(token);
        orgId = decoded.orgId;
      } catch {}
    }

    if (!orgId) {
      const { OrganizationModel } = await import("../models/Organization.js");
      const defaultOrg = await OrganizationModel.findOne({ slug: "2bn" });
      if (defaultOrg) {
        orgId = defaultOrg._id.toString();
      }
    }

    const sections = await SelectionSectionModel.find({ orgId }).sort({ order: 1 });
    const themes = await ThemeModel.find({ orgId, active: true });

    const returnedSections = sections.length > 0 ? sections : masterCategories.sections;
    const styleThemes = themes.length > 0 
      ? themes.map(t => t.name) 
      : masterCategories.meta.styleThemesFromDocument;

    const flatCategoriesSet = new Set<string>();
    for (const section of returnedSections) {
      if (section.groups) {
        for (const group of section.groups) {
          if (group.categoryKey) {
            flatCategoriesSet.add(group.categoryKey);
          }
          if (group.subgroups) {
            for (const sub of group.subgroups) {
              if (sub.categoryKey) {
                flatCategoriesSet.add(sub.categoryKey);
              }
            }
          }
        }
      }
    }

    return {
      sections: returnedSections,
      flatCategories: Array.from(flatCategoriesSet),
      styleThemes,
    };
  });

  app.post(
    "/api/master-categories/sections",
    { preHandler: [requireAuth, requireRole("admin", "client")] },
    async (request, reply) => {
      const user = request.user!;
      let orgId = user.orgId;
      if (!orgId && user.role === "admin") {
        const { OrganizationModel } = await import("../models/Organization.js");
        const defaultOrg = await OrganizationModel.findOne({ slug: "2bn" });
        if (defaultOrg) {
          orgId = defaultOrg._id.toString();
        }
      }

      const body = request.body as {
        name: string;
        order?: number;
        groups?: any[];
      };

      if (!body.name) {
        return reply.code(400).send({ error: "Section name is required" });
      }

      let order = body.order;
      if (order === undefined) {
        const lastSection = await SelectionSectionModel.findOne({ orgId }).sort({ order: -1 });
        order = lastSection ? lastSection.order + 1 : 1;
      }

      const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      const section = await SelectionSectionModel.create({
        orgId,
        name: body.name,
        slug,
        order,
        groups: body.groups || [],
      });

      return { section };
    }
  );

  app.patch(
    "/api/master-categories/sections/:id",
    { preHandler: [requireAuth, requireRole("admin", "client")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const filter: Record<string, unknown> = { _id: id };
      if (user.orgId) {
        filter.orgId = user.orgId;
      }

      const section = await SelectionSectionModel.findOne(filter);
      if (!section) {
        return reply.code(404).send({ error: "Section not found" });
      }

      const body = request.body as {
        name?: string;
        order?: number;
        groups?: any[];
      };

      if (body.name !== undefined) {
        section.name = body.name;
        section.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      }
      if (body.order !== undefined) {
        section.order = body.order;
      }
      if (body.groups !== undefined) {
        section.set("groups", body.groups);
      }

      await section.save();
      return { section };
    }
  );

  app.delete(
    "/api/master-categories/sections/:id",
    { preHandler: [requireAuth, requireRole("admin", "client")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const filter: Record<string, unknown> = { _id: id };
      if (user.orgId) {
        filter.orgId = user.orgId;
      }

      const result = await SelectionSectionModel.deleteOne(filter);
      if (result.deletedCount === 0) {
        return reply.code(404).send({ error: "Section not found" });
      }

      return { deleted: true };
    }
  );

  app.post(
    "/api/upload",
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = request.body as { fileName: string; base64: string };
      if (!body.fileName || !body.base64) {
        return reply.code(400).send({ error: "fileName and base64 string are required" });
      }

      const match = body.base64.match(/^data:(.*?);base64,(.*)$/);
      let buffer: Buffer;
      let extension = "";
      if (match) {
        const mimeType = match[1];
        buffer = Buffer.from(match[2], "base64");
        extension = mimeType.split("/")[1] || "png";
      } else {
        buffer = Buffer.from(body.base64, "base64");
        extension = path.extname(body.fileName).replace(".", "") || "png";
      }

      const uniqueId = Math.random().toString(36).substring(2, 15);
      const baseName = path.basename(body.fileName, path.extname(body.fileName))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");
      const finalFileName = `${Date.now()}-${uniqueId}-${baseName}.${extension}`;

      const targetDir = path.join(env.uploadsDir, "materials");
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, finalFileName);
      fs.writeFileSync(filePath, buffer);

      return { url: `/uploads/materials/${finalFileName}` };
    }
  );


  app.get(
    "/api/library",
    { preHandler: requireAuth },
    async (request) => {
      const user = request.user!;
      const query = request.query as {
        category?: string;
        categoryKey?: string;
        level?: string;
        projectId?: string;
        showDeleted?: string;
      };

      const filter: Record<string, unknown> = { active: true };
      if (user.orgId) {
        filter.orgId = user.orgId;
      } else if (user.role === "admin") {
        const { OrganizationModel } = await import("../models/Organization.js");
        const defaultOrg = await OrganizationModel.findOne({ slug: "2bn" });
        if (defaultOrg) {
          filter.orgId = defaultOrg._id;
        }
      }
      if (query.category) {
        filter.category = query.category;
      }
      if (query.categoryKey) {
        filter.categoryKey = query.categoryKey;
      }
      if (query.level) {
        filter.level = query.level;
      }

      if (query.showDeleted === "true") {
        filter.isDeleted = true;
      } else {
        filter.isDeleted = { $ne: true };
      }

      let items = await LibraryItemModel.find(filter).sort({ categoryKey: 1, level: 1 });

      let themeId: string | undefined;
      if (query.projectId) {
        const project = await ProjectModel.findById(query.projectId);
        themeId = project?.themeId?.toString();
      }

      const scored = await scoreLibraryItems(items, themeId);
      const sorted = sortByRecommendation(scored);

      return { items: sorted.map((item) => mapLibraryItem(item as never)) };
    },
  );

  app.post(
    "/api/library",
    { preHandler: [requireAuth, requireRole("admin", "client")] },
    async (request, reply) => {
      const body = createLibraryItemSchema.parse(request.body);
      const user = request.user!;

      let orgId = user.orgId;
      if (!orgId && user.role === "admin") {
        const { OrganizationModel } = await import("../models/Organization.js");
        const defaultOrg = await OrganizationModel.findOne({ slug: "2bn" });
        if (defaultOrg) {
          orgId = defaultOrg._id.toString();
        }
      }

      const item = await LibraryItemModel.create({
        orgId,
        category: body.category,
        categoryKey: body.categoryKey ?? body.category,
        selectionSlot: body.selectionSlot,
        manufacturer: body.manufacturer,
        model: body.model,
        product: body.product,
        finish: body.finish,
        priceMin: body.priceMin,
        priceMax: body.priceMax,
        level: body.level,
        imageUrl: body.imageUrl,
        tagSlugs: body.tags ?? [],
        vendor: body.vendor,
        specifications: body.specifications,
        size: body.size,
        dimensionsImageUrl: body.dimensionsImageUrl,
        custom: true,
        isDeleted: false,
      });

      return { item: mapLibraryItem(item) };
    },
  );

  app.patch(
    "/api/library/:id",
    { preHandler: [requireAuth, requireRole("admin", "client")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateLibraryItemSchema.parse(request.body);
      const user = request.user!;

      const filter: Record<string, unknown> = { _id: id };
      if (user.orgId) {
        filter.orgId = user.orgId;
      }

      const item = await LibraryItemModel.findOne(filter);
      if (!item) {
        return reply.code(404).send({ error: "Library item not found" });
      }

      if (body.category !== undefined) item.category = body.category;
      if (body.categoryKey !== undefined) item.categoryKey = body.categoryKey;
      if (body.selectionSlot !== undefined) item.selectionSlot = body.selectionSlot;
      if (body.manufacturer !== undefined) item.manufacturer = body.manufacturer;
      if (body.model !== undefined) item.set("model", body.model);
      if (body.product !== undefined) item.product = body.product;
      if (body.finish !== undefined) item.finish = body.finish;
      if (body.priceMin !== undefined) item.priceMin = body.priceMin;
      if (body.priceMax !== undefined) item.priceMax = body.priceMax;
      if (body.level !== undefined) item.level = body.level;
      if (body.imageUrl !== undefined) item.imageUrl = body.imageUrl;
      if (body.tags !== undefined) item.tagSlugs = body.tags;
      if (body.vendor !== undefined) item.vendor = body.vendor;
      if (body.specifications !== undefined) item.specifications = body.specifications;
      if (body.size !== undefined) item.size = body.size;
      if (body.dimensionsImageUrl !== undefined) item.dimensionsImageUrl = body.dimensionsImageUrl;

      await item.save();
      return { item: mapLibraryItem(item) };
    },
  );

  app.delete(
    "/api/library/:id",
    { preHandler: [requireAuth, requireRole("admin", "client")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      const filter: Record<string, unknown> = { _id: id };
      if (user.orgId) {
        filter.orgId = user.orgId;
      }

      const item = await LibraryItemModel.findOne(filter);
      if (!item) {
        return reply.code(404).send({ error: "Library item not found" });
      }

      if (item.isDeleted) {
        await LibraryItemModel.deleteOne({ _id: item._id });
        return { deleted: true, permanent: true };
      } else {
        item.isDeleted = true;
        await item.save();
        return { deleted: true, permanent: false, item: mapLibraryItem(item) };
      }
    },
  );

  app.post(
    "/api/library/:id/restore",
    { preHandler: [requireAuth, requireRole("admin", "client")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      const filter: Record<string, unknown> = { _id: id };
      if (user.orgId) {
        filter.orgId = user.orgId;
      }

      const item = await LibraryItemModel.findOne(filter);
      if (!item) {
        return reply.code(404).send({ error: "Library item not found" });
      }

      item.isDeleted = false;
      await item.save();
      return { restored: true, item: mapLibraryItem(item) };
    },
  );
}
