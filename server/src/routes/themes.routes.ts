import { createThemeSchema } from "@2bn/shared";
import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ThemeModel } from "../models/Theme.js";

export async function registerThemeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/themes", { preHandler: requireAuth }, async (request) => {
    const user = request.user!;
    const filter = user.orgId ? { orgId: user.orgId, active: true } : { active: true };
    const themes = await ThemeModel.find(filter).sort({ name: 1 });
    return {
      themes: themes.map((theme) => ({
        id: theme._id.toString(),
        orgId: theme.orgId.toString(),
        name: theme.name,
        description: theme.description,
        tagWeights: Object.fromEntries(theme.tagWeights ?? new Map()),
        active: theme.active,
      })),
    };
  });

  app.post(
    "/api/themes",
    { preHandler: [requireAuth, requireRole("admin", "project_manager", "client")] },
    async (request, reply) => {
      const body = createThemeSchema.parse(request.body);
      const user = request.user!;

      if (!user.orgId) {
        return reply.code(400).send({ error: "User must belong to an organization" });
      }

      const theme = await ThemeModel.create({
        orgId: user.orgId,
        name: body.name,
        description: body.description,
        tagWeights: body.tagWeights ?? {},
        active: body.active ?? true,
      });

      return {
        theme: {
          id: theme._id.toString(),
          name: theme.name,
          description: theme.description,
          tagWeights: Object.fromEntries(theme.tagWeights ?? new Map()),
        },
      };
    },
  );

  app.patch(
    "/api/themes/:themeId",
    { preHandler: [requireAuth, requireRole("admin", "project_manager", "client")] },
    async (request, reply) => {
      const body = createThemeSchema.partial().parse(request.body);
      const theme = await ThemeModel.findById(
        (request.params as { themeId: string }).themeId,
      );
      if (!theme) {
        return reply.code(404).send({ error: "Theme not found" });
      }

      if (body.name) theme.name = body.name;
      if (body.description !== undefined) theme.description = body.description;
      if (body.tagWeights) theme.set("tagWeights", body.tagWeights);
      if (body.active !== undefined) theme.active = body.active;
      await theme.save();

      return { theme: { id: theme._id.toString(), name: theme.name, active: theme.active } };
    },
  );
}
