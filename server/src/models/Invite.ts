import { Schema, model, type InferSchemaType } from "mongoose";
import { MEMBER_ROLES } from "@2bn/shared";

const inviteSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    email: { type: String, required: true, lowercase: true },
    role: { type: String, required: true },
    tokenHash: { type: String, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
  },
  { timestamps: true },
);

inviteSchema.index({ email: 1, projectId: 1 });

export type InviteDocument = InferSchemaType<typeof inviteSchema> & { _id: Schema.Types.ObjectId };
export const InviteModel = model("Invite", inviteSchema);
