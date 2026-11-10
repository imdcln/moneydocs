import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISupportTicket extends Document {
  userId?: mongoose.Types.ObjectId | string;
  userName?: string;
  userEmail?: string;
  contactEmail: string;
  targetEmail: string;
  category: string;
  subject: string;
  message: string;
  deviceInfo?: {
    platform?: string;
    browser?: string;
    userAgent?: string;
    screen?: string;
    appVersion?: string;
  };
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    userId: { type: Schema.Types.Mixed },
    userName: { type: String, default: "Anonymous" },
    userEmail: { type: String },
    contactEmail: { type: String, required: true, trim: true },
    targetEmail: { type: String, default: "declane.docs@gmail.com" },
    category: {
      type: String,
      required: true,
      default: "Bug Report",
    },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    deviceInfo: {
      platform: { type: String },
      browser: { type: String },
      userAgent: { type: String },
      screen: { type: String },
      appVersion: { type: String, default: "2.3" },
    },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
      default: "OPEN",
    },
  },
  { timestamps: true }
);

const SupportTicket: Model<ISupportTicket> =
  mongoose.models.SupportTicket ??
  mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);

export default SupportTicket;
