import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IAccount extends Document {
  userId: Types.ObjectId;
  provider: string; // e.g. "google", "credentials"
  providerAccountId: string;
  emailVerified?: Date | boolean | null;
  type?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, required: true },
    providerAccountId: { type: String, required: true },
    emailVerified: { type: Schema.Types.Mixed, default: null },
    type: { type: String, default: "oauth" },
  },
  { timestamps: true }
);

AccountSchema.index({ provider: 1, providerAccountId: 1 }, { unique: true });
AccountSchema.index({ userId: 1, provider: 1 });

const Account: Model<IAccount> =
  mongoose.models.Account ?? mongoose.model<IAccount>("Account", AccountSchema);

export default Account;
