import mongoose, { Schema, Document, Model, Types } from "mongoose";

import "./Wallet";

export interface IBudget extends Document {
  userId: Types.ObjectId;
  walletId?: Types.ObjectId;
  name?: string;
  category: string;
  subCategory?: string;
  /** Multi-category list. Each entry is "ALL_CATEGORIES", "parentId", or "parentId:childId". */
  categories?: string[];
  amountLimit: number;
  currency?: string;
  monthYear: string; // Format: "YYYY-MM"
  periodType?: "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
  startDate?: Date;
  endDate?: Date;
  repeat?: boolean;
  order?: number;
  createdAt: Date;
  updatedAt: Date;
}

const BudgetSchema = new Schema<IBudget>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    walletId: { type: Schema.Types.ObjectId, ref: "Wallet", index: true },
    name: { type: String, trim: true, default: null },
    category: { type: String, required: true },
    subCategory: { type: String },
    categories: { type: [String], default: undefined },
    amountLimit: { type: Number, required: true },
    currency: { type: String },
    monthYear: { type: String, required: true }, // e.g., "2026-09"
    periodType: {
      type: String,
      enum: ["WEEK", "MONTH", "QUARTER", "YEAR", "CUSTOM"],
      default: "MONTH",
    },
    startDate: { type: Date },
    endDate: { type: Date },
    repeat: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

BudgetSchema.index({ userId: 1, walletId: 1, category: 1, subCategory: 1, startDate: 1 });
BudgetSchema.index({ userId: 1, order: 1 });

const Budget: Model<IBudget> =
  mongoose.models.Budget ?? mongoose.model<IBudget>("Budget", BudgetSchema);

export default Budget;
