import nodemailer from "nodemailer";
import { env } from "../config/env.js";

import { OrganizationModel } from "../models/Organization.js";

const transporter =
  env.smtpHost.length > 0
    ? nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpPort === 465,
        family: 4, // Force IPv4 to prevent IPv6 network unreachable errors on Render
        auth:
          env.smtpUser && env.smtpPass
            ? { user: env.smtpUser, pass: env.smtpPass }
            : undefined,
      } as any)
    : null;

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; path?: string; content?: Buffer }>;
  orgId?: string;
}): Promise<void> {
  let activeTransporter = transporter;
  let fromEmail = env.smtpFrom;

  if (input.orgId) {
    const org = await OrganizationModel.findById(input.orgId);
    if (org && org.smtpHost && org.smtpPort && org.smtpUser && org.smtpPass) {
      activeTransporter = nodemailer.createTransport({
        host: org.smtpHost,
        port: org.smtpPort,
        secure: org.smtpPort === 465,
        family: 4, // Force IPv4
        auth: {
          user: org.smtpUser,
          pass: org.smtpPass,
        },
      } as any);
      fromEmail = org.smtpFrom || org.smtpUser;
    }
  }

  if (!activeTransporter) {
    console.info(`[email:dev] To: ${input.to}\nSubject: ${input.subject}\n${input.html}`);
    if (input.attachments && input.attachments.length > 0) {
      console.info(`[email:dev] Attachments: ${input.attachments.map(a => a.filename).join(", ")}`);
    }
    return;
  }

  await activeTransporter.sendMail({
    from: fromEmail,
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      path: a.path,
      content: a.content,
    })),
  });
}

export function buildMagicLinkEmail(link: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#1a1a1a;">2bn Selections</h2>
      <p>Click the button below to sign in. This link expires in 15 minutes.</p>
      <a href="${link}" style="display:inline-block;background:#b8860b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">Sign in</a>
      <p style="color:#666;font-size:13px;margin-top:24px;">If you did not request this, ignore this email.</p>
    </div>
  `;
}

export function buildInviteEmail(link: string, name: string, roleName: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #eaeaea;border-radius:12px;">
      <h2 style="color:#111827;font-size:20px;font-weight:700;margin-bottom:16px;">You've been invited!</h2>
      <p style="color:#374151;font-size:14px;line-height:20px;">Hi ${name},</p>
      <p style="color:#374151;font-size:14px;line-height:20px;">You have been invited to join <strong>2bn Selections</strong> as a <strong>${roleName}</strong>.</p>
      <p style="color:#374151;font-size:14px;line-height:20px;margin-bottom:24px;">Please click the button below to accept your invitation and configure your password:</p>
      <a href="${link}" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;text-align:center;">Accept Invitation</a>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">This invitation will expire in 7 days.</p>
    </div>
  `;
}

export function buildChangeOrderApprovalEmail(input: {
  projectName: string;
  changeOrderTitle: string;
  approvalLink: string;
}): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#1a1a1a;">Change Order Approval Required</h2>
      <p>Project: <strong>${input.projectName}</strong></p>
      <p>${input.changeOrderTitle}</p>
      <a href="${input.approvalLink}" style="display:inline-block;background:#b8860b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">Review &amp; Sign</a>
    </div>
  `;
}
