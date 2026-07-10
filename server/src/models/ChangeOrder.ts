import { Schema, model, type InferSchemaType } from "mongoose";
import { CHANGE_ORDER_STATUSES } from "@2bn/shared";

const changeOrderLineSchema = new Schema(
  {
    category: { type: String, required: true },
    description: { type: String, required: true },
    previousAmount: { type: Number, required: true },
    newAmount: { type: Number, required: true },
    delta: { type: Number, required: true },
  },
  { _id: false },
);

const approvalRecordSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    email: { type: String },
    signatureType: { type: String, enum: ["drawn", "typed", "both"] },
    typedName: { type: String },
    signatureImagePath: { type: String },
    ipAddress: { type: String },
    geoLatitude: { type: Number },
    geoLongitude: { type: Number },
    decidedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const changeOrderSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    number: { type: Number, required: true },
    title: { type: String, required: true },
    status: { type: String, enum: CHANGE_ORDER_STATUSES, default: "draft" },
    lines: [changeOrderLineSchema],
    totalDelta: { type: Number, required: true },
    notes: { type: String, default: "" },
    pdfFilePath: { type: String },
    approvalTokenHash: { type: String },
    approvalTokenExpiresAt: { type: Date },
    approvals: [approvalRecordSchema],
    releasedAt: { type: Date },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectReason: { type: String },
  },
  { timestamps: true },
);

changeOrderSchema.index({ projectId: 1, number: 1 }, { unique: true });
changeOrderSchema.index({ status: 1 });

export type ChangeOrderDocument = InferSchemaType<typeof changeOrderSchema> & {
  _id: Schema.Types.ObjectId;
};
export const ChangeOrderModel = model("ChangeOrder", changeOrderSchema);
