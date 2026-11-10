import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type WalletType = "CASH" | "BANK" | "E_WALLET" | "INVESTMENT" | "OTHER";

export interface IWalletSharedUser {
  email: string;
  name?: string;
  role: "VIEWER" | "EDITOR" | "ADMIN";
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  addedAt?: Date;
  isDefault?: boolean;
  excludeFromTotal?: boolean;
  enableNotification?: boolean;
}

export interface IWallet extends Document {
  userId: Types.ObjectId;
  name: string;
  icon: string;
  type: WalletType;
  balance: number;
  currency: string;
  isDefault: boolean;
  excludeFromReport?: boolean;
  excludeFromTotal?: boolean;
  archived?: boolean;
  enableNotification?: boolean;
  disabledCategories?: string[];
  sharedWith?: IWalletSharedUser[];
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: "💳" },
    type: {
      type: String,
      enum: ["CASH", "BANK", "E_WALLET", "INVESTMENT", "OTHER"],
      default: "CASH",
    },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: "IDR" },
    isDefault: { type: Boolean, default: false },
    excludeFromReport: { type: Boolean, default: false },
    excludeFromTotal: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    enableNotification: { type: Boolean, default: true },
    disabledCategories: [{ type: String }],
    sharedWith: [
      {
        email: { type: String, lowercase: true, trim: true },
        name: { type: String },
        role: { type: String, enum: ["VIEWER", "EDITOR", "ADMIN"], default: "EDITOR" },
        status: { type: String, enum: ["PENDING", "ACCEPTED", "DECLINED"], default: "PENDING" },
        addedAt: { type: Date, default: Date.now },
        isDefault: { type: Boolean, default: false },
        excludeFromTotal: { type: Boolean, default: false },
        enableNotification: { type: Boolean, default: true },
      },
    ],
  },
  { timestamps: true }
);

const Wallet: Model<IWallet> =
  mongoose.models.Wallet ?? mongoose.model<IWallet>("Wallet", WalletSchema);

export default Wallet;
