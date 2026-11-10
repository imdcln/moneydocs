import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Transaction from "@/models/Transaction";
import Wallet from "@/models/Wallet";
import User from "@/models/User";
import Budget from "@/models/Budget";
import EventModel from "@/models/Event";
import { getExchangeRates, convertToIDR, convertCurrency } from "@/lib/currency";
import { isLoanCategory } from "@/lib/categories";
import { createAndSendNotification } from "@/lib/notifications";
import { getRunningBudgetsQuery, isTransactionMatchingBudget } from "@/lib/budgetServer";
import { notifyWalletTransactionActivity } from "@/lib/walletNotifications";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  await connectDB();
  const user = await User.findOne({ email: session.user.email }).lean() as { _id: { toString(): string } } | null;
  return user ? String(user._id) : null;
}

async function getFullUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  await connectDB();
  return User.findOne({ email: session.user.email }).select("_id baseCurrency").lean() as Promise<{ _id: unknown; baseCurrency?: string } | null>;
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const category = searchParams.get("category");
  const walletId = searchParams.get("walletId");
  const search = searchParams.get("search");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const sortBy = searchParams.get("sortBy") ?? "date";
  const order = searchParams.get("order") === "asc" ? 1 : -1;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(1000, Math.max(1, parseInt(limitParam))) : 50;

  await connectDB();

  // Build query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = { userId };
  if (type) query.type = type;
  if (category) query.category = category;
  if (walletId) query.walletId = walletId;
  if (search) query.title = { $regex: search, $options: "i" };
  if (dateFrom || dateTo) {
    query.date = {};
    if (dateFrom) query.date.$gte = new Date(dateFrom);
    if (dateTo) query.date.$lte = new Date(dateTo);
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: "walletId", select: "name icon currency", strictPopulate: false })
      .populate({ path: "eventId", select: "name icon currency status", strictPopulate: false })
      .lean(),
    Transaction.countDocuments(query),
  ]);

  return NextResponse.json({ transactions, total, page, limit });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const {
    type,
    title,
    amount,
    currency = "IDR",
    category,
    subCategory,
    walletId,
    date,
    description,
    tags,
    receiptUrl,
    debtParty,
    debtDueDate,
    debtInterestRate,
    debtStatus,
    eventId,
    eventName,
    eventCurrency,
    withPeople,
  } = body;

  if (!type || !title || amount === undefined || amount === null || !category) {
    return NextResponse.json(
      { error: "type, title, amount, and category are required" },
      { status: 400 }
    );
  }

  // Cyber security input validation
  const numAmount = Number(amount);
  if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0 || numAmount > 1e12) {
    return NextResponse.json({ error: "Invalid amount. Must be a positive finite number." }, { status: 400 });
  }

  const cleanTitle = String(title).trim().slice(0, 100).replace(/[<>]/g, "");
  const cleanCategory = String(category).trim().slice(0, 50).replace(/[<>]/g, "");
  const cleanSubCategory = subCategory ? String(subCategory).trim().slice(0, 50).replace(/[<>]/g, "") : undefined;
  const cleanDescription = description ? String(description).trim().slice(0, 500).replace(/[<>]/g, "") : undefined;
  const cleanDebtParty = debtParty ? String(debtParty).trim().slice(0, 100).replace(/[<>]/g, "") : undefined;

  let validWalletId: string | undefined = undefined;
  if (walletId && typeof walletId === "string" && walletId !== "ALL" && walletId !== "GLOBAL") {
    if (walletId.match(/^[0-9a-fA-F]{24}$/)) {
      validWalletId = walletId;
    }
  }

  let validEventId: string | undefined = undefined;
  if (eventId && typeof eventId === "string" && eventId.match(/^[0-9a-fA-F]{24}$/)) {
    validEventId = eventId;
  }

  await connectDB();

  let resolvedEventName = eventName ? String(eventName).trim().slice(0, 100) : undefined;
  let resolvedEventCurrency = eventCurrency ? String(eventCurrency).trim().slice(0, 5).toUpperCase() : undefined;

  if (validEventId) {
    const ev = await EventModel.findOne({ _id: validEventId, userId }).lean();
    if (ev) {
      resolvedEventName = ev.name;
      resolvedEventCurrency = ev.currency;
    } else {
      validEventId = undefined;
    }
  }

  // Convert to IDR
  let convertedAmountIDR = numAmount;
  if (currency !== "IDR") {
    const rates = await getExchangeRates("IDR");
    convertedAmountIDR = convertToIDR(numAmount, currency, rates);
  }

  const transaction = await Transaction.create({
    userId,
    type,
    title: cleanTitle,
    amount: numAmount,
    currency: String(currency).slice(0, 5).toUpperCase(),
    convertedAmountIDR,
    category: cleanCategory,
    subCategory: cleanSubCategory,
    walletId: validWalletId || undefined,
    eventId: validEventId || undefined,
    eventName: resolvedEventName,
    eventCurrency: resolvedEventCurrency,
    withPeople: Array.isArray(withPeople)
      ? withPeople.map((p) => String(p).trim().slice(0, 50)).filter(Boolean)
      : undefined,
    date: date ? new Date(date) : new Date(),
    description: cleanDescription,
    tags: Array.isArray(tags) ? tags.map((t) => String(t).slice(0, 30).replace(/[<>]/g, "")) : [],
    receiptUrl: typeof receiptUrl === "string" && receiptUrl.startsWith("data:image/") ? receiptUrl : undefined,
    debtParty: cleanDebtParty,
    debtDueDate: debtDueDate ? new Date(debtDueDate) : undefined,
    debtInterestRate: debtInterestRate && isFinite(Number(debtInterestRate)) ? Number(debtInterestRate) : undefined,
    debtStatus: debtStatus ?? "UNPAID",
  });

  // Update wallet balance — delta must be in the wallet's OWN currency, not IDR
  if (validWalletId) {
    const wallet = await Wallet.findById(validWalletId).select("currency").lean();
    const walletCurrency = (wallet as { currency?: string } | null)?.currency ?? "IDR";
    // Amount in wallet's currency: if transaction currency matches wallet currency, use raw amount;
    // otherwise convert via USD-based rates.
    const usdRates = await getExchangeRates("USD");
    const amountInWalletCurrency = convertCurrency(numAmount, currency, walletCurrency, usdRates);

    const isLoan = isLoanCategory(cleanCategory, cleanSubCategory);
    const delta =
      type === "INCOME" || (type === "DEBT" && isLoan) ? amountInWalletCurrency :
      type === "EXPENSE" ? -amountInWalletCurrency : 0;
    if (delta !== 0) {
      await Wallet.findByIdAndUpdate(validWalletId, { $inc: { balance: delta } });
    }
  }

  // Fire budget alert check asynchronously for EXPENSE type
  if (type === "EXPENSE") {
    const usdRates = await getExchangeRates("USD");
    checkBudgetAlerts(userId, cleanCategory, cleanSubCategory, validWalletId, currency, numAmount, usdRates);
  }

  // Notify wallet collaborators of the new transaction (fire-and-forget)
  if (validWalletId) {
    notifyWalletTransactionActivity({
      walletId: validWalletId,
      actorUserId: userId,
      action: "CREATED",
      transaction: {
        _id: transaction._id,
        type,
        title: cleanTitle,
        amount: numAmount,
        currency: String(currency),
      },
    }).catch(console.error);
  }

  return NextResponse.json({ transaction }, { status: 201 });
}

/** Fire budget alert if a new expense pushes spending >= 80% or 100% of limit */
async function checkBudgetAlerts(
  userId: string,
  category: string,
  subCategory: string | undefined,
  walletId: string | undefined,
  txCurrency: string,
  txAmount: number,
  usdRates: Record<string, number>
) {
  try {
    const now = new Date();
    const userObjId = new Types.ObjectId(userId);
    const budgets = await Budget.find(getRunningBudgetsQuery(userObjId, now))
      .populate({ path: "walletId", select: "name currency", strictPopulate: false })
      .lean();

    for (const budget of budgets) {
      if (!isTransactionMatchingBudget({ category, subCategory, walletId }, budget)) {
        continue;
      }
      const bWalletId =
        budget.walletId && typeof budget.walletId === "object"
          ? String((budget.walletId as { _id: unknown })._id)
          : budget.walletId
          ? String(budget.walletId)
          : null;

      const budgetCurrency = (budget as { currency?: string }).currency || "IDR";

      // Sum current spending for this budget
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const expenseQuery: Record<string, unknown> = {
        userId,
        type: "EXPENSE",
        date: { $gte: startOfMonth, $lt: startOfNextMonth },
      };
      if (bWalletId) expenseQuery.walletId = bWalletId;
      if (budget.category !== "ALL_CATEGORIES" && budget.category !== "ALL") {
        expenseQuery.category = budget.category;
        if (budget.subCategory) expenseQuery.subCategory = budget.subCategory;
      }

      const expenses = await Transaction.find(expenseQuery).select("amount currency").lean();
      let totalSpent = 0;
      for (const ex of expenses) {
        totalSpent += convertCurrency(ex.amount, ex.currency || "IDR", budgetCurrency, usdRates);
      }
      // Include the new transaction
      totalSpent += convertCurrency(txAmount, txCurrency, budgetCurrency, usdRates);

      const percent = budget.amountLimit > 0 ? (totalSpent / budget.amountLimit) * 100 : 0;
      const prevPercent =
        budget.amountLimit > 0
          ? ((totalSpent - convertCurrency(txAmount, txCurrency, budgetCurrency, usdRates)) /
              budget.amountLimit) *
            100
          : 0;

      const categoryLabel =
        budget.subCategory
          ? `${budget.category} › ${budget.subCategory}`
          : budget.category === "ALL_CATEGORIES" || budget.category === "ALL"
          ? "All Categories"
          : budget.category;

      // Alert at 80% (only once per crossing)
      if (percent >= 80 && prevPercent < 80 && percent < 100) {
        createAndSendNotification({
          userId,
          type: "BUDGET",
          title: "Budget Warning ⚠️",
          message: `You've spent ${Math.round(percent)}% of your "${categoryLabel}" budget for this month.`,
          link: "/budgets",
          metadata: { budgetId: String((budget as { _id: unknown })._id), percent: Math.round(percent) },
        }).catch(console.error);
      }

      // Alert at 100%+ (overspent)
      if (percent >= 100 && prevPercent < 100) {
        createAndSendNotification({
          userId,
          type: "BUDGET",
          title: "Budget Exceeded 🚨",
          message: `You have exceeded your "${categoryLabel}" budget by ${budgetCurrency} ${Math.round(totalSpent - budget.amountLimit).toLocaleString()}.`,
          link: "/budgets",
          metadata: { budgetId: String((budget as { _id: unknown })._id), percent: Math.round(percent) },
        }).catch(console.error);
      }
    }
  } catch (err) {
    console.error("checkBudgetAlerts error:", err);
  }
}

/** DELETE /api/finance/transactions — Delete single or multiple transactions with wallet balance rollback */
export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let idsToDelete: string[] = [];

  const { searchParams } = new URL(req.url);
  const singleId = searchParams.get("id");
  const commaIds = searchParams.get("ids");

  if (singleId) {
    idsToDelete.push(singleId);
  } else if (commaIds) {
    idsToDelete = commaIds.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    try {
      const body = await req.json();
      if (Array.isArray(body.ids)) {
        idsToDelete = body.ids;
      }
    } catch {
      // No body
    }
  }

  // Filter valid Mongo ObjectIDs to avoid injection
  idsToDelete = idsToDelete.filter((id) => /^[0-9a-fA-F]{24}$/.test(id));

  if (idsToDelete.length === 0) {
    return NextResponse.json({ error: "No valid transaction IDs provided" }, { status: 400 });
  }

  await connectDB();

  // Find all transactions to reverse their wallet balances
  const txs = await Transaction.find({ _id: { $in: idsToDelete }, userId }).lean();

  const usdRates = await getExchangeRates("USD");

  for (const tx of txs) {
    if (tx.walletId) {
      // Reversal: If it was EXPENSE, add back. If it was INCOME or LOAN, deduct.
      // Delta must be in the wallet's OWN currency, not IDR.
      const wallet = await Wallet.findById(tx.walletId).select("currency").lean();
      const walletCurrency = (wallet as { currency?: string } | null)?.currency ?? "IDR";
      const amountInWalletCurrency = convertCurrency(tx.amount, tx.currency || "IDR", walletCurrency, usdRates);

      const isLoan = isLoanCategory(tx.category, tx.subCategory);
      const rollbackDelta =
        tx.type === "EXPENSE" ? amountInWalletCurrency :
        (tx.type === "INCOME" || (tx.type === "DEBT" && isLoan)) ? -amountInWalletCurrency : 0;

      if (rollbackDelta !== 0) {
        await Wallet.findByIdAndUpdate(tx.walletId, { $inc: { balance: rollbackDelta } });
      }
    }

    // Refund any debt/loan repayments made from wallets
    if (tx.debtPayments && Array.isArray(tx.debtPayments)) {
      for (const p of tx.debtPayments) {
        if (p.walletId && p.amount > 0) {
          const pWallet = await Wallet.findById(p.walletId).select("currency").lean();
          if (pWallet) {
            const pWalletCurrency = (pWallet as { currency?: string }).currency || "IDR";
            const pAmt = convertCurrency(p.amount, p.currency || tx.currency || "IDR", pWalletCurrency, usdRates);
            await Wallet.findByIdAndUpdate(p.walletId, { $inc: { balance: pAmt } });
          }
        }
      }
    }
  }

  const result = await Transaction.deleteMany({ _id: { $in: idsToDelete }, userId });

  // Notify wallet collaborators for each affected wallet (fire-and-forget)
  const walletIdsNotified = new Set<string>();
  for (const tx of txs) {
    if (tx.walletId) {
      const wid = String(tx.walletId);
      if (!walletIdsNotified.has(wid)) {
        walletIdsNotified.add(wid);
        notifyWalletTransactionActivity({
          walletId: wid,
          actorUserId: userId,
          action: "DELETED",
          transaction: {
            _id: tx._id,
            type: tx.type,
            title: tx.title,
            amount: tx.amount,
            currency: tx.currency,
          },
        }).catch(console.error);
      }
    }
  }

  return NextResponse.json({ success: true, deletedCount: result.deletedCount });
}
