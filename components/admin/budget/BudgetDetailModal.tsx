"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trash2,
  SquarePen,
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
import { formatMoney, formatThousands, getCurrencySymbol, getCurrencyDisplayCode } from "@/lib/currency";
import {
  calculateBudgetStats,
  getDaysBetween,
  formatDayMonth,
  formatDayMonthYear,
  getBudgetCategoryIcons,
  getBudgetDisplayName,
} from "@/lib/budgetUtils";
import BudgetCategoryIcons from "./BudgetCategoryIcons";

export interface BudgetDetailData {
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

interface BudgetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  budget: BudgetDetailData | null;
  userCurrency: string;
  onEdit: (budget: BudgetDetailData) => void;
  onDelete: (id: string) => void;
}

export default function BudgetDetailModal({
  isOpen,
  onClose,
  budget,
  userCurrency,
  onEdit,
  onDelete,
}: BudgetDetailModalProps) {
  const [showTransactionsList, setShowTransactionsList] = useState(false);

  const now = new Date();
  const startObj = budget ? new Date(budget.startDate) : now;
  let endObj = budget ? new Date(budget.endDate) : now;
  if (budget && (budget.periodType === "MONTH" || !budget.periodType) && endObj.getDate() === 1 && endObj.getMonth() !== startObj.getMonth()) {
    endObj = new Date(startObj.getFullYear(), startObj.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const stats = budget
    ? calculateBudgetStats(
        budget.amountLimit,
        budget.spent,
        budget.startDate,
        budget.endDate,
        now
      )
    : {
        totalDays: 1,
        daysPassed: 1,
        remainingDays: 0,
        isFinished: false,
        remaining: 0,
        overspent: 0,
        recommendedDaily: 0,
        actualDaily: 0,
        projectedSpending: 0,
      };

  const isOverspent = budget ? budget.spent > budget.amountLimit : false;
  const isProjectedOverspent = budget ? stats.projectedSpending > budget.amountLimit : false;

  const rangeDateDisplay = `${formatDayMonth(startObj)} - ${formatDayMonth(endObj)}`;
  const startFullDisplay = formatDayMonthYear(startObj);
  const endFullDisplay = formatDayMonthYear(endObj);

  const walletName =
    budget && typeof budget.walletId === "object" && budget.walletId?.name
      ? budget.walletId.name
      : "Total";

  const totalDays = Math.max(1, Math.round((endObj.getTime() - startObj.getTime()) / 86400000) + 1);

  // Today day offset index (0 to totalDays - 1)
  const isFinished = now > endObj;
  const isFuture = now < startObj;
  const todayDayOffset = isFinished
    ? totalDays - 1
    : isFuture
    ? 0
    : Math.max(0, Math.min(totalDays - 1, Math.round((now.getTime() - startObj.getTime()) / 86400000)));

  // Daily raw cumulative points
  const rawPoints =
    budget && budget.dailyPoints && budget.dailyPoints.length > 0
      ? budget.dailyPoints
      : [
          { date: formatDayMonth(startObj), spent: 0 },
          { date: formatDayMonth(endObj), spent: budget?.spent ?? 0 },
        ];

  const todayPt = rawPoints[Math.min(todayDayOffset, rawPoints.length - 1)];
  const currentSpentToToday = todayPt?.spent ?? (budget?.spent ?? 0);
  const daysRemainingFromToday = Math.max(0, totalDays - 1 - todayDayOffset);

  // Two-part chart data:
  // 1. actualSpent: plain green area up to today
  // 2. projectedSpent: lighter opacity green area with dotted stroke from today to end date
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

    return {
      date: pt.date,
      actualSpent,
      projectedSpent,
    };
  });

  const budgetCurrency =
    budget?.currency ||
    (budget?.walletId && typeof budget.walletId === "object" && (budget.walletId as { currency?: string }).currency) ||
    userCurrency;

  // Currency symbol (uses $ for all dollar currencies, e.g. USD, NTD, SGD, AUD, CAD)
  const currSymbol = getCurrencySymbol(budgetCurrency);
  const currDisplay = getCurrencyDisplayCode(budgetCurrency);

  // Calculate Y-axis domain & nice ticks adaptively based on actual budget & spending
  const rawMax = budget
    ? Math.max(budget.amountLimit, budget.spent, stats.projectedSpending)
    : 0;
  const maxVal = Math.max(rawMax, 10);
  const targetMax = maxVal * 1.15; // 15% headroom above highest point/budget limit

  // Compute a clean step size (multiples of 1, 2, 2.5, 5 * 10^n) targeting ~4 intervals
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
    budget &&
    (budget.category === "ALL_CATEGORIES" ||
      budget.category === "ALL" ||
      budget.category === "all_categories");

  // Today marker percent on the progress bar
  const todayPercent = Math.min(
    95,
    Math.max(5, (stats.daysPassed / stats.totalDays) * 100)
  );

  return (
    <AnimatePresence>
      {isOpen && budget && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          {/* Dark Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Main Sheet: slides up from bottom covering the entire page (just like AddTransactionModal) */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative z-[70] w-full max-w-lg mx-auto bg-[#131418] border-t border-white/10 rounded-t-[2.5rem] shadow-2xl flex flex-col h-[94vh] overflow-hidden"
          >
            {/* Top Bar matching Screenshot 4, 5, and new image */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/6 bg-[#131418]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 stroke-[2.2]" />
                </button>
                <h2 className="text-white font-bold text-lg tracking-tight">
                  Budget details
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                {!budget.isOtherCategories && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEdit(budget);
                    }}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-[var(--color-primary-light)] active:bg-white/10 transition-colors cursor-pointer"
                    title="Edit budget"
                  >
                    <SquarePen className="w-5 h-5" />
                  </button>
                )}
                {!budget.isOtherCategories && (
                  <button
                    type="button"
                    onClick={() => onDelete(budget._id)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-red-400 active:bg-white/10 transition-colors cursor-pointer"
                    title="Delete budget"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Header Card matching Screenshot 5 & new image */}
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

                {/* Total Budget Amount */}
                <div className="pt-1">
                  <span className="text-white font-black text-2xl tracking-tight">
                    {formatMoney(budget.amountLimit, budgetCurrency)}
                  </span>
                </div>

                {/* Spent & Overspent/Remaining Breakdown */}
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

                {/* Red / Primary Progress Bar with "Today" marker matching new picture */}
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

                  {/* Today marker pill */}
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

                {/* Date Range Row */}
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

                {/* Wallet Row */}
                <div className="flex items-center gap-3 pt-1">
                  <WalletIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <span className="text-white text-sm font-semibold">
                    {walletName} ({currDisplay})
                  </span>
                </div>
              </div>

              {/* Graph Section matching new Screenshot */}
              <div className="bg-[#1b1c21] border border-white/6 rounded-3xl p-4 space-y-4">
                {/* Composed Chart: Plain green area for actual, lighter opacity area with dotted line for projected */}
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

                      {/* Horizontal red line for budget limit */}
                      <ReferenceLine
                        y={budget.amountLimit}
                        stroke="#ef4444"
                        strokeWidth={1.5}
                      />

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

                      {/* 1. Actual Spending Progression (Plain green fill) */}
                      <Area
                        type="monotone"
                        dataKey="actualSpent"
                        stroke="#22c55e"
                        strokeWidth={2}
                        fill="#22c55e"
                        fillOpacity={0.65}
                        connectNulls={false}
                      />

                      {/* 2. Projected Spending (Lighter opacity green fill with dotted stroke) */}
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

                {/* Date range footer underneath chart */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 border-t border-white/6 pt-2">
                  <span>{startFullDisplay}</span>
                  <span>{endFullDisplay}</span>
                </div>

                {/* Three key statistical metrics */}
                <div className="space-y-3 pt-2 border-t border-white/6">
                  {/* 1. Recommended daily spending */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Recommended daily spending</span>
                    <span className="text-white font-bold text-sm">
                      {formatMoney(stats.recommendedDaily, budgetCurrency)}
                    </span>
                  </div>

                  {/* 2. Projected spending (Red if overspent, matching new screenshot) */}
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

                  {/* 3. Actual daily spending */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Actual daily spending</span>
                    <span className="text-white font-bold text-sm">
                      {formatMoney(stats.actualDaily, budgetCurrency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Matching Transactions List */}
              {showTransactionsList && (
                <div className="bg-[#1b1c21] border border-white/6 rounded-3xl p-4 space-y-3 animate-in fade-in duration-150">
                  <h4 className="text-white text-xs font-bold uppercase tracking-wider">
                    Matching Transactions ({budget.transactions?.length || 0})
                  </h4>
                  {(!budget.transactions || budget.transactions.length === 0) ? (
                    <p className="text-slate-500 text-xs py-3 text-center">
                      No expense transactions recorded in this period.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {budget.transactions.map((tx) => (
                        <div
                          key={tx._id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs"
                        >
                          <div>
                            <p className="text-white font-semibold">{tx.title}</p>
                            <p className="text-slate-400 text-[10px]">
                              {new Date(tx.date).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="text-red-400 font-bold">
                            -{formatMoney(tx.amount, budgetCurrency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Transactions List Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowTransactionsList((v) => !v)}
                  className="w-full py-3.5 rounded-xl bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-black text-xs tracking-wider uppercase shadow-xl active:scale-98 transition-all cursor-pointer"
                  style={{ boxShadow: "0 8px 20px -4px var(--color-primary-glow)" }}
                >
                  {showTransactionsList ? "HIDE TRANSACTIONS" : "TRANSACTIONS LIST"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
