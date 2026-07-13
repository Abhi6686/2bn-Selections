import type { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ActivityLogModel } from "../models/ActivityLog.js";

export async function registerActivityRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/activity
   * Paginated, filterable activity log — Admin only.
   */
  app.get(
    "/api/activity",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request) => {
      const user = request.user!;
      const orgId = await resolveOrgId(user);

      const q = request.query as {
        page?: string;
        limit?: string;
        userId?: string;
        action?: string;
        resourceType?: string;
        dateFrom?: string;
        dateTo?: string;
        search?: string;
      };

      const page = Math.max(1, parseInt(q.page || "1"));
      const limit = Math.min(100, parseInt(q.limit || "50"));
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {};
      if (orgId) filter.orgId = new mongoose.Types.ObjectId(orgId);
      if (q.userId) filter.userId = new mongoose.Types.ObjectId(q.userId);
      if (q.action) filter.action = q.action;
      if (q.resourceType) filter.resourceType = q.resourceType;
      if (q.dateFrom || q.dateTo) {
        const dateFilter: Record<string, Date> = {};
        if (q.dateFrom) dateFilter.$gte = new Date(q.dateFrom);
        if (q.dateTo) {
          // Include the entire end day
          const end = new Date(q.dateTo);
          end.setHours(23, 59, 59, 999);
          dateFilter.$lte = end;
        }
        filter.createdAt = dateFilter;
      }
      if (q.search) {
        filter.$or = [
          { userName: { $regex: q.search, $options: "i" } },
          { userEmail: { $regex: q.search, $options: "i" } },
          { details: { $regex: q.search, $options: "i" } },
          { resourceName: { $regex: q.search, $options: "i" } },
        ];
      }

      const [logs, total] = await Promise.all([
        ActivityLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        ActivityLogModel.countDocuments(filter),
      ]);

      return {
        logs,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      };
    }
  );

  /**
   * GET /api/activity/stats
   * Aggregated stats for the Activity Monitor dashboard — Admin only.
   */
  app.get(
    "/api/activity/stats",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request) => {
      const user = request.user!;
      const orgId = await resolveOrgId(user);
      if (!orgId) return { todayCount: 0, weekCount: 0, totalCount: 0, topUsers: [], actionBreakdown: [] };

      const orgObjId = new mongoose.Types.ObjectId(orgId);

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      const [todayCount, weekCount, totalCount, topUsers, actionBreakdown, resourceBreakdown] =
        await Promise.all([
          ActivityLogModel.countDocuments({ orgId: orgObjId, createdAt: { $gte: todayStart } }),
          ActivityLogModel.countDocuments({ orgId: orgObjId, createdAt: { $gte: weekStart } }),
          ActivityLogModel.countDocuments({ orgId: orgObjId }),
          ActivityLogModel.aggregate([
            { $match: { orgId: orgObjId } },
            {
              $group: {
                _id: {
                  userId: "$userId",
                  userName: "$userName",
                  userEmail: "$userEmail",
                  userRole: "$userRole",
                },
                count: { $sum: 1 },
                lastActionAt: { $max: "$createdAt" },
                lastAction: { $last: "$action" },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ]),
          ActivityLogModel.aggregate([
            { $match: { orgId: orgObjId } },
            { $group: { _id: "$action", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 },
          ]),
          ActivityLogModel.aggregate([
            { $match: { orgId: orgObjId, resourceType: { $exists: true, $ne: null } } },
            { $group: { _id: "$resourceType", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ]),
        ]);

      return { todayCount, weekCount, totalCount, topUsers, actionBreakdown, resourceBreakdown };
    }
  );

  /**
   * GET /api/activity/users
   * List of users who have activity (for filter dropdown) — Admin only.
   */
  app.get(
    "/api/activity/users",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request) => {
      const user = request.user!;
      const orgId = await resolveOrgId(user);
      if (!orgId) return { users: [] };

      const users = await ActivityLogModel.aggregate([
        { $match: { orgId: new mongoose.Types.ObjectId(orgId) } },
        {
          $group: {
            _id: "$userId",
            userName: { $last: "$userName" },
            userEmail: { $last: "$userEmail" },
            userRole: { $last: "$userRole" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]);

      return { users };
    }
  );
}

async function resolveOrgId(user: { orgId?: string; role: string; sub: string }): Promise<string | undefined> {
  if (user.orgId) return user.orgId;
  if (user.role === "admin" || user.role === "project_manager") {
    const { OrganizationModel } = await import("../models/Organization.js");
    const defaultOrg = await OrganizationModel.findOne({ slug: "2bn" });
    return defaultOrg?._id.toString();
  }
  return undefined;
}
