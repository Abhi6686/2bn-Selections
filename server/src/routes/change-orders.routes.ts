import { approveChangeOrderSchema, createChangeOrderSchema } from "@2bn/shared";
import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { requireProjectAccess } from "../middleware/project-access.js";
import { ChangeOrderModel } from "../models/ChangeOrder.js";
import { ProjectModel } from "../models/Project.js";
import { UserModel } from "../models/User.js";
import { buildChangeOrderApprovalEmail, sendEmail } from "../services/email.service.js";
import { generateChangeOrderPdf } from "../services/pdf.service.js";
import { appendTimeline, recordBudgetSnapshot } from "../services/project.service.js";
import { getChangeOrderParams, getProjectParams } from "../utils/route-params.js";
import { generateSecureToken, hashToken } from "../utils/tokens.js";
import type { Types } from "mongoose";

export async function registerChangeOrderRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/projects/:projectId/change-orders",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request) => {
      const orders = await ChangeOrderModel.find({
        projectId: getProjectParams(request).projectId,
      }).sort({ number: -1 });

      const project = await ProjectModel.findById(getProjectParams(request).projectId);
      const requiredApprovals = project?.requiresDualApproval ? 2 : 1;

      return {
        changeOrders: orders.map((order) => ({
          id: order._id.toString(),
          projectId: order.projectId.toString(),
          number: order.number,
          title: order.title,
          status: order.status,
          lines: order.lines,
          totalDelta: order.totalDelta,
          notes: order.notes,
          pdfUrl: order.pdfFilePath ? `/uploads/pdfs/co-${order.projectId}-${order.number}.pdf` : undefined,
          createdAt: order.createdAt.toISOString(),
          releasedAt: order.releasedAt?.toISOString(),
          approvedAt: order.approvedAt?.toISOString(),
          rejectedAt: order.rejectedAt?.toISOString(),
          approvalCount: order.approvals?.length ?? 0,
          requiredApprovals,
        })),
      };
    },
  );

  app.post(
    "/api/projects/:projectId/change-orders",
    { preHandler: [requireAuth, requireRole("admin", "client"), requireProjectAccess] },
    async (request, reply) => {
      const body = createChangeOrderSchema.parse(request.body);
      const project = await ProjectModel.findById(getProjectParams(request).projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      const lines = body.lines.map((line) => ({
        ...line,
        delta: line.newAmount - line.previousAmount,
      }));
      const totalDelta = lines.reduce((sum, line) => sum + line.delta, 0);

      if (Math.abs(totalDelta) < env.changeOrderMinimum) {
        return reply.code(400).send({
          error: `Change order minimum is $${env.changeOrderMinimum}`,
        });
      }

      const lastNumber = await ChangeOrderModel.findOne({ projectId: project._id })
        .sort({ number: -1 })
        .select("number");
      const number = (lastNumber?.number ?? 0) + 1;

      const changeOrder = await ChangeOrderModel.create({
        projectId: project._id,
        number,
        title: body.title,
        status: "draft",
        lines,
        totalDelta,
        notes: body.notes,
      });

      await appendTimeline({
        projectId: project._id,
        type: "change_order_created",
        title: `Change Order #${number} drafted`,
        description: body.title,
        amountAfter: totalDelta,
        changeOrderId: changeOrder._id,
        actorId: request.user!.sub as unknown as Types.ObjectId,
      });

      return {
        changeOrder: {
          id: changeOrder._id.toString(),
          number: changeOrder.number,
          status: changeOrder.status,
          totalDelta: changeOrder.totalDelta,
        },
      };
    },
  );

  app.post(
    "/api/projects/:projectId/change-orders/:changeOrderId/release",
    { preHandler: [requireAuth, requireRole("admin", "client"), requireProjectAccess] },
    async (request, reply) => {
      const changeOrder = await ChangeOrderModel.findOne({
        _id: getChangeOrderParams(request).changeOrderId,
        projectId: getChangeOrderParams(request).projectId,
      });
      const project = await ProjectModel.findById(getProjectParams(request).projectId);

      if (!changeOrder || !project) {
        return reply.code(404).send({ error: "Not found" });
      }

      const approvalToken = generateSecureToken();
      changeOrder.status = "released";
      changeOrder.releasedAt = new Date();
      changeOrder.approvalTokenHash = hashToken(approvalToken);
      changeOrder.approvalTokenExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const approvalLink = `${env.webOrigin}/approve/co?token=${approvalToken}&id=${changeOrder._id}`;
      changeOrder.pdfFilePath = await generateChangeOrderPdf({ project, changeOrder, approvalLink });
      await changeOrder.save();

      for (const endUserId of project.endUserIds) {
        const user = await UserModel.findById(endUserId);
        if (user?.email) {
          await sendEmail({
            to: user.email,
            subject: `Change Order #${changeOrder.number} — approval required`,
            html: buildChangeOrderApprovalEmail({
              projectName: project.name,
              changeOrderTitle: changeOrder.title,
              approvalLink,
            }),
          });
        }
      }

      await appendTimeline({
        projectId: project._id,
        type: "change_order_released",
        title: `Change Order #${changeOrder.number} released`,
        description: changeOrder.title,
        changeOrderId: changeOrder._id,
        actorId: request.user!.sub as unknown as Types.ObjectId,
      });

      return {
        changeOrder: {
          id: changeOrder._id.toString(),
          status: changeOrder.status,
          pdfUrl: `/uploads/pdfs/co-${project._id}-${changeOrder.number}.pdf`,
          approvalLink: env.isDevelopment ? approvalLink : undefined,
        },
      };
    },
  );

  app.get("/api/change-orders/verify", async (request, reply) => {
    const query = request.query as { token?: string; id?: string };
    if (!query.token || !query.id) {
      return reply.code(400).send({ error: "Missing token or change order id" });
    }

    const changeOrder = await ChangeOrderModel.findById(query.id);
    if (
      !changeOrder ||
      changeOrder.approvalTokenHash !== hashToken(query.token) ||
      (changeOrder.approvalTokenExpiresAt && changeOrder.approvalTokenExpiresAt < new Date())
    ) {
      return reply.code(400).send({ error: "Invalid or expired approval link" });
    }

    const project = await ProjectModel.findById(changeOrder.projectId);
    const requiredApprovals = project?.requiresDualApproval ? 2 : 1;

    return {
      changeOrder: {
        id: changeOrder._id.toString(),
        number: changeOrder.number,
        title: changeOrder.title,
        status: changeOrder.status,
        lines: changeOrder.lines,
        totalDelta: changeOrder.totalDelta,
        notes: changeOrder.notes,
        projectName: project?.name ?? "Project",
        clientName: project?.clientName ?? "Client",
        approvalCount: changeOrder.approvals?.length ?? 0,
        requiredApprovals,
      },
    };
  });

  app.post("/api/change-orders/approve", async (request, reply) => {
    const query = request.query as { token?: string; id?: string };
    const body = approveChangeOrderSchema.parse(request.body);

    if (!query.token || !query.id) {
      return reply.code(400).send({ error: "Missing token or change order id" });
    }

    const changeOrder = await ChangeOrderModel.findById(query.id);
    if (
      !changeOrder ||
      changeOrder.approvalTokenHash !== hashToken(query.token) ||
      (changeOrder.approvalTokenExpiresAt && changeOrder.approvalTokenExpiresAt < new Date())
    ) {
      return reply.code(400).send({ error: "Invalid or expired approval link" });
    }

    const project = await ProjectModel.findById(changeOrder.projectId);
    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }

    let signatureImagePath: string | undefined;
    if (body.signatureImageBase64) {
      await fs.mkdir(path.join(env.uploadsDir, "signatures"), { recursive: true });
      const fileName = `sig-${changeOrder._id}-${Date.now()}.png`;
      signatureImagePath = path.join(env.uploadsDir, "signatures", fileName);
      const base64Data = body.signatureImageBase64.replace(/^data:image\/\w+;base64,/, "");
      await fs.writeFile(signatureImagePath, Buffer.from(base64Data, "base64"));
    }

    let email = request.user?.email;
    if (!email) {
      const cookieToken = request.cookies.access_token;
      const headerToken = request.headers.authorization?.replace("Bearer ", "");
      const token = cookieToken ?? headerToken;
      if (token) {
        try {
          const { verifyAccessToken } = await import("../services/jwt.service.js");
          const decoded = await verifyAccessToken(token);
          email = decoded.email;
        } catch (err) {}
      }
    }

    const approvalRecord = {
      email,
      signatureType: body.signatureType,
      typedName: body.typedName,
      signatureImagePath,
      ipAddress: request.ip,
      geoLatitude: body.geoConsent ? body.geoLatitude : undefined,
      geoLongitude: body.geoConsent ? body.geoLongitude : undefined,
      decidedAt: new Date(),
    };

    if (!changeOrder.approvals) {
      changeOrder.set("approvals", []);
    }
    changeOrder.approvals.push(approvalRecord as never);

    const requiredApprovals = project.requiresDualApproval ? 2 : 1;
    if (changeOrder.approvals.length >= requiredApprovals) {
      changeOrder.status = "approved";
      changeOrder.approvedAt = new Date();
      project.currentBudget += changeOrder.totalDelta;
      await project.save();

      await recordBudgetSnapshot({
        projectId: project._id,
        label: `CO #${changeOrder.number} approved`,
        total: project.currentBudget,
        byCategory: {},
        source: "change_order",
        changeOrderId: changeOrder._id,
      });

      await appendTimeline({
        projectId: project._id,
        type: "change_order_accepted",
        title: `Change Order #${changeOrder.number} approved`,
        description: changeOrder.title,
        amountAfter: changeOrder.totalDelta,
        changeOrderId: changeOrder._id,
      });
    }

    const approvalLink = `${env.webOrigin}/approve/co?token=${query.token}&id=${changeOrder._id}`;
    changeOrder.pdfFilePath = await generateChangeOrderPdf({ project, changeOrder, approvalLink });
    await changeOrder.save();
    return {
      ok: true,
      status: changeOrder.status,
      approvalCount: changeOrder.approvals.length,
      requiredApprovals,
    };
  });

  app.post(
    "/api/projects/:projectId/change-orders/:changeOrderId/reject",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request, reply) => {
      const changeOrder = await ChangeOrderModel.findOne({
        _id: getChangeOrderParams(request).changeOrderId,
        projectId: getChangeOrderParams(request).projectId,
      });

      if (!changeOrder) {
        return reply.code(404).send({ error: "Not found" });
      }

      changeOrder.status = "rejected";
      changeOrder.rejectedAt = new Date();
      await changeOrder.save();

      await appendTimeline({
        projectId: changeOrder.projectId,
        type: "change_order_rejected",
        title: `Change Order #${changeOrder.number} rejected`,
        changeOrderId: changeOrder._id,
        actorId: request.user!.sub as unknown as Types.ObjectId,
      });

      return { ok: true, status: changeOrder.status };
    },
  );

  app.post(
    "/api/projects/:projectId/change-orders/:changeOrderId/approve",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request, reply) => {
      const { projectId, changeOrderId } = getChangeOrderParams(request);
      const changeOrder = await ChangeOrderModel.findOne({
        _id: changeOrderId,
        projectId,
      });
      const project = await ProjectModel.findById(projectId);

      if (!changeOrder || !project) {
        return reply.code(404).send({ error: "Not found" });
      }

      if (changeOrder.status !== "released") {
        return reply.code(400).send({ error: "Change order is not released for approval" });
      }

      const body = approveChangeOrderSchema.parse(request.body);

      let signatureImagePath: string | undefined;
      if (body.signatureImageBase64) {
        await fs.mkdir(path.join(env.uploadsDir, "signatures"), { recursive: true });
        const fileName = `sig-${changeOrder._id}-${Date.now()}.png`;
        signatureImagePath = path.join(env.uploadsDir, "signatures", fileName);
        const base64Data = body.signatureImageBase64.replace(/^data:image\/\w+;base64,/, "");
        await fs.writeFile(signatureImagePath, Buffer.from(base64Data, "base64"));
      }

      const email = request.user!.email;

      if (changeOrder.approvals?.some((a: any) => a.email === email)) {
        return reply.code(400).send({ error: "You have already approved this change order" });
      }

      const approvalRecord = {
        email,
        signatureType: body.signatureType,
        typedName: body.typedName,
        signatureImagePath,
        ipAddress: request.ip,
        geoLatitude: body.geoConsent ? body.geoLatitude : undefined,
        geoLongitude: body.geoConsent ? body.geoLongitude : undefined,
        decidedAt: new Date(),
      };

      if (!changeOrder.approvals) {
        changeOrder.set("approvals", []);
      }
      changeOrder.approvals.push(approvalRecord as never);

      const requiredApprovals = project.requiresDualApproval ? 2 : 1;
      if (changeOrder.approvals.length >= requiredApprovals) {
        changeOrder.status = "approved";
        changeOrder.approvedAt = new Date();
        project.currentBudget += changeOrder.totalDelta;
        await project.save();

        await recordBudgetSnapshot({
          projectId: project._id,
          label: `CO #${changeOrder.number} approved`,
          total: project.currentBudget,
          byCategory: {},
          source: "change_order",
          changeOrderId: changeOrder._id,
        });

        await appendTimeline({
          projectId: project._id,
          type: "change_order_accepted",
          title: `Change Order #${changeOrder.number} approved`,
          description: changeOrder.title,
          amountAfter: changeOrder.totalDelta,
          changeOrderId: changeOrder._id,
        });
      }

      const approvalLink = `${env.webOrigin}/approve/co?id=${changeOrder._id}`;
      changeOrder.pdfFilePath = await generateChangeOrderPdf({ project, changeOrder, approvalLink });
      await changeOrder.save();

      return {
        ok: true,
        status: changeOrder.status,
        approvalCount: changeOrder.approvals.length,
        requiredApprovals,
      };
    },
  );
}
