"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  CreditCard,
  HandCoins,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
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
  resolveCategoryHierarchy,
  calculateTrendComparison,
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

export interface SubCategoryReportGroup {
  subId: string;
  subName: string;
  total: number;
  remainingTotal: number;
  repaidTotal: number;
  prevTotal: number;
  prevRemainingTotal: number;
  transactions: Transaction[];
  isDirectParent?: boolean;
}

export interface ParentCategoryReportGroup {
  parentId: string;
  parentName: string;
  subCategoryId?: string;
  total: number;
  remainingTotal: number;
  repaidTotal: number;
  prevTotal: number;
  prevRemainingTotal: number;
  directTotal: number;
  directRemainingTotal: number;
  directRepaidTotal: number;
  directTransactions: Transaction[];
  subCategories: SubCategoryReportGroup[];
  hasChildTransactions: boolean;
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

  // Dropdown states to keep content compact and cost-effective
  const [openSubcategories, setOpenSubcategories] = useState<Record<string, boolean>>({});
  const [openTransactions, setOpenTransactions] = useState<Record<string, boolean>>({});
  const [openSubTx, setOpenSubTx] = useState<Record<string, boolean>>({});

  const toggleSubcategories = (key: string) => {
    setOpenSubcategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTransactions = (key: string) => {
    setOpenTransactions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSubTx = (key: string) => {
    setOpenSubTx((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

  // ─── Date Range & Previous Period Calculations ──────────────────────────
  const { prevStart, prevEnd, periodUnitLabel } = useMemo(() => {
    const unitParam = searchParams.get("unit") ?? "MONTH";
    if (unitParam === "MONTH") {
      const ps = new Date(start.getFullYear(), start.getMonth() - 1, 1, 0, 0, 0, 0);
      const pe = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999);
      return { prevStart: ps, prevEnd: pe, periodUnitLabel: "prev month" };
    } else if (unitParam === "YEAR") {
      const ps = new Date(start.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      const pe = new Date(start.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      return { prevStart: ps, prevEnd: pe, periodUnitLabel: "prev year" };
    } else {
      const span = end.getTime() - start.getTime();
      const pe = new Date(start.getTime() - 1);
      const ps = new Date(pe.getTime() - span);
      return { prevStart: ps, prevEnd: pe, periodUnitLabel: "prev period" };
    }
  }, [start, end, searchParams]);

  // Filter transactions
  const { filteredTx, previousFilteredTx, allActiveUnpaidTx, prevActiveUnpaidTx } = useMemo(() => {
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

    // Current period transactions
    const current = walletScoped.filter((tx) => {
      const inDate = inRange(tx.date, start, end);
      const inDueDate = tx.debtDueDate ? inRange(tx.debtDueDate, start, end) : false;
      return inDate || inDueDate;
    });

    // Previous period transactions
    const previous = walletScoped.filter((tx) => {
      const inDate = inRange(tx.date, prevStart, prevEnd);
      const inDueDate = tx.debtDueDate ? inRange(tx.debtDueDate, prevStart, prevEnd) : false;
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

    const prevUnpaid = walletScoped.filter((tx) => {
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
      return !isNaN(txDate.getTime()) && txDate <= prevEnd;
    });

    return {
      filteredTx: current,
      previousFilteredTx: previous,
      allActiveUnpaidTx: allUnpaid,
      prevActiveUnpaidTx: prevUnpaid,
    };
  }, [transactions, start, end, prevStart, prevEnd, walletId, wallets]);

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

  const prevTargetDebtPool = useMemo(() => {
    if (debtScope === "all_unpaid") {
      return prevActiveUnpaidTx;
    }
    return previousFilteredTx.filter((tx) => {
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
  }, [debtScope, prevActiveUnpaidTx, previousFilteredTx]);

  // Category breakdown for Income, Expense, Unpaid Debt, Unpaid Loan
  // Grouped hierarchically: Parent Category (sum of direct + all child categories)
  // Sub-categories listed with comparisons when child transactions exist
  const categoryBreakdown = useMemo(() => {
    // ── Helper to group Income / Expense by parent & sub-categories ──
    const groupIncomeExpense = (type: "INCOME" | "EXPENSE"): ParentCategoryReportGroup[] => {
      const parentMap: Record<
        string,
        {
          parentId: string;
          parentName: string;
          directTotal: number;
          directPrevTotal: number;
          directTransactions: Transaction[];
          subs: Record<
            string,
            {
              subId: string;
              subName: string;
              total: number;
              prevTotal: number;
              transactions: Transaction[];
            }
          >;
        }
      > = {};

      const ensureParent = (pId: string, pName: string) => {
        if (!parentMap[pId]) {
          parentMap[pId] = {
            parentId: pId,
            parentName: pName,
            directTotal: 0,
            directPrevTotal: 0,
            directTransactions: [],
            subs: {},
          };
        }
        return parentMap[pId];
      };

      filteredTx.forEach((tx) => {
        if (tx.type !== type) return;
        const { parentId, parentName, subId, subName } = resolveCategoryHierarchy(tx.category, tx.subCategory);
        const parent = ensureParent(parentId, parentName);
        const amt = toActive(tx);
        if (subId) {
          if (!parent.subs[subId]) {
            parent.subs[subId] = {
              subId,
              subName: subName || subId,
              total: 0,
              prevTotal: 0,
              transactions: [],
            };
          }
          parent.subs[subId].total += amt;
          parent.subs[subId].transactions.push(tx);
        } else {
          parent.directTotal += amt;
          parent.directTransactions.push(tx);
        }
      });

      previousFilteredTx.forEach((tx) => {
        if (tx.type !== type) return;
        const { parentId, parentName, subId, subName } = resolveCategoryHierarchy(tx.category, tx.subCategory);
        const parent = ensureParent(parentId, parentName);
        const amt = toActive(tx);
        if (subId) {
          if (!parent.subs[subId]) {
            parent.subs[subId] = {
              subId,
              subName: subName || subId,
              total: 0,
              prevTotal: 0,
              transactions: [],
            };
          }
          parent.subs[subId].prevTotal += amt;
        } else {
          parent.directPrevTotal += amt;
        }
      });

      return Object.values(parentMap)
        .map((p) => {
          const activeSubs = Object.values(p.subs).filter(
            (s) => s.total > 0 || s.prevTotal > 0 || s.transactions.length > 0
          );
          const currentActiveSubs = Object.values(p.subs).filter(
            (s) => s.total > 0 || s.transactions.length > 0
          );
          const hasDirect = p.directTotal > 0 || p.directTransactions.length > 0;

          // Rule: If at a parent category only one sub-category is used (and no direct parent spending),
          // don't put sub-category below it, directly put it as a category with no parent category.
          const isSingleSub =
            !hasDirect &&
            (currentActiveSubs.length === 1 || (currentActiveSubs.length === 0 && activeSubs.length === 1));

          if (isSingleSub) {
            const singleSub = currentActiveSubs[0] || activeSubs[0];
            return {
              parentId: p.parentId,
              parentName: singleSub.subName,
              subCategoryId: singleSub.subId,
              total: singleSub.total,
              remainingTotal: singleSub.total,
              repaidTotal: 0,
              prevTotal: singleSub.prevTotal,
              prevRemainingTotal: singleSub.prevTotal,
              directTotal: singleSub.total,
              directRemainingTotal: singleSub.total,
              directRepaidTotal: 0,
              directTransactions: singleSub.transactions,
              subCategories: [],
              hasChildTransactions: false,
              transactions: singleSub.transactions,
            };
          }

          const hasChildTransactions = activeSubs.length > 0;

          const subCategories: SubCategoryReportGroup[] = activeSubs.map((s) => ({
            subId: s.subId,
            subName: s.subName,
            total: s.total,
            remainingTotal: s.total,
            repaidTotal: 0,
            prevTotal: s.prevTotal,
            prevRemainingTotal: s.prevTotal,
            transactions: s.transactions,
          }));

          // If parent category has direct spending AND child categories done transactions,
          // include direct spending as a sub-category so the breakdown transparently accounts for parent total
          if (hasChildTransactions && (p.directTotal > 0 || p.directTransactions.length > 0 || p.directPrevTotal > 0)) {
            subCategories.unshift({
              subId: "_direct",
              subName: `${p.parentName} (General)`,
              total: p.directTotal,
              remainingTotal: p.directTotal,
              repaidTotal: 0,
              prevTotal: p.directPrevTotal,
              prevRemainingTotal: p.directPrevTotal,
              transactions: p.directTransactions,
              isDirectParent: true,
            });
          }

          const total = p.directTotal + activeSubs.reduce((s, c) => s + c.total, 0);
          const prevTotal = p.directPrevTotal + activeSubs.reduce((s, c) => s + c.prevTotal, 0);

          const allTransactions = [...p.directTransactions];
          activeSubs.forEach((s) => allTransactions.push(...s.transactions));

          subCategories.sort((a, b) => b.total - a.total || b.prevTotal - a.prevTotal);

          return {
            parentId: p.parentId,
            parentName: p.parentName,
            total,
            remainingTotal: total,
            repaidTotal: 0,
            prevTotal,
            prevRemainingTotal: prevTotal,
            directTotal: p.directTotal,
            directRemainingTotal: p.directTotal,
            directRepaidTotal: 0,
            directTransactions: p.directTransactions,
            subCategories,
            hasChildTransactions,
            transactions: allTransactions,
          };
        })
        .filter((p) => p.total > 0 || p.prevTotal > 0 || p.transactions.length > 0)
        .sort((a, b) => b.total - a.total);
    };

    // ── Helper to group Debt & Loan by parent & sub-categories ──
    const groupDebtLoan = (isLoanType: boolean): ParentCategoryReportGroup[] => {
      const parentMap: Record<
        string,
        {
          parentId: string;
          parentName: string;
          directTotal: number;
          directRemainingTotal: number;
          directRepaidTotal: number;
          directPrevRemainingTotal: number;
          directTransactions: Transaction[];
          subs: Record<
            string,
            {
              subId: string;
              subName: string;
              total: number;
              remainingTotal: number;
              repaidTotal: number;
              prevRemainingTotal: number;
              transactions: Transaction[];
            }
          >;
        }
      > = {};

      const ensureParent = (pId: string, pName: string) => {
        if (!parentMap[pId]) {
          parentMap[pId] = {
            parentId: pId,
            parentName: pName,
            directTotal: 0,
            directRemainingTotal: 0,
            directRepaidTotal: 0,
            directPrevRemainingTotal: 0,
            directTransactions: [],
            subs: {},
          };
        }
        return parentMap[pId];
      };

      targetDebtPool.forEach((tx) => {
        const isLoan = isLoanCategory(tx.category, tx.subCategory);
        if (isLoan !== isLoanType) return;

        const { parentId, parentName, subId, subName } = resolveCategoryHierarchy(tx.category, tx.subCategory);
        const parent = ensureParent(parentId, parentName);

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

        if (subId) {
          if (!parent.subs[subId]) {
            parent.subs[subId] = {
              subId,
              subName: subName || subId,
              total: 0,
              remainingTotal: 0,
              repaidTotal: 0,
              prevRemainingTotal: 0,
              transactions: [],
            };
          }
          parent.subs[subId].total += totalActive;
          parent.subs[subId].remainingTotal += remainingActive;
          parent.subs[subId].repaidTotal += repaidActive;
          parent.subs[subId].transactions.push(tx);
        } else {
          parent.directTotal += totalActive;
          parent.directRemainingTotal += remainingActive;
          parent.directRepaidTotal += repaidActive;
          parent.directTransactions.push(tx);
        }
      });

      prevTargetDebtPool.forEach((tx) => {
        const isLoan = isLoanCategory(tx.category, tx.subCategory);
        if (isLoan !== isLoanType) return;

        const { parentId, parentName, subId, subName } = resolveCategoryHierarchy(tx.category, tx.subCategory);
        const parent = ensureParent(parentId, parentName);

        const repaid = Number(tx.debtRepaidAmount) || 0;
        const remaining = Math.max(0, tx.amount - repaid);
        const ratio = tx.amount > 0 ? remaining / tx.amount : 1;
        const remainingActive = toActiveAmount(
          remaining,
          tx.currency,
          tx.convertedAmountIDR ? tx.convertedAmountIDR * ratio : undefined
        );

        if (subId) {
          if (!parent.subs[subId]) {
            parent.subs[subId] = {
              subId,
              subName: subName || subId,
              total: 0,
              remainingTotal: 0,
              repaidTotal: 0,
              prevRemainingTotal: 0,
              transactions: [],
            };
          }
          parent.subs[subId].prevRemainingTotal += remainingActive;
        } else {
          parent.directPrevRemainingTotal += remainingActive;
        }
      });

      return Object.values(parentMap)
        .map((p) => {
          const activeSubs = Object.values(p.subs).filter(
            (s) => s.remainingTotal > 0 || s.prevRemainingTotal > 0 || s.transactions.length > 0
          );
          const currentActiveSubs = Object.values(p.subs).filter(
            (s) => s.remainingTotal > 0 || s.transactions.length > 0
          );
          const hasDirect =
            p.directRemainingTotal > 0 ||
            p.directTransactions.length > 0;

          // Rule: If at a parent category only one sub-category is used (and no direct parent debt/loan),
          // don't put sub-category below it, directly put it as a category with no parent category.
          const isSingleSub =
            !hasDirect &&
            (currentActiveSubs.length === 1 || (currentActiveSubs.length === 0 && activeSubs.length === 1));

          if (isSingleSub) {
            const singleSub = currentActiveSubs[0] || activeSubs[0];
            return {
              parentId: p.parentId,
              parentName: singleSub.subName,
              subCategoryId: singleSub.subId,
              total: singleSub.total,
              remainingTotal: singleSub.remainingTotal,
              repaidTotal: singleSub.repaidTotal,
              prevTotal: singleSub.prevRemainingTotal,
              prevRemainingTotal: singleSub.prevRemainingTotal,
              directTotal: singleSub.total,
              directRemainingTotal: singleSub.remainingTotal,
              directRepaidTotal: singleSub.repaidTotal,
              directTransactions: singleSub.transactions,
              subCategories: [],
              hasChildTransactions: false,
              transactions: singleSub.transactions,
            };
          }

          const hasChildTransactions = activeSubs.length > 0;

          const subCategories: SubCategoryReportGroup[] = activeSubs.map((s) => ({
            subId: s.subId,
            subName: s.subName,
            total: s.total,
            remainingTotal: s.remainingTotal,
            repaidTotal: s.repaidTotal,
            prevTotal: s.prevRemainingTotal,
            prevRemainingTotal: s.prevRemainingTotal,
            transactions: s.transactions,
          }));

          if (hasChildTransactions && (p.directRemainingTotal > 0 || p.directTransactions.length > 0 || p.directPrevRemainingTotal > 0)) {
            subCategories.unshift({
              subId: "_direct",
              subName: `${p.parentName} (General)`,
              total: p.directTotal,
              remainingTotal: p.directRemainingTotal,
              repaidTotal: p.directRepaidTotal,
              prevTotal: p.directPrevRemainingTotal,
              prevRemainingTotal: p.directPrevRemainingTotal,
              transactions: p.directTransactions,
              isDirectParent: true,
            });
          }

          const total = p.directTotal + activeSubs.reduce((s, c) => s + c.total, 0);
          const remainingTotal = p.directRemainingTotal + activeSubs.reduce((s, c) => s + c.remainingTotal, 0);
          const repaidTotal = p.directRepaidTotal + activeSubs.reduce((s, c) => s + c.repaidTotal, 0);
          const prevRemainingTotal = p.directPrevRemainingTotal + activeSubs.reduce((s, c) => s + c.prevRemainingTotal, 0);

          const allTransactions = [...p.directTransactions];
          activeSubs.forEach((s) => allTransactions.push(...s.transactions));

          subCategories.sort((a, b) => b.remainingTotal - a.remainingTotal || b.prevRemainingTotal - a.prevRemainingTotal);

          return {
            parentId: p.parentId,
            parentName: p.parentName,
            total,
            remainingTotal,
            repaidTotal,
            prevTotal: prevRemainingTotal,
            prevRemainingTotal,
            directTotal: p.directTotal,
            directRemainingTotal: p.directRemainingTotal,
            directRepaidTotal: p.directRepaidTotal,
            directTransactions: p.directTransactions,
            subCategories,
            hasChildTransactions,
            transactions: allTransactions,
          };
        })
        .filter((p) => p.remainingTotal > 0 || p.prevRemainingTotal > 0 || p.transactions.length > 0)
        .sort((a, b) => b.remainingTotal - a.remainingTotal);
    };

    return {
      income: groupIncomeExpense("INCOME"),
      expense: groupIncomeExpense("EXPENSE"),
      unpaidDebt: groupDebtLoan(false),
      unpaidLoan: groupDebtLoan(true),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTx, previousFilteredTx, targetDebtPool, prevTargetDebtPool, activeCurrency, rates]);

  const totalUnpaidDebt = useMemo(
    () => categoryBreakdown.unpaidDebt.reduce((s, d) => s + d.remainingTotal, 0),
    [categoryBreakdown.unpaidDebt]
  );

  const totalUnpaidLoan = useMemo(
    () => categoryBreakdown.unpaidLoan.reduce((s, d) => s + d.remainingTotal, 0),
    [categoryBreakdown.unpaidLoan]
  );

  const unpaidDebtCount = useMemo(
    () => categoryBreakdown.unpaidDebt.reduce((s, d) => s + d.transactions.length, 0),
    [categoryBreakdown.unpaidDebt]
  );

  const unpaidLoanCount = useMemo(
    () => categoryBreakdown.unpaidLoan.reduce((s, d) => s + d.transactions.length, 0),
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
    ...categoryBreakdown.expense.map((e) => e.total),
    ...categoryBreakdown.income.map((e) => e.total),
    ...categoryBreakdown.unpaidDebt.map((e) => e.remainingTotal),
    ...categoryBreakdown.unpaidLoan.map((e) => e.remainingTotal),
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
              {categoryBreakdown.income.reduce((s, d) => s + d.transactions.length, 0)} transactions
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
              {categoryBreakdown.expense.reduce((s, d) => s + d.transactions.length, 0)} transactions
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
            {/* Breakdown Header & Optional Scope Toggle & Expand All */}
            <div className="flex items-center justify-between flex-wrap gap-2 px-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">
                  {expandedSection === "income"
                    ? "Income breakdown"
                    : expandedSection === "expense"
                    ? "Expense breakdown"
                    : expandedSection === "unpaid_debt"
                    ? "Unpaid Debt breakdown"
                    : "Unpaid Loan Return breakdown"}
                </p>

                {/* Expand / Collapse All Toggle */}
                {((expandedSection === "income"
                  ? categoryBreakdown.income
                  : expandedSection === "expense"
                  ? categoryBreakdown.expense
                  : expandedSection === "unpaid_debt"
                  ? categoryBreakdown.unpaidDebt
                  : categoryBreakdown.unpaidLoan
                ).length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      const cats =
                        expandedSection === "income"
                          ? categoryBreakdown.income
                          : expandedSection === "expense"
                          ? categoryBreakdown.expense
                          : expandedSection === "unpaid_debt"
                          ? categoryBreakdown.unpaidDebt
                          : categoryBreakdown.unpaidLoan;
                      const allOpen = cats.every((p) => {
                        const key = `${expandedSection}_${
                          p.subCategoryId ? `${p.parentId}_${p.subCategoryId}` : p.parentId
                        }`;
                        return p.hasChildTransactions ? !!openSubcategories[key] : !!openTransactions[key];
                      });
                      const nextState = !allOpen;
                      const nextSub = { ...openSubcategories };
                      const nextTx = { ...openTransactions };
                      const nextSubTx = { ...openSubTx };
                      cats.forEach((p) => {
                        const key = `${expandedSection}_${
                          p.subCategoryId ? `${p.parentId}_${p.subCategoryId}` : p.parentId
                        }`;
                        if (p.hasChildTransactions) {
                          nextSub[key] = nextState;
                          p.subCategories.forEach((s) => {
                            nextSubTx[`${key}_${s.subId}`] = nextState;
                          });
                        } else {
                          nextTx[key] = nextState;
                        }
                      });
                      setOpenSubcategories(nextSub);
                      setOpenTransactions(nextTx);
                      setOpenSubTx(nextSubTx);
                    }}
                    className="text-[10px] text-slate-400 hover:text-white font-medium px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 transition-colors cursor-pointer"
                  >
                    {(() => {
                      const cats =
                        expandedSection === "income"
                          ? categoryBreakdown.income
                          : expandedSection === "expense"
                          ? categoryBreakdown.expense
                          : expandedSection === "unpaid_debt"
                          ? categoryBreakdown.unpaidDebt
                          : categoryBreakdown.unpaidLoan;
                      const allOpen =
                        cats.length > 0 &&
                        cats.every((p) => {
                          const key = `${expandedSection}_${
                            p.subCategoryId ? `${p.parentId}_${p.subCategoryId}` : p.parentId
                          }`;
                          return p.hasChildTransactions ? !!openSubcategories[key] : !!openTransactions[key];
                        });
                      return allOpen ? "Collapse all" : "Expand all";
                    })()}
                  </button>
                )}
              </div>

              {/* Scope filter pill for Debt & Loan */}
              {(expandedSection === "unpaid_debt" || expandedSection === "unpaid_loan") &&
                allActiveUnpaidTx.length > periodUnpaidCount && (
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setDebtScope("period")}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
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
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
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
            ).map((parent) => {
              const displayAmount =
                expandedSection === "unpaid_debt" || expandedSection === "unpaid_loan"
                  ? parent.remainingTotal
                  : parent.total;
              const prevDisplayAmount =
                expandedSection === "unpaid_debt" || expandedSection === "unpaid_loan"
                  ? parent.prevRemainingTotal
                  : parent.prevTotal;

              const parentTrend = calculateTrendComparison(displayAmount, prevDisplayAmount, periodUnitLabel);
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

              const renderTxItem = (tx: Transaction) => {
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
              };

              const categoryKey = `${expandedSection}_${
                parent.subCategoryId ? `${parent.parentId}_${parent.subCategoryId}` : parent.parentId
              }`;
              const isSubOpen = !!openSubcategories[categoryKey];
              const isTxOpen = !!openTransactions[categoryKey];

              return (
                <div
                  key={categoryKey}
                  className="p-4 rounded-2xl bg-[#1b1c22] border border-white/5 space-y-3"
                >
                  {/* Parent Category Header */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex-shrink-0">
                          <CategoryIcon
                            categoryId={parent.parentId}
                            subCategoryId={parent.subCategoryId}
                            size="sm"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="text-white font-bold block truncate text-sm">
                            {parent.parentName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {parent.transactions.length} transaction
                            {parent.transactions.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 space-y-0.5">
                        <span className={`font-extrabold text-sm block ${colorClass}`}>
                          {formatMoney(displayAmount, activeCurrency)}
                        </span>
                        {(expandedSection === "unpaid_debt" ||
                          expandedSection === "unpaid_loan") &&
                          parent.repaidTotal > 0 && (
                            <p className="text-[10px] text-emerald-400 font-medium">
                              Paid: {formatMoney(parent.repaidTotal, activeCurrency)}
                            </p>
                          )}
                        {/* Parent Trend vs Previous Period */}
                        <div className="flex items-center gap-1 justify-end text-[10px] font-semibold">
                          {parentTrend.trending === "up" && (
                            <TrendingUp
                              className={`w-3 h-3 ${
                                expandedSection === "income" ? "text-emerald-400" : "text-red-400"
                              }`}
                            />
                          )}
                          {parentTrend.trending === "down" && (
                            <TrendingDown
                              className={`w-3 h-3 ${
                                expandedSection === "income" ? "text-red-400" : "text-emerald-400"
                              }`}
                            />
                          )}
                          {parentTrend.trending === "flat" && (
                            <Minus className="w-3 h-3 text-slate-500" />
                          )}
                          <span
                            className={
                              parentTrend.trending === "up"
                                ? expandedSection === "income"
                                  ? "text-emerald-400"
                                  : "text-red-400"
                                : parentTrend.trending === "down"
                                ? expandedSection === "income"
                                  ? "text-red-400"
                                  : "text-emerald-400"
                                : "text-slate-500"
                            }
                          >
                            {parentTrend.percentText}
                          </span>
                        </div>
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

                  {/* Case 1: Parent has multiple child categories - Sub-categories are a dropdown for user to open or close */}
                  {parent.hasChildTransactions ? (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => toggleSubcategories(categoryKey)}
                        className={`w-full flex items-center justify-between py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isSubOpen
                            ? "bg-white/[0.08] border-white/20 text-white shadow-sm"
                            : "bg-white/[0.03] border-white/5 text-slate-300 hover:bg-white/[0.07] hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold tracking-wide uppercase text-slate-400">
                            Sub-categories
                          </span>
                          <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] text-slate-200 font-bold">
                            {parent.subCategories.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <span>{isSubOpen ? "Hide" : "Show sub-categories"}</span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                              isSubOpen ? "rotate-180 text-white" : ""
                            }`}
                          />
                        </div>
                      </button>

                      {isSubOpen && (
                        <div className="pt-3 space-y-2.5 pl-2.5 border-l-2 border-white/10 animate-fade-in">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-0.5">
                            <span>Sub-categories ({parent.subCategories.length})</span>
                            <span>Tap to view transactions</span>
                          </div>

                          <div className="space-y-2.5">
                            {parent.subCategories.map((sub) => {
                              const subKey = `${categoryKey}_${sub.subId}`;
                              const isSubTxOpen = !!openSubTx[subKey];
                              const subDisplayAmount =
                                expandedSection === "unpaid_debt" || expandedSection === "unpaid_loan"
                                  ? sub.remainingTotal
                                  : sub.total;
                              const subPrevDisplayAmount =
                                expandedSection === "unpaid_debt" || expandedSection === "unpaid_loan"
                                  ? sub.prevRemainingTotal
                                  : sub.prevTotal;
                              const subTrend = calculateTrendComparison(
                                subDisplayAmount,
                                subPrevDisplayAmount,
                                periodUnitLabel
                              );
                              const subPct =
                                parent.total > 0
                                  ? Math.round((subDisplayAmount / parent.total) * 100)
                                  : 0;

                              return (
                                <div
                                  key={sub.subId}
                                  className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden transition-all"
                                >
                                  {/* Subcategory Header Button */}
                                  <button
                                    type="button"
                                    onClick={() => toggleSubTx(subKey)}
                                    className="w-full p-3 text-left hover:bg-white/[0.04] transition-colors cursor-pointer space-y-2"
                                  >
                                    <div className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="flex-shrink-0">
                                          <CategoryIcon
                                            categoryId={parent.parentId}
                                            subCategoryId={sub.isDirectParent ? undefined : sub.subId}
                                            size="sm"
                                          />
                                        </div>
                                        <div className="min-w-0">
                                          <span className="text-white font-semibold block truncate">
                                            {sub.subName}
                                          </span>
                                          <span className="text-[10px] text-slate-400">
                                            {sub.transactions.length} transaction
                                            {sub.transactions.length !== 1 ? "s" : ""}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2.5 flex-shrink-0 text-right">
                                        <div className="space-y-0.5">
                                          <span className={`font-bold text-xs block ${colorClass}`}>
                                            {formatMoney(subDisplayAmount, activeCurrency)}
                                          </span>
                                          {/* Sub Trend vs Previous Period */}
                                          <div className="flex items-center gap-1 justify-end text-[9px] font-medium">
                                            {subTrend.trending === "up" && (
                                              <TrendingUp
                                                className={`w-2.5 h-2.5 ${
                                                  expandedSection === "income"
                                                    ? "text-emerald-400"
                                                    : "text-red-400"
                                                }`}
                                              />
                                            )}
                                            {subTrend.trending === "down" && (
                                              <TrendingDown
                                                className={`w-2.5 h-2.5 ${
                                                  expandedSection === "income"
                                                    ? "text-red-400"
                                                    : "text-emerald-400"
                                                }`}
                                              />
                                            )}
                                            {subTrend.trending === "flat" && (
                                              <Minus className="w-2.5 h-2.5 text-slate-500" />
                                            )}
                                            <span
                                              className={
                                                subTrend.trending === "up"
                                                  ? expandedSection === "income"
                                                    ? "text-emerald-400"
                                                    : "text-red-400"
                                                  : subTrend.trending === "down"
                                                  ? expandedSection === "income"
                                                    ? "text-red-400"
                                                    : "text-emerald-400"
                                                  : "text-slate-500"
                                              }
                                            >
                                              {subTrend.percentText}
                                            </span>
                                          </div>
                                        </div>
                                        <ChevronDown
                                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                                            isSubTxOpen ? "rotate-180 text-white" : ""
                                          }`}
                                        />
                                      </div>
                                    </div>

                                    {/* Sub Progress Bar */}
                                    <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${barBgClass}`}
                                        style={{ width: `${Math.max(4, Math.min(100, subPct))}%` }}
                                      />
                                    </div>
                                  </button>

                                  {/* Sub Transactions Dropdown */}
                                  {isSubTxOpen && (
                                    <div className="p-2.5 pt-1 space-y-1.5 border-t border-white/5 animate-fade-in">
                                      {sub.transactions.length > 0 ? (
                                        sub.transactions.map((tx) => renderTxItem(tx))
                                      ) : (
                                        <p className="text-[11px] text-slate-500 py-1 text-center">
                                          No transactions in this period
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Case 2: No sub-category below it (only one subcategory used or direct transactions) */
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => toggleTransactions(categoryKey)}
                        className={`w-full flex items-center justify-between py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isTxOpen
                            ? "bg-white/[0.08] border-white/20 text-white shadow-sm"
                            : "bg-white/[0.03] border-white/5 text-slate-300 hover:bg-white/[0.07] hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold tracking-wide uppercase text-slate-400">
                            Transactions
                          </span>
                          <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] text-slate-200 font-bold">
                            {parent.transactions.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <span>{isTxOpen ? "Hide" : "Show transactions"}</span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                              isTxOpen ? "rotate-180 text-white" : ""
                            }`}
                          />
                        </div>
                      </button>

                      {isTxOpen && (
                        <div className="space-y-1.5 pt-2 animate-fade-in">
                          {parent.transactions.length > 0 ? (
                            parent.transactions.map((tx) => renderTxItem(tx))
                          ) : (
                            <p className="text-[11px] text-slate-500 py-2 text-center">
                              No transactions in this period
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
