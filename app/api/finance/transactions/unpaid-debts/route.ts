import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Transaction from "@/models/Transaction";
import User from "@/models/User";
import { isLoanCategory } from "@/lib/categories";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  await connectDB();
  const user = (await User.findOne({ email: session.user.email }).lean()) as {
    _id: { toString(): string };
  } | null;
  return user ? String(user._id) : null;
}

export async function GET(_req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  // Find all unpaid debts & loans for the current user
  // (EVERY unpaid will be shown, no matter from what time, even if its next year / last month)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {
    userId: new mongoose.Types.ObjectId(userId),
    type: "DEBT",
    debtStatus: { $ne: "PAID" },
    $expr: {
      $gt: ["$amount", { $ifNull: ["$debtRepaidAmount", 0] }],
    },
  };

  const rawTransactions = await Transaction.find(query as any)
    .populate({ path: "walletId", select: "name icon currency balance", strictPopulate: false })
    .sort({ debtDueDate: 1, date: -1 })
    .lean();

  const unpaidDebts = rawTransactions.map((tx) => {
    const repaid = Number(tx.debtRepaidAmount) || 0;
    const remaining = Math.max(0, tx.amount - repaid);
    const isLoan = isLoanCategory(tx.category, tx.subCategory);

    return {
      _id: String(tx._id),
      title: tx.title,
      category: tx.category,
      subCategory: tx.subCategory,
      amount: tx.amount,
      debtRepaidAmount: repaid,
      remainingUnpaid: remaining,
      currency: tx.currency || "IDR",
      date: tx.date ? new Date(tx.date).toISOString() : new Date().toISOString(),
      debtDueDate: tx.debtDueDate ? new Date(tx.debtDueDate).toISOString() : null,
      debtParty: tx.debtParty || (tx.withPeople?.[0]) || null,
      debtStatus: tx.debtStatus || "UNPAID",
      isLoan,
      walletName: (tx.walletId as { name?: string } | undefined)?.name,
    };
  });

  return NextResponse.json({ unpaidDebts });
}
