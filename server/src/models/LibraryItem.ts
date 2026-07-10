import { Schema, model, type InferSchemaType } from "mongoose";
import { SELECTION_LEVELS } from "@2bn/shared";

const libraryItemSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    category: { type: String, required: true },
    categoryKey: { type: String, required: true, index: true },
    selectionSlot: { type: String },
    manufacturer: { type: String, required: true },
    model: { type: String, required: true },
    product: { type: String, required: true },
    finish: { type: String },
    priceMin: { type: Number, required: true },
    priceMax: { type: Number, required: true },
    level: { type: String, enum: SELECTION_LEVELS, required: true },
    imageUrl: { type: String },
    imageIds: [{ type: Schema.Types.ObjectId, ref: "File" }],
    tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
    tagSlugs: [{ type: String }],
    vendor: { type: String },
    specifications: { type: String },
    size: { type: String },
    dimensionsImageUrl: { type: String },
    isDeleted: { type: Boolean, default: false, index: true },
    active: { type: Boolean, default: true },
    custom: { type: Boolean, default: false },
    legacyId: { type: String },
    galleryImages: { type: [String], default: [] },
  },
  { timestamps: true },
);

libraryItemSchema.index({ orgId: 1, category: 1, level: 1 });
libraryItemSchema.index({ orgId: 1, active: 1 });
libraryItemSchema.index({ manufacturer: "text", product: "text", model: "text" });

export type LibraryItemDocument = InferSchemaType<typeof libraryItemSchema> & {
  _id: Schema.Types.ObjectId;
};
export const LibraryItemModel = model("LibraryItem", libraryItemSchema);
