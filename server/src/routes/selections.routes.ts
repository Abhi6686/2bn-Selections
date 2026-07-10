import { patchSelectionSchema } from "@2bn/shared";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectAccess } from "../middleware/project-access.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { ProjectModel } from "../models/Project.js";
import { ProjectSelectionModel } from "../models/ProjectSelection.js";
import { appendTimeline, syncProjectBudgetFromSelections } from "../services/project.service.js";
import { mapProjectSelection } from "../utils/mappers.js";
import { getProjectParams } from "../utils/route-params.js";
import { env } from "../config/env.js";
import type { Types } from "mongoose";

export async function registerSelectionRoutes(app: FastifyInstance): Promise<void> {
  app.patch(
    "/api/projects/:projectId/selections",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request, reply) => {
      const body = patchSelectionSchema.parse(request.body);
      const user = request.user!;

      const project = await ProjectModel.findById(getProjectParams(request).projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      // Lock check for homeowner role
      if (user.role === "end_user" && (project.proposalSigned || project.projectLocked)) {
        const isCategoryUnlocked = project.unlockedCategoryKeys?.includes(body.categoryKey) ||
          project.unlockedCategoryKeys?.some(key => body.categoryKey.startsWith(key + " - "));
        if (!isCategoryUnlocked) {
          return reply.code(403).send({ error: "Selection sheet is locked for this category. Please contact your project manager." });
        }
      }

      // If project was previously signed/finalized, reset it so homeowner can sign again
      if (project.proposalSigned) {
        project.proposalSigned = false;
        project.status = "selections_in_progress";
        await project.save();
      }

      const query: any = {
        projectId: project._id,
        categoryKey: body.categoryKey,
      };
      if (body.id) {
        query._id = body.id;
      } else {
        query.slotLabel = body.slotLabel || "";
      }

      const existing = await ProjectSelectionModel.findOne(query);

      if (existing && body.version !== undefined && body.version !== existing.version) {
        return reply.code(409).send({
          error: "Conflict",
          selection: mapProjectSelection(existing),
        });
      }

      let libraryData = {};
      if (body.libraryItemId) {
        const libraryItem = await LibraryItemModel.findById(body.libraryItemId);
        if (libraryItem) {
          libraryData = {
            libraryItemId: libraryItem._id,
            manufacturer: libraryItem.manufacturer,
            model: libraryItem.model,
            product: libraryItem.product,
            level: libraryItem.level,
            finish: libraryItem.finish,
            imageUrl: libraryItem.imageUrl,
            priceUsed: body.priceUsed ?? libraryItem.priceMin,
          };
        }
      }

      const selection = await ProjectSelectionModel.findOneAndUpdate(
        query,
        {
          $set: {
            state: body.state,
            selectedBy: user.sub,
            ...libraryData,
            ...(body.priceUsed !== undefined ? { priceUsed: body.priceUsed } : {}),
            ...(body.manufacturer ? { manufacturer: body.manufacturer } : {}),
            ...(body.model ? { model: body.model } : {}),
            ...(body.product ? { product: body.product } : {}),
            ...(body.level ? { level: body.level } : {}),
            ...(body.finish ? { finish: body.finish } : {}),
            ...(body.imageUrl ? { imageUrl: body.imageUrl } : {}),
            ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
            ...(body.slotLabel !== undefined ? { slotLabel: body.slotLabel } : {}),
            ...(body.discountPercent !== undefined ? { discountPercent: body.discountPercent } : {}),
            ...(body.discountFlat !== undefined ? { discountFlat: body.discountFlat } : {}),
          },
          $inc: { version: 1 },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      project.lastVisitedCategoryKey = body.categoryKey;
      await project.save();

      if (body.state === "confirmed") {
        await syncProjectBudgetFromSelections(project, `Selection: ${body.categoryKey}`);
        await appendTimeline({
          projectId: project._id,
          type: "selection_updated",
          title: `${body.categoryKey} updated`,
          description: selection.product ?? body.categoryKey,
          category: body.categoryKey,
          actorId: user.sub as unknown as Types.ObjectId,
        });
      }

      return { selection: mapProjectSelection(selection) };
    },
  );

  // DELETE a specific project selection (for removing a multi-select slot)
  app.delete(
    "/api/projects/:projectId/selections/:selectionId",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request, reply) => {
      const { selectionId } = request.params as { selectionId: string };
      const project = await ProjectModel.findById(getProjectParams(request).projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      const selection = await ProjectSelectionModel.findOne({
        _id: selectionId,
        projectId: project._id,
      });

      if (!selection) {
        return reply.code(404).send({ error: "Selection not found" });
      }

      // Lock check for homeowner role on deletion
      if (request.user!.role === "end_user" && (project.proposalSigned || project.projectLocked)) {
        const isCategoryUnlocked = project.unlockedCategoryKeys?.includes(selection.categoryKey) ||
          project.unlockedCategoryKeys?.some(key => selection.categoryKey.startsWith(key + " - "));
        if (!isCategoryUnlocked) {
          return reply.code(403).send({ error: "Selection sheet is locked for this category. Please contact your project manager." });
        }
      }

      // If project was previously signed/finalized, reset it so homeowner can sign again
      if (project.proposalSigned) {
        project.proposalSigned = false;
        project.status = "selections_in_progress";
        await project.save();
      }

      const categoryKey = selection.categoryKey;
      await selection.deleteOne();

      await syncProjectBudgetFromSelections(project, `Removed selection slot from ${categoryKey}`);
      await appendTimeline({
        projectId: project._id,
        type: "selection_updated",
        title: `${categoryKey} slot removed`,
        description: `Removed a selection slot from ${categoryKey}`,
        category: categoryKey,
        actorId: request.user!.sub as unknown as Types.ObjectId,
      });

      return { success: true };
    },
  );

  app.post(
    "/api/projects/:projectId/selections/confirm-all",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request, reply) => {
      const project = await ProjectModel.findById(getProjectParams(request).projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      await ProjectSelectionModel.updateMany(
        { projectId: project._id, state: "draft" },
        { $set: { state: "confirmed" } },
      );

      await syncProjectBudgetFromSelections(project, "All selections confirmed");
      project.status = "selections_complete";
      await project.save();

      return { project: { id: project._id.toString(), status: project.status } };
    },
  );

  app.post(
    "/api/projects/:projectId/selections/generate-rendering",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request, reply) => {
      const { blueprintImage, selections, theme = "sunset" } = request.body as {
        blueprintImage?: string;
        selections?: Array<{ category: string; manufacturer?: string; model?: string; product?: string }>;
        theme?: string;
      };

      if (!env.geminiApiKey) {
        return reply.code(400).send({
          error: "Missing GEMINI_API_KEY in backend configuration. Please add your Gemini API Key to the root .env file and restart the API server."
        });
      }

      if (!blueprintImage) {
        return reply.code(400).send({ error: "Blueprint sketch image is required." });
      }

      try {
        // 1. Prepare material description
        const materialsText = (selections ?? [])
          .map((s) => `- ${s.category}: ${s.manufacturer || ""} ${s.model || ""} ${s.product || ""}`)
          .join("\n");

        const promptText = `
You are an expert architectural prompt engineer for Imagen 3.
Analyze the attached blueprint sketch/elevation drawing and identify its structural layout (e.g., roof angles, window placement, door placement, porch columns).
Then, integrate the following material selections made by the client:
${materialsText}

Create a single, highly detailed, photorealistic prompt for Imagen 3 to render this house.
The prompt must describe a realistic photographic rendering of this house from the front yard view.
Incorporate the following environmental scene theme/style: "${theme}".
- For "sunset": set in golden hour lighting, warm glow, soft shadows, manicured lawn.
- For "winter": set in a snowy landscape, snow resting on the roof and lawn, warm light glowing from the windows, crisp winter evening sky.
- For "forest": set in a lush woodland setting, surrounded by tall pine trees, dappled sunlight filtering through leaves, natural rustic landscape.
- For "modern": set in a high-end luxury modern neighborhood, clean concrete driveway, minimalist landscaping, bright afternoon daylight.
- For "traditional": set in a classic suburban family neighborhood, green grass yard, mature trees, warm morning sun.

Make sure the prompt is:
1. Focused on the exact architectural layout shown in the sketch (e.g. if the sketch shows a 1-story house with a garage, don't describe a 3-story mansion).
2. Specifies the selections (shingle colors, siding materials, entry door color, etc.) in detail.
3. Written as a single paragraph description of a high-quality photograph, without preamble or extra text. Only return the prompt.
`;

        // Parse base64 image data
        const parts = blueprintImage.split(";base64,");
        const mimeType = parts[0].split("data:").pop() || "image/png";
        const base64Data = parts.pop() || "";

        // 2. Call gemini-1.5-flash to generate the Imagen prompt
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.geminiApiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: { temperature: 0.2 },
          }),
        });

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          app.log.error({ details: errText }, "Gemini API call failed");
          return reply.code(502).send({ error: "Gemini API call failed", details: errText });
        }

        const geminiData = (await geminiRes.json()) as any;
        const generatedPrompt = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!generatedPrompt) {
          app.log.error({ data: geminiData }, "No prompt generated by Gemini");
          return reply.code(502).send({ error: "Failed to generate prompt from blueprint." });
        }

        app.log.info({ generatedPrompt }, "Generated Prompt for Imagen");

        // 3. Call Imagen 3 to generate the image
        const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${env.geminiApiKey}`;
        const imagenRes = await fetch(imagenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: generatedPrompt,
            numberOfImages: 1,
            outputMimeType: "image/jpeg",
            aspectRatio: "16:9",
          }),
        });

        if (!imagenRes.ok) {
          const errText = await imagenRes.text();
          app.log.error({ details: errText }, "Imagen API call failed");
          return reply.code(502).send({ error: "Imagen API call failed", details: errText });
        }

        const imagenData = (await imagenRes.json()) as any;
        const imageBytes = imagenData?.generatedImages?.[0]?.image?.imageBytes;

        if (!imageBytes) {
          app.log.error({ data: imagenData }, "No image returned by Imagen");
          return reply.code(502).send({ error: "Failed to render image from prompt." });
        }

        return {
          renderingUrl: `data:image/jpeg;base64,${imageBytes}`,
          prompt: generatedPrompt,
        };
      } catch (err: any) {
        app.log.error(err, "Error generating rendering");
        return reply.code(500).send({ error: "Internal server error during rendering.", details: err.message });
      }
    }
  );
}
