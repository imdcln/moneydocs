/**
 * POST /api/finance/daily-recap
 *
 * Sends a daily spending recap notification to all users who have at least
 * one wallet with `enableNotification` enabled (or to the authenticated user
 * only when called without an admin key).
 *
 * Designed to be triggered by a cron job (e.g., Vercel Cron at 23:00 daily)
 * via a POST request with `Authorization: Bearer <CRON_SECRET>` header,
 * OR called as an authenticated user to request their own recap on-demand.
 *
 * Recap covers today's transactions (in the server's timezone).
 *
 * Notification example:
 *   "Today's recap: you spent IDR 150,000 across 3 transactions.
 *    Top category: Food & Drink."
 */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import Wallet from "@/models/Wallet";
import Transaction from "@/models/Transaction";
import { createAndSendNotification } from "@/lib/notifications";
import { getExchangeRates, convertCurrency } from "@/lib/currency";
import { getCategoryDisplayName } from "@/lib/categories";

const CRON_SECRET = process.env.CRON_SECRET || "";

async function sendRecapToUser(
  userId: mongoose.Types.ObjectId,
  baseCurrency: string,
  rates: Record<string, number>
): Promise<boolean> {
  const userIdStr = String(userId);

  // Find wallets owned by or shared with this user that have notifications enabled
  const wallets = await Wallet.find({
    $or: [
      { userId: userId, enableNotification: { $ne: false } },
      {
        sharedWith: {
          $elemMatch: {
            userId: userId,
            status: "ACCEPTED",
            enableNotification: { $ne: false },
          },
        },
      },
    ],
  })
    .select("_id name currency enableNotification sharedWith userId")
    .lean();

  // Also include wallets owned by user (the enableNotification check above
  // applies the wallet-level flag for the owner)
  const notifyWalletIds: mongoose.Types.ObjectId[] = wallets
    .filter((w) => {
      const isOwner = String(w.userId) === userIdStr;
      if (isOwner) {
        return w.enableNotification !== false;
      }
      // member: check sharedWith entry
      const entry = (w.sharedWith || []).find(
        (m) => m.status === "ACCEPTED"
      );
      return entry ? (entry as { enableNotification?: boolean }).enableNotification !== false : false;
    })
    .map((w) => w._id as mongoose.Types.ObjectId);

  if (notifyWalletIds.length === 0) return false;

  // Today's date range
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const txs = await Transaction.find({
    userId: userId,
    walletId: { $in: notifyWalletIds },
    date: { $gte: startOfDay, $lte: endOfDay },
  })
    .select("type amount currency category walletId")
    .lean();

  if (txs.length === 0) return false; // No activity today — skip

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryCount: Record<string, number> = {};

  for (const tx of txs) {
    const converted = convertCurrency(tx.amount ?? 0, tx.currency || "IDR", baseCurrency, rates);
    if (tx.type === "INCOME") {
      totalIncome += converted;
    } else if (tx.type === "EXPENSE") {
      totalExpense += converted;
      const cat = tx.category || "Uncategorized";
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    }
  }

  // Find top expense category
  const topCategoryKey = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topCategoryLabel = topCategoryKey ? getCategoryDisplayName(topCategoryKey) : null;

  const formatAmount = (n: number) =>
    `${baseCurrency} ${Math.round(n).toLocaleString()}`;

  const expenseCount = txs.filter((t) => t.type === "EXPENSE").length;
  const incomeCount = txs.filter((t) => t.type === "INCOME").length;

  const parts: string[] = [];
  if (totalExpense > 0) {
    parts.push(
      `You spent ${formatAmount(totalExpense)} across ${expenseCount} expense${expenseCount !== 1 ? "s" : ""}${topCategoryLabel ? ` · Top: ${topCategoryLabel}` : ""}.`
    );
  }
  if (totalIncome > 0) {
    parts.push(`You received ${formatAmount(totalIncome)} in ${incomeCount} income transaction${incomeCount !== 1 ? "s" : ""}.`);
  }
  if (parts.length === 0) return false;

  const message = parts.join(" ");
  const today = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  await createAndSendNotification({
    userId,
    type: "GENERAL",
    title: `📊 Daily Recap · ${today}`,
    message,
    link: "/transactions",
    metadata: {
      recapDate: startOfDay.toISOString(),
      totalExpense: Math.round(totalExpense),
      totalIncome: Math.round(totalIncome),
      currency: baseCurrency,
    },
  });

  return true;
}

/** Called by Vercel Cron or on-demand by an authenticated user */
export async function POST(req: NextRequest) {
  await connectDB();

  const authHeader = req.headers.get("authorization");
  const isCron =
    CRON_SECRET &&
    authHeader === `Bearer ${CRON_SECRET}`;

  if (isCron) {
    // Run for ALL users
    const rates = await getExchangeRates("USD");

    const users = (await User.find({}).select("_id baseCurrency").lean()) as Array<{
      _id: mongoose.Types.ObjectId;
      baseCurrency?: string;
    }>;

    let sentCount = 0;
    for (const u of users) {
      try {
        const sent = await sendRecapToUser(u._id, u.baseCurrency || "IDR", rates);
        if (sent) sentCount++;
      } catch (err) {
        console.error("daily-recap error for user", String(u._id), err);
      }
    }

    return NextResponse.json({ ok: true, sentCount, totalUsers: users.length });
  }

  // Non-cron: only for the authenticated user (on-demand recap)
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = (await User.findOne({ email: session.user.email })
    .select("_id baseCurrency")
    .lean()) as { _id: mongoose.Types.ObjectId; baseCurrency?: string } | null;

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const rates = await getExchangeRates("USD");
  const sent = await sendRecapToUser(user._id, user.baseCurrency || "IDR", rates);

  if (!sent) {
    return NextResponse.json({
      ok: false,
      message: "No activity today or notifications are disabled for all your wallets.",
    });
  }

  return NextResponse.json({ ok: true, message: "Recap sent!" });
}

/** GET for quick health-check */
export async function GET(_req: NextRequest) {
  return NextResponse.json({ ok: true, endpoint: "daily-recap", method: "POST" });
}
