"use client";

import { useState, useEffect, use, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronDown, Check, AlertTriangle } from "lucide-react";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { getCategoryDisplayName, getTransactionIssues } from "@/lib/categories";
import { getBudgetDisplayName } from "@/lib/budgetUtils";
import {
  formatMoney,
  convertCurrency,
  getCurrencyDisplayCode,
  CURRENCY_INFO,
  SUPPORTED_CURRENCIES,
  SupportedCurrency,
} from "@/lib/currency";
import CurrencyFlag from "@/components/admin/CurrencyFlag";
import PageLoading from "@/components/ui/PageLoading";
import { useWalletContext } from "@/hooks/useWalletContext";

interface BudgetTransaction {
  _id: string;
  date: string | Date;
  title: string;
  category: string;
  subCategory?: string;
  amount: number;
  rawAmount?: number;
  rawCurrency?: string;
  currency?: string;
  walletId?: { _id: string; name?: string; currency?: string } | string;
}

interface BudgetDetailData {
  _id: string;
  name?: string;
  category: string;
  subCategory?: string;
  categories?: string[];
  currency?: string;
  walletId?: { _id: string; name: string; currency?: string } | string;
  transactions?: BudgetTransaction[];
}

interface DayGroup {
  date: Date;
  dayNumber: string;
  dayName: string;
  monthYear: string;
  dayTotal: number;
  items: BudgetTransaction[];
}

function groupByDay(
  transactions: BudgetTransaction[],
  toViewCurrency: (tx: BudgetTransaction) => number
): DayGroup[] {
  const groups: Record<string, DayGroup> = {};
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const tx of transactions) {
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (!groups[key]) {
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
      const isYesterday =
        d.getDate() === yesterday.getDate() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getFullYear() === yesterday.getFullYear();

      const dayName = isToday
        ? "Today"
        : isYesterday
        ? "Yesterday"
        : d.toLocaleDateString("en-US", { weekday: "long" });

      const monthYear = d.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      groups[key] = {
        date: d,
        dayNumber: String(d.getDate()).padStart(2, "0"),
        dayName,
        monthYear,
        dayTotal: 0,
        items: [],
      };
    }

    const amt = toViewCurrency(tx);
    groups[key].items.push(tx);
    groups[key].dayTotal += amt;
  }

  return Object.entries(groups)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([, g]) => g);
}

export default function BudgetTransactionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { wallets } = useWalletContext();

  const [budget, setBudget] = useState<BudgetDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userCurrency, setUserCurrency] = useState("IDR");
  const [rates, setRates] = useState<Record<string, number>>({});
  const [selectedDisplayCurrency, setSelectedDisplayCurrency] = useState<string | null>(null);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  const paramMonthYear = searchParams.get("monthYear");
  const paramWalletId = searchParams.get("walletId");

  const monthYear = paramMonthYear || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    fetch("/api/finance/user")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.baseCurrency) setUserCurrency(d.user.baseCurrency);
      });

    fetch("/api/finance/exchange-rates")
      .then((r) => r.json())
      .then((d) => {
        if (d.rates) setRates(d.rates);
      });
  }, []);

  // Close currency dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target as Node)) {
        setCurrencyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const fetchBudget = async () => {
      setLoading(true);
      try {
        const decodedId = decodeURIComponent(id).trim();
        let res = await fetch(`/api/finance/budgets?budgetId=${encodeURIComponent(decodedId)}`);
        let data = await res.json();
        let allBudgets: BudgetDetailData[] = data.budgets ?? [];
        let found = allBudgets.find(
          (b) => String(b._id) === decodedId || String((b as any).parentAllCategoriesId) === decodedId
        );

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
    fetchBudget();
  }, [id, monthYear, paramWalletId]);

  const budgetCurrency =
    budget?.currency ||
    (budget?.walletId &&
      typeof budget.walletId === "object" &&
      (budget.walletId as { currency?: string }).currency) ||
    userCurrency;

  const viewCurrency = selectedDisplayCurrency || budgetCurrency;
  const currDisplay = getCurrencyDisplayCode(viewCurrency);

  const toViewCurrency = useCallback(
    (tx: BudgetTransaction): number => {
      const fromCurr = tx.rawCurrency || tx.currency || budgetCurrency;
      const fromAmt = tx.rawAmount ?? tx.amount;
      const normFrom = fromCurr === "NTD" ? "TWD" : fromCurr;
      const normView = viewCurrency === "NTD" ? "TWD" : viewCurrency;
      if (normFrom === normView) return fromAmt;
      if (rates && Object.keys(rates).length > 0) {
        return convertCurrency(fromAmt, fromCurr, viewCurrency, rates);
      }
      return convertCurrency(fromAmt, fromCurr, viewCurrency);
    },
    [budgetCurrency, viewCurrency, rates]
  );

  const transactions: BudgetTransaction[] = budget?.transactions ?? [];
  const dayGroups = useMemo(
    () => groupByDay(transactions, toViewCurrency),
    [transactions, toViewCurrency]
  );

  const totalIncome = 0; // Budget transactions are always expenses
  const totalExpense = useMemo(
    () => transactions.reduce((sum, tx) => sum + toViewCurrency(tx), 0),
    [transactions, toViewCurrency]
  );
  const net = totalIncome - totalExpense;

  if (loading) {
    return (
      <PageLoading
        title="Loading Transactions..."
        subtitle="Fetching budget transactions list"
      />
    );
  }

  if (!budget) {
    return (
      <div className="py-20 p-6 flex flex-col items-center justify-center text-center">
        <p className="text-red-400 font-semibold mb-4">Budget not found</p>
        <button
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-bold text-white"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="text-white max-w-lg mx-auto pb-24">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-white font-bold text-lg tracking-tight truncate">
            {budget ? getBudgetDisplayName(budget) : "Transactions list"}
          </h1>
          <p className="text-slate-400 text-xs">Transactions list</p>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* Summary Card */}
        <div className="bg-[#141519] border border-white/8 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-white font-bold text-sm">
              {transactions.length} result{transactions.length !== 1 ? "s" : ""}
            </span>
            <div className="relative" ref={currencyDropdownRef}>
              <button
                type="button"
                onClick={() => setCurrencyDropdownOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-white/8 hover:bg-white/12 border border-white/10 px-2.5 py-1 rounded-lg transition-all cursor-pointer active:scale-95 shadow-sm"
                aria-label="Change currency"
              >
                <span>{currDisplay}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    currencyDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {currencyDropdownOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-[70] w-56 max-h-64 bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto animate-fade-in py-1 divide-y divide-white/6 text-left">
                  {SUPPORTED_CURRENCIES.map((code) => {
                    const info = CURRENCY_INFO[code];
                    const isSelected =
                      (viewCurrency === "NTD" ? "TWD" : viewCurrency) === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          setSelectedDisplayCurrency(code);
                          setCurrencyDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]"
                            : "text-slate-300 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CurrencyFlag flag={info.flag} code={code} className="text-base flex-shrink-0" />
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white">{info.displayCode}</span>
                              <span className="text-[11px] text-slate-400">({info.symbol})</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-normal truncate">{info.name}</p>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[var(--color-primary-light)] flex-shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="pt-1 space-y-1 border-t border-white/6">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Income</span>
              <span className="text-sky-400 font-bold">
                {formatMoney(totalIncome, viewCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Expense</span>
              <span className="text-red-400 font-bold">
                {formatMoney(totalExpense, viewCurrency)}
              </span>
            </div>
            <div className="flex justify-end border-t border-white/6 pt-1">
              <span className="text-white font-bold text-xs">
                {formatMoney(net, viewCurrency)}
              </span>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-slate-400 text-sm font-medium">No transactions in this budget</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dayGroups.map((group) => (
              <div
                key={`${group.dayNumber}-${group.monthYear}`}
                className="bg-[#141519] border border-white/8 rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Day Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/6 bg-[#171920]">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-extrabold text-white tracking-tight">
                      {group.dayNumber}
                    </span>
                    <div>
                      <p className="text-white text-xs font-bold leading-tight">
                        {group.dayName}
                      </p>
                      <p className="text-slate-400 text-[11px] leading-tight">
                        {group.monthYear}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-white">
                    {formatMoney(-group.dayTotal, viewCurrency)}
                  </span>
                </div>

                {/* Day Transactions */}
                <div className="divide-y divide-white/4">
                  {group.items.map((tx) => {
                    const convertedAmt = toViewCurrency(tx);
                    const origCurr = tx.rawCurrency || tx.currency || budgetCurrency;
                    const normOrig = origCurr === "NTD" ? "TWD" : origCurr;
                    const normView = viewCurrency === "NTD" ? "TWD" : viewCurrency;
                    const showOriginal = normOrig !== normView;
                    const issues = getTransactionIssues(tx, wallets);

                    return (
                      <div
                        key={tx._id}
                        onClick={() => router.push(`/transactions/${tx._id}`)}
                        className={`flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer ${
                          issues.length > 0 ? "bg-amber-500/[0.04] border-l-2 border-l-amber-400" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="relative flex-shrink-0">
                            <CategoryIcon
                              categoryId={tx.category}
                              subCategoryId={tx.subCategory}
                              size="md"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-white text-sm font-semibold">
                                {tx.title ||
                                  getCategoryDisplayName(tx.category, tx.subCategory)}
                              </p>
                              {issues.map((issue) => (
                                <span
                                  key={issue.label}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    issue.severity === "error"
                                      ? "bg-red-500/15 text-red-300 border border-red-500/30"
                                      : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                  }`}
                                >
                                  <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
                                  <span>{issue.label}</span>
                                </span>
                              ))}
                            </div>
                            {showOriginal && (
                              <p className="text-slate-500 text-[10px]">
                                -{formatMoney(tx.rawAmount ?? tx.amount, origCurr)}
                              </p>
                            )}
                            {issues.length > 0 && (
                              <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                                <span>Tap to fix this transaction</span>
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-red-400 font-bold text-sm flex-shrink-0">
                          -{formatMoney(convertedAmt, viewCurrency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
