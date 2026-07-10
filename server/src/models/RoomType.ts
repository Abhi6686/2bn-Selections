import { Schema, model, type InferSchemaType } from "mongoose";

const roomTypeSlotSchema = new Schema(
  {
    categoryKey: { type: String, required: true },
    slotLabel: { type: String, required: true },
    required: { type: Boolean, default: true },
    allowance: { type: Number },
  },
  { _id: false }
);

const roomTypeSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    icon: { type: String, default: "🏠" },
    description: { type: String },
    imageUrl: { type: String },
    slots: [roomTypeSlotSchema],
  },
  { timestamps: true }
);


roomTypeSchema.index({ orgId: 1, name: 1 }, { unique: true });

export type RoomTypeDocument = InferSchemaType<typeof roomTypeSchema> & {
  _id: Schema.Types.ObjectId;
};

export const RoomTypeModel = model("RoomType", roomTypeSchema);
