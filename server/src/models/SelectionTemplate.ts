import { Schema, model, type InferSchemaType } from "mongoose";
import { TEMPLATE_VISIBILITIES } from "@2bn/shared";

const selectionTemplateSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    visibility: { type: String, enum: TEMPLATE_VISIBILITIES, default: "org" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    selections: {
      type: Map,
      of: [
        new Schema(
          {
            libraryItemId: { type: Schema.Types.ObjectId, ref: "LibraryItem", required: true },
            quantity: { type: Number, default: 1 },
            priceUsed: { type: Number },
            slotLabel: { type: String },
          },
          { _id: false }
        ),
      ],
      default: {},
    },
    coveredSections: [{ type: String }],
    tags: [{ type: String }],
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

selectionTemplateSchema.index({ orgId: 1, name: 1 }, { unique: true });

export type SelectionTemplateDocument = InferSchemaType<typeof selectionTemplateSchema> & {
  _id: Schema.Types.ObjectId;
};
export const SelectionTemplateModel = model("SelectionTemplate", selectionTemplateSchema);
