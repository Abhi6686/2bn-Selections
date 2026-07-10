import { Schema, model, type InferSchemaType } from "mongoose";

const activityLogSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    action: { type: String, required: true }, // e.g. "user_invited", "login", "price_visibility_toggled"
    details: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type ActivityLogDocument = InferSchemaType<typeof activityLogSchema> & {
  _id: Schema.Types.ObjectId;
  createdAt: Date;
};
export const ActivityLogModel = model("ActivityLog", activityLogSchema);
