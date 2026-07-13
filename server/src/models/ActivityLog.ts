import { Schema, model, type InferSchemaType } from "mongoose";

const activityLogSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    userRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    // e.g. "library_item" | "project" | "selection" | "user" | "template" | "room_type" | "auth"
    resourceType: { type: String, index: true },
    resourceId: { type: String },
    resourceName: { type: String },
    details: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound indexes for efficient admin queries
activityLogSchema.index({ orgId: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ orgId: 1, action: 1, createdAt: -1 });
activityLogSchema.index({ orgId: 1, resourceType: 1, createdAt: -1 });

export type ActivityLogDocument = InferSchemaType<typeof activityLogSchema> & {
  _id: Schema.Types.ObjectId;
  createdAt: Date;
};
export const ActivityLogModel = model("ActivityLog", activityLogSchema);
