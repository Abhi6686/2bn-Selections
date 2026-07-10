import { Schema, model, type InferSchemaType } from "mongoose";

const magicLinkTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true },
    purpose: { type: String, enum: ["login", "invite"], default: "login" },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

magicLinkTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type MagicLinkTokenDocument = InferSchemaType<typeof magicLinkTokenSchema> & {
  _id: Schema.Types.ObjectId;
};
export const MagicLinkTokenModel = model("MagicLinkToken", magicLinkTokenSchema);
