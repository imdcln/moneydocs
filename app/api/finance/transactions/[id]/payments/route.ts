import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Transaction, { IDebtPayment } from "@/models/Transaction";
import Wallet from "@/models/Wallet";
import User from "@/models/User";
import { getExchangeRates, convertCurrency, convertToIDR } from "@/lib/currency";

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
 * POST /api/finance/transactions/[id]/payments
 * Record a payment / return money for a Debt or Loan
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

  const { amount, walletId, date, note } = body;

  const numAmount = Number(amount);
  if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  if (!walletId || !mongoose.Types.ObjectId.isValid(walletId)) {
    return NextResponse.json({ error: "A valid wallet is required" }, { status: 400 });
  }

  await connectDB();
  const tx = await Transaction.findOne({ _id: id, userId });
  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const wallet = await Wallet.findOne({ _id: walletId, userId });
  if (!wallet) {
    return NextResponse.json({ error: "Selected wallet was not found" }, { status: 404 });
  }

  const currentRepaid = Number(tx.debtRepaidAmount) || 0;
  const remaining = Math.max(0, tx.amount - currentRepaid);
  if (remaining <= 0 && tx.debtStatus === "PAID") {
    return NextResponse.json({ error: "This transaction is already fully paid" }, { status: 400 });
  }

  // Deduct from the chosen wallet in the wallet's currency
  const usdRates = await getExchangeRates("USD");
  const walletCurrency = wallet.currency || "IDR";
  const amountInWalletCurrency = convertCurrency(
    numAmount,
    tx.currency || "IDR",
    walletCurrency,
    usdRates
  );

  await Wallet.findByIdAndUpdate(wallet._id, {
    $inc: { balance: -amountInWalletCurrency },
  });

  // Calculate IDR converted amount
  let convertedAmountIDR = numAmount;
  if (tx.currency && tx.currency !== "IDR") {
    const idrRates = await getExchangeRates("IDR");
    convertedAmountIDR = convertToIDR(numAmount, tx.currency, idrRates);
  }

  const cleanNote = note ? String(note).trim().slice(0, 300).replace(/[<>]/g, "") : undefined;
  const paymentDate = date ? new Date(date) : new Date();

  const newPayment: IDebtPayment = {
    _id: new mongoose.Types.ObjectId(),
    amount: numAmount,
    currency: tx.currency || "IDR",
    convertedAmountIDR,
    date: paymentDate,
    walletId: wallet._id,
    walletName: wallet.name,
    note: cleanNote,
    createdAt: new Date(),
  };

  if (!tx.debtPayments) {
    tx.debtPayments = [];
  }
  tx.debtPayments.push(newPayment);

  const newRepaidAmount = currentRepaid + numAmount;
  tx.debtRepaidAmount = newRepaidAmount;
  tx.debtStatus = newRepaidAmount >= tx.amount ? "PAID" : "PARTIAL";

  await tx.save();

  const populatedTx = await Transaction.findById(tx._id)
    .populate({ path: "walletId", select: "name icon currency", strictPopulate: false })
    .populate({ path: "eventId", select: "name icon currency status", strictPopulate: false })
    .lean();

  return NextResponse.json({
    success: true,
    transaction: populatedTx,
    payment: newPayment,
  });
}

/**
 * DELETE /api/finance/transactions/[id]/payments?paymentId=...
 * Delete a repayment and restore the deducted wallet balance
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const paymentId = searchParams.get("paymentId");
  if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
    return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
  }

  await connectDB();
  const tx = await Transaction.findOne({ _id: id, userId });
  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const payments = tx.debtPayments || [];
  const pIndex = payments.findIndex((p) => String(p._id) === String(paymentId));
  if (pIndex === -1) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const removed = payments[pIndex];

  // Restore wallet balance
  if (removed.walletId && removed.amount > 0) {
    const wallet = await Wallet.findById(removed.walletId).select("currency").lean();
    if (wallet) {
      const usdRates = await getExchangeRates("USD");
      const walletCurrency = (wallet as { currency?: string }).currency || "IDR";
      const amtInWalletCurrency = convertCurrency(
        removed.amount,
        removed.currency || tx.currency || "IDR",
        walletCurrency,
        usdRates
      );
      await Wallet.findByIdAndUpdate(removed.walletId, {
        $inc: { balance: amtInWalletCurrency },
      });
    }
  }

  // Remove payment
  payments.splice(pIndex, 1);
  tx.debtPayments = payments;

  // Recalculate
  const newRepaid = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  tx.debtRepaidAmount = newRepaid;
  tx.debtStatus = newRepaid >= tx.amount ? "PAID" : newRepaid > 0 ? "PARTIAL" : "UNPAID";

  await tx.save();

  const populatedTx = await Transaction.findById(tx._id)
    .populate({ path: "walletId", select: "name icon currency", strictPopulate: false })
    .populate({ path: "eventId", select: "name icon currency status", strictPopulate: false })
    .lean();

  return NextResponse.json({
    success: true,
    transaction: populatedTx,
  });
}
