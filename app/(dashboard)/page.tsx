import type { BudgetPeriodType } from "@/lib/budgetUtils";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import Wallet from "@/models/Wallet";
import Transaction from "@/models/Transaction";
import Budget from "@/models/Budget";
import { getExchangeRates, convertCurrency } from "@/lib/currency";
import {
  processRepeatingBudgets,
  getRunningBudgetsQuery,
  isTransactionMatchingBudget,
} from "@/lib/budgetServer";
import HomeDashboard from "@/components/admin/HomeDashboard";
import { normalizePermissions } from "@/lib/walletPermissions";

export default async function AdminHomePage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  await connectDB();

  const user = (await User.findOne({ email: session.user.email }).lean()) as {
    _id: { toString(): string };
    name: string;
    email: string;
    baseCurrency: string;
    hasCompletedOnboarding?: boolean;
  } | null;

  if (!user) {
    redirect("/auth/signin");
  }

  const userId = String(user._id);
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const globalCurrency = user.baseCurrency || "IDR";

  // Fire-and-forget: auto-renew repeating budgets in background (non-blocking)
  processRepeatingBudgets(userObjectId).catch(() => {});

  // Date ranges
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const monthYear = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  const startOfThisMonth = new Date(currentYear, currentMonth, 1);
  const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1);

  // Previous month dates
  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const startOfPrevMonth = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1);
  const endOfPrevMonth = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 1);

  // Fetch exchange rates and running budgets in parallel (saves one round-trip)
  const [rates, budgets] = await Promise.all([
    getExchangeRates("USD"),
    Budget.find(getRunningBudgetsQuery(userObjectId, now))
      .populate({ path: "walletId", select: "name icon currency", strictPopulate: false })
      .sort({ order: 1, createdAt: -1 })
      .lean(),
  ]);

  let budgetWindowStart = new Date(startOfThisMonth);
  let budgetWindowEnd = new Date(startOfNextMonth);
  for (const b of budgets) {
    if (b.startDate && new Date(b.startDate) < budgetWindowStart) {
      budgetWindowStart = new Date(b.startDate);
    }
    if (b.endDate && new Date(b.endDate) > budgetWindowEnd) {
      budgetWindowEnd = new Date(b.endDate);
    }
  }
  budgetWindowStart = new Date(budgetWindowStart.getTime() - 2 * 24 * 60 * 60 * 1000);
  budgetWindowEnd = new Date(budgetWindowEnd.getTime() + 2 * 24 * 60 * 60 * 1000);

  const [
    wallets,
    recentTransactions,
    currentMonthTransactions,
    previousMonthTransactions,
    budgetExpenses,
  ] = await Promise.all([
    Wallet.find({
      $or: [
        { userId: userObjectId },
        { sharedWith: { $elemMatch: { email: user.email.toLowerCase(), status: "ACCEPTED" } } },
      ],
    }).sort({ isDefault: -1, createdAt: 1 }).lean(),
    Transaction.find({ userId: userObjectId })
      .sort({ date: -1 })
      .limit(30)
      .lean(),
    Transaction.find({
      userId: userObjectId,
      date: { $gte: startOfThisMonth, $lt: startOfNextMonth },
    }).lean(),
    Transaction.find({
      userId: userObjectId,
      date: { $gte: startOfPrevMonth, $lt: endOfPrevMonth },
    }).lean(),
    Transaction.find({
      userId: userObjectId,
      type: "EXPENSE",
      date: { $gte: budgetWindowStart, $lte: budgetWindowEnd },
    }).lean(),
  ]);

  // Attach owner info (email + name) to each wallet
  const ownerIds = [...new Set(wallets.map((w) => String(w.userId)))];
  const owners = (await User.find({ _id: { $in: ownerIds } })
    .select("_id email name image profileColor")
    .lean()) as Array<{ _id: unknown; email: string; name: string }>;
  const ownerMap = new Map((owners as Array<{ _id: unknown; email: string; name: string; image?: string; profileColor?: string }>).map((o) => [String(o._id), { email: o.email, name: o.name, image: o.image || "", profileColor: o.profileColor || "" }]));

  // Also collect all member emails to populate member names
  const allMemberEmails = [
    ...new Set(wallets.flatMap((w) => (w.sharedWith || []).map((m) => m.email.toLowerCase()))),
  ];
  const memberUsers = (await User.find({ email: { $in: allMemberEmails } })
    .select("email name image profileColor")
    .lean()) as Array<{ email: string; name: string }>;
  const memberNameMap = new Map(memberUsers.map((u) => [u.email.toLowerCase(), u.name]));
  const memberUserMap = new Map((memberUsers as Array<{ email: string; name: string; image?: string; profileColor?: string }>).map((u) => [u.email.toLowerCase(), u]));

  // Resolve per-user defaultWalletId and custom walletOrder
  const userDoc = (await User.findById(userId).select("defaultWalletId walletOrder").lean()) as {
    defaultWalletId?: mongoose.Types.ObjectId;
    walletOrder?: Array<mongoose.Types.ObjectId | string>;
  } | null;
  const userDefaultWalletIdStr = userDoc?.defaultWalletId ? String(userDoc.defaultWalletId) : null;

  // Resolve per-user wallet preferences and collect excluded wallet IDs
  const resolvedWallets = wallets.map((w) => {
    const wIdStr = String((w as { _id: unknown })._id);
    const isOwner = String(w.userId) === userId;
    const memberEntry = (w.sharedWith || []).find(
      (m) => m.email.toLowerCase() === user.email.toLowerCase()
    );

    // isDefault: prefer User.defaultWalletId, then fall back to wallet/member flag
    let resolvedIsDefault = false;
    if (userDefaultWalletIdStr) {
      resolvedIsDefault = wIdStr === userDefaultWalletIdStr;
    } else if (isOwner) {
      resolvedIsDefault = Boolean(w.isDefault);
    } else if (memberEntry) {
      resolvedIsDefault = Boolean((memberEntry as { isDefault?: boolean }).isDefault);
    }

    // excludeFromTotal: owner uses wallet field, member uses sharedWith entry
    const resolvedExcludeFromTotal = isOwner
      ? Boolean(w.excludeFromTotal)
      : Boolean((memberEntry as { excludeFromTotal?: boolean } | undefined)?.excludeFromTotal);

    // enableNotification: similar per-user resolution
    const resolvedEnableNotification = isOwner
      ? w.enableNotification !== false
      : (memberEntry as { enableNotification?: boolean } | undefined)?.enableNotification !== undefined
      ? Boolean((memberEntry as { enableNotification?: boolean }).enableNotification)
      : true;

    return {
      ...w,
      isDefault: resolvedIsDefault,
      excludeFromTotal: resolvedExcludeFromTotal,
      enableNotification: resolvedEnableNotification,
    };
  });

  // Apply custom wallet ordering if set by user
  if (userDoc?.walletOrder && userDoc.walletOrder.length > 0) {
    const orderMap = new Map(
      userDoc.walletOrder.map((id, index) => [String(id), index])
    );
    resolvedWallets.sort((a, b) => {
      const aId = String((a as { _id: unknown })._id);
      const bId = String((b as { _id: unknown })._id);
      const aIdx = orderMap.has(aId) ? orderMap.get(aId)! : 999999;
      const bIdx = orderMap.has(bId) ? orderMap.get(bId)! : 999999;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0);
    });
  }

  // Wallets excluded from the user's global totals
  const excludedWalletIds = new Set(
    resolvedWallets
      .filter((w) => w.excludeFromTotal)
      .map((w) => String((w as { _id: unknown })._id))
  );

  // Convert wallets to global currency for the top total balance (skip excluded)
  let totalBalanceConverted = 0;
  for (const w of resolvedWallets) {
    if (w.excludeFromTotal) continue;
    const wBalance = w.balance ?? 0;
    const wCurrency = w.currency ?? "IDR";
    totalBalanceConverted += convertCurrency(wBalance, wCurrency, globalCurrency, rates);
  }

  // Filter transactions for dashboard display: exclude transactions belonging to excluded wallets
  const visibleRecentTransactions = recentTransactions
    .filter((tx) => !tx.walletId || !excludedWalletIds.has(String(tx.walletId)))
    .slice(0, 8);

  const visibleCurrentMonthTransactions = currentMonthTransactions.filter(
    (tx) => !tx.walletId || !excludedWalletIds.has(String(tx.walletId))
  );

  const visiblePreviousMonthTransactions = previousMonthTransactions.filter(
    (tx) => !tx.walletId || !excludedWalletIds.has(String(tx.walletId))
  );

  // Calculate this month's total spent & total income converted to global currency
  // Skip transactions that belong to excluded wallets
  let totalIncomeConverted = 0;
  let totalExpenseConverted = 0;

  for (const tx of visibleCurrentMonthTransactions) {
    const txAmount = tx.amount ?? 0;
    const txCurrency = tx.currency ?? "IDR";
    const converted = convertCurrency(txAmount, txCurrency, globalCurrency, rates);

    if (tx.type === "INCOME") {
      totalIncomeConverted += converted;
    } else if (tx.type === "EXPENSE") {
      totalExpenseConverted += converted;
    }
  }

  // Merge spending into budgets
  const budgetList = budgets.map((b) => {
    const bWallet = b.walletId && typeof b.walletId === "object" ? (b.walletId as { _id: unknown; currency?: string; name?: string }) : null;
    const budgetCurrency = (b as { currency?: string }).currency || bWallet?.currency || globalCurrency;

    const bStart = b.startDate ? new Date(b.startDate) : startOfThisMonth;
    let bEnd = b.endDate ? new Date(b.endDate) : new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    if ((b.periodType === "MONTH" || !b.periodType) && bEnd.getDate() === 1 && bEnd.getMonth() !== bStart.getMonth()) {
      bEnd = new Date(bStart.getFullYear(), bStart.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    let spent = 0;
    for (const tx of budgetExpenses) {
      const txDate = new Date(tx.date);
      if (txDate < bStart || txDate > bEnd) continue;
      // If budget is for all wallets, skip transactions from excluded wallets
      if (!b.walletId && tx.walletId && excludedWalletIds.has(String(tx.walletId))) continue;
      if (isTransactionMatchingBudget(tx, b)) {
        spent += convertCurrency(tx.amount ?? 0, tx.currency || "IDR", budgetCurrency, rates);
      }
    }

    const percentUsed =
      b.amountLimit > 0 ? Math.min(100, Math.round((spent / b.amountLimit) * 100)) : 0;
    return {
      _id: String((b as { _id: unknown })._id),
      name: (b as { name?: string }).name,
      category: b.category,
      subCategory: b.subCategory,
      categories: (b as { categories?: string[] }).categories,
      order: (b as { order?: number }).order ?? 0,
      amountLimit: b.amountLimit,
      currency: budgetCurrency,
      periodType: (b.periodType as BudgetPeriodType) || "MONTH",
      startDate: bStart.toISOString(),
      endDate: bEnd.toISOString(),
      spent,
      percentUsed,
    };
  });

  // Ensure "All Categories" budget is strictly at the top, then sorted by custom order
  budgetList.sort((a, b) => {
    const aIsAll = a.category === "ALL_CATEGORIES" || a.category === "ALL";
    const bIsAll = b.category === "ALL_CATEGORIES" || b.category === "ALL";
    if (aIsAll && !bIsAll) return -1;
    if (!aIsAll && bIsAll) return 1;
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return 0;
  });

  return (
    <HomeDashboard
      user={{
        name: user.name,
        email: user.email,
        baseCurrency: globalCurrency,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
      }}
      wallets={resolvedWallets.map((w) => ({
        _id: String((w as { _id: unknown })._id),
        name: w.name,
        type: w.type,
        balance: w.balance,
        currency: w.currency,
        icon: w.icon,
        isDefault: w.isDefault,
        excludeFromReport: w.excludeFromReport,
        excludeFromTotal: w.excludeFromTotal,
        archived: w.archived,
        enableNotification: w.enableNotification,
        disabledCategories: w.disabledCategories,
        sharedWith: (w.sharedWith || []).map((m) => ({
          email: m.email,
          name: m.name || memberNameMap.get(m.email.toLowerCase()) || "",
          role: m.role,
          roleName: (m as any).roleName || (m.role === "VIEWER" ? "Viewer" : "Editor"),
          permissions: normalizePermissions((m as any).permissions, m.role),
          image: memberUserMap.get(m.email.toLowerCase())?.image || (m as any).image || "",
          profileColor: memberUserMap.get(m.email.toLowerCase())?.profileColor || (m as any).profileColor || "",
          status: m.status,
        })),
        userId: String(w.userId),
        ownerEmail: ownerMap.get(String(w.userId))?.email ?? "",
        ownerName: ownerMap.get(String(w.userId))?.name ?? "",
        ownerImage: ownerMap.get(String(w.userId))?.image ?? "",
        ownerProfileColor: ownerMap.get(String(w.userId))?.profileColor ?? "",
      }))}
      recentTransactions={visibleRecentTransactions.map((tx) => ({
        _id: String((tx as { _id: unknown })._id),
        type: tx.type,
        title: tx.title,
        amount: tx.amount,
        currency: tx.currency,
        convertedAmount: convertCurrency(tx.amount, tx.currency || "IDR", globalCurrency, rates),
        convertedAmountIDR: tx.convertedAmountIDR,
        category: tx.category,
        subCategory: tx.subCategory,
        date: tx.date.toISOString(),
      }))}
      currentMonthTransactions={visibleCurrentMonthTransactions.map((tx) => ({
        _id: String((tx as { _id: unknown })._id),
        type: tx.type,
        title: tx.title,
        amount: tx.amount,
        currency: tx.currency,
        convertedAmountIDR: tx.convertedAmountIDR,
        convertedToGlobal: convertCurrency(tx.amount, tx.currency || "IDR", globalCurrency, rates),
        category: tx.category,
        subCategory: tx.subCategory,
        date: tx.date.toISOString(),
      }))}
      previousMonthTransactions={visiblePreviousMonthTransactions.map((tx) => ({
        _id: String((tx as { _id: unknown })._id),
        type: tx.type,
        title: tx.title,
        amount: tx.amount,
        currency: tx.currency,
        convertedAmountIDR: tx.convertedAmountIDR,
        convertedToGlobal: convertCurrency(tx.amount, tx.currency || "IDR", globalCurrency, rates),
        category: tx.category,
        subCategory: tx.subCategory,
        date: tx.date.toISOString(),
      }))}
      budgets={budgetList}
      totalBalanceConverted={totalBalanceConverted}
      totalIncomeConverted={totalIncomeConverted}
      totalExpenseConverted={totalExpenseConverted}
      monthYear={monthYear}
    />
  );
}
