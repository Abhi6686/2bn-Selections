import type { FastifyRequest } from "fastify";

export function getProjectParams(request: FastifyRequest): { projectId: string } {
  return request.params as { projectId: string };
}

export function getChangeOrderParams(
  request: FastifyRequest,
): { projectId: string; changeOrderId: string } {
  return request.params as { projectId: string; changeOrderId: string };
}

export function getThemeParams(request: FastifyRequest): { themeId: string } {
  return request.params as { themeId: string };
}
