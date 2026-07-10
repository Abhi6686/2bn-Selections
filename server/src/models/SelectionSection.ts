import { Schema, model, type InferSchemaType } from "mongoose";

const selectionSectionSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    order: { type: Number, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    groups: [
      {
        name: { type: String, required: true },
        slug: { type: String, required: true },
        categoryKey: { type: String, required: true },
        items: [{ type: String }],
        subgroups: [
          {
            name: { type: String, required: true },
            slug: { type: String, required: true },
            categoryKey: { type: String, required: true },
            items: [{ type: String }],
          }
        ]
      }
    ]
  },
  { timestamps: true }
);

selectionSectionSchema.index({ orgId: 1, order: 1 });

export type SelectionSectionDocument = InferSchemaType<typeof selectionSectionSchema> & {
  _id: Schema.Types.ObjectId;
};
export const SelectionSectionModel = model("SelectionSection", selectionSectionSchema);
