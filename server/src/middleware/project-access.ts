import type { FastifyReply, FastifyRequest } from "fastify";
import { ProjectMemberModel } from "../models/ProjectMember.js";
import { ProjectModel } from "../models/Project.js";

export async function requireProjectAccess(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.user) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }

  const projectId = (request.params as { projectId?: string }).projectId;
  if (!projectId) {
    reply.code(400).send({ error: "Missing project id" });
    return;
  }

  if (request.user.role === "admin") {
    return;
  }

  const project = await ProjectModel.findById(projectId);
  if (!project) {
    reply.code(404).send({ error: "Project not found" });
    return;
  }

  const userId = request.user.sub;

  if (request.user.role === "client") {
    if (project.ownerClientId.toString() === userId) {
      return;
    }
    if (project.orgId.toString() === request.user.orgId) {
      return;
    }
    reply.code(403).send({ error: "Forbidden" });
    return;
  }

  const isEndUser =
    project.endUserIds?.some((id) => id.toString() === userId) ||
    (await ProjectMemberModel.exists({ projectId: project._id, userId }));

  if (!isEndUser) {
    return reply.code(403).send({ error: "Forbidden" });
  }
}
