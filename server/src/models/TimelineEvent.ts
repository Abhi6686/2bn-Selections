import { Schema, model, type InferSchemaType } from "mongoose";

const timelineEventSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    amountBefore: { type: Number },
    amountAfter: { type: Number },
    category: { type: String },
    changeOrderId: { type: Schema.Types.ObjectId, ref: "ChangeOrder" },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

timelineEventSchema.index({ projectId: 1, createdAt: -1 });

export type TimelineEventDocument = InferSchemaType<typeof timelineEventSchema> & {
  _id: Schema.Types.ObjectId;
  createdAt: Date;
};
export const TimelineEventModel = model("TimelineEvent", timelineEventSchema);
