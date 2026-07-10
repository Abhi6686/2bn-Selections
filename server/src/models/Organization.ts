import { Schema, model, type InferSchemaType } from "mongoose";

const organizationSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    smtpHost: { type: String },
    smtpPort: { type: Number },
    smtpUser: { type: String },
    smtpPass: { type: String },
    smtpFrom: { type: String },
  },
  { timestamps: true },
);

export type OrganizationDocument = InferSchemaType<typeof organizationSchema>;
export const OrganizationModel = model("Organization", organizationSchema);
