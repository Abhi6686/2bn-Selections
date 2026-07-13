import { ActivityLogModel } from "../models/ActivityLog.js";
import { UserModel } from "../models/User.js";
import type { AccessTokenPayload } from "./jwt.service.js";

export interface LogActivityParams {
  user: AccessTokenPayload;
  orgId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  details?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget activity logger.
 * Uses setImmediate so it NEVER blocks the HTTP response.
 * Silently ignores any failures — activity logging must never crash the app.
 */
export function logActivity(params: LogActivityParams): void {
  setImmediate(async () => {
    try {
      const userDoc = await UserModel.findById(params.user.sub).select("name").lean();
      await ActivityLogModel.create({
        orgId: params.orgId,
        userId: params.user.sub,
        userEmail: params.user.email,
        userName: userDoc?.name || params.user.email,
        userRole: params.user.role,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        resourceName: params.resourceName,
        details: params.details,
        metadata: params.metadata,
      });
    } catch {
      // Silently swallow — never let logging crash the app
    }
  });
}
