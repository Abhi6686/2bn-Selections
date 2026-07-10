import { createSelectionTemplateSchema } from "@2bn/shared";
import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { requireProjectAccess } from "../middleware/project-access.js";
import { SelectionTemplateModel } from "../models/SelectionTemplate.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { ProjectModel } from "../models/Project.js";
import { ProjectSelectionModel } from "../models/ProjectSelection.js";
import { syncProjectBudgetFromSelections, appendTimeline } from "../services/project.service.js";
import { getProjectParams } from "../utils/route-params.js";
import type { Types } from "mongoose";

function mapSelectionTemplate(template: any) {
  return {
    id: template._id.toString(),
    orgId: template.orgId.toString(),
    name: template.name,
    description: template.description,
    visibility: template.visibility,
    createdBy: template.createdBy.toString(),
    selections: template.selections instanceof Map 
      ? Object.fromEntries(template.selections) 
      : template.selections,
    coveredSections: template.coveredSections,
    tags: template.tags,
    isDefault: template.isDefault,
    active: template.active,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export async function registerSelectionTemplateRoutes(app: FastifyInstance): Promise<void> {
  // GET templates list
  app.get(
    "/api/selection-templates",
    { preHandler: [requireAuth] },
    async (request) => {
      const user = request.user!;
      const filter = user.orgId 
        ? { orgId: user.orgId, active: true } 
        : { active: true };
      
      const templates = await SelectionTemplateModel.find(filter).sort({ name: 1 });
      return {
        templates: templates.map(mapSelectionTemplate),
      };
    }
  );

  // GET single template with populated library items helper
  app.get(
    "/api/selection-templates/:templateId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const template = await SelectionTemplateModel.findById(
        (request.params as { templateId: string }).templateId
      );
      if (!template) {
        return reply.code(404).send({ error: "Template not found" });
      }

      // Collect library item details to return
      const libraryItemIds = new Set<string>();
      const selectionsMap = template.selections instanceof Map 
        ? Object.fromEntries(template.selections) 
        : template.selections || {};

      for (const list of Object.values(selectionsMap) as any[]) {
        for (const item of list) {
          if (item.libraryItemId) {
            libraryItemIds.add(item.libraryItemId.toString());
          }
        }
      }

      const libraryItems = await LibraryItemModel.find({
        _id: { $in: Array.from(libraryItemIds) },
      });

      return {
        template: mapSelectionTemplate(template),
        libraryItems: libraryItems.map((item) => ({
          id: item._id.toString(),
          category: item.category,
          categoryKey: item.categoryKey,
          manufacturer: item.manufacturer,
          model: item.model,
          product: item.product,
          finish: item.finish,
          priceMin: item.priceMin,
          priceMax: item.priceMax,
          level: item.level,
          imageUrl: item.imageUrl,
        })),
      };
    }
  );

  // POST create template
  app.post(
    "/api/selection-templates",
    { preHandler: [requireAuth, requireRole("admin", "project_manager", "client")] },
    async (request, reply) => {
      const body = createSelectionTemplateSchema.parse(request.body);
      const user = request.user!;

      if (!user.orgId) {
        return reply.code(400).send({ error: "User must belong to an organization" });
      }

      // If isDefault is true, unset default status on others in organization
      if (body.isDefault) {
        await SelectionTemplateModel.updateMany(
          { orgId: user.orgId },
          { $set: { isDefault: false } }
        );
      }

      const template = await SelectionTemplateModel.create({
        orgId: user.orgId,
        name: body.name,
        description: body.description,
        visibility: body.visibility,
        createdBy: user.sub,
        selections: body.selections,
        coveredSections: body.coveredSections,
        tags: body.tags,
        isDefault: body.isDefault,
        active: body.active,
      });

      return { template: mapSelectionTemplate(template) };
    }
  );

  // PATCH update template
  app.patch(
    "/api/selection-templates/:templateId",
    { preHandler: [requireAuth, requireRole("admin", "project_manager", "client")] },
    async (request, reply) => {
      const body = createSelectionTemplateSchema.partial().parse(request.body);
      const template = await SelectionTemplateModel.findById(
        (request.params as { templateId: string }).templateId
      );
      if (!template) {
        return reply.code(404).send({ error: "Template not found" });
      }

      const user = request.user!;

      if (body.isDefault) {
        await SelectionTemplateModel.updateMany(
          { orgId: user.orgId, _id: { $ne: template._id } },
          { $set: { isDefault: false } }
        );
      }

      if (body.name !== undefined) template.name = body.name;
      if (body.description !== undefined) template.description = body.description;
      if (body.visibility !== undefined) template.visibility = body.visibility;
      if (body.selections !== undefined) template.set("selections", body.selections);
      if (body.coveredSections !== undefined) template.coveredSections = body.coveredSections;
      if (body.tags !== undefined) template.tags = body.tags;
      if (body.isDefault !== undefined) template.isDefault = body.isDefault;
      if (body.active !== undefined) template.active = body.active;

      await template.save();
      return { template: mapSelectionTemplate(template) };
    }
  );

  // DELETE template
  app.delete(
    "/api/selection-templates/:templateId",
    { preHandler: [requireAuth, requireRole("admin", "project_manager", "client")] },
    async (request, reply) => {
      const template = await SelectionTemplateModel.findById(
        (request.params as { templateId: string }).templateId
      );
      if (!template) {
        return reply.code(404).send({ error: "Template not found" });
      }

      // Hard or soft delete, let's do soft delete by making active = false
      template.active = false;
      await template.save();

      return { success: true };
    }
  );

  // POST apply template to a project
  app.post(
    "/api/projects/:projectId/selections/apply-template",
    { preHandler: [requireAuth, requireProjectAccess, requireRole("admin", "project_manager", "client")] },
    async (request, reply) => {
      const { templateId, categoryKeys } = request.body as { templateId: string; categoryKeys?: string[] };
      const project = await ProjectModel.findById(getProjectParams(request).projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      const template = await SelectionTemplateModel.findById(templateId);
      if (!template) {
        return reply.code(404).send({ error: "Template not found" });
      }

      const selectionsMap = template.selections instanceof Map 
        ? Object.fromEntries(template.selections) 
        : template.selections || {};

      // Filter templates keys if client wants specific category keys
      const keysToApply = categoryKeys && categoryKeys.length > 0
        ? Object.keys(selectionsMap).filter(k => categoryKeys.includes(k))
        : Object.keys(selectionsMap);

      if (keysToApply.length === 0) {
        return { success: true, count: 0 };
      }

      // Find all library items referenced in the template to copy specs
      const libraryItemIds = new Set<string>();
      for (const key of keysToApply) {
        const list = selectionsMap[key] || [];
        for (const item of list) {
          if (item.libraryItemId) {
            libraryItemIds.add(item.libraryItemId.toString());
          }
        }
      }

      const libraryItems = await LibraryItemModel.find({ _id: { $in: Array.from(libraryItemIds) } });
      const libraryItemsMap = new Map(libraryItems.map(item => [item._id.toString(), item]));

      // For simplicity in a multi-select context:
      // We delete existing selections in the project for the keys to apply and insert the template selections
      await ProjectSelectionModel.deleteMany({
        projectId: project._id,
        categoryKey: { $in: keysToApply },
      });

      const user = request.user!;
      const selectionsToInsert = [];

      for (const key of keysToApply) {
        const list = selectionsMap[key] || [];
        for (const item of list) {
          const libItem = libraryItemsMap.get(item.libraryItemId.toString());
          if (!libItem) continue;

          selectionsToInsert.push({
            projectId: project._id,
            categoryKey: key,
            state: "confirmed", // Template selections start as confirmed
            libraryItemId: libItem._id,
            manufacturer: libItem.manufacturer,
            model: libItem.model,
            product: libItem.product,
            priceUsed: item.priceUsed ?? libItem.priceMin,
            level: libItem.level,
            finish: libItem.finish,
            imageUrl: libItem.imageUrl,
            selectedBy: user.sub,
            quantity: item.quantity || 1,
            slotLabel: item.slotLabel || "",
            version: 1,
          });
        }
      }

      if (selectionsToInsert.length > 0) {
        await ProjectSelectionModel.insertMany(selectionsToInsert);
      }

      // Sync budget and record history
      await syncProjectBudgetFromSelections(project, `Applied template: ${template.name}`);
      await appendTimeline({
        projectId: project._id,
        type: "selection_updated",
        title: `Template Applied: ${template.name}`,
        description: `Applied ${selectionsToInsert.length} selections from template.`,
        actorId: user.sub as unknown as Types.ObjectId,
      });

      return { success: true, count: selectionsToInsert.length };
    }
  );
}
