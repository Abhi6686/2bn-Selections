import { Schema, model, type InferSchemaType } from "mongoose";
import { SELECTION_LEVELS, SELECTION_STATES } from "@2bn/shared";

const projectSelectionSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    categoryKey: { type: String, required: true },
    state: { type: String, enum: SELECTION_STATES, default: "draft" },
    libraryItemId: { type: Schema.Types.ObjectId, ref: "LibraryItem" },
    manufacturer: { type: String },
    model: { type: String },
    product: { type: String },
    priceUsed: { type: Number },
    level: { type: String, enum: SELECTION_LEVELS },
    finish: { type: String },
    imageUrl: { type: String },
    selectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    quantity: { type: Number, default: 1 },
    slotLabel: { type: String, default: "" },
    version: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountFlat: { type: Number, default: 0 },
  },
  { timestamps: true },
);

projectSelectionSchema.index({ projectId: 1, categoryKey: 1, slotLabel: 1 }, { unique: true });

export type ProjectSelectionDocument = InferSchemaType<typeof projectSelectionSchema> & {
  _id: Schema.Types.ObjectId;
};
export const ProjectSelectionModel = model("ProjectSelection", projectSelectionSchema);
