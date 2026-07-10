import { Schema, model, type InferSchemaType } from "mongoose";

const tagSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    kind: {
      type: String,
      enum: ["style", "color", "material", "finish", "feature"],
      default: "style",
    },
  },
  { timestamps: true },
);

tagSchema.index({ orgId: 1, slug: 1 }, { unique: true });
tagSchema.index({ kind: 1 });

export type TagDocument = InferSchemaType<typeof tagSchema> & { _id: Schema.Types.ObjectId };
export const TagModel = model("Tag", tagSchema);
