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
import { getBudgetDisplayName } from "@/lib/budgetUtils";
import { getRunningBudgetsQuery, isTransactionMatchingBudget } from "@/lib/budgetServer";
import { notifyWalletTransactionActivity } from "@/lib/walletNotifications";
import { getUserWalletPermissions } from "@/lib/walletPermissions";

interface BatchItem {
  type: "EXPENSE" | "INCOME" | "DEBT";
  title: string;
  amount: number;
  currency: string;
  category: string;
  subCategory?: string;
  description?: string;
}

interface BatchRequestBody {
  items: BatchItem[];
  walletId?: string;
  date: string;
  tags?: string[];
  receiptUrl?: string;
  eventId?: string;
  eventName?: string;
  eventCurrency?: string;
  withPeople?: string[];
  totalAmount: number;
}

/** Fire budget alerts for a batch of EXPENSE items */
async function checkBudgetAlertsForItems(
  userId: string,
  items: Array<{ category: string; subCategory?: string; currency: string; amount: number }>,
  walletId: string | undefined,
  usdRates: Record<string, number>
) {
  try {
    const now = new Date();
    const userObjId = new Types.ObjectId(userId);
    const budgets = await Budget.find(getRunningBudgetsQuery(userObjId, now))
      .populate({ path: "walletId", select: "name currency", strictPopulate: false })
      .lean();

    for (const budget of budgets) {
      const budgetCurrency = (budget as { currency?: string }).currency || "IDR";
      const bWalletId =
        budget.walletId && typeof budget.walletId === "object"
          ? String((budget.walletId as { _id: unknown })._id)
          : budget.walletId
          ? String(budget.walletId)
          : null;

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
      let baseSpent = 0;
      for (const ex of expenses) {
        baseSpent += convertCurrency(ex.amount, ex.currency || "IDR", budgetCurrency, usdRates);
      }

      // Check each matching item
      for (const item of items) {
        if (!isTransactionMatchingBudget({ category: item.category, subCategory: item.subCategory, walletId }, budget)) {
          continue;
        }
        const txAmtInBudgetCurrency = convertCurrency(item.amount, item.currency, budgetCurrency, usdRates);
        const totalSpent = baseSpent + txAmtInBudgetCurrency;
        const prevTotal = baseSpent;
        const percent = budget.amountLimit > 0 ? (totalSpent / budget.amountLimit) * 100 : 0;
        const prevPercent = budget.amountLimit > 0 ? (prevTotal / budget.amountLimit) * 100 : 0;
        const categoryLabel = getBudgetDisplayName(budget);

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

        // Accumulate so subsequent items in same batch see updated spend
        baseSpent += txAmtInBudgetCurrency;
      }
    }
  } catch (err) {
    console.error("checkBudgetAlertsForItems error:", err);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const user = await User.findOne({ email: session.user.email }).select("_id baseCurrency").lean() as {
    _id: unknown;
    baseCurrency?: string;
  } | null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = String(user._id);

  let body: BatchRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { items, walletId, date, tags, receiptUrl, eventId, eventName, eventCurrency, withPeople, totalAmount } = body;

  // Validate items array
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
  }
  if (items.length > 20) {
    return NextResponse.json({ error: "Maximum 20 items per batch" }, { status: 400 });
  }

  // Validate each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.type || !item.title || item.amount === undefined || item.amount === null || !item.category) {
      return NextResponse.json(
        { error: `Item ${i + 1} is missing required fields (type, title, amount, category)` },
        { status: 400 }
      );
    }
    if (!["EXPENSE", "INCOME", "DEBT"].includes(item.type)) {
      return NextResponse.json({ error: `Item ${i + 1} has invalid type` }, { status: 400 });
    }
    const numAmt = Number(item.amount);
    if (isNaN(numAmt) || !isFinite(numAmt) || numAmt <= 0 || numAmt > 1e12) {
      return NextResponse.json(
        { error: `Item ${i + 1} has invalid amount` },
        { status: 400 }
      );
    }
  }

  // Validate totalAmount
  const numTotalAmount = Number(totalAmount);
  if (isNaN(numTotalAmount) || !isFinite(numTotalAmount) || numTotalAmount <= 0) {
    return NextResponse.json({ error: "Invalid totalAmount" }, { status: 400 });
  }

  // Validate that item amounts sum to totalAmount (within 0.01 tolerance)
  const itemSum = items.reduce((s, i) => s + Number(i.amount), 0);
  if (Math.abs(itemSum - numTotalAmount) > 0.01) {
    return NextResponse.json({ error: "Item amounts do not sum to total" }, { status: 400 });
  }

  // Wallet permission check
  let validWalletId: string | undefined = undefined;
  if (walletId && typeof walletId === "string" && walletId !== "ALL" && walletId !== "GLOBAL") {
    if (!walletId.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json({ error: "Invalid wallet ID format" }, { status: 400 });
    }
    validWalletId = walletId;
    const targetWallet = await Wallet.findById(validWalletId).lean();
    if (!targetWallet) {
      return NextResponse.json({ error: "Selected wallet was not found" }, { status: 404 });
    }
    const perms = getUserWalletPermissions(
      targetWallet as Parameters<typeof getUserWalletPermissions>[0],
      session.user.email,
      userId
    );
    if (!perms.transactions.create) {
      return NextResponse.json(
        { error: "You do not have permission to create transactions in this wallet" },
        { status: 403 }
      );
    }
  }

  // Event lookup
  let validEventId: string | undefined = undefined;
  let resolvedEventName = eventName ? String(eventName).trim().slice(0, 100) : undefined;
  let resolvedEventCurrency = eventCurrency ? String(eventCurrency).trim().slice(0, 5).toUpperCase() : undefined;

  if (eventId && typeof eventId === "string" && eventId.match(/^[0-9a-fA-F]{24}$/)) {
    validEventId = eventId;
    const ev = await EventModel.findOne({ _id: validEventId, userId }).lean() as { name: string; currency: string } | null;
    if (ev) {
      resolvedEventName = ev.name;
      resolvedEventCurrency = ev.currency;
    } else {
      validEventId = undefined;
    }
  }

  // Sanitize shared fields
  const cleanTags = Array.isArray(tags)
    ? tags.map((t) => String(t).slice(0, 30).replace(/[<>]/g, "")).filter(Boolean)
    : [];
  const cleanWithPeople = Array.isArray(withPeople)
    ? withPeople.map((p) => String(p).trim().slice(0, 50)).filter(Boolean)
    : undefined;
  const cleanReceiptUrl =
    typeof receiptUrl === "string" && receiptUrl.startsWith("data:image/") ? receiptUrl : undefined;
  const txDate = date ? new Date(date) : new Date();

  // Get exchange rates once
  const usdRates = await getExchangeRates("USD");

  // Build transaction documents
  const docs: Record<string, unknown>[] = [];
  for (const item of items) {
    const numAmt = Number(item.amount);
    const cleanTitle = String(item.title).trim().slice(0, 100).replace(/[<>]/g, "");
    const cleanCategory = String(item.category).trim().slice(0, 50).replace(/[<>]/g, "");
    const cleanSubCategory = item.subCategory
      ? String(item.subCategory).trim().slice(0, 50).replace(/[<>]/g, "")
      : undefined;
    const cleanDescription = item.description
      ? String(item.description).trim().slice(0, 500).replace(/[<>]/g, "")
      : undefined;
    const itemCurrency = String(item.currency || "IDR").slice(0, 5).toUpperCase();

    let convertedAmountIDR = numAmt;
    if (itemCurrency !== "IDR") {
      const idrRates = await getExchangeRates("IDR");
      convertedAmountIDR = convertToIDR(numAmt, itemCurrency, idrRates);
    }

    docs.push({
      userId,
      type: item.type,
      title: cleanTitle,
      amount: numAmt,
      currency: itemCurrency,
      convertedAmountIDR,
      category: cleanCategory,
      subCategory: cleanSubCategory,
      walletId: validWalletId || undefined,
      eventId: validEventId || undefined,
      eventName: resolvedEventName,
      eventCurrency: resolvedEventCurrency,
      withPeople: cleanWithPeople,
      date: txDate,
      description: cleanDescription,
      tags: cleanTags,
      receiptUrl: cleanReceiptUrl,
    });
  }

  // Batch insert
  const createdDocs = await Transaction.insertMany(docs);

  // Update wallet balance once — sum all deltas together
  if (validWalletId) {
    const wallet = await Wallet.findById(validWalletId).select("currency").lean();
    const walletCurrency = (wallet as { currency?: string } | null)?.currency ?? "IDR";

    let totalDelta = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const numAmt = Number(item.amount);
      const itemCurrency = String(item.currency || "IDR").slice(0, 5).toUpperCase();
      const cleanCategory = String(item.category).trim().slice(0, 50).replace(/[<>]/g, "");
      const cleanSubCategory = item.subCategory
        ? String(item.subCategory).trim().slice(0, 50).replace(/[<>]/g, "")
        : undefined;
      const amountInWalletCurrency = convertCurrency(numAmt, itemCurrency, walletCurrency, usdRates);
      const isLoan = isLoanCategory(cleanCategory, cleanSubCategory);
      const delta =
        item.type === "INCOME" || (item.type === "DEBT" && isLoan)
          ? amountInWalletCurrency
          : item.type === "EXPENSE"
          ? -amountInWalletCurrency
          : 0;
      totalDelta += delta;
    }

    if (totalDelta !== 0) {
      await Wallet.findByIdAndUpdate(validWalletId, { $inc: { balance: totalDelta } });
    }
  }

  // Fire budget alerts for EXPENSE items
  const expenseItems = items
    .filter((i) => i.type === "EXPENSE")
    .map((i) => ({
      category: String(i.category).trim().slice(0, 50).replace(/[<>]/g, ""),
      subCategory: i.subCategory ? String(i.subCategory).trim().slice(0, 50).replace(/[<>]/g, "") : undefined,
      currency: String(i.currency || "IDR").slice(0, 5).toUpperCase(),
      amount: Number(i.amount),
    }));

  if (expenseItems.length > 0) {
    checkBudgetAlertsForItems(userId, expenseItems, validWalletId, usdRates);
  }

  // Fire wallet notification once for the batch
  if (validWalletId && createdDocs.length > 0) {
    const firstTx = createdDocs[0];
    notifyWalletTransactionActivity({
      walletId: validWalletId,
      actorUserId: userId,
      action: "CREATED",
      transaction: {
        _id: firstTx._id,
        type: items[0].type,
        title: `Batch (${createdDocs.length} items)`,
        amount: numTotalAmount,
        currency: String(items[0].currency || "IDR"),
      },
    }).catch(console.error);
  }

  return NextResponse.json({ transactions: createdDocs, count: createdDocs.length }, { status: 201 });
}
