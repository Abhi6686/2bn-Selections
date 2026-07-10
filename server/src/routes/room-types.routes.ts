import { createRoomTypeSchema, updateRoomTypeSchema } from "@2bn/shared";
import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { RoomTypeModel } from "../models/RoomType.js";

export async function registerRoomTypeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/room-types", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    let orgId = user.orgId;
    if (!orgId) {
      const defaultOrg = await import("../models/Organization.js").then((module) =>
        module.OrganizationModel.findOne({ slug: "2bn" }),
      );
      orgId = defaultOrg?._id.toString();
    }
    if (!orgId) {
      return reply.code(400).send({ error: "User must belong to an organization" });
    }

    const roomTypes = await RoomTypeModel.find({ orgId }).sort({ name: 1 });
    return {
      roomTypes: roomTypes.map((rt) => ({
        id: rt._id.toString(),
        orgId: rt.orgId.toString(),
        name: rt.name,
        icon: rt.icon,
        description: (rt as any).description,
        imageUrl: (rt as any).imageUrl,
        slots: rt.slots.map((s: any) => ({
          categoryKey: s.categoryKey,
          slotLabel: s.slotLabel,
          required: s.required,
          allowance: s.allowance,
        })),
        createdAt: rt.createdAt ? (rt.createdAt as Date).toISOString() : new Date().toISOString(),
        updatedAt: rt.updatedAt ? (rt.updatedAt as Date).toISOString() : new Date().toISOString(),
      })),
    };
  });

  app.post(
    "/api/room-types",
    { preHandler: [requireAuth, requireRole("admin", "project_manager", "client")] },
    async (request, reply) => {
      const body = createRoomTypeSchema.parse(request.body);
      const user = request.user!;

      let orgId = user.orgId;
      if (!orgId) {
        const defaultOrg = await import("../models/Organization.js").then((module) =>
          module.OrganizationModel.findOne({ slug: "2bn" }),
        );
        orgId = defaultOrg?._id.toString();
      }
      if (!orgId) {
        return reply.code(400).send({ error: "Admin must belong to an organization" });
      }

      try {
        const roomType = await RoomTypeModel.create({
          orgId,
          name: body.name,
          icon: body.icon,
          description: (body as any).description,
          imageUrl: (body as any).imageUrl,
          slots: body.slots,
        });

        return {
          roomType: {
            id: roomType._id.toString(),
            orgId: roomType.orgId.toString(),
            name: roomType.name,
            icon: roomType.icon,
            description: (roomType as any).description,
            imageUrl: (roomType as any).imageUrl,
            slots: roomType.slots,
            createdAt: roomType.createdAt ? (roomType.createdAt as Date).toISOString() : new Date().toISOString(),
            updatedAt: roomType.updatedAt ? (roomType.updatedAt as Date).toISOString() : new Date().toISOString(),
          },
        };
      } catch (err: any) {
        if (err.code === 11000) {
          return reply.code(400).send({ error: `A room template with the name "${body.name}" already exists.` });
        }
        throw err;
      }
    }
  );

  app.patch(
    "/api/room-types/:roomTypeId",
    { preHandler: [requireAuth, requireRole("admin", "project_manager", "client")] },
    async (request, reply) => {
      const body = updateRoomTypeSchema.parse(request.body);
      const { roomTypeId } = request.params as { roomTypeId: string };

      const roomType = await RoomTypeModel.findById(roomTypeId);
      if (!roomType) {
        return reply.code(404).send({ error: "Room type template not found" });
      }

      if (body.name !== undefined) roomType.name = body.name;
      if (body.icon !== undefined) roomType.icon = body.icon;
      if (body.slots !== undefined) roomType.set("slots", body.slots);
      if ((body as any).description !== undefined) (roomType as any).description = (body as any).description;
      if ((body as any).imageUrl !== undefined) (roomType as any).imageUrl = (body as any).imageUrl;

      try {
        await roomType.save();

        return {
          roomType: {
            id: roomType._id.toString(),
            orgId: roomType.orgId.toString(),
            name: roomType.name,
            icon: roomType.icon,
            description: (roomType as any).description,
            imageUrl: (roomType as any).imageUrl,
            slots: roomType.slots,
          },
        };
      } catch (err: any) {
        if (err.code === 11000) {
          return reply.code(400).send({ error: `A room template with the name "${body.name}" already exists.` });
        }
        throw err;
      }
    }
  );

  app.delete(
    "/api/room-types/:roomTypeId",
    { preHandler: [requireAuth, requireRole("admin", "project_manager", "client")] },
    async (request, reply) => {
      const { roomTypeId } = request.params as { roomTypeId: string };

      const result = await RoomTypeModel.deleteOne({ _id: roomTypeId });
      if (result.deletedCount === 0) {
        return reply.code(404).send({ error: "Room type template not found" });
      }

      return { success: true };
    }
  );
}
