import mongoose, { Schema, Document, Model, Types } from "mongoose";
import "./Wallet";

export type TransactionType = "EXPENSE" | "INCOME" | "DEBT";
export type DebtStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface IDebtPayment {
  _id?: Types.ObjectId | string;
  amount: number;
  currency?: string;
  convertedAmountIDR?: number;
  date: Date;
  walletId?: Types.ObjectId | string;
  walletName?: string;
  note?: string;
  createdAt?: Date;
}

export interface ITransaction extends Document {
  userId: Types.ObjectId;
  type: TransactionType;
  title: string;
  amount: number;
  currency: string;
  convertedAmountIDR: number;
  category: string;
  subCategory?: string;
  walletId?: Types.ObjectId;
  date: Date;
  description?: string;
  tags: string[];
  receiptUrl?: string;
  // Event & People fields
  eventId?: Types.ObjectId;
  eventName?: string;
  eventCurrency?: string;
  withPeople?: string[];
  excludeFromReport?: boolean;
  // Debt-specific fields
  debtParty?: string;
  debtDueDate?: Date;
  debtInterestRate?: number;
  debtRepaidAmount?: number;
  debtStatus?: DebtStatus;
  debtPayments?: IDebtPayment[];
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["EXPENSE", "INCOME", "DEBT"],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "IDR" },
    convertedAmountIDR: { type: Number, required: true },
    category: { type: String, required: true },
    subCategory: { type: String },
    walletId: { type: Schema.Types.ObjectId, ref: "Wallet" },
    date: { type: Date, default: Date.now },
    description: { type: String },
    tags: [{ type: String }],
    receiptUrl: { type: String },
    // Event & People
    eventId: { type: Schema.Types.ObjectId, ref: "Event" },
    eventName: { type: String },
    eventCurrency: { type: String },
    withPeople: [{ type: String }],
    excludeFromReport: { type: Boolean, default: false },
    // Debt-specific
    debtParty: { type: String },
    debtDueDate: { type: Date },
    debtInterestRate: { type: Number },
    debtRepaidAmount: { type: Number, default: 0 },
    debtStatus: {
      type: String,
      enum: ["UNPAID", "PARTIAL", "PAID"],
      default: "UNPAID",
    },
    debtPayments: [
      {
        amount: { type: Number, required: true },
        currency: { type: String, default: "IDR" },
        convertedAmountIDR: { type: Number },
        date: { type: Date, default: Date.now },
        walletId: { type: Schema.Types.ObjectId, ref: "Wallet" },
        walletName: { type: String },
        note: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Compound index for efficient per-user date-sorted queries
TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, type: 1 });
TransactionSchema.index({ userId: 1, category: 1 });

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ??
  mongoose.model<ITransaction>("Transaction", TransactionSchema);

export default Transaction;
