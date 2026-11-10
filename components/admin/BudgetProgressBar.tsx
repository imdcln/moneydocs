"use client";

import { EXPENSE_CATEGORIES } from "@/lib/categories";
import { formatMoney } from "@/lib/currency";

interface BudgetData {
  _id: string;
  category: string;
  amountLimit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  monthYear: string;
  currency?: string;
}

const CATEGORY_MAP = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, { label: c.label, icon: c.icon }])
);

function getBarColor(pct: number): string {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-orange-500";
  if (pct >= 60) return "bg-amber-400";
  return "bg-[var(--color-primary)]";
}

function getTextColor(pct: number): string {
  if (pct >= 100) return "text-red-400";
  if (pct >= 80) return "text-orange-400";
  if (pct >= 60) return "text-amber-400";
  return "text-[var(--color-primary-light)]";
}

export default function BudgetProgressBar({ budget }: { budget: BudgetData }) {
  const meta = CATEGORY_MAP[budget.category] ?? { label: budget.category, icon: "📦" };
  const pct = budget.percentUsed;
  const isOver = budget.spent > budget.amountLimit;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-base">
            {meta.icon}
          </div>
          <span className="text-white text-sm font-medium">{meta.label}</span>
        </div>
        <div className="text-right">
          <p className={`text-xs font-bold ${getTextColor(pct)}`}>{pct}%</p>
          {isOver && (
            <p className="text-red-400 text-[10px] font-semibold">Over budget!</p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2.5 rounded-full bg-slate-700 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out ${getBarColor(pct)}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>

      {/* Amounts */}
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">
          Spent: <span className={getTextColor(pct)}>{formatMoney(budget.spent, budget.currency || "IDR")}</span>
        </span>
        <span className="text-slate-400">
          Budget: <span className="text-white">{formatMoney(budget.amountLimit, budget.currency || "IDR")}</span>
        </span>
      </div>

      {/* Remaining */}
      {!isOver && (
        <p className="text-slate-500 text-xs mt-1">
          {formatMoney(budget.remaining, budget.currency || "IDR")} remaining this month
        </p>
      )}
      {isOver && (
        <p className="text-red-400 text-xs mt-1 font-medium">
          Over by {formatMoney(Math.abs(budget.remaining), budget.currency || "IDR")}
        </p>
      )}
    </div>
  );
}
