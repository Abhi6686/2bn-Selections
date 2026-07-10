import { Schema, model, type InferSchemaType } from "mongoose";
import { MEMBER_ROLES } from "@2bn/shared";

const projectMemberSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: MEMBER_ROLES, required: true },
    canSelect: { type: Boolean, default: true },
    canApproveChangeOrders: { type: Boolean, default: true },
    invitedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date },
  },
  { timestamps: true },
);

projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export type ProjectMemberDocument = InferSchemaType<typeof projectMemberSchema> & {
  _id: Schema.Types.ObjectId;
};
export const ProjectMemberModel = model("ProjectMember", projectMemberSchema);
