import { Schema, model, type InferSchemaType } from "mongoose";
import { USER_ROLES } from "@2bn/shared";

const userSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true },
    passwordHash: { type: String },
    status: {
      type: String,
      enum: ["invited", "active", "disabled"],
      default: "active",
    },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ orgId: 1, role: 1 });

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: Schema.Types.ObjectId };
export const UserModel = model("User", userSchema);
