"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  SquarePen,
  AlertTriangle,
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
import BudgetCategoryIcons from "./BudgetCategoryIcons";
import AddBudgetModal from "@/components/admin/budget/AddBudgetModal";
import { useWalletContext } from "@/hooks/useWalletContext";
import { useToast } from "@/components/ui/Toast";

interface BudgetDetailData {
  _id: string;
  name?: string;
  category: string;
  subCategory?: string;
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

interface BudgetDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The budget object already fetched from the list â€” pass directly to avoid a second fetch */
  budget: BudgetDetailData | null;
  monthYear: string;
  selectedWalletId: string;
  onDeleted: () => void;
  onEdited: () => void;
}

export default function BudgetDetailSheet({
  isOpen,
  onClose,
  budget: initialBudget,
  monthYear,
  selectedWalletId,
  onDeleted,
  onEdited,
}: BudgetDetailSheetProps) {
  const router = useRouter();
  const { wallets } = useWalletContext();
  const { toast } = useToast();

  const [budget, setBudget] = useState<BudgetDetailData | null>(initialBudget);
  const [userCurrency, setUserCurrency] = useState("IDR");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync with parent's budget prop whenever it changes (e.g. user clicked another card)
  useEffect(() => {
    setBudget(initialBudget);
  }, [initialBudget]);

  useEffect(() => {
    fetch("/api/finance/user")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.baseCurrency) setUserCurrency(d.user.baseCurrency);
      });
  }, []);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (!budget) return;
    setShowDeleteConfirm(false);
    try {
      await fetch(`/api/finance/budgets?id=${budget._id}`, { method: "DELETE" });
      onClose();
      onDeleted();
    } catch {
      toast("Failed to delete budget", "error");
    }
  };

  // â”€â”€ Loading/empty â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!budget) {
    return (
      <div className="fixed inset-0 z-[95] bg-[#0c0d10] text-white flex flex-col animate-in fade-in duration-200">
        <div className="flex items-center px-4 py-3 border-b border-white/8 bg-[#111216]">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white active:bg-white/10 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
          <h2 className="ml-3 text-lg font-bold text-white tracking-tight">Budget details</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400">No budget selected.</p>
        </div>
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
    <div className="fixed inset-0 z-[95] bg-[#0c0d10] text-white flex flex-col animate-in fade-in duration-200 overflow-hidden">
      {/* â”€â”€ Top Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="w-full border-b border-white/8 bg-[#111216] flex-shrink-0">
        <div className="max-w-lg mx-auto flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white active:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </button>
            <h2 className="text-lg font-bold text-white tracking-tight">Budget details</h2>
          </div>

          <div className="flex items-center gap-1">
            {!budget.isOtherCategories && (
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-[var(--color-primary-light)] active:bg-white/10 transition-colors cursor-pointer"
                title="Edit budget"
              >
                <SquarePen className="w-5 h-5" />
              </button>
            )}
            {!budget.isOtherCategories && (
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
      </div>

      {/* â”€â”€ Scrollable Body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="max-w-lg mx-auto px-5 pt-4 space-y-4">
          {/* Header Card */}
          <div className="p-4 bg-[#1b1c21] border border-white/6 rounded-3xl space-y-3">
            {/* Category Icon and Title */}
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
                `/budgets/${budget._id}/transactions?monthYear=${monthYear}${
                  selectedWalletId && selectedWalletId !== "ALL"
                    ? `&walletId=${selectedWalletId}`
                    : ""
                }`
              )
            }
            className="w-full py-3.5 rounded-xl bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-black text-xs tracking-wider uppercase shadow-xl active:scale-98 transition-all cursor-pointer"
            style={{ boxShadow: "0 8px 20px -4px var(--color-primary-glow)" }}
          >
            TRANSACTIONS LIST
          </button>
        </div>
      </div>

      {/* Edit Budget Modal */}
      {showEditModal && (
        <AddBudgetModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            onEdited();
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative z-10 w-full max-w-sm bg-[#1a1c24] border border-white/10 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white text-base font-bold">Delete budget?</h3>
              <p className="text-slate-400 text-xs mt-1">
                This budget will be permanently removed. This cannot be undone.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shadow-lg shadow-red-600/30"
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
