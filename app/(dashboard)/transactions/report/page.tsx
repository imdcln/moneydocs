"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  HelpCircle,
  CreditCard,
  HandCoins,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";
import {
  formatMoney,
  convertCurrency,
  getCurrencyDisplayCode,
  CURRENCY_INFO,
  SupportedCurrency,
} from "@/lib/currency";
import CategoryIcon from "@/components/ui/CategoryIcon";
import {
  getCategoryDisplayName,
  isLoanCategory,
  isDebtCategory,
} from "@/lib/categories";
import { useWalletContext } from "@/hooks/useWalletContext";
import CurrencyFlag from "@/components/admin/CurrencyFlag";
import PageLoading from "@/components/ui/PageLoading";
import { generatePeriodTabs, TimeRangeUnit, PeriodTabOption } from "@/app/(dashboard)/transactions/page";

interface Transaction {
  _id: string;
  type: "EXPENSE" | "INCOME" | "DEBT";
  title: string;
  amount: number;
  currency: string;
  convertedAmountIDR: number;
  category: string;
  subCategory?: string;
  date: string;
  walletId?: { _id: string; name: string; currency: string } | string;
  debtParty?: string;
  debtDueDate?: string;
  debtRepaidAmount?: number;
  debtStatus?: "UNPAID" | "PARTIAL" | "PAID";
  debtPayments?: {
    _id?: string;
    amount: number;
    currency?: string;
    date: string;
    walletName?: string;
    note?: string;
  }[];
  withPeople?: string[];
  eventName?: string;
}

interface Wallet {
  _id: string;
  name: string;
  balance: number;
  currency: string;
  isDefault?: boolean;
  excludeFromTotal?: boolean;
}

interface CategoryBreakdownItem {
  total: number;
  remainingTotal: number;
  repaidTotal: number;
  transactions: Transaction[];
}

type SectionType = "income" | "expense" | "unpaid_debt" | "unpaid_loan";

function ReportContent() {
  const searchParams = useSearchParams();

  const { selectedWalletId, wallets: contextWallets } = useWalletContext();
  const walletParam = searchParams.get("wallet");
  const walletId = walletParam !== null && walletParam !== undefined ? walletParam : selectedWalletId;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>(contextWallets);
  const [userCurrency, setUserCurrency] = useState("IDR");
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<SectionType | null>("unpaid_debt");
  const [debtScope, setDebtScope] = useState<"period" | "all_unpaid">("period");

  useEffect(() => {
    Promise.all([
      fetch("/api/finance/transactions?limit=1000").then((r) => r.json()),
      fetch("/api/finance/wallets").then((r) => r.json()),
      fetch("/api/finance/user").then((r) => r.json()),
      fetch("/api/finance/exchange-rates").then((r) => r.json()),
    ]).then(([txData, walletData, userData, rateData]) => {
      setTransactions(txData.transactions ?? []);
      setWallets(walletData.wallets ?? []);
      if (userData.user?.baseCurrency) setUserCurrency(userData.user.baseCurrency);
      if (rateData.rates) setRates(rateData.rates);
      setLoading(false);
    });
  }, []);

  const selectedWallet =
    wallets.find((w) => w._id === walletId) ||
    (walletId === "ALL" ? undefined : (wallets.find((w) => w.isDefault) || wallets[0]));
  const currencyParam = searchParams.get("currency");
  const activeCurrency = currencyParam || (selectedWallet ? selectedWallet.currency : userCurrency);

  // Parse exact date range and human-readable label from query params
  const { start, end, periodLabel } = useMemo(() => {
    const startParam = searchParams.get("startDate");
    const endParam = searchParams.get("endDate");
    const labelParam = searchParams.get("label");
    const periodParam = searchParams.get("period");
    const periodIdParam = searchParams.get("periodId");
    const unitParam = (searchParams.get("unit") ?? "MONTH") as TimeRangeUnit;

    const now = new Date();

    // 1. Direct startDate and endDate query params
    if (startParam) {
      const s = new Date(startParam);
      const e = endParam ? new Date(endParam) : new Date(9999, 0, 1);
      if (!isNaN(s.getTime())) {
        // Build a human-readable label based on unit + date range
        let lbl = "";
        if (unitParam === "MONTH") {
          lbl = s.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        } else if (unitParam === "YEAR") {
          lbl = String(s.getFullYear());
        } else if (unitParam === "QUARTER") {
          const q = Math.floor(s.getMonth() / 3) + 1;
          lbl = `Q${q} ${s.getFullYear()}`;
        } else if (unitParam === "WEEK" && endParam) {
          const eDate = new Date(endParam);
          const startFmt = s.toLocaleDateString("en-US", { day: "numeric", month: "short" });
          const endFmt = eDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
          lbl = `${startFmt} – ${endFmt}`;
        } else if (unitParam === "DAY") {
          lbl = s.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        } else {
          // Fallback: use the label param only if it's a proper human label (not all-caps raw keys)
          const rawLabel = labelParam ? decodeURIComponent(labelParam) : "";
          const isRawKey = /^[A-Z _]+$/.test(rawLabel.trim());
          lbl = rawLabel && !isRawKey && rawLabel !== "undefined"
            ? rawLabel
            : s.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        }
        return { start: s, end: e, periodLabel: lbl };
      }
    }

    // 2. periodId param (e.g. offset_0, offset_-1, offset_-2)
    if (periodIdParam && periodIdParam.startsWith("offset_")) {
      const offset = parseInt(periodIdParam.replace("offset_", ""), 10);
      if (!isNaN(offset)) {
        if (unitParam === "MONTH") {
          const curYear = now.getFullYear();
          const curMonth = now.getMonth();
          const d = new Date(curYear, curMonth + offset, 1);
          const s = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
          const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
          const lbl = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
          return { start: s, end: e, periodLabel: lbl };
        }
        const tabs = generatePeriodTabs(unitParam);
        const tab = tabs.find((t: PeriodTabOption) => t.id === periodIdParam);
        if (tab && tab.startDate) {
          // Generate a human-readable label from the date rather than raw tab label
          let lbl = "";
          const s = tab.startDate;
          const e = tab.endDate;
          if (unitParam === "WEEK" && e) {
            const startFmt = s.toLocaleDateString("en-US", { day: "numeric", month: "short" });
            const endFmt = e.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
            lbl = `${startFmt} – ${endFmt}`;
          } else if (unitParam === "DAY") {
            lbl = s.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
          } else if (unitParam === "QUARTER") {
            const q = Math.floor(s.getMonth() / 3) + 1;
            lbl = `Q${q} ${s.getFullYear()}`;
          } else if (unitParam === "YEAR") {
            lbl = String(s.getFullYear());
          } else {
            lbl = tab.label;
          }
          return {
            start: s,
            end: e ?? new Date(9999, 0, 1),
            periodLabel: lbl,
          };
        }
      }
    }

    // 3. Fallback to period query param
    if (periodParam === "LAST_MONTH") {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const s = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const lbl = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      return { start: s, end: e, periodLabel: lbl };
    }

    if (periodParam === "FUTURE") {
      const s = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
      const e = new Date(9999, 0, 1);
      return { start: s, end: e, periodLabel: "Future" };
    }

    // Default: THIS_MONTH
    const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const lbl = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return { start: s, end: e, periodLabel: lbl };
  }, [searchParams]);

  // Currency conversion helper
  const toActiveAmount = (amt: number, curr: string, idrEquivalent?: number): number => {
    const normCurr = curr === "NTD" ? "TWD" : curr;
    const normActive = activeCurrency === "NTD" ? "TWD" : activeCurrency;
    if (normCurr === normActive) return amt;
    if (rates && Object.keys(rates).length > 0) {
      return convertCurrency(amt, normCurr, normActive, rates);
    }
    if (idrEquivalent !== undefined && normActive === "IDR") {
      return idrEquivalent;
    }
    if (idrEquivalent !== undefined && rates && Object.keys(rates).length > 0) {
      return convertCurrency(idrEquivalent, "IDR", normActive, rates);
    }
    return amt;
  };

  const toActive = (tx: Transaction): number => {
    return toActiveAmount(tx.amount, tx.currency, tx.convertedAmountIDR);
  };

  // Filter transactions
  const { filteredTx, allActiveUnpaidTx } = useMemo(() => {
    const inRange = (dStr?: string | Date | null, s?: Date, e?: Date) => {
      if (!dStr || !s || !e) return false;
      const d = new Date(dStr);
      return !isNaN(d.getTime()) && d >= s && d <= e;
    };

    const excludedWalletIds =
      walletId === "ALL"
        ? new Set(wallets.filter((w) => w.excludeFromTotal).map((w) => w._id))
        : new Set<string>();

    const wFilter = (tx: Transaction) => {
      if (walletId !== "ALL") {
        const wid = typeof tx.walletId === "string" ? tx.walletId : tx.walletId?._id;
        return wid === walletId;
      }
      const wid = typeof tx.walletId === "string" ? tx.walletId : tx.walletId?._id;
      if (wid && excludedWalletIds.has(wid)) return false;
      return true;
    };

    const walletScoped = transactions.filter(wFilter);

    // Current period transactions: includes income/expense/debt whose tx.date is in range,
    // OR debts whose debtDueDate is in range
    const current = walletScoped.filter((tx) => {
      const inDate = inRange(tx.date, start, end);
      const inDueDate = tx.debtDueDate ? inRange(tx.debtDueDate, start, end) : false;
      return inDate || inDueDate;
    });

    // All active unpaid debts/loans originated on or before period end date and not fully paid
    const allUnpaid = walletScoped.filter((tx) => {
      const isDebtType =
        tx.type === "DEBT" ||
        isDebtCategory(tx.category, tx.subCategory) ||
        isLoanCategory(tx.category, tx.subCategory);
      if (!isDebtType) return false;

      const repaid = Number(tx.debtRepaidAmount) || 0;
      const remaining = Math.max(0, tx.amount - repaid);
      const isPaid = tx.debtStatus === "PAID" || (repaid >= tx.amount && tx.amount > 0);
      if (isPaid || remaining <= 0) return false;

      const txDate = new Date(tx.date);
      return !isNaN(txDate.getTime()) && txDate <= end;
    });

    return { filteredTx: current, allActiveUnpaidTx: allUnpaid };
  }, [transactions, start, end, walletId, wallets]);

  const totalIncome = useMemo(
    () =>
      filteredTx
        .filter((tx) => tx.type === "INCOME")
        .reduce((s, tx) => s + toActive(tx), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredTx, activeCurrency, rates]
  );

  const totalExpense = useMemo(
    () =>
      filteredTx
        .filter((tx) => tx.type === "EXPENSE")
        .reduce((s, tx) => s + toActive(tx), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredTx, activeCurrency, rates]
  );

  const netIncome = totalIncome - totalExpense;

  // Opening balance & ending balance
  const openingBalance = useMemo(() => {
    const currentWalletBalance = selectedWallet
      ? selectedWallet.balance
      : wallets.reduce(
          (sum, w) => sum + convertCurrency(w.balance || 0, w.currency, userCurrency, rates),
          0
        );
    return currentWalletBalance - netIncome;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWallet, wallets, netIncome, userCurrency, rates]);

  const endingBalance = useMemo(() => {
    return selectedWallet
      ? selectedWallet.balance
      : wallets.reduce(
          (sum, w) => sum + convertCurrency(w.balance || 0, w.currency, userCurrency, rates),
          0
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWallet, wallets, userCurrency, rates]);

  // Debt & Loan transactions pool based on selected scope
  const targetDebtPool = useMemo(() => {
    if (debtScope === "all_unpaid") {
      return allActiveUnpaidTx;
    }
    // "period": only transactions within current period range
    return filteredTx.filter((tx) => {
      const isDebtType =
        tx.type === "DEBT" ||
        isDebtCategory(tx.category, tx.subCategory) ||
        isLoanCategory(tx.category, tx.subCategory);
      if (!isDebtType) return false;
      const repaid = Number(tx.debtRepaidAmount) || 0;
      const remaining = Math.max(0, tx.amount - repaid);
      const isPaid = tx.debtStatus === "PAID" || (repaid >= tx.amount && tx.amount > 0);
      return !isPaid && remaining > 0;
    });
  }, [debtScope, allActiveUnpaidTx, filteredTx]);

  // Category breakdown for Income, Expense, Unpaid Debt, Unpaid Loan
  const categoryBreakdown = useMemo(() => {
    const income: Record<string, CategoryBreakdownItem> = {};
    const expense: Record<string, CategoryBreakdownItem> = {};
    const unpaidDebt: Record<string, CategoryBreakdownItem> = {};
    const unpaidLoan: Record<string, CategoryBreakdownItem> = {};

    // 1. Process Income & Expense from filteredTx
    filteredTx.forEach((tx) => {
      const key = tx.subCategory ? `${tx.category}:${tx.subCategory}` : tx.category;
      const amt = toActive(tx);
      if (tx.type === "INCOME") {
        if (!income[key]) income[key] = { total: 0, remainingTotal: 0, repaidTotal: 0, transactions: [] };
        income[key].total += amt;
        income[key].remainingTotal += amt;
        income[key].transactions.push(tx);
      } else if (tx.type === "EXPENSE") {
        if (!expense[key]) expense[key] = { total: 0, remainingTotal: 0, repaidTotal: 0, transactions: [] };
        expense[key].total += amt;
        expense[key].remainingTotal += amt;
        expense[key].transactions.push(tx);
      }
    });

    // 2. Process Unpaid Debt and Unpaid Loan from targetDebtPool
    targetDebtPool.forEach((tx) => {
      const key = tx.subCategory ? `${tx.category}:${tx.subCategory}` : tx.category;
      const repaid = Number(tx.debtRepaidAmount) || 0;
      const remaining = Math.max(0, tx.amount - repaid);
      const ratio = tx.amount > 0 ? remaining / tx.amount : 1;
      const remainingActive = toActiveAmount(
        remaining,
        tx.currency,
        tx.convertedAmountIDR ? tx.convertedAmountIDR * ratio : undefined
      );
      const repaidActive = toActiveAmount(
        repaid,
        tx.currency,
        tx.convertedAmountIDR ? tx.convertedAmountIDR * (1 - ratio) : undefined
      );
      const totalActive = toActive(tx);

      const isLoan = isLoanCategory(tx.category, tx.subCategory);
      const target = isLoan ? unpaidLoan : unpaidDebt;

      if (!target[key]) {
        target[key] = { total: 0, remainingTotal: 0, repaidTotal: 0, transactions: [] };
      }
      target[key].total += totalActive;
      target[key].remainingTotal += remainingActive;
      target[key].repaidTotal += repaidActive;
      target[key].transactions.push(tx);
    });

    const sortedIncome = Object.entries(income).sort((a, b) => b[1].total - a[1].total);
    const sortedExpense = Object.entries(expense).sort((a, b) => b[1].total - a[1].total);
    const sortedUnpaidDebt = Object.entries(unpaidDebt).sort(
      (a, b) => b[1].remainingTotal - a[1].remainingTotal
    );
    const sortedUnpaidLoan = Object.entries(unpaidLoan).sort(
      (a, b) => b[1].remainingTotal - a[1].remainingTotal
    );

    return {
      income: sortedIncome,
      expense: sortedExpense,
      unpaidDebt: sortedUnpaidDebt,
      unpaidLoan: sortedUnpaidLoan,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTx, targetDebtPool, activeCurrency, rates]);

  const totalUnpaidDebt = useMemo(
    () => categoryBreakdown.unpaidDebt.reduce((s, [, d]) => s + d.remainingTotal, 0),
    [categoryBreakdown.unpaidDebt]
  );

  const totalUnpaidLoan = useMemo(
    () => categoryBreakdown.unpaidLoan.reduce((s, [, d]) => s + d.remainingTotal, 0),
    [categoryBreakdown.unpaidLoan]
  );

  const unpaidDebtCount = useMemo(
    () => categoryBreakdown.unpaidDebt.reduce((s, [, d]) => s + d.transactions.length, 0),
    [categoryBreakdown.unpaidDebt]
  );

  const unpaidLoanCount = useMemo(
    () => categoryBreakdown.unpaidLoan.reduce((s, [, d]) => s + d.transactions.length, 0),
    [categoryBreakdown.unpaidLoan]
  );

  const periodUnpaidCount = useMemo(() => {
    return filteredTx.filter((tx) => {
      const isDebtType =
        tx.type === "DEBT" ||
        isDebtCategory(tx.category, tx.subCategory) ||
        isLoanCategory(tx.category, tx.subCategory);
      if (!isDebtType) return false;
      const repaid = Number(tx.debtRepaidAmount) || 0;
      const remaining = Math.max(0, tx.amount - repaid);
      const isPaid = tx.debtStatus === "PAID" || (repaid >= tx.amount && tx.amount > 0);
      return !isPaid && remaining > 0;
    }).length;
  }, [filteredTx]);

  const currencyMeta = CURRENCY_INFO[activeCurrency as SupportedCurrency];
  const displayCode = getCurrencyDisplayCode(activeCurrency);

  const maxCategoryAmount = Math.max(
    ...categoryBreakdown.expense.map((e) => e[1].total),
    ...categoryBreakdown.income.map((e) => e[1].total),
    ...categoryBreakdown.unpaidDebt.map((e) => e[1].remainingTotal),
    ...categoryBreakdown.unpaidLoan.map((e) => e[1].remainingTotal),
    1
  );

  if (loading) {
    return (
      <PageLoading
        title="Generating Report..."
        subtitle="Analyzing period spending & balance data"
      />
    );
  }

  return (
    <div className="px-4 pt-3 pb-nav-safe max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between py-1">
        <Link
          href="/transactions"
          className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          title="Back to transactions"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="text-center">
          <p className="text-white font-bold text-base">Period Report</p>
          <p className="text-slate-400 text-xs font-medium">{periodLabel}</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-400">
          <HelpCircle className="w-5 h-5" />
        </div>
      </div>

      {/* Wallet / Currency context pill */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/8 shadow-sm">
          <CurrencyFlag flag={currencyMeta?.flag ?? "🌐"} code={activeCurrency} className="text-base" />
          <span className="text-white text-xs font-bold">
            {selectedWallet ? selectedWallet.name : "All Wallets"}
          </span>
          <span className="text-slate-400 text-xs">· {displayCode}</span>
        </div>
      </div>

      {/* Opening / Ending Balance */}
      <div className="money-card p-4 bg-[#141519] border border-white/8 rounded-2xl space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Opening balance</span>
          <span className="text-white font-semibold">
            ≈ {formatMoney(openingBalance, activeCurrency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Ending balance</span>
          <span className="text-white font-semibold">
            ≈ {formatMoney(endingBalance, activeCurrency)}
          </span>
        </div>
      </div>

      {/* Net Income Card */}
      <div className="money-card p-5 bg-[#141519] border border-white/8 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-base">Net Income</h3>
            <p
              className={`text-lg font-extrabold mt-0.5 ${
                netIncome >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {netIncome >= 0 ? "+" : ""}
              {formatMoney(netIncome, activeCurrency)}
            </p>
          </div>
          <span className="text-slate-500 text-xs">≈ {displayCode}</span>
        </div>

        {/* Income & Expense progress bars */}
        <div className="space-y-2.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">≈ {formatMoney(totalIncome, activeCurrency)}</span>
              <span className="text-sky-400 font-semibold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Income
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full transition-all duration-700"
                style={{
                  width: `${
                    totalIncome > 0
                      ? Math.min(100, (totalIncome / Math.max(totalIncome, totalExpense)) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">≈ {formatMoney(totalExpense, activeCurrency)}</span>
              <span className="text-red-400 font-semibold flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" /> Expense
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full transition-all duration-700"
                style={{
                  width: `${
                    totalExpense > 0
                      ? Math.min(100, (totalExpense / Math.max(totalIncome, totalExpense)) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Outstanding Obligations Card (Unpaid Debt & Unpaid Loan Return) */}
      <div className="money-card p-5 bg-[#141519] border border-white/8 rounded-2xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Outstanding Obligations</h3>
              <p className="text-[11px] text-slate-400">Unpaid debts & pending loan returns</p>
            </div>
          </div>
          <span className="text-slate-500 text-xs">≈ {displayCode}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Unpaid Debt Mini Box */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-rose-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-rose-300/90 flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-rose-400" />
                Unpaid Debt
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-300 font-bold">
                {unpaidDebtCount}
              </span>
            </div>
            <p className="text-white font-extrabold text-sm">
              {formatMoney(totalUnpaidDebt, activeCurrency)}
            </p>
            <p className="text-[10px] text-slate-400">Money you owe others</p>
          </div>

          {/* Unpaid Loan Return Mini Box */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-amber-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-300/90 flex items-center gap-1">
                <HandCoins className="w-3 h-3 text-amber-400" />
                Unpaid Loan Return
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-300 font-bold">
                {unpaidLoanCount}
              </span>
            </div>
            <p className="text-white font-extrabold text-sm">
              {formatMoney(totalUnpaidLoan, activeCurrency)}
            </p>
            <p className="text-[10px] text-slate-400">Borrowed to return</p>
          </div>
        </div>

        {totalUnpaidDebt === 0 && totalUnpaidLoan === 0 && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>All debts and loans in this period are fully settled!</span>
          </div>
        )}
      </div>

      {/* Category Report */}
      <div className="money-card p-5 bg-[#141519] border border-white/8 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-base">Category report</h3>
            <p className="text-xs text-slate-400">Select a category to view itemized breakdown</p>
          </div>
        </div>

        {/* 2x2 Grid of Category Selector Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {/* Income Button */}
          <button
            type="button"
            onClick={() =>
              setExpandedSection(expandedSection === "income" ? null : "income")
            }
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              expandedSection === "income"
                ? "bg-sky-500/10 border-sky-500/40 shadow-sm shadow-sky-500/10"
                : "bg-[#1b1c22] border-white/5 hover:border-white/15"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 text-xs font-semibold">Income</span>
              <ChevronRight
                className={`w-4 h-4 text-slate-500 transition-transform ${
                  expandedSection === "income" ? "rotate-90 text-sky-400" : ""
                }`}
              />
            </div>
            <p className="text-sky-400 font-extrabold text-sm truncate">
              ≈ {formatMoney(totalIncome, activeCurrency)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {categoryBreakdown.income.reduce((s, [, d]) => s + d.transactions.length, 0)} transactions
            </p>
          </button>

          {/* Expense Button */}
          <button
            type="button"
            onClick={() =>
              setExpandedSection(expandedSection === "expense" ? null : "expense")
            }
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              expandedSection === "expense"
                ? "bg-red-500/10 border-red-500/40 shadow-sm shadow-red-500/10"
                : "bg-[#1b1c22] border-white/5 hover:border-white/15"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 text-xs font-semibold">Expense</span>
              <ChevronRight
                className={`w-4 h-4 text-slate-500 transition-transform ${
                  expandedSection === "expense" ? "rotate-90 text-red-400" : ""
                }`}
              />
            </div>
            <p className="text-red-400 font-extrabold text-sm truncate">
              ≈ {formatMoney(totalExpense, activeCurrency)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {categoryBreakdown.expense.reduce((s, [, d]) => s + d.transactions.length, 0)} transactions
            </p>
          </button>

          {/* Unpaid Debt Button */}
          <button
            type="button"
            onClick={() =>
              setExpandedSection(expandedSection === "unpaid_debt" ? null : "unpaid_debt")
            }
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              expandedSection === "unpaid_debt"
                ? "bg-rose-500/10 border-rose-500/40 shadow-sm shadow-rose-500/10"
                : "bg-[#1b1c22] border-white/5 hover:border-white/15"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 text-xs font-semibold flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-rose-400" />
                Unpaid Debt
              </span>
              <ChevronRight
                className={`w-4 h-4 text-slate-500 transition-transform ${
                  expandedSection === "unpaid_debt" ? "rotate-90 text-rose-400" : ""
                }`}
              />
            </div>
            <p className="text-rose-400 font-extrabold text-sm truncate">
              ≈ {formatMoney(totalUnpaidDebt, activeCurrency)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {unpaidDebtCount} unpaid item{unpaidDebtCount !== 1 ? "s" : ""}
            </p>
          </button>

          {/* Unpaid Loan Return Button */}
          <button
            type="button"
            onClick={() =>
              setExpandedSection(expandedSection === "unpaid_loan" ? null : "unpaid_loan")
            }
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              expandedSection === "unpaid_loan"
                ? "bg-amber-500/10 border-amber-500/40 shadow-sm shadow-amber-500/10"
                : "bg-[#1b1c22] border-white/5 hover:border-white/15"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 text-xs font-semibold flex items-center gap-1">
                <HandCoins className="w-3 h-3 text-amber-400" />
                Unpaid Loan Return
              </span>
              <ChevronRight
                className={`w-4 h-4 text-slate-500 transition-transform ${
                  expandedSection === "unpaid_loan" ? "rotate-90 text-amber-400" : ""
                }`}
              />
            </div>
            <p className="text-amber-400 font-extrabold text-sm truncate">
              ≈ {formatMoney(totalUnpaidLoan, activeCurrency)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {unpaidLoanCount} unpaid item{unpaidLoanCount !== 1 ? "s" : ""}
            </p>
          </button>
        </div>

        {/* Expanded Breakdown Section with Clickable Transactions */}
        {expandedSection && (
          <div className="space-y-3 pt-2 border-t border-white/8 animate-fade-in">
            {/* Breakdown Header & Optional Scope Toggle */}
            <div className="flex items-center justify-between flex-wrap gap-2 px-1">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">
                {expandedSection === "income"
                  ? "Income breakdown"
                  : expandedSection === "expense"
                  ? "Expense breakdown"
                  : expandedSection === "unpaid_debt"
                  ? "Unpaid Debt breakdown"
                  : "Unpaid Loan Return breakdown"}
              </p>

              {/* Scope filter pill for Debt & Loan */}
              {(expandedSection === "unpaid_debt" || expandedSection === "unpaid_loan") &&
                allActiveUnpaidTx.length > periodUnpaidCount && (
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setDebtScope("period")}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                        debtScope === "period"
                          ? "bg-white/15 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      This Period
                    </button>
                    <button
                      type="button"
                      onClick={() => setDebtScope("all_unpaid")}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                        debtScope === "all_unpaid"
                          ? "bg-white/15 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      All Unpaid ({allActiveUnpaidTx.length})
                    </button>
                  </div>
                )}
            </div>

            {/* Empty State */}
            {((expandedSection === "income" && categoryBreakdown.income.length === 0) ||
              (expandedSection === "expense" && categoryBreakdown.expense.length === 0) ||
              (expandedSection === "unpaid_debt" && categoryBreakdown.unpaidDebt.length === 0) ||
              (expandedSection === "unpaid_loan" && categoryBreakdown.unpaidLoan.length === 0)) && (
              <div className="p-6 rounded-2xl bg-[#1b1c22] border border-white/5 text-center space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-white/5 flex items-center justify-center text-slate-400">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-white text-xs font-semibold">
                  {expandedSection === "unpaid_debt"
                    ? `No unpaid debt in ${periodLabel}`
                    : expandedSection === "unpaid_loan"
                    ? `No unpaid loan return in ${periodLabel}`
                    : `No ${expandedSection} recorded for ${periodLabel}`}
                </p>
                <p className="text-[11px] text-slate-400">
                  {expandedSection === "unpaid_debt" || expandedSection === "unpaid_loan"
                    ? "Great job! All accounts for this period are settled up."
                    : "Transactions added for this period will appear here."}
                </p>
              </div>
            )}

            {/* Category Groups */}
            {(expandedSection === "income"
              ? categoryBreakdown.income
              : expandedSection === "expense"
              ? categoryBreakdown.expense
              : expandedSection === "unpaid_debt"
              ? categoryBreakdown.unpaidDebt
              : categoryBreakdown.unpaidLoan
            ).map(([key, data]) => {
              const [cat, sub] = key.split(":");
              const displayAmount =
                expandedSection === "unpaid_debt" || expandedSection === "unpaid_loan"
                  ? data.remainingTotal
                  : data.total;
              const pct = Math.round((displayAmount / maxCategoryAmount) * 100);

              const colorClass =
                expandedSection === "income"
                  ? "text-sky-400"
                  : expandedSection === "expense"
                  ? "text-red-400"
                  : expandedSection === "unpaid_debt"
                  ? "text-rose-400"
                  : "text-amber-400";

              const barBgClass =
                expandedSection === "income"
                  ? "bg-sky-500"
                  : expandedSection === "expense"
                  ? "bg-red-500"
                  : expandedSection === "unpaid_debt"
                  ? "bg-rose-500"
                  : "bg-amber-500";

              return (
                <div
                  key={key}
                  className="p-3.5 rounded-2xl bg-[#1b1c22] border border-white/5 space-y-3"
                >
                  {/* Category Header */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex-shrink-0">
                          <CategoryIcon categoryId={cat} subCategoryId={sub} size="sm" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-white font-bold block truncate">
                            {getCategoryDisplayName(cat, sub)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {data.transactions.length} transaction
                            {data.transactions.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className={`font-extrabold text-sm ${colorClass}`}>
                          {formatMoney(displayAmount, activeCurrency)}
                        </span>
                        {(expandedSection === "unpaid_debt" ||
                          expandedSection === "unpaid_loan") &&
                          data.repaidTotal > 0 && (
                            <p className="text-[10px] text-emerald-400 font-medium">
                              Paid: {formatMoney(data.repaidTotal, activeCurrency)}
                            </p>
                          )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barBgClass}`}
                        style={{ width: `${Math.max(5, pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Transaction List under this Category - Click to redirect to transaction detail */}
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] uppercase font-bold text-slate-500 px-1">
                      Tap a transaction to view details & settle
                    </p>
                    <div className="space-y-1.5">
                      {data.transactions.map((tx) => {
                        const repaid = Number(tx.debtRepaidAmount) || 0;
                        const remaining = Math.max(0, tx.amount - repaid);
                        const isLoan = isLoanCategory(tx.category, tx.subCategory);
                        const isDebtOrLoan =
                          tx.type === "DEBT" ||
                          isDebtCategory(tx.category, tx.subCategory) ||
                          isLoan;
                        const status = tx.debtStatus ?? (repaid > 0 ? "PARTIAL" : "UNPAID");
                        const party = tx.debtParty || tx.withPeople?.[0];
                        const isOverdue =
                          tx.debtDueDate && new Date(tx.debtDueDate).getTime() < Date.now();
                        const isCarriedForward = new Date(tx.date) < start;

                        const displayTxAmount = isDebtOrLoan
                          ? toActiveAmount(
                              remaining,
                              tx.currency,
                              tx.convertedAmountIDR
                                ? tx.convertedAmountIDR * (tx.amount > 0 ? remaining / tx.amount : 1)
                                : undefined
                            )
                          : toActive(tx);

                        const originalTxAmount = toActive(tx);

                        return (
                          <Link
                            key={tx._id}
                            href={`/transactions/${tx._id}`}
                            className="group flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/20 transition-all cursor-pointer"
                          >
                            <div className="min-w-0 pr-3 space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-white text-xs font-semibold group-hover:text-[var(--color-primary-light)] transition-colors truncate">
                                  {tx.title || getCategoryDisplayName(tx.category, tx.subCategory)}
                                </p>

                                {isDebtOrLoan && (
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      status === "PARTIAL"
                                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                        : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                    }`}
                                  >
                                    {status === "PARTIAL" ? "PARTIAL" : "UNPAID"}
                                  </span>
                                )}

                                {isOverdue && status !== "PAID" && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-500/15 text-red-300 border border-red-500/30">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    Overdue
                                  </span>
                                )}

                                {isCarriedForward && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                    Prior carryover
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                                <span>
                                  {tx.date ? new Date(tx.date).toLocaleDateString() : "No date"}
                                </span>
                                {party && (
                                  <span>
                                    • {isLoan ? "Lender" : "To"}:{" "}
                                    <strong className="text-slate-300 font-medium">{party}</strong>
                                  </span>
                                )}
                                {tx.debtDueDate && (
                                  <span className={isOverdue ? "text-red-400 font-medium" : ""}>
                                    • Due {new Date(tx.debtDueDate).toLocaleDateString()}
                                  </span>
                                )}
                                {isDebtOrLoan && repaid > 0 && (
                                  <span className="text-emerald-400 font-medium">
                                    • Repaid: {formatMoney(toActiveAmount(repaid, tx.currency), activeCurrency)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0 text-right">
                              <div>
                                <p className={`text-xs font-extrabold ${colorClass}`}>
                                  {expandedSection === "income" ? "+" : "-"}
                                  {formatMoney(displayTxAmount, activeCurrency)}
                                </p>
                                {isDebtOrLoan && repaid > 0 && (
                                  <p className="text-[10px] text-slate-400 line-through">
                                    {formatMoney(originalTxAmount, activeCurrency)}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <PageLoading
          title="Generating Report..."
          subtitle="Analyzing period spending & balance data"
        />
      }
    >
      <ReportContent />
    </Suspense>
  );
}
