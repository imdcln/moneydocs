import mongoose from "mongoose";
import Budget from "@/models/Budget";
import { BudgetPeriodType, getNextPeriodRange } from "@/lib/budgetUtils";

/**
 * Safely computes the "YYYY-MM" monthYear for a budget period.
 * Uses the midpoint of startDate and endDate to ensure timezone shifts
 * (e.g. UTC+8 00:00:00 being stored as 16:00:00 UTC of prior month's last day)
 * never cause the monthYear to fall into the wrong month.
 */
export function computeBudgetMonthYear(
  startDate: Date,
  endDate: Date,
  clientMonthYear?: string
): string {
  if (clientMonthYear && /^\d{4}-\d{2}$/.test(clientMonthYear)) {
    return clientMonthYear;
  }
  const midTime = startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2;
  const mid = new Date(midTime);
  return `${mid.getUTCFullYear()}-${String(mid.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Automatically renews budgets marked "repeat this budget" whose time range has passed
 */
export async function processRepeatingBudgets(userId: mongoose.Types.ObjectId): Promise<void> {
  const now = new Date();
  const expiredRecurring = await Budget.find({
    userId,
    repeat: true,
    endDate: { $lt: now },
  });

  for (const b of expiredRecurring) {
    if (!b.startDate || !b.endDate) continue;
    let currStart = new Date(b.startDate);
    let currEnd = new Date(b.endDate);
    const pType = (b.periodType as BudgetPeriodType) || "MONTH";

    while (currEnd < now) {
      const nextRange = getNextPeriodRange(pType, currStart, currEnd);
      currStart = nextRange.startDate;
      currEnd = nextRange.endDate;

      // Check if a recurring budget was already generated for this new period
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query: Record<string, any> = {
        userId,
        category: b.category,
        startDate: currStart,
      };
      if (b.walletId) query.walletId = b.walletId;
      else query.walletId = { $in: [null, undefined] };
      if (b.subCategory) query.subCategory = b.subCategory;
      else query.subCategory = { $in: [null, ""] };

      const existing = await Budget.findOne(query);
      if (!existing) {
        const nextMonthYear = computeBudgetMonthYear(currStart, currEnd);
        await Budget.create({
          userId,
          walletId: b.walletId,
          currency: b.currency,
          name: b.name,
          category: b.category,
          subCategory: b.subCategory,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          categories: (b as any).categories,
          amountLimit: b.amountLimit,
          monthYear: nextMonthYear,
          periodType: pType,
          startDate: currStart,
          endDate: currEnd,
          repeat: true,
          order: (b as any).order ?? 0,
        });
      }
    }

    // Deactivate repeat on the past period so it doesn't process again
    b.repeat = false;
    await b.save();
  }
}

/**
 * Tests whether a transaction matches a budget by category/subcategory/multi-category and wallet
 */
export function isTransactionMatchingBudget(
  tx: { category?: string; subCategory?: string; walletId?: unknown },
  budget: {
    category?: string;
    subCategory?: string;
    categories?: string[];
    walletId?: unknown;
  }
): boolean {
  // Check wallet match if budget is scoped to a wallet
  const bWallet =
    budget.walletId && typeof budget.walletId === "object"
      ? String((budget.walletId as { _id?: unknown })._id ?? "")
      : budget.walletId
      ? String(budget.walletId)
      : null;

  if (bWallet) {
    const txWallet = tx.walletId ? String(tx.walletId) : null;
    if (!txWallet || txWallet !== bWallet) {
      return false;
    }
  }

  // Multi-category matching — prefer new `categories` array, fall back to legacy fields
  const categoryKeys: string[] =
    budget.categories && budget.categories.length > 0
      ? budget.categories
      : budget.category === "ALL_CATEGORIES" || budget.category === "ALL"
      ? ["ALL_CATEGORIES"]
      : budget.subCategory
      ? [`${budget.category}:${budget.subCategory}`]
      : budget.category
      ? [budget.category]
      : ["ALL_CATEGORIES"];

  if (categoryKeys.includes("ALL_CATEGORIES") || categoryKeys.includes("ALL")) {
    return true;
  }

  return categoryKeys.some((key) => {
    const [parentId, childId] = key.split(":");
    if (childId) {
      return tx.category === parentId && tx.subCategory === childId;
    }
    return tx.category === parentId;
  });
}

/**
 * Filter query to retrieve active / running budgets for the dashboard and reports
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRunningBudgetsQuery(userId: mongoose.Types.ObjectId, refDate = new Date()): Record<string, any> {
  const currentMonthYear = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}`;
  return {
    userId,
    $or: [
      { endDate: { $gte: refDate } },
      { endDate: { $in: [null, undefined] }, monthYear: { $gte: currentMonthYear } },
      { monthYear: currentMonthYear },
    ],
  };
}
