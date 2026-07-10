import { Schema, model, type InferSchemaType } from "mongoose";

const themeSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    tagWeights: { type: Map, of: Number, default: {} },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

themeSchema.index({ orgId: 1, name: 1 }, { unique: true });

export type ThemeDocument = InferSchemaType<typeof themeSchema> & { _id: Schema.Types.ObjectId };
export const ThemeModel = model("Theme", themeSchema);
