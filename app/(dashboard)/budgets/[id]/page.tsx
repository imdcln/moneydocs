"use client";

import { useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLoading from "@/components/ui/PageLoading";
import {
  ChevronLeft,
  Trash2,
  SquarePen,
  AlertTriangle,
  Lock,
  Wallet as WalletIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
} from "recharts";
import CategoryIcon, { AllCategoriesGlobeGraphic } from "@/components/ui/CategoryIcon";
import { CalendarIcon } from "@/components/ui/AppIcons";
import { getCategoryDisplayName } from "@/lib/categories";
import { formatMoney, getCurrencySymbol, getCurrencyDisplayCode } from "@/lib/currency";
import {
  calculateBudgetStats,
  getDaysBetween,
  formatDayMonth,
  formatDayMonthYear,
  getBudgetCategoryIcons,
  getBudgetDisplayName,
} from "@/lib/budgetUtils";
import BudgetCategoryIcons from "@/components/admin/budget/BudgetCategoryIcons";
import AddBudgetModal from "@/components/admin/budget/AddBudgetModal";
import { useWalletContext } from "@/hooks/useWalletContext";
import { useToast } from "@/components/ui/Toast";

interface BudgetDetailData {
  _id: string;
  name?: string;
  category: string;
  subCategory?: string;
  /** Multi-category list (new format) */
  categories?: string[];
  amountLimit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  currency?: string;
  periodType?: "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
  startDate: Date | string;
  endDate: Date | string;
  repeat?: boolean;
  walletId?: { _id: string; name: string; currency?: string } | string;
  isOtherCategories?: boolean;
  dailyPoints?: { date: string; spent: number }[];
  transactions?: {
    _id: string;
    date: string | Date;
    title: string;
    category: string;
    subCategory?: string;
    amount: number;
    rawAmount?: number;
    rawCurrency?: string;
    currency?: string;
  }[];
}

export default function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { wallets, getPermissionsForWallet } = useWalletContext();
  const { toast } = useToast();

  const [budget, setBudget] = useState<BudgetDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userCurrency, setUserCurrency] = useState("IDR");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const budgetWalletId =
    typeof budget?.walletId === "object"
      ? (budget.walletId as { _id?: string })?._id
      : budget?.walletId;
  const budgetPerms = getPermissionsForWallet(budgetWalletId);
  const canReadBudget = !budgetWalletId || budgetPerms.budgets.read;
  const canUpdateBudget = !budgetWalletId || budgetPerms.budgets.update;
  const canDeleteBudget = !budgetWalletId || budgetPerms.budgets.delete;


  const paramMonthYear = searchParams.get("monthYear");
  const paramWalletId = searchParams.get("walletId");

  const [monthYear] = useState(() => {
    if (paramMonthYear) return paramMonthYear;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    fetch("/api/finance/user")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.baseCurrency) setUserCurrency(d.user.baseCurrency);
      });
  }, []);

  const fetchBudget = async () => {
    setLoading(true);
    try {
      const decodedId = decodeURIComponent(id).trim();
      
      // 1. First try direct lookup by budgetId
      let res = await fetch(`/api/finance/budgets?budgetId=${encodeURIComponent(decodedId)}`);
      let data = await res.json();
      let allBudgets: BudgetDetailData[] = data.budgets ?? [];
      let found =
        allBudgets.find((b) => String(b._id) === decodedId) ||
        allBudgets.find((b) => String((b as any).parentAllCategoriesId) === decodedId);

      // 2. If not found or if allBudgets had items but exact ID didn't match directly, try by monthYear + wallet
      if (!found) {
        const walletQuery = paramWalletId && paramWalletId !== "ALL"
          ? `&walletId=${paramWalletId}`
          : "&walletId=GLOBAL";

        res = await fetch(`/api/finance/budgets?monthYear=${monthYear}${walletQuery}`);
        data = await res.json();
        allBudgets = data.budgets ?? [];
        found = allBudgets.find(
          (b) => String(b._id) === decodedId || String((b as any).parentAllCategoriesId) === decodedId
        );

        if (!found) {
          res = await fetch(`/api/finance/budgets?monthYear=${monthYear}&walletId=ALL`);
          data = await res.json();
          allBudgets = data.budgets ?? [];
          found = allBudgets.find(
            (b) => String(b._id) === decodedId || String((b as any).parentAllCategoriesId) === decodedId
          );
        }
      }

      setBudget(found || null);
    } catch (err) {
      console.error("fetchBudget error:", err);
      setBudget(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudget();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, monthYear, paramWalletId]);

  const handleDelete = async () => {
    if (!budget) return;
    setShowDeleteConfirm(false);
    try {
      const res = await fetch(`/api/finance/budgets?id=${budget._id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Budget deleted", "info");
        router.push("/budgets");
      } else {
        toast("Failed to delete budget", "error");
      }
    } catch {
      toast("Failed to delete budget", "error");
    }
  };

  if (loading) {
    return (
      <PageLoading
        title="Loading Budget Details..."
        subtitle="Fetching category spending & limits"
      />
    );
  }

  if (!budget) {
    return (
      <div className="py-20 p-6 flex flex-col items-center justify-center text-center">
        <p className="text-red-400 font-semibold mb-4">Budget not found</p>
        <button
          onClick={() => router.push("/budgets")}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-bold text-white"
        >
          Back to Budgets
        </button>
      </div>
    );
  }

  const now = new Date();
  const startObj = new Date(budget.startDate);
  let endObj = new Date(budget.endDate);
  if ((budget.periodType === "MONTH" || !budget.periodType) && endObj.getDate() === 1 && endObj.getMonth() !== startObj.getMonth()) {
    endObj = new Date(startObj.getFullYear(), startObj.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const stats = calculateBudgetStats(
    budget.amountLimit,
    budget.spent,
    budget.startDate,
    budget.endDate,
    now
  );

  const isOverspent = budget.spent > budget.amountLimit;
  const isProjectedOverspent = stats.projectedSpending > budget.amountLimit;

  const rangeDateDisplay = `${formatDayMonth(startObj)} - ${formatDayMonth(endObj)}`;
  const startFullDisplay = formatDayMonthYear(startObj);
  const endFullDisplay = formatDayMonthYear(endObj);

  const walletName =
    budget && typeof budget.walletId === "object" && budget.walletId?.name
      ? budget.walletId.name
      : "Total";

  const totalDays = getDaysBetween(startObj, endObj);

  const isFinished = now > endObj;
  const isFuture = now < startObj;
  const todayDayOffset = isFinished
    ? totalDays - 1
    : isFuture
    ? 0
    : Math.max(
        0,
        Math.min(
          totalDays - 1,
          Math.round((now.getTime() - startObj.getTime()) / 86400000)
        )
      );

  const rawPoints =
    budget.dailyPoints && budget.dailyPoints.length > 0
      ? budget.dailyPoints
      : [
          { date: formatDayMonth(startObj), spent: 0 },
          { date: formatDayMonth(endObj), spent: budget.spent },
        ];

  const todayPt = rawPoints[Math.min(todayDayOffset, rawPoints.length - 1)];
  const currentSpentToToday = todayPt?.spent ?? budget.spent;
  const daysRemainingFromToday = Math.max(0, totalDays - 1 - todayDayOffset);

  const chartData = rawPoints.map((pt, idx) => {
    let actualSpent: number | null = null;
    let projectedSpent: number | null = null;

    if (idx <= todayDayOffset) {
      actualSpent = pt.spent;
    }

    if (!isFinished) {
      if (idx === todayDayOffset) {
        projectedSpent = currentSpentToToday;
      } else if (idx > todayDayOffset) {
        if (daysRemainingFromToday > 0) {
          const ratio = (idx - todayDayOffset) / daysRemainingFromToday;
          projectedSpent =
            Math.round(
              (currentSpentToToday +
                (stats.projectedSpending - currentSpentToToday) * ratio) *
                100
            ) / 100;
        } else {
          projectedSpent = stats.projectedSpending;
        }
      }
    }

    return { date: pt.date, actualSpent, projectedSpent };
  });

  const budgetCurrency =
    budget.currency ||
    (budget.walletId &&
      typeof budget.walletId === "object" &&
      (budget.walletId as { currency?: string }).currency) ||
    userCurrency;

  const currSymbol = getCurrencySymbol(budgetCurrency);
  const currDisplay = getCurrencyDisplayCode(budgetCurrency);

  const rawMax = Math.max(budget.amountLimit, budget.spent, stats.projectedSpending);
  const maxVal = Math.max(rawMax, 10);
  const targetMax = maxVal * 1.15;
  const rawStep = targetMax / 4;
  const power = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
  const fraction = rawStep / power;
  let niceStep = 10 * power;
  if (fraction <= 1) niceStep = 1 * power;
  else if (fraction <= 2) niceStep = 2 * power;
  else if (fraction <= 2.5) niceStep = 2.5 * power;
  else if (fraction <= 5) niceStep = 5 * power;

  const yMax = Math.max(Math.ceil(targetMax / niceStep) * niceStep, niceStep);
  const yTicks: number[] = [];
  for (let t = 0; t <= yMax + niceStep * 0.001; t += niceStep) {
    yTicks.push(Math.round(t * 100) / 100);
  }

  const isAllCategories =
    budget.category === "ALL_CATEGORIES" ||
    budget.category === "ALL" ||
    budget.category === "all_categories";

  const todayPercent = Math.min(
    95,
    Math.max(5, (stats.daysPassed / stats.totalDays) * 100)
  );

  return (
    <div className="text-white max-w-lg mx-auto pb-24">
      {/* ── Top Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <button
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/budgets");
            }
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <h1 className="text-white font-bold text-lg tracking-tight">Budget details</h1>

        <div className="flex items-center gap-1">
          {!budget.isOtherCategories && canUpdateBudget && (
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-[var(--color-primary-light)] active:bg-white/10 transition-colors cursor-pointer"
              title="Edit budget"
            >
              <SquarePen className="w-5 h-5" />
            </button>
          )}
          {!budget.isOtherCategories && canDeleteBudget && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-red-400 active:bg-white/10 transition-colors cursor-pointer"
              title="Delete budget"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="px-5 space-y-4">
        {/* Header Card */}
        <div className="p-4 bg-[#1b1c21] border border-white/6 rounded-3xl space-y-3">
          <div className="flex items-center gap-3 min-w-0">
            <BudgetCategoryIcons
              icons={getBudgetCategoryIcons(budget)}
              size="md"
            />
            <h3 className="text-white font-bold text-xl tracking-tight truncate">
              {getBudgetDisplayName(budget)}
            </h3>
          </div>

          <div className="pt-1">
            <span className="text-white font-black text-2xl tracking-tight">
              {formatMoney(budget.amountLimit, budgetCurrency)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-0.5">
            <div>
              <span className="text-slate-400 block text-[11px]">Spent</span>
              <span className="text-white font-bold text-sm">
                {formatMoney(budget.spent, budgetCurrency)}
              </span>
            </div>
            <div className="text-right">
              {isOverspent ? (
                <>
                  <span className="text-red-400 block text-[11px] font-medium">Overspent</span>
                  <span className="text-red-400 font-bold text-sm">
                    {formatMoney(stats.overspent, budgetCurrency)}
                  </span>
                </>
              ) : (
                <>
                  <span className="block text-[11px] font-medium" style={{ color: "var(--color-primary-light)" }}>Remaining</span>
                  <span className="font-bold text-sm" style={{ color: "var(--color-primary-light)" }}>
                    {formatMoney(stats.remaining, budgetCurrency)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Progress Bar with Today marker */}
          <div className="relative pt-1 pb-4">
            <div className="w-full h-1.5 rounded-full bg-[#20222a] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, budget.percentUsed)}%`,
                  backgroundColor: isOverspent ? "#ef4444" : "var(--color-primary)",
                }}
              />
            </div>
            {!stats.isFinished && (
              <div
                className="absolute top-3 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                style={{ left: `${todayPercent}%` }}
              >
                <div className="w-0.5 h-1.5 bg-white/40 mb-0.5" />
                <span className="px-2 py-0.5 rounded-md bg-[#252830] text-slate-300 text-[9px] font-medium shadow-xs">
                  Today
                </span>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-start gap-3">
            <CalendarIcon size={20} color="#94a3b8" className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white text-sm font-semibold">{rangeDateDisplay}</p>
              <p className="text-slate-400 text-xs">
                {stats.isFinished
                  ? "Finished"
                  : stats.remainingDays === 0
                  ? "Last day"
                  : `${stats.remainingDays} days left`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <WalletIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <span className="text-white text-sm font-semibold">
              {walletName} ({currDisplay})
            </span>
          </div>
        </div>

        {/* Graph Section */}
        <div className="bg-[#1b1c21] border border-white/6 rounded-3xl p-4 space-y-4">
          <div className="w-full h-48 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <XAxis dataKey="date" hide />
                <YAxis
                  domain={[0, yMax]}
                  ticks={yTicks}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  tickFormatter={(val) => {
                    if (val === 0) return `${currSymbol} 0`;
                    if (val >= 1000000) {
                      const m = val / 1000000;
                      return `${currSymbol} ${Number.isInteger(m) ? m : m.toFixed(1)} M`;
                    }
                    if (val >= 1000) {
                      const k = val / 1000;
                      return `${currSymbol} ${Number.isInteger(k) ? k : k.toFixed(1)} K`;
                    }
                    return `${currSymbol} ${val}`;
                  }}
                  stroke="#2e323e"
                />
                <ReferenceLine y={budget.amountLimit} stroke="#ef4444" strokeWidth={1.5} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1c1e24",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "#fff",
                  }}
                  formatter={(val, name) => [
                    formatMoney(Number(val) || 0, budgetCurrency),
                    name === "actualSpent" ? "Actual Spent" : "Projected Spent",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="actualSpent"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="#22c55e"
                  fillOpacity={0.65}
                  connectNulls={false}
                />
                <Area
                  type="linear"
                  dataKey="projectedSpent"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  fill="#22c55e"
                  fillOpacity={0.2}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 border-t border-white/6 pt-2">
            <span>{startFullDisplay}</span>
            <span>{endFullDisplay}</span>
          </div>

          <div className="space-y-3 pt-2 border-t border-white/6">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Recommended daily spending</span>
              <span className="text-white font-bold text-sm">
                {formatMoney(stats.recommendedDaily, budgetCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Projected spending</span>
              <span
                className={`font-bold text-sm ${
                  isProjectedOverspent ? "text-[#ef4444]" : "text-white"
                }`}
              >
                {formatMoney(stats.projectedSpending, budgetCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Actual daily spending</span>
              <span className="text-white font-bold text-sm">
                {formatMoney(stats.actualDaily, budgetCurrency)}
              </span>
            </div>
          </div>
        </div>

        {/* Transactions List Button */}
        <button
          type="button"
          onClick={() =>
            router.push(
              `/budgets/${id}/transactions?monthYear=${monthYear}${
                paramWalletId ? `&walletId=${paramWalletId}` : ""
              }`
            )
          }
          className="w-full py-3.5 rounded-xl bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-black text-xs tracking-wider uppercase shadow-xl active:scale-98 transition-all cursor-pointer"
          style={{ boxShadow: "0 8px 20px -4px var(--color-primary-glow)" }}
        >
          TRANSACTIONS LIST
        </button>
      </div>

      {/* Edit Budget Modal */}
      {showEditModal && (
        <AddBudgetModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchBudget();
          }}
          userCurrency={budgetCurrency}
          wallets={wallets}
          initialBudget={{
            _id: budget._id,
            name: budget.name,
            category: budget.category,
            subCategory: budget.subCategory,
            categories: budget.categories,
            amountLimit: budget.amountLimit,
            currency: budget.currency,
            periodType: budget.periodType,
            startDate: budget.startDate,
            endDate: budget.endDate,
            repeat: budget.repeat,
            walletId: budget.walletId,
          }}
          initialWalletId={
            budget.walletId && typeof budget.walletId === "object"
              ? budget.walletId._id
              : typeof budget.walletId === "string"
              ? budget.walletId
              : "GLOBAL"
          }
        />
      )}

      {/* Delete Budget Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#16181e] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-white font-bold text-base">Delete budget?</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                This budget will be permanently removed. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 font-semibold text-xs hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
