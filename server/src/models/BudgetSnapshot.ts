import { Schema, model, type InferSchemaType } from "mongoose";

const budgetSnapshotSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    label: { type: String, required: true },
    total: { type: Number, required: true },
    byCategory: { type: Map, of: Number, default: {} },
    source: {
      type: String,
      enum: ["initial", "change_order", "manual", "selection_change"],
      required: true,
    },
    changeOrderId: { type: Schema.Types.ObjectId, ref: "ChangeOrder" },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

budgetSnapshotSchema.index({ projectId: 1, recordedAt: -1 });

export type BudgetSnapshotDocument = InferSchemaType<typeof budgetSnapshotSchema> & {
  _id: Schema.Types.ObjectId;
};
export const BudgetSnapshotModel = model("BudgetSnapshot", budgetSnapshotSchema);
