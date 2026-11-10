import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Wallet from "@/models/Wallet";
import Transaction from "@/models/Transaction";
import User from "@/models/User";
import { getExchangeRates, convertCurrency } from "@/lib/currency";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  await connectDB();
  const user = (await User.findOne({ email: session.user.email }).lean()) as {
    _id: { toString(): string };
  } | null;
  return user ? String(user._id) : null;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { fromWalletId, toWalletId, amount, note } = body;

  if (!fromWalletId || !toWalletId || !amount) {
    return NextResponse.json(
      { error: "fromWalletId, toWalletId, and amount are required" },
      { status: 400 }
    );
  }

  if (fromWalletId === toWalletId) {
    return NextResponse.json({ error: "Cannot transfer to the same wallet" }, { status: 400 });
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
    return NextResponse.json({ error: "Valid positive amount required" }, { status: 400 });
  }

  await connectDB();

  const [fromWallet, toWallet] = await Promise.all([
    Wallet.findOne({ _id: fromWalletId, userId }),
    Wallet.findOne({ _id: toWalletId, userId }),
  ]);

  if (!fromWallet || !toWallet) {
    return NextResponse.json({ error: "One or both wallets not found" }, { status: 404 });
  }

  // Calculate currency converted amount for destination wallet if currencies differ
  let destinationAmount = numAmount;
  if (fromWallet.currency !== toWallet.currency) {
    const rates = await getExchangeRates("IDR");
    destinationAmount = convertCurrency(numAmount, fromWallet.currency, toWallet.currency, rates);
  }

  // Deduct from source and add to destination
  await Promise.all([
    Wallet.findByIdAndUpdate(fromWalletId, { $inc: { balance: -numAmount } }),
    Wallet.findByIdAndUpdate(toWalletId, { $inc: { balance: destinationAmount } }),
    Transaction.create({
      userId,
      type: "EXPENSE",
      title: note?.trim() || `Transfer to ${toWallet.name}`,
      amount: numAmount,
      currency: fromWallet.currency,
      convertedAmountIDR: numAmount,
      category: "other_expense",
      walletId: fromWallet._id,
      date: new Date(),
      description: `Internal transfer to ${toWallet.name}`,
    }),
    Transaction.create({
      userId,
      type: "INCOME",
      title: note?.trim() || `Transfer from ${fromWallet.name}`,
      amount: destinationAmount,
      currency: toWallet.currency,
      convertedAmountIDR: destinationAmount,
      category: "other_income",
      walletId: toWallet._id,
      date: new Date(),
      description: `Internal transfer from ${fromWallet.name}`,
    }),
  ]);

  return NextResponse.json({ success: true, fromWalletId, toWalletId, amount: numAmount });
}
