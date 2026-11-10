import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Budget from "@/models/Budget";
import Transaction from "@/models/Transaction";
import User from "@/models/User";
import Wallet from "@/models/Wallet";
import { getExchangeRates, convertCurrency } from "@/lib/currency";
import { getNextPeriodRange, getMonthRange, getDaysBetween, BudgetPeriodType } from "@/lib/budgetUtils";
import { getCategoryDisplayName } from "@/lib/categories";
import { computeBudgetMonthYear, processRepeatingBudgets } from "@/lib/budgetServer";
import { getUserWalletPermissions } from "@/lib/walletPermissions";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  await connectDB();
  const user = await User.findOne({ email: session.user.email }).lean() as { _id: { toString(): string } } | null;
  return user ? String(user._id) : null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email }).select("_id baseCurrency").lean() as { _id: unknown; baseCurrency?: string } | null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = String(user._id);
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const userEmail = session.user.email.toLowerCase();

  const { searchParams } = new URL(req.url);
  const monthYearParam = searchParams.get("monthYear") ?? new Date().toISOString().slice(0, 7);
  const walletId = searchParams.get("walletId");
  const mode = searchParams.get("mode") || searchParams.get("status");

  // Fire-and-forget auto-renewal in background (non-blocking)
  processRepeatingBudgets(userObjectId).catch(() => {});

  const [yearStr, monthStr] = monthYearParam.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const monthDefault = getMonthRange(new Date(year, month - 1, 15));

  const budgetId = searchParams.get("budgetId");

  const sharedWallets = await Wallet.find({ "sharedWith.email": userEmail }).lean();
  const readableSharedWalletIds = sharedWallets
    .filter((w) => getUserWalletPermissions(w as any, userEmail, userId).budgets.read)
    .map((w) => w._id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const budgetQuery: Record<string, any> = {};

  if (budgetId) {
    const rawId = budgetId.startsWith("other_categories_")
      ? budgetId.replace("other_categories_", "")
      : budgetId;

    if (mongoose.Types.ObjectId.isValid(rawId)) {
      const targetDoc = (await Budget.findById(rawId).lean()) as {
        category?: string;
        startDate: Date;
        endDate: Date;
        walletId?: unknown;
        userId?: unknown;
      } | null;

      if (targetDoc) {
        if (
          targetDoc.category === "ALL_CATEGORIES" ||
          targetDoc.category === "ALL" ||
          budgetId.startsWith("other_categories_")
        ) {
          budgetQuery.$or = [
            { _id: new mongoose.Types.ObjectId(rawId) },
            {
              startDate: { $lte: targetDoc.endDate },
              endDate: { $gte: targetDoc.startDate },
            },
          ];
          if (targetDoc.walletId) {
            budgetQuery.walletId = targetDoc.walletId;
          } else {
            budgetQuery.walletId = { $in: [null, undefined] };
          }
        } else {
          budgetQuery._id = new mongoose.Types.ObjectId(rawId);
        }
      } else {
        budgetQuery._id = new mongoose.Types.ObjectId(rawId);
      }
    }
  } else if (mode === "finished") {
    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    budgetQuery.$and = [
      {
        $or: [
          { endDate: { $lt: now } },
          { endDate: { $in: [null, undefined] }, monthYear: { $lt: currentMonthYear } },
        ],
      },
    ];

    if (walletId && walletId !== "ALL" && walletId !== "GLOBAL") {
      if (mongoose.Types.ObjectId.isValid(walletId)) {
        budgetQuery.walletId = new mongoose.Types.ObjectId(walletId);
      }
    } else if (walletId === "GLOBAL") {
      budgetQuery.userId = userObjectId;
      budgetQuery.walletId = { $in: [null, undefined] };
    } else {
      budgetQuery.$and.push({
        $or: [
          { userId: userObjectId },
          ...(readableSharedWalletIds.length > 0 ? [{ walletId: { $in: readableSharedWalletIds } }] : []),
        ],
      });
    }
  } else if (mode === "running") {
    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    budgetQuery.$and = [
      {
        $or: [
          { endDate: { $gte: now } },
          { endDate: { $in: [null, undefined] }, monthYear: { $gte: currentMonthYear } },
        ],
      },
    ];

    if (walletId && walletId !== "ALL" && walletId !== "GLOBAL") {
      if (mongoose.Types.ObjectId.isValid(walletId)) {
        budgetQuery.walletId = new mongoose.Types.ObjectId(walletId);
      }
    } else if (walletId === "GLOBAL") {
      budgetQuery.userId = userObjectId;
      budgetQuery.walletId = { $in: [null, undefined] };
    } else {
      budgetQuery.$and.push({
        $or: [
          { userId: userObjectId },
          ...(readableSharedWalletIds.length > 0 ? [{ walletId: { $in: readableSharedWalletIds } }] : []),
        ],
      });
    }
  } else {
    budgetQuery.$and = [
      {
        $or: [
          { monthYear: monthYearParam },
          {
            $and: [
              { startDate: { $lte: new Date(monthDefault.endDate.getTime() - 24 * 60 * 60 * 1000) } },
              { endDate: { $gte: new Date(monthDefault.startDate.getTime() + 24 * 60 * 60 * 1000) } },
            ],
          },
        ],
      },
    ];

    if (walletId && walletId !== "ALL" && walletId !== "GLOBAL") {
      if (mongoose.Types.ObjectId.isValid(walletId)) {
        budgetQuery.walletId = new mongoose.Types.ObjectId(walletId);
      }
    } else if (walletId === "GLOBAL") {
      budgetQuery.userId = userObjectId;
      budgetQuery.walletId = { $in: [null, undefined] };
    } else {
      budgetQuery.$and.push({
        $or: [
          { userId: userObjectId },
          ...(readableSharedWalletIds.length > 0 ? [{ walletId: { $in: readableSharedWalletIds } }] : []),
        ],
      });
    }
  }

  const [budgets, rates] = await Promise.all([
    Budget.find(budgetQuery)
      .populate({ path: "walletId", select: "name icon currency", strictPopulate: false })
      .sort(mode === "finished" ? { endDate: -1, startDate: -1, createdAt: -1 } : { order: 1, createdAt: -1 })
      .lean(),
    getExchangeRates("USD"),
  ]);

  const globalCurrency = user.baseCurrency || "IDR";

  // Limit transaction query to the active date window of budgets instead of all historical expenses
  let rawTransactions: any[] = [];
  if (budgets.length > 0) {
    let minStart = monthDefault.startDate;
    let maxEnd = monthDefault.endDate;
    for (const b of budgets) {
      if (b.startDate && new Date(b.startDate) < minStart) minStart = new Date(b.startDate);
      if (b.endDate && new Date(b.endDate) > maxEnd) maxEnd = new Date(b.endDate);
    }
    const bufferedStart = new Date(minStart.getTime() - 2 * 24 * 60 * 60 * 1000);
    const bufferedEnd = new Date(maxEnd.getTime() + 2 * 24 * 60 * 60 * 1000);

    const txBaseQuery =
      walletId && walletId !== "ALL" && walletId !== "GLOBAL" && mongoose.Types.ObjectId.isValid(walletId)
        ? { walletId: new mongoose.Types.ObjectId(walletId), type: "EXPENSE" }
        : walletId === "GLOBAL"
        ? { userId: userObjectId, walletId: { $in: [null, undefined] }, type: "EXPENSE" }
        : {
            $or: [
              { userId: userObjectId },
              ...(readableSharedWalletIds.length > 0 ? [{ walletId: { $in: readableSharedWalletIds } }] : []),
            ],
            type: "EXPENSE",
          };

    rawTransactions = await Transaction.find({
      ...txBaseQuery,
      date: { $gte: bufferedStart, $lte: bufferedEnd },
    } as any).lean();
  }

  // Compute spent and daily cumulative spending for each budget
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const computedBudgets: any[] = [];

  for (const b of budgets) {
    const bStart = b.startDate ? new Date(b.startDate) : monthDefault.startDate;
    let bEnd = b.endDate ? new Date(b.endDate) : monthDefault.endDate;
    if ((b.periodType === "MONTH" || !b.periodType) && bEnd.getDate() === 1 && bEnd.getMonth() !== bStart.getMonth()) {
      bEnd = new Date(bStart.getFullYear(), bStart.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    const bWallet = b.walletId && typeof b.walletId === "object" ? (b.walletId as { _id: unknown; currency?: string; name?: string }) : null;
    const bWalletId = bWallet ? String(bWallet._id) : (b.walletId ? String(b.walletId) : null);

    // Determine the currency for this budget:
    // 1. Budget's own stored currency
    // 2. Linked wallet's currency
    // 3. User's base currency
    const budgetCurrency = b.currency || bWallet?.currency || globalCurrency;

    // Filter matching transactions in budget range
    const matchingTx = rawTransactions.filter((tx) => {
      const txDate = new Date(tx.date);
      if (txDate < bStart || txDate > bEnd) return false;

      // Filter by wallet if budget is wallet-specific
      if (bWalletId) {
        if (!tx.walletId || String(tx.walletId) !== bWalletId) return false;
      }

      // Category matching — prefer new `categories` array, fall back to legacy fields
      const categoryKeys: string[] = (b as { categories?: string[] }).categories && (b as { categories?: string[] }).categories!.length > 0
        ? (b as { categories?: string[] }).categories!
        : b.category === "ALL_CATEGORIES" || b.category === "ALL"
          ? ["ALL_CATEGORIES"]
          : b.subCategory
            ? [`${b.category}:${b.subCategory}`]
            : [b.category];

      if (categoryKeys.includes("ALL_CATEGORIES")) return true;

      return categoryKeys.some((key) => {
        const [parentId, childId] = key.split(":");
        if (childId) {
          return tx.category === parentId && tx.subCategory === childId;
        }
        return tx.category === parentId;
      });
    });

    let spent = 0;
    for (const tx of matchingTx) {
      spent += convertCurrency(tx.amount, tx.currency || "IDR", budgetCurrency, rates);
    }

    const remaining = Math.max(0, b.amountLimit - spent);
    const percentUsed = b.amountLimit > 0 ? Math.min(100, Math.round((spent / b.amountLimit) * 100)) : 0;

    // Daily cumulative curve calculation for details chart
    const totalDays = getDaysBetween(bStart, bEnd);
    const dailyPoints: { date: string; spent: number }[] = [];
    let runningSpent = 0;

    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const pointDate = new Date(bStart);
      pointDate.setDate(pointDate.getDate() + dayOffset);
      const dayStart = new Date(pointDate.getFullYear(), pointDate.getMonth(), pointDate.getDate(), 0, 0, 0);
      const dayEnd = new Date(pointDate.getFullYear(), pointDate.getMonth(), pointDate.getDate(), 23, 59, 59, 999);

      const dayTxs = matchingTx.filter((t) => {
        const d = new Date(t.date);
        return d >= dayStart && d <= dayEnd;
      });

      for (const t of dayTxs) {
        runningSpent += convertCurrency(t.amount, t.currency || "IDR", budgetCurrency, rates);
      }

      const dStr = `${String(pointDate.getDate()).padStart(2, "0")}/${String(pointDate.getMonth() + 1).padStart(2, "0")}`;
      dailyPoints.push({
        date: dStr,
        spent: Math.round(runningSpent * 100) / 100,
      });
    }

    computedBudgets.push({
      ...b,
      currency: budgetCurrency,
      startDate: bStart,
      endDate: bEnd,
      periodType: b.periodType || "MONTH",
      repeat: !!b.repeat,
      spent: Math.round(spent * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      percentUsed,
      dailyPoints,
      transactions: matchingTx.map((tx) => ({
        _id: String(tx._id),
        date: tx.date,
        title: tx.title || tx.category,
        category: tx.category,
        subCategory: tx.subCategory,
        amount: convertCurrency(tx.amount, tx.currency || "IDR", budgetCurrency, rates),
        rawAmount: tx.amount,
        rawCurrency: tx.currency,
        currency: budgetCurrency,
        walletId: tx.walletId ? String(typeof tx.walletId === "object" && tx.walletId._id ? tx.walletId._id : tx.walletId) : undefined,
      })),
    });
  }

  // ── Requirement 6: "All Categories" and "Other Categories" calculation ───────
  // Support multiple ALL_CATEGORIES budgets across different periods
  const allCategoriesBudgets = computedBudgets.filter(
    (b) => b.category === "ALL_CATEGORIES" || b.category === "ALL"
  );

  for (const allCategoriesBudget of allCategoriesBudgets) {
    const allCatCurrency = allCategoriesBudget.currency || globalCurrency;
    const bStart = new Date(allCategoriesBudget.startDate);
    const bEnd = new Date(allCategoriesBudget.endDate);
    const bWalletId = allCategoriesBudget.walletId
      ? (typeof allCategoriesBudget.walletId === "object" ? String((allCategoriesBudget.walletId as { _id: unknown })._id) : String(allCategoriesBudget.walletId))
      : null;

    const allCatPeriodType = allCategoriesBudget.periodType || "MONTH";
    const specificBudgets = computedBudgets.filter((b) => {
      if (b.category === "ALL_CATEGORIES" || b.category === "ALL" || b.isOtherCategories) return false;
      const bPeriodType = b.periodType || "MONTH";
      if (bPeriodType !== allCatPeriodType) return false;
      const sStart = new Date(b.startDate);
      const sEnd = new Date(b.endDate);
      const sWalletId = b.walletId
        ? (typeof b.walletId === "object" ? String((b.walletId as { _id: unknown })._id) : String(b.walletId))
        : null;
      if (bWalletId !== sWalletId) return false;
      // Child budget must be contained within (or equal to) the All Categories date range.
      // Use date-level comparison to avoid millisecond precision mismatches from DB storage.
      return sStart >= bStart && sEnd <= bEnd;
    });

    const totalSpecificLimit = specificBudgets.reduce((acc, curr) => {
      const specCurr = curr.currency || allCatCurrency;
      return acc + convertCurrency(curr.amountLimit || 0, specCurr, allCatCurrency, rates);
    }, 0);

    allCategoriesBudget.childBudgetsTotal = Math.round(totalSpecificLimit * 100) / 100;
    allCategoriesBudget.childBudgetsExceed = totalSpecificLimit > allCategoriesBudget.amountLimit;
    allCategoriesBudget.childBudgetsExceededAmount = Math.max(
      0,
      Math.round((totalSpecificLimit - allCategoriesBudget.amountLimit) * 100) / 100
    );

    // If user only creates "all categories" budget without any other budgets, do not auto create "Other Categories"
    if (specificBudgets.length === 0) {
      continue;
    }

    if (totalSpecificLimit < allCategoriesBudget.amountLimit) {
      const otherLimit = allCategoriesBudget.amountLimit - totalSpecificLimit;

      // Build a precise set of covered (category[:subCategory]) keys from each child budget.
      // A whole-category budget covers "CATEGORY"; a subcategory budget covers "CATEGORY:sub".
      // This prevents a subcat budget from incorrectly wiping its entire parent category.
      const coveredKeys = new Set<string>();
      for (const sb of specificBudgets) {
        const cats: string[] =
          (sb as { categories?: string[] }).categories &&
          (sb as { categories?: string[] }).categories!.length > 0
            ? (sb as { categories?: string[] }).categories!
            : sb.subCategory
            ? [`${sb.category}:${sb.subCategory}`]
            : [sb.category];
        for (const k of cats) coveredKeys.add(k);
      }

      // A tx is "covered" if a whole-category key matches tx.category,
      // or a subcategory key matches tx.category:tx.subCategory.
      const isCovered = (tx: { category: string; subCategory?: string }) => {
        if (coveredKeys.has(tx.category)) return true;
        if (tx.subCategory && coveredKeys.has(`${tx.category}:${tx.subCategory}`)) return true;
        return false;
      };

      // Other categories = any expense transactions in this range NOT covered by a child budget
      const otherTx = rawTransactions.filter((tx) => {
        const txDate = new Date(tx.date);
        if (txDate < bStart || txDate > bEnd) return false;
        if (bWalletId && (!tx.walletId || String(tx.walletId) !== bWalletId)) return false;
        return !isCovered(tx);
      });

      let otherSpent = 0;
      for (const tx of otherTx) {
        otherSpent += convertCurrency(tx.amount, tx.currency || "IDR", allCatCurrency, rates);
      }

      const otherRemaining = Math.max(0, otherLimit - otherSpent);
      const otherPercentUsed = otherLimit > 0 ? Math.min(100, Math.round((otherSpent / otherLimit) * 100)) : 0;

      // Daily cumulative curve for other categories
      const totalDays = getDaysBetween(bStart, bEnd);
      const dailyPoints: { date: string; spent: number }[] = [];
      let runningOther = 0;

      for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
        const pointDate = new Date(bStart);
        pointDate.setDate(pointDate.getDate() + dayOffset);
        const dayStart = new Date(pointDate.getFullYear(), pointDate.getMonth(), pointDate.getDate(), 0, 0, 0);
        const dayEnd = new Date(pointDate.getFullYear(), pointDate.getMonth(), pointDate.getDate(), 23, 59, 59, 999);

        const dayTxs = otherTx.filter((t) => {
          const d = new Date(t.date);
          return d >= dayStart && d <= dayEnd;
        });

        for (const t of dayTxs) {
          runningOther += convertCurrency(t.amount, t.currency || "IDR", allCatCurrency, rates);
        }

        dailyPoints.push({
          date: `${String(pointDate.getDate()).padStart(2, "0")}/${String(pointDate.getMonth() + 1).padStart(2, "0")}`,
          spent: Math.round(runningOther * 100) / 100,
        });
      }

      computedBudgets.push({
        _id: `other_categories_${allCategoriesBudget._id}`,
        category: "OTHER_CATEGORIES",
        isOtherCategories: true,
        parentAllCategoriesId: allCategoriesBudget._id,
        amountLimit: otherLimit,
        currency: allCatCurrency,
        spent: Math.round(otherSpent * 100) / 100,
        remaining: Math.round(otherRemaining * 100) / 100,
        percentUsed: otherPercentUsed,
        monthYear: allCategoriesBudget.monthYear,
        periodType: allCategoriesBudget.periodType,
        startDate: bStart,
        endDate: bEnd,
        walletId: allCategoriesBudget.walletId,
        repeat: allCategoriesBudget.repeat,
        dailyPoints,
        transactions: otherTx.map((tx) => ({
          _id: String(tx._id),
          date: tx.date,
          title: tx.title || tx.category,
          category: tx.category,
          subCategory: tx.subCategory,
          amount: convertCurrency(tx.amount, tx.currency || "IDR", allCatCurrency, rates),
          rawAmount: tx.amount,
          rawCurrency: tx.currency,
          currency: allCatCurrency,
          walletId: tx.walletId ? String(typeof tx.walletId === "object" && tx.walletId._id ? tx.walletId._id : tx.walletId) : undefined,
        })),
      });
    }
  }

  const budgetsRes = NextResponse.json({
    budgets: computedBudgets,
    monthYear: monthYearParam,
    globalCurrency,
  });
  budgetsRes.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=20");
  return budgetsRes;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, category, subCategory, categories, amountLimit, periodType, startDate, endDate, repeat, walletId, currency, monthYear: clientMonthYear } = body;

  if (!category || !amountLimit) {
    return NextResponse.json(
      { error: "Category and budget amount limit are required" },
      { status: 400 }
    );
  }

  const numLimit = Number(amountLimit);
  if (isNaN(numLimit) || !isFinite(numLimit) || numLimit <= 0 || numLimit > 1e14) {
    return NextResponse.json({ error: "Invalid budget amount limit" }, { status: 400 });
  }

  await connectDB();

  let start: Date;
  let end: Date;

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
    if ((periodType === "MONTH" || !periodType) && end.getDate() === 1 && end.getMonth() !== start.getMonth()) {
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    }
  } else {
    const mRange = getMonthRange(new Date());
    start = mRange.startDate;
    end = mRange.endDate;
  }

  // Reject budgets where start date is after end date
  if (start > end) {
    return NextResponse.json(
      { error: "Start date must be before or equal to the end date." },
      { status: 400 }
    );
  }

  // Reject budgets whose end date is entirely in the past
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (end < todayStart) {
    return NextResponse.json(
      { error: "Budget period cannot be in the past. Budgets can only be created for the present or future." },
      { status: 400 }
    );
  }

  const pType = periodType || "MONTH";
  const cleanName =
    name && typeof name === "string" && name.trim()
      ? name.trim().slice(0, 100).replace(/[<>]/g, "")
      : undefined;
  const cleanCategory = String(category).trim().slice(0, 50).replace(/[<>]/g, "");
  const cleanSubCategory = subCategory ? String(subCategory).trim().slice(0, 50).replace(/[<>]/g, "") : undefined;
  // Validate and clean multi-category list
  const cleanCategories: string[] | undefined = Array.isArray(categories) && categories.length > 0
    ? categories.map((k: string) => String(k).trim().slice(0, 100).replace(/[<>]/g, "")).filter(Boolean)
    : undefined;
  const monthYear = computeBudgetMonthYear(start, end, clientMonthYear);

  let targetWalletId: mongoose.Types.ObjectId | undefined = undefined;
  let budgetCurrency = currency ? String(currency).toUpperCase() : undefined;

  const session = await auth();
  if (walletId && walletId !== "ALL" && walletId !== "GLOBAL" && mongoose.Types.ObjectId.isValid(walletId)) {
    targetWalletId = new mongoose.Types.ObjectId(walletId);
    const targetWalletDoc = await Wallet.findById(targetWalletId).lean();
    if (targetWalletDoc) {
      const perms = getUserWalletPermissions(targetWalletDoc as any, session?.user?.email, userId);
      if (!perms.budgets.create) {
        return NextResponse.json({ error: "You do not have permission to create budgets in this wallet" }, { status: 403 });
      }
    }
    if (!budgetCurrency) {
      const walletDoc = await Wallet.findById(targetWalletId).select("currency").lean();
      if (walletDoc && (walletDoc as { currency?: string }).currency) {
        budgetCurrency = (walletDoc as { currency?: string }).currency;
      }
    }
  }

  if (!budgetCurrency) {
    const userDoc = await User.findById(userId).select("baseCurrency").lean();
    budgetCurrency = (userDoc as { baseCurrency?: string } | null)?.baseCurrency || "IDR";
  }

  // Check if a budget already exists for this category, wallet, and overlapping period within the same periodType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingFilter: Record<string, any> = {
    userId: new mongoose.Types.ObjectId(userId),
  };

  if (cleanCategory === "ALL_CATEGORIES" || cleanCategory === "ALL") {
    existingFilter.category = { $in: ["ALL_CATEGORIES", "ALL"] };
  } else {
    existingFilter.category = cleanCategory;
  }

  if (pType === "MONTH") {
    // For monthly budgets, duplicate check is strictly within monthly budgets for that monthYear
    existingFilter.periodType = { $in: ["MONTH", null, undefined] };
    existingFilter.monthYear = monthYear;
  } else {
    // For other period types (WEEK, QUARTER, YEAR, CUSTOM), duplicate check is scoped to that periodType and date overlap
    existingFilter.periodType = pType;
    existingFilter.startDate = { $lte: new Date(end.getTime() - 24 * 60 * 60 * 1000) };
    existingFilter.endDate = { $gte: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  }

  if (targetWalletId) {
    existingFilter.walletId = targetWalletId;
  } else {
    existingFilter.walletId = { $in: [null, undefined] };
  }

  if (cleanSubCategory) {
    existingFilter.subCategory = cleanSubCategory;
  } else {
    existingFilter.subCategory = { $in: [null, ""] };
  }

  const existingBudget = await Budget.findOne(existingFilter);
  if (existingBudget) {
    const catName = getCategoryDisplayName(cleanCategory, cleanSubCategory);
    return NextResponse.json(
      {
        error: `A budget for "${catName}" already exists for this time period. You can edit the existing budget instead.`,
        code: "BUDGET_ALREADY_EXISTS",
        existingBudgetId: String(existingBudget._id),
      },
      { status: 409 }
    );
  }

  // Determine next order sequence for this user
  const lastBudget = await Budget.findOne({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ order: -1 })
    .select("order")
    .lean();
  const nextOrder = lastBudget && typeof lastBudget.order === "number" ? lastBudget.order + 1 : 0;

  // Create new budget document
  const budget = await Budget.create({
    userId: new mongoose.Types.ObjectId(userId),
    walletId: targetWalletId,
    name: cleanName,
    category: cleanCategory,
    subCategory: cleanSubCategory,
    categories: cleanCategories,
    amountLimit: numLimit,
    currency: budgetCurrency,
    monthYear,
    periodType: pType,
    startDate: start,
    endDate: end,
    repeat: !!repeat,
    order: nextOrder,
  });

  return NextResponse.json({ budget }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { _id, name, category, subCategory, categories, amountLimit, periodType, startDate, endDate, repeat, walletId, currency } = body;

  if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
    return NextResponse.json({ error: "Valid budget id is required" }, { status: 400 });
  }

  const numLimit = Number(amountLimit);
  if (isNaN(numLimit) || !isFinite(numLimit) || numLimit <= 0) {
    return NextResponse.json({ error: "Invalid budget amount limit" }, { status: 400 });
  }

  await connectDB();

  let targetWalletId: mongoose.Types.ObjectId | null = null;
  let budgetCurrency = currency ? String(currency).toUpperCase() : undefined;

  const updateFields: Record<string, unknown> = {
    amountLimit: numLimit,
    repeat: !!repeat,
  };

  if (walletId !== undefined) {
    if (walletId && walletId !== "ALL" && walletId !== "GLOBAL" && mongoose.Types.ObjectId.isValid(walletId)) {
      targetWalletId = new mongoose.Types.ObjectId(walletId);
      if (!budgetCurrency) {
        const walletDoc = await Wallet.findById(targetWalletId).select("currency").lean();
        if (walletDoc && (walletDoc as { currency?: string }).currency) {
          budgetCurrency = (walletDoc as { currency?: string }).currency;
        }
      }
    } else {
      if (!budgetCurrency) {
        const userDoc = await User.findById(userId).select("baseCurrency").lean();
        budgetCurrency = (userDoc as { baseCurrency?: string } | null)?.baseCurrency || "IDR";
      }
    }
    updateFields.walletId = targetWalletId;
    if (budgetCurrency) updateFields.currency = budgetCurrency;
  } else if (budgetCurrency) {
    updateFields.currency = budgetCurrency;
  }

  if (name !== undefined) {
    updateFields.name =
      name && typeof name === "string" && name.trim()
        ? name.trim().slice(0, 100).replace(/[<>]/g, "")
        : null;
  }
  if (category) updateFields.category = String(category).trim();
  if (subCategory !== undefined) updateFields.subCategory = subCategory || undefined;
  // Update multi-category list
  if (Array.isArray(categories) && categories.length > 0) {
    updateFields.categories = categories
      .map((k: string) => String(k).trim().slice(0, 100).replace(/[<>]/g, ""))
      .filter(Boolean);
  }
  if (periodType) updateFields.periodType = periodType;
  if (startDate) updateFields.startDate = new Date(startDate);
  if (endDate) {
    let eDate = new Date(endDate);
    const sDate = startDate ? new Date(startDate) : null;
    if (sDate && (periodType === "MONTH" || !periodType) && eDate.getDate() === 1 && eDate.getMonth() !== sDate.getMonth()) {
      eDate = new Date(sDate.getFullYear(), sDate.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    updateFields.endDate = eDate;
  }

  if (body.monthYear && /^\d{4}-\d{2}$/.test(body.monthYear)) {
    updateFields.monthYear = body.monthYear;
  } else if (startDate && updateFields.endDate) {
    updateFields.monthYear = computeBudgetMonthYear(new Date(startDate), new Date(updateFields.endDate as string | number | Date));
  }

  const updatedBudget = await Budget.findOneAndUpdate(
    { _id, userId: new mongoose.Types.ObjectId(userId) },
    updateFields,
    { new: true }
  );

  if (!updatedBudget) {
    return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  }

  return NextResponse.json({ budget: updatedBudget });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Valid id is required" }, { status: 400 });
  }

  await connectDB();
  await Budget.findOneAndDelete({ _id: id, userId });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { orderedIds } = body;

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds array is required" }, { status: 400 });
  }

  await connectDB();
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const bulkOps = orderedIds
    .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
    .map((id: string, index: number) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(id), userId: userObjectId },
        update: { $set: { order: index } },
      },
    }));

  if (bulkOps.length > 0) {
    // Use Budget.collection.bulkWrite() (raw MongoDB driver) to bypass
    // Mongoose model caching / strict-mode which silently strips unknown fields
    // when the model was registered before the `order` field was added to the schema.
    await Budget.collection.bulkWrite(bulkOps);
  }

  return NextResponse.json({ success: true, count: bulkOps.length });
}
