import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Transaction from "@/models/Transaction";
import Wallet from "@/models/Wallet";
import User from "@/models/User";
import { getUserWalletPermissions } from "@/lib/walletPermissions";
import { isLoanCategory, CATEGORIES_TREE, getCategoryDisplayName } from "@/lib/categories";
import { notifyWalletTransactionActivity } from "@/lib/walletNotifications";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  await connectDB();
  const user = (await User.findOne({ email: session.user.email }).lean()) as {
    _id: { toString(): string };
  } | null;
  return user ? String(user._id) : null;
}

/**
 * POST /api/finance/transactions/[id]/convert-to-expense
 * Converts a fully paid debt transaction into a standard expense transaction.
 * Ensures atomic updates, removes it from active debts, and prevents double-counting outflow or double-deducting balance.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Request body is required" }, { status: 400 });
  }

  const { category, subCategory } = body;
  if (!category || typeof category !== "string") {
    return NextResponse.json({ error: "An expense category is required" }, { status: 400 });
  }

  await connectDB();
  const tx = await Transaction.findById(id);
  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase();
  const isOwnerOfTx = String(tx.userId) === String(userId);

  if (!isOwnerOfTx) {
    if (!tx.walletId) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    const walletObj = await Wallet.findById(tx.walletId).lean();
    const perms = getUserWalletPermissions(walletObj as any, userEmail, userId);
    if (!perms.transactions.update) {
      return NextResponse.json(
        { error: "You do not have permission to modify this transaction" },
        { status: 403 }
      );
    }
  }

  // Must be a DEBT transaction
  if (tx.type !== "DEBT") {
    return NextResponse.json(
      { error: "Only debt transactions can be converted to expenses" },
      { status: 400 }
    );
  }

  // Cannot convert loans
  if (isLoanCategory(tx.category, tx.subCategory)) {
    return NextResponse.json(
      { error: "Loans cannot be converted to expense transactions" },
      { status: 400 }
    );
  }

  // Validate that remaining debt is 0
  const repaid = Number(tx.debtRepaidAmount) || 0;
  const remaining = Math.max(0, tx.amount - repaid);
  if (remaining > 0 && tx.debtStatus !== "PAID") {
    return NextResponse.json(
      {
        error: `Cannot convert debt: remaining balance is ${remaining}. Debt must be fully repaid first.`,
      },
      { status: 400 }
    );
  }

  // Validate that category is an existing EXPENSE category
  const cleanCategory = String(category).trim().slice(0, 50).replace(/[<>]/g, "");
  const cleanSubCategory = subCategory
    ? String(subCategory).trim().slice(0, 50).replace(/[<>]/g, "")
    : undefined;

  const validExpenseCat = CATEGORIES_TREE.find(
    (c) =>
      c.type === "EXPENSE" &&
      (c.id === cleanCategory || c.children.some((ch) => ch.id === cleanCategory))
  );

  if (!validExpenseCat && cleanCategory !== "other_expense") {
    return NextResponse.json(
      { error: "Selected category must be an existing expense category" },
      { status: 400 }
    );
  }

  // Update transaction fields atomically
  const oldCategoryDisplayName = getCategoryDisplayName(tx.category, tx.subCategory);
  tx.type = "EXPENSE";
  tx.category = cleanCategory;
  tx.subCategory = cleanSubCategory;

  // Update title if it was a generic debt title or matches old category name
  const isGenericDebtTitle =
    !tx.title ||
    tx.title.trim() === "" ||
    tx.title === oldCategoryDisplayName ||
    tx.title.toLowerCase() === "debt" ||
    tx.title.toLowerCase() === "debt payment" ||
    tx.title.toLowerCase().startsWith("debt to") ||
    tx.title.toLowerCase().startsWith("debt paid");

  if (isGenericDebtTitle) {
    tx.title = getCategoryDisplayName(cleanCategory, cleanSubCategory);
  }

  // If tx has no walletId, assign walletId from debt payments
  if (!tx.walletId && tx.debtPayments && tx.debtPayments.length > 0) {
    const lastPaymentWithWallet = [...tx.debtPayments].reverse().find((p) => p.walletId);
    if (lastPaymentWithWallet?.walletId) {
      tx.walletId = new mongoose.Types.ObjectId(String(lastPaymentWithWallet.walletId));
    }
  }

  // Mark debtStatus as PAID for audit history
  tx.debtStatus = "PAID";
  tx.debtRepaidAmount = tx.amount;

  // IMPORTANT: Do NOT deduct from wallet balance again!
  // Wallet balance was already deducted when debt payments were made.
  // This ensures atomic balance consistency without double-deduction.

  await tx.save();

  const populatedTx = await Transaction.findById(tx._id)
    .populate({
      path: "walletId",
      select: "name icon currency balance sharedWith userId ownerEmail",
      strictPopulate: false,
    })
    .populate({ path: "eventId", select: "name icon currency status", strictPopulate: false })
    .lean();

  // Notify wallet collaborators
  if (tx.walletId) {
    notifyWalletTransactionActivity({
      walletId: String(tx.walletId),
      actorUserId: userId,
      action: "UPDATED",
      transaction: {
        _id: tx._id,
        type: "EXPENSE",
        title: tx.title,
        amount: tx.amount,
        currency: tx.currency,
      },
    }).catch(console.error);
  }

  return NextResponse.json({
    success: true,
    message: "Debt converted to standard expense transaction successfully",
    transaction: populatedTx,
  });
}
