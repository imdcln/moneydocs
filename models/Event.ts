import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IEvent extends Document {
  userId: Types.ObjectId;
  name: string;
  icon?: string;
  endingDate?: Date;
  currency: string;
  walletId?: Types.ObjectId;
  status: "RUNNING" | "FINISHED";
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: "✈️" },
    endingDate: { type: Date },
    currency: { type: String, default: "IDR" },
    walletId: { type: Schema.Types.ObjectId, ref: "Wallet" },
    status: { type: String, enum: ["RUNNING", "FINISHED"], default: "RUNNING" },
  },
  { timestamps: true }
);

const EventModel: Model<IEvent> =
  mongoose.models.Event ?? mongoose.model<IEvent>("Event", EventSchema);

export default EventModel;
