import { Schema, model, type InferSchemaType } from "mongoose";
import { PROJECT_STATUSES } from "@2bn/shared";

const projectRoomSlotSchema = new Schema(
  {
    slotKey: { type: String, required: true },
    slotLabel: { type: String },
    categoryKey: { type: String, required: true },
    required: { type: Boolean, default: true },
    allowance: { type: Number },
  },
  { _id: false }
);

const projectRoomSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    icon: { type: String },
    sortOrder: { type: Number, default: 0 },
    slots: [projectRoomSlotSchema],
  },
  { _id: false }
);

const projectSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    clientName: { type: String, required: true },
    address: { type: String, default: "" },
    ownerClientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    themeId: { type: Schema.Types.ObjectId, ref: "Theme" },
    status: { type: String, enum: PROJECT_STATUSES, default: "active" },
    requiresDualApproval: { type: Boolean, default: false },
    initialBudget: { type: Number, default: 0 },
    currentBudget: { type: Number, default: 0 },
    lastVisitedCategoryKey: { type: String },
    allowancesByCategory: { type: Map, of: Number, default: {} },
    proposalSigned: { type: Boolean, default: false },
    proposalPdfUrl: { type: String },
    proposalSignedAt: { type: Date },
    proposalSignedBy: { type: String },
    proposalSignatureType: { type: String },
    proposalTypedName: { type: String },
    proposalSignatureIp: { type: String },
    proposalSignatureGeo: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    proposalEmailStatus: { type: String, enum: ["pending", "sending", "sent", "failed"], default: "pending" },
    proposalEmailError: { type: String },
    unlockedCategoryKeys: { type: [String], default: [] },
    projectLocked: { type: Boolean, default: false },
    showPrices: { type: Boolean, default: true },
    decideLaterSlots: { type: [String], default: [] },
    rooms: { type: [projectRoomSchema], default: [] },
    deleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);


projectSchema.index({ endUserIds: 1 });
projectSchema.index({ status: 1 });

export type ProjectDocument = InferSchemaType<typeof projectSchema> & { _id: Schema.Types.ObjectId };
export const ProjectModel = model("Project", projectSchema);

