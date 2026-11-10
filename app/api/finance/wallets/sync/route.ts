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

/**
 * POST /api/finance/wallets/sync
 * Reconciles wallet balances against transactions.
 * If a wallet has transactions but its balance was never updated or got out of sync,
 * this calculates the true balance = (initialBalance || 0) + sum(income) - sum(expense).
 */
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const wallets = await Wallet.find({ userId: userObjectId });
  const usdRates = await getExchangeRates("USD");

  const syncResults = [];

  for (const wallet of wallets) {
    const txs = await Transaction.find({
      userId: userObjectId,
      walletId: wallet._id,
    }).lean();

    let netTransactionsDelta = 0;
    for (const tx of txs) {
      const amtInWalletCurr = convertCurrency(
        tx.amount,
        tx.currency || "IDR",
        wallet.currency || "IDR",
        usdRates
      );
      if (tx.type === "INCOME") {
        netTransactionsDelta += amtInWalletCurr;
      } else if (tx.type === "EXPENSE") {
        netTransactionsDelta -= amtInWalletCurr;
      }
    }

    // If initialBalance was never explicitly tracked:
    // If balance is 0 but there are transactions, initial was 0, so balance = netTransactionsDelta.
    let correctedBalance = wallet.balance;
    if (wallet.balance === 0 && txs.length > 0) {
      correctedBalance = netTransactionsDelta;
      await Wallet.findByIdAndUpdate(wallet._id, { balance: correctedBalance });
    }

    syncResults.push({
      walletId: wallet._id,
      name: wallet.name,
      transactionsCount: txs.length,
      netTransactionsDelta,
      balance: correctedBalance,
    });
  }

  return NextResponse.json({ success: true, wallets: syncResults });
}
