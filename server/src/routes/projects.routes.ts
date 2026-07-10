import { createProjectSchema, inviteHomeownerSchema, updateProjectSchema } from "@2bn/shared";
import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { requireProjectAccess } from "../middleware/project-access.js";
import { BudgetSnapshotModel } from "../models/BudgetSnapshot.js";
import { ChangeOrderModel } from "../models/ChangeOrder.js";
import { InviteModel } from "../models/Invite.js";
import { ProjectMemberModel } from "../models/ProjectMember.js";
import { ProjectModel } from "../models/Project.js";
import { ProjectSelectionModel } from "../models/ProjectSelection.js";
import { TimelineEventModel } from "../models/TimelineEvent.js";
import { UserModel } from "../models/User.js";
import { hashPassword } from "../services/auth.service.js";
import { buildMagicLinkEmail, sendEmail } from "../services/email.service.js";
import { appendTimeline, recordBudgetSnapshot } from "../services/project.service.js";
import { env } from "../config/env.js";
import { mapProject, mapProjectSelection } from "../utils/mappers.js";
import { getProjectParams } from "../utils/route-params.js";
import { generateSecureToken, hashToken } from "../utils/tokens.js";

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/projects",
    { preHandler: [requireAuth] },
    async (request) => {
      const user = request.user!;
      let filter: any = { deleted: { $ne: true } };

      if (user.role === "client") {
        filter.ownerClientId = user.sub;
      } else if (user.role === "end_user") {
        filter.endUserIds = user.sub;
      }

      const projects = await ProjectModel.find(filter).sort({ updatedAt: -1 });
      return { projects: projects.map(mapProject) };
    },
  );

  app.get(
    "/api/projects/:projectId",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request, reply) => {
      const project = await ProjectModel.findById(getProjectParams(request).projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }
      return { project: mapProject(project) };
    },
  );

  app.post(
    "/api/projects",
    { preHandler: [requireAuth, requireRole("admin", "client")] },
    async (request, reply) => {
      const body = createProjectSchema.parse(request.body);
      const user = request.user!;

      let orgId = user.orgId;
      if (!orgId && user.role === "admin") {
        const defaultOrg = await import("../models/Organization.js").then((module) =>
          module.OrganizationModel.findOne({ slug: "2bn" }),
        );
        orgId = defaultOrg?._id.toString();
      }
      if (!orgId) {
        return reply.code(400).send({ error: "User missing organization" });
      }

      const project = await ProjectModel.create({
        orgId,
        name: body.name,
        clientName: body.clientName,
        address: body.address,
        ownerClientId: user.sub,
        themeId: body.themeId,
        requiresDualApproval: body.requiresDualApproval,
        status: "active",
        rooms: body.rooms || [],
      });


      await appendTimeline({
        projectId: project._id,
        type: "project_created",
        title: "Project created",
        description: `${project.name} — ${project.clientName}`,
        actorId: user.sub as unknown as import("mongoose").Types.ObjectId,
      });

      if (body.primaryHomeownerEmail) {
        await inviteHomeownerInternal({
          projectId: project._id.toString(),
          email: body.primaryHomeownerEmail,
          role: "primary_homeowner",
          invitedBy: user.sub,
          orgId: orgId,
        });
      }

      if (body.secondaryHomeownerEmail) {
        await inviteHomeownerInternal({
          projectId: project._id.toString(),
          email: body.secondaryHomeownerEmail,
          role: "secondary_homeowner",
          invitedBy: user.sub,
          orgId: orgId,
        });
        project.requiresDualApproval = true;
        await project.save();
      }

      return { project: mapProject(project) };
    },
  );

  app.patch(
    "/api/projects/:projectId",
    { preHandler: [requireAuth, requireRole("admin", "project_manager", "client"), requireProjectAccess] },
    async (request, reply) => {
      const body = updateProjectSchema.parse(request.body);
      const project = await ProjectModel.findById(getProjectParams(request).projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      Object.assign(project, body);

      // Handle homeowner email changes
      const orgId = project.orgId.toString();

      if (body.primaryHomeownerEmail) {
        const hasMember = await ProjectMemberModel.findOne({
          projectId: project._id,
          role: "primary_homeowner",
        }).populate("userId");
        const existingEmail = (hasMember?.userId as any)?.email;
        if (existingEmail !== body.primaryHomeownerEmail.toLowerCase()) {
          if (hasMember) {
            project.endUserIds = project.endUserIds.filter(
              (id) => id.toString() !== (hasMember.userId as any)?._id.toString()
            );
            await ProjectMemberModel.deleteOne({ _id: hasMember._id });
          }
          await inviteHomeownerInternal({
            projectId: project._id.toString(),
            email: body.primaryHomeownerEmail,
            role: "primary_homeowner",
            invitedBy: request.user!.sub,
            orgId,
          });
        }
      }

      if (body.secondaryHomeownerEmail) {
        const hasMember = await ProjectMemberModel.findOne({
          projectId: project._id,
          role: "secondary_homeowner",
        }).populate("userId");
        const existingEmail = (hasMember?.userId as any)?.email;
        if (existingEmail !== body.secondaryHomeownerEmail.toLowerCase()) {
          if (hasMember) {
            project.endUserIds = project.endUserIds.filter(
              (id) => id.toString() !== (hasMember.userId as any)?._id.toString()
            );
            await ProjectMemberModel.deleteOne({ _id: hasMember._id });
          }
          await inviteHomeownerInternal({
            projectId: project._id.toString(),
            email: body.secondaryHomeownerEmail,
            role: "secondary_homeowner",
            invitedBy: request.user!.sub,
            orgId,
          });
          project.requiresDualApproval = true;
        }
      }

      await project.save();
      return { project: mapProject(project) };
    },
  );

  app.get(
    "/api/projects/:projectId/selections",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request) => {
      const selections = await ProjectSelectionModel.find({
        projectId: getProjectParams(request).projectId,
      });
      return {
        selections: selections.map((s) => mapProjectSelection(s as any)),
      };
    },
  );

  app.get(
    "/api/projects/:projectId/timeline",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request) => {
      const events = await TimelineEventModel.find({
        projectId: getProjectParams(request).projectId,
      }).sort({ createdAt: -1 });
      return {
        events: events.map((event) => ({
          id: event._id.toString(),
          projectId: event.projectId.toString(),
          type: event.type,
          title: event.title,
          description: event.description,
          amountBefore: event.amountBefore,
          amountAfter: event.amountAfter,
          category: event.category,
          changeOrderId: event.changeOrderId?.toString(),
          createdAt: event.createdAt.toISOString(),
        })),
      };
    },
  );

  app.get(
    "/api/projects/:projectId/budget-snapshots",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request) => {
      const snapshots = await BudgetSnapshotModel.find({
        projectId: getProjectParams(request).projectId,
      }).sort({ recordedAt: -1 });
      return {
        snapshots: snapshots.map((snapshot) => ({
          id: snapshot._id.toString(),
          projectId: snapshot.projectId.toString(),
          label: snapshot.label,
          total: snapshot.total,
          byCategory: Object.fromEntries(snapshot.byCategory ?? new Map()),
          source: snapshot.source,
          changeOrderId: snapshot.changeOrderId?.toString(),
          recordedAt: snapshot.recordedAt.toISOString(),
        })),
      };
    },
  );

  app.get(
    "/api/projects/:projectId/members",
    { preHandler: [requireAuth, requireRole("admin", "project_manager", "client"), requireProjectAccess] },
    async (request) => {
      const members = await ProjectMemberModel.find({
        projectId: getProjectParams(request).projectId,
      }).populate("userId", "email name");

      return {
        members: members.map((member) => {
          const user = member.userId as unknown as { email: string; name: string; _id: { toString(): string } };
          return {
            id: member._id.toString(),
            projectId: member.projectId.toString(),
            userId: user._id.toString(),
            email: user.email,
            name: user.name,
            role: member.role,
            canSelect: member.canSelect,
            canApproveChangeOrders: member.canApproveChangeOrders,
            invitedAt: member.invitedAt.toISOString(),
            acceptedAt: member.acceptedAt?.toISOString(),
          };
        }),
      };
    },
  );

  app.post(
    "/api/projects/:projectId/invite",
    { preHandler: [requireAuth, requireRole("admin", "project_manager", "client"), requireProjectAccess] },
    async (request) => {
      const body = inviteHomeownerSchema.parse(request.body);
      const user = request.user!;
      await inviteHomeownerInternal({
        projectId: getProjectParams(request).projectId,
        email: body.email,
        role: body.role,
        invitedBy: user.sub,
        orgId: user.orgId ?? "",
      });
      return { ok: true };
    },
  );

  app.post(
    "/api/projects/:projectId/submit-proposal",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request, reply) => {
      const { projectId } = getProjectParams(request);
      const user = request.user!;
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      const body = request.body as {
        signatureType: "drawn" | "typed";
        typedName?: string;
        signatureImageBase64?: string;
      };

      if (!body.signatureType) {
        return reply.code(400).send({ error: "Signature type is required" });
      }

      // Save drawn signature if applicable
      let signatureImagePath: string | undefined;
      if (body.signatureType === "drawn" && body.signatureImageBase64) {
        const parts = body.signatureImageBase64.split(";base64,");
        const base64Data = parts.pop() || "";
        const sigBuffer = Buffer.from(base64Data, "base64");
        
        await fs.mkdir(path.join(env.uploadsDir, "signatures"), { recursive: true });
        const sigFileName = `sig-${projectId}-${Date.now()}.png`;
        signatureImagePath = path.join(env.uploadsDir, "signatures", sigFileName);
        await fs.writeFile(signatureImagePath, sigBuffer);
      }

      // Load all selections
      const selections = await ProjectSelectionModel.find({ projectId: project._id });

      // Generate PDF
      const pdfService = await import("../services/pdf.service.js");
      const isUpdatedProposal = project.proposalSigned;
      const proposalVersion = isUpdatedProposal ? 2 : 1; 

      const pdfPath = await pdfService.generateProposalPdf({
        project: {
          _id: project._id,
          name: project.name,
          clientName: project.clientName,
          address: project.address,
          rooms: (project as any).rooms,
        },
        selections: selections.map((s) => ({
          categoryKey: s.categoryKey,
          product: s.product ?? undefined,
          manufacturer: s.manufacturer ?? undefined,
          model: s.model ?? undefined,
          level: s.level ?? undefined,
          finish: s.finish ?? undefined,
          quantity: s.quantity,
          priceUsed: s.priceUsed ?? undefined,
          discountPercent: s.discountPercent ?? undefined,
          discountFlat: s.discountFlat ?? undefined,
        })),
        signatureType: body.signatureType,
        typedName: body.typedName,
        signatureImagePath,
        version: proposalVersion,
      });

      // Read PDF file into Buffer
      const pdfBuffer = await fs.readFile(pdfPath);
      
      // Delete temp file asynchronously to avoid disk buildup
      fs.unlink(pdfPath).catch((err) => app.log.error(err, "Failed to delete temp PDF file"));

      // If this is an updated proposal, create a Change Order from the delta
      if (isUpdatedProposal) {
        const lastSnapshot = await BudgetSnapshotModel.findOne({
          projectId: project._id,
        }).sort({ createdAt: -1 });

        const lastSnapshotMap = lastSnapshot?.byCategory || new Map();

        // Compute current byCategory
        const currentByCategory: Record<string, number> = {};
        selections.forEach((s) => {
          const amount = (s.priceUsed || 0) * (s.quantity || 1);
          currentByCategory[s.categoryKey] = (currentByCategory[s.categoryKey] ?? 0) + amount;
        });

        // Collect all keys
        const lastKeys = lastSnapshotMap instanceof Map ? Array.from(lastSnapshotMap.keys()) : Object.keys(lastSnapshotMap || {});
        const allKeys = new Set([
          ...lastKeys,
          ...Object.keys(currentByCategory),
        ]);

        const lines: any[] = [];
        allKeys.forEach((key) => {
          const prevVal = (lastSnapshotMap instanceof Map ? lastSnapshotMap.get(key) : (lastSnapshotMap as any)[key]) || 0;
          const newVal = currentByCategory[key] || 0;
          if (prevVal !== newVal) {
            lines.push({
              category: key,
              description: newVal > 0 
                ? `Updated selection for ${key.split(" - ").pop()}`
                : `Removed selection for ${key.split(" - ").pop()}`,
              previousAmount: prevVal,
              newAmount: newVal,
              delta: newVal - prevVal,
            });
          }
        });

        if (lines.length > 0) {
          const lastCONumber = await ChangeOrderModel.findOne({ projectId: project._id })
            .sort({ number: -1 })
            .select("number");
          const nextCONumber = (lastCONumber?.number ?? 0) + 1;
          const totalDelta = lines.reduce((sum, l) => sum + l.delta, 0);

          await ChangeOrderModel.create({
            projectId: project._id,
            number: nextCONumber,
            title: `Updated Selections (Proposal V${proposalVersion})`,
            status: "approved",
            lines,
            totalDelta,
            notes: `Auto-generated from signed homeowner selections update (Proposal Version ${proposalVersion}).`,
            pdfFilePath: `/api/projects/${project._id.toString()}/proposal-pdf`,
            approvedAt: new Date(),
            approvals: [{
              userId: user.sub,
              email: user.email,
              signatureType: body.signatureType,
              typedName: body.typedName,
              decidedAt: new Date(),
            }]
          });

          // Append to timeline
          await appendTimeline({
            projectId: project._id,
            type: "change_order_approved",
            title: `Change Order #${nextCONumber} approved`,
            description: `Auto-generated and approved from signed selections update.`,
            amountAfter: totalDelta,
          });
        }
      }

      // Update project status and locks
      project.proposalSigned = true;
      project.proposalPdfUrl = `/api/projects/${project._id.toString()}/proposal-pdf`;
      project.proposalPdfBuffer = pdfBuffer;
      project.proposalSignedAt = new Date();
      project.proposalSignedBy = user.email;
      project.proposalSignatureType = body.signatureType;
      project.proposalTypedName = body.typedName;
      project.proposalSignatureIp = request.ip;
      if ((body as any).geo) {
        project.proposalSignatureGeo = {
          latitude: (body as any).geo.latitude,
          longitude: (body as any).geo.longitude,
        };
      }
      project.proposalEmailStatus = "sending";
      project.proposalEmailError = "";
      project.unlockedCategoryKeys = [];
      project.status = "selections_complete";
      await project.save();

      // Record timeline event
      await appendTimeline({
        projectId: project._id,
        type: isUpdatedProposal ? "updated_proposal_signed" : "initial_proposal_signed",
        title: isUpdatedProposal ? "Updated Selections Proposal Signed" : "Initial Selections Proposal Signed",
        description: `Signed by ${user.email} (Version #${proposalVersion})`,
        actorId: user.sub as unknown as import("mongoose").Types.ObjectId,
      });

      // Send email copies in background using the memory Buffer
      (async () => {
        try {
          const pmUser = await UserModel.findById(project.ownerClientId);
          const endUsers = await UserModel.find({ _id: { $in: project.endUserIds } });
          const recipients = [pmUser?.email, ...endUsers.map((u) => u.email)].filter(Boolean) as string[];

          const emailHtml = `
            <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;">
              <h2 style="color:#0f3e20;">2bn Selections — Proposal Signed</h2>
              <p>The selections proposal for project <strong>${project.name}</strong> has been signed and finalized by <strong>${project.clientName}</strong>.</p>
              <p>Please find the attached signed PDF document for your records.</p>
              <p style="color:#666;font-size:12px;">This is an automated notification from 2bn Selections.</p>
            </div>
          `;

          for (const email of recipients) {
            await sendEmail({
              to: email,
              subject: `Signed Selections Proposal — ${project.name}`,
              html: emailHtml,
              attachments: [
                {
                  filename: `proposal-${project.name.replace(/\s+/g, "_")}.pdf`,
                  content: pdfBuffer,
                },
              ],
            });
          }

          await ProjectModel.updateOne(
            { _id: project._id },
            { $set: { proposalEmailStatus: "sent", proposalEmailError: "" } }
          );
        } catch (emailErr: any) {
          app.log.error(emailErr, `Failed to send proposal PDF email background job`);
          await ProjectModel.updateOne(
            { _id: project._id },
            { $set: { proposalEmailStatus: "failed", proposalEmailError: emailErr?.message || String(emailErr) } }
          );
        }
      })();

      return {
        success: true,
        proposalPdfUrl: project.proposalPdfUrl,
        status: project.status,
      };
    },
  );

  app.get(
    "/api/projects/:projectId/proposal-draft-pdf",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request, reply) => {
      const { projectId } = getProjectParams(request);
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      const selections = await ProjectSelectionModel.find({ projectId: project._id });
      const pdfService = await import("../services/pdf.service.js");
      const pdfPath = await pdfService.generateProposalPdf({
        project: {
          _id: project._id,
          name: project.name,
          clientName: project.clientName,
          address: project.address,
          rooms: (project as any).rooms,
        },
        selections: selections.map((s) => ({
          categoryKey: s.categoryKey,
          product: s.product ?? undefined,
          manufacturer: s.manufacturer ?? undefined,
          model: s.model ?? undefined,
          level: s.level ?? undefined,
          finish: s.finish ?? undefined,
          quantity: s.quantity,
          priceUsed: s.priceUsed ?? undefined,
        })),
        signatureType: "typed",
        typedName: "",
        version: 0,
      });

      const buffer = await fs.readFile(pdfPath);
      reply.type("application/pdf");
      return buffer;
    },
  );

  app.get(
    "/api/projects/:projectId/proposal-pdf",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request, reply) => {
      const { projectId } = getProjectParams(request);
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }
      if (!project.proposalPdfBuffer) {
        return reply.code(404).send({ error: "Signed proposal PDF not found in database" });
      }

      reply.type("application/pdf");
      reply.header("Content-Disposition", `inline; filename="proposal-${project.name.replace(/\s+/g, "_")}.pdf"`);
      return project.proposalPdfBuffer;
    }
  );

  app.post(
    "/api/projects/:projectId/resend-signed-proposal",
    { preHandler: [requireAuth, requireRole("admin", "project_manager")] },
    async (request, reply) => {
      const { projectId } = getProjectParams(request);
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }
      if (!project.proposalPdfBuffer) {
        return reply.code(400).send({ error: "No signed proposal PDF exists for this project" });
      }

      project.proposalEmailStatus = "sending";
      project.proposalEmailError = "";
      await project.save();

      setImmediate(async () => {
        try {
          const pmUser = await UserModel.findById(project.ownerClientId);
          const endUsers = await UserModel.find({ _id: { $in: project.endUserIds } });
          const recipients = [pmUser?.email, ...endUsers.map((u) => u.email)].filter(Boolean) as string[];

          const emailHtml = `
            <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;">
              <h2 style="color:#0f3e20;">2bn Selections — Proposal Signed</h2>
              <p>Here is the signed selections proposal for project <strong>${project.name}</strong> signed by <strong>${project.clientName}</strong>.</p>
              <p>Please find the attached signed PDF document for your records.</p>
              <p style="color:#666;font-size:12px;">This is an automated notification from 2bn Selections.</p>
            </div>
          `;

          for (const email of recipients) {
            await sendEmail({
              to: email,
              subject: `Signed Selections Proposal — ${project.name}`,
              html: emailHtml,
              attachments: [
                {
                  filename: `proposal-${project.name.replace(/\s+/g, "_")}.pdf`,
                  content: project.proposalPdfBuffer,
                },
              ],
            });
          }

          await ProjectModel.updateOne(
            { _id: project._id },
            { $set: { proposalEmailStatus: "sent", proposalEmailError: "" } }
          );
        } catch (emailErr: any) {
          app.log.error(emailErr, `Failed to resend proposal PDF email background job`);
          await ProjectModel.updateOne(
            { _id: project._id },
            { $set: { proposalEmailStatus: "failed", proposalEmailError: emailErr?.message || String(emailErr) } }
          );
        }
      });

      return { success: true, message: "Email resend queued successfully" };
    }
  );
  
  app.post(
    "/api/projects/:projectId/submit-selections",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request, reply) => {
      const { projectId } = getProjectParams(request);
      const user = request.user!;
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      // Load all selections
      const selections = await ProjectSelectionModel.find({ projectId: project._id });

      // Group selections by state
      const confirmedSels = selections.filter((s) => s.state === "confirmed");
      const skippedSels = selections.filter((s) => s.state === "skipped");

      let selectionsListHtml = "";
      if (confirmedSels.length === 0 && skippedSels.length === 0) {
        selectionsListHtml = "<p>No selections made yet.</p>";
      } else {
        selectionsListHtml += '<h3 style="color:#0f3e20;border-bottom:1px solid #ddd;padding-bottom:4px;">Confirmed Selections</h3>';
        selectionsListHtml += `
          <table style="width:100%; border-collapse:collapse; margin-bottom: 20px; font-size: 14px;">
            <thead>
              <tr style="background-color:#0f3e20; color:white; text-align:left;">
                <th style="padding:10px; border:1px solid #ddd;">Category</th>
                <th style="padding:10px; border:1px solid #ddd;">Selection Detail</th>
                <th style="padding:10px; border:1px solid #ddd; text-align:center;">Qty</th>
                <th style="padding:10px; border:1px solid #ddd; text-align:right;">Unit Price</th>
              </tr>
            </thead>
            <tbody>
        `;
        confirmedSels.forEach((sel) => {
          const detail = [sel.manufacturer, sel.model, sel.product].filter(Boolean).join(" ");
          selectionsListHtml += `
            <tr>
              <td style="padding:8px; border:1px solid #ddd; font-weight:600;">${sel.categoryKey.split(" - ").slice(-1)[0]}</td>
              <td style="padding:8px; border:1px solid #ddd;">${detail || "Standard Option"}</td>
              <td style="padding:8px; border:1px solid #ddd; text-align:center;">${sel.quantity}</td>
              <td style="padding:8px; border:1px solid #ddd; text-align:right;">$${(sel.priceUsed || 0).toFixed(2)}</td>
            </tr>
          `;
        });
        selectionsListHtml += "</tbody></table>";

        if (skippedSels.length > 0) {
          selectionsListHtml += '<h3 style="color:#777;border-bottom:1px solid #ddd;padding-bottom:4px;">Skipped Categories (Out of Scope)</h3><ul style="font-size:14px;line-height:1.6;margin-top:8px;">';
          skippedSels.forEach((sel) => {
            selectionsListHtml += `<li><strong>${sel.categoryKey.split(" - ").slice(-1)[0]}</strong></li>`;
          });
          selectionsListHtml += "</ul>";
        }
      }

      // Record timeline event
      await appendTimeline({
        projectId: project._id,
        type: "selections_submitted",
        title: "Selections Sheet Completed & Submitted",
        description: `Selections submitted by homeowner (${user.email}). Awaiting contract signature.`,
        actorId: user.sub as unknown as import("mongoose").Types.ObjectId,
      });

      project.status = "selections_submitted";
      await project.save();

      // Notify PM
      const pmUser = await UserModel.findById(project.ownerClientId);
      const pmEmail = pmUser?.email;

      if (pmEmail) {
        const emailHtml = `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto; border:1px solid #ddd; padding: 24px; border-radius: 8px; background-color:#fcfcfc;">
            <h2 style="color:#0f3e20; border-bottom: 2px solid #C5A028; padding-bottom: 8px; margin-top:0;">2bn Selections — Selections Completed</h2>
            <p>The client <strong>${project.clientName}</strong> has completed their selection sheet for project <strong>${project.name}</strong>.</p>
            <p>They are now ready to digitally sign the initial proposal PDF. Below is the list of selections submitted by the client:</p>
            ${selectionsListHtml}
            <div style="margin-top: 24px; padding: 12px; background-color:#f5f7f5; border-radius:6px; border-left:4px solid #0f3e20; font-size:13px; color:#444;">
              <strong>Next Steps:</strong> The homeowner has been prompted to electronically sign the finalized proposal. Once signed, you will receive another notification with the signed contract PDF.
            </div>
            <p style="margin-top: 24px; font-size:12px; color:#999; text-align:center;">This is an automated notification from 2bn Selections.</p>
          </div>
        `;

        try {
          await sendEmail({
            to: pmEmail,
            subject: `Selections Completed & Submitted — ${project.name}`,
            html: emailHtml,
          });
        } catch (emailErr) {
          app.log.error(emailErr, `Failed to send selections submitted email to PM ${pmEmail}`);
        }
      }

      return { success: true };
    },
  );

  app.post(
    "/api/projects/:projectId/unlock-categories",
    { preHandler: [requireAuth, requireRole("admin", "client"), requireProjectAccess] },
    async (request, reply) => {
      const { projectId } = getProjectParams(request);
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      const body = request.body as { unlockedCategoryKeys: string[] };
      if (!Array.isArray(body.unlockedCategoryKeys)) {
        return reply.code(400).send({ error: "unlockedCategoryKeys must be an array of strings" });
      }

      project.unlockedCategoryKeys = body.unlockedCategoryKeys;
      await project.save();

      await appendTimeline({
        projectId: project._id,
        type: "categories_unlocked",
        title: "Category Selection Sheet Unlocked",
        description: `Unlocked categories: ${body.unlockedCategoryKeys.map(k => k.split(" - ").slice(-1)[0]).join(", ") || "None"}`,
        actorId: request.user!.sub as unknown as import("mongoose").Types.ObjectId,
      });

      return {
        success: true,
        unlockedCategoryKeys: project.unlockedCategoryKeys,
      };
    },
  );

  app.post(
    "/api/projects/:projectId/toggle-lock",
    { preHandler: [requireAuth, requireRole("admin", "client"), requireProjectAccess] },
    async (request, reply) => {
      const { projectId } = getProjectParams(request);
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      const body = request.body as { locked: boolean };
      if (typeof body.locked !== "boolean") {
        return reply.code(400).send({ error: "locked must be a boolean" });
      }

      project.projectLocked = body.locked;
      await project.save();

      await appendTimeline({
        projectId: project._id,
        type: body.locked ? "project_locked" : "project_unlocked",
        title: body.locked ? "Project Selections Locked" : "Project Selections Unlocked",
        description: body.locked 
          ? "The project selections sheet was locked by the Project Manager."
          : "The project selections sheet was unlocked by the Project Manager.",
        actorId: request.user!.sub as unknown as import("mongoose").Types.ObjectId,
      });

      return {
        success: true,
        projectLocked: project.projectLocked,
      };
    }
  );

  app.post(
    "/api/projects/:projectId/toggle-decide-later",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request, reply) => {
      const { projectId } = getProjectParams(request);
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      const body = request.body as { categoryKey: string; slotLabel?: string; decideLater: boolean };
      if (!body.categoryKey || typeof body.decideLater !== "boolean") {
        return reply.code(400).send({ error: "Invalid parameters" });
      }

      const slotLabel = body.slotLabel || "";
      const slotKey = `${body.categoryKey}::${slotLabel}`;
      let list = project.decideLaterSlots || [];
      if (body.decideLater) {
        if (!list.includes(slotKey)) {
          list.push(slotKey);
        }
      } else {
        list = list.filter((item) => item !== slotKey);
      }

      project.decideLaterSlots = list;
      await project.save();

      return {
        success: true,
        decideLaterSlots: project.decideLaterSlots,
      };
    }
  );

  app.patch(
    "/api/projects/:projectId/last-visited",
    { preHandler: [requireAuth, requireProjectAccess] },
    async (request, reply) => {
      const { projectId } = getProjectParams(request);
      const { lastVisitedCategoryKey } = request.body as { lastVisitedCategoryKey: string };
      if (!lastVisitedCategoryKey) {
        return reply.code(400).send({ error: "lastVisitedCategoryKey is required" });
      }
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }
      project.lastVisitedCategoryKey = lastVisitedCategoryKey;
      await project.save();
      return { success: true };
    }
  );
  app.get(
    "/api/projects/recycle-bin",
    { preHandler: [requireAuth] },
    async (request) => {
      const user = request.user!;
      let filter: any = { deleted: true };
      if (user.role === "client") {
        filter.ownerClientId = user.sub;
      }
      const projects = await ProjectModel.find(filter).sort({ updatedAt: -1 });
      return { projects: projects.map(mapProject) };
    }
  );

  app.delete(
    "/api/projects/:projectId",
    { preHandler: [requireAuth, requireRole("admin", "client")] },
    async (request, reply) => {
      const { projectId } = getProjectParams(request);
      const permanent = (request.query as { permanent?: string }).permanent === "true";

      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      if (permanent) {
        await ProjectModel.findByIdAndDelete(projectId);
        await appendTimeline({
          projectId: project._id,
          type: "project_deleted",
          title: "Project permanently deleted",
          actorId: request.user!.sub as any,
        });
        return { success: true, permanent: true };
      } else {
        project.set("deleted", true);
        project.set("deletedAt", new Date());
        await project.save();
        await appendTimeline({
          projectId: project._id,
          type: "project_deleted",
          title: "Project sent to Recycle Bin",
          actorId: request.user!.sub as any,
        });
        return { success: true, permanent: false };
      }
    }
  );

  app.post(
    "/api/projects/:projectId/restore",
    { preHandler: [requireAuth, requireRole("admin", "client")] },
    async (request, reply) => {
      const { projectId } = getProjectParams(request);
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: "Project not found" });
      }

      project.set("deleted", false);
      project.set("deletedAt", undefined);
      await project.save();

      await appendTimeline({
        projectId: project._id,
        type: "project_restored",
        title: "Project restored from Recycle Bin",
        actorId: request.user!.sub as any,
      });

      return { success: true };
    }
  );
}


async function inviteHomeownerInternal(input: {
  projectId: string;
  email: string;
  role: "primary_homeowner" | "secondary_homeowner";
  invitedBy: string;
  orgId: string;
}): Promise<void> {
  const project = await ProjectModel.findById(input.projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const orgId = project.orgId;

  let user = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (!user) {
    user = await UserModel.create({
      email: input.email.toLowerCase(),
      name: input.email.split("@")[0],
      role: "end_user",
      orgId,
      status: "invited",
      passwordHash: generateSecureToken(), // No need to hash a temp password since status is "invited"
    });
  }

  const rawToken = generateSecureToken();
  await InviteModel.create({
    orgId,
    projectId: project._id,
    email: input.email.toLowerCase(),
    role: input.role,
    tokenHash: hashToken(rawToken),
    invitedBy: input.invitedBy,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  if (!project.endUserIds.some((id) => id.toString() === user!._id.toString())) {
    project.endUserIds.push(user._id);
    await project.save();
  }

  await ProjectMemberModel.findOneAndUpdate(
    { projectId: project._id, userId: user._id },
    {
      projectId: project._id,
      userId: user._id,
      role: input.role,
      invitedAt: new Date(),
    },
    { upsert: true },
  );

  const link = `${env.webOrigin}/auth/magic?token=${rawToken}`;
  await sendEmail({
    to: input.email,
    subject: "You're invited to 2bn Selections",
    html: buildMagicLinkEmail(link),
  });
}
