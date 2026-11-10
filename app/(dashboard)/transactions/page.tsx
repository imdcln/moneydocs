"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HelpCircle,
  Search,
  MoreVertical,
  ChevronDown,
  Globe,
  Check,
  X,
  Layers,
  Sliders,
  Trash2,
  ArrowRightLeft,
  RefreshCw,
  Edit3,
  Share2,
  CheckSquare,
  Square,
  ChevronRight,
  AlertTriangle,
  Lock,
} from "lucide-react";
import {
  formatMoney,
  convertCurrency,
  getCurrencyDisplayCode,
  CURRENCY_INFO,
  SupportedCurrency,
  SUPPORTED_CURRENCIES,
} from "@/lib/currency";
import { WalletGraphic, CalendarIcon } from "@/components/ui/AppIcons";
import CategoryIcon from "@/components/ui/CategoryIcon";
import {
  getCategoryDisplayName,
  getTransactionIssues,
  checkCategoryStatus,
  TransactionIssue,
  isLoanCategory,
  isDebtCategory,
} from "@/lib/categories";
import ShareWalletModal from "@/components/admin/ShareWalletModal";
import TransferModal from "@/components/admin/TransferModal";
import WalletManagerModal from "@/components/admin/WalletManagerModal";
import WalletSwitcher from "@/components/admin/WalletSwitcher";
import { useWalletContext } from "@/hooks/useWalletContext";
import { useToast } from "@/components/ui/Toast";
import CurrencyFlag from "@/components/admin/CurrencyFlag";
import PageLoading from "@/components/ui/PageLoading";
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from "@/lib/clientCache";
import OnboardingSpotlight, { SpotlightStep } from "@/components/transactions/OnboardingSpotlight";
import ConfettiEffect from "@/components/transactions/ConfettiEffect";

const ONBOARDING_STEPS: SpotlightStep[] = [
  {
    targetId: "spotlight-balance-section",
    title: "Wallet Balance & Currency",
    description:
      "💎 Monitor your total aggregated balance across all wallets. Tap the currency pill to instantly switch view currencies with real-time conversion rates.",
    preferredPlacement: "bottom",
  },
  {
    targetId: "spotlight-period-tabs",
    title: "Timeline Navigation",
    description:
      "⚡ Navigate across months, quarters, or weeks. Track past financial health or inspect future planned expenses with the scrollable period selector.",
    preferredPlacement: "bottom",
  },
  {
    targetId: "spotlight-cashflow-card",
    title: "Cashflow & Financial Reports",
    description:
      "📊 Track net savings with live Inflow vs. Outflow metrics. Tap 'View report for this period' to open detailed visual analytics and category breakdowns.",
    preferredPlacement: "top",
  },
  {
    targetId: "spotlight-transactions-list",
    title: "Activity Feed & Actions",
    description:
      "🎯 Your transactions are categorized automatically. Issue warnings highlight items needing attention. Use the ⋯ menu to transfer funds or bulk-manage entries.",
    preferredPlacement: "top",
  },
];

interface Wallet {
  _id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  isDefault?: boolean;
  excludeFromTotal?: boolean;
  sharedWith?: Array<{ email: string; role: string }>;
}

interface DebtPayment {
  _id?: string;
  amount: number;
  currency?: string;
  date: string;
  walletName?: string;
  note?: string;
}

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
  description?: string;
  eventId?: string;
  eventName?: string;
  eventCurrency?: string;
  withPeople?: string[];
  debtParty?: string;
  debtRepaidAmount?: number;
  debtStatus?: "UNPAID" | "PARTIAL" | "PAID";
  debtPayments?: DebtPayment[];
  walletId?: { _id: string; name: string; currency: string } | string;
}

export type TimeRangeUnit = "DAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR";
export type ViewMode = "BY_DAY" | "BY_CATEGORY";

export interface PeriodTabOption {
  id: string;
  label: string;
  startDate?: Date;
  endDate?: Date;
  isFuture?: boolean;
}

export function generatePeriodTabs(unit: TimeRangeUnit): PeriodTabOption[] {
  const now = new Date();
  const tabs: PeriodTabOption[] = [];

  if (unit === "MONTH") {
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    for (let offset = -4; offset <= -2; offset++) {
      const d = new Date(curYear, curMonth + offset, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthName = d.toLocaleDateString("en-US", { month: "long" });
      tabs.push({
        id: `offset_${offset}`,
        label: monthName.toUpperCase(),
        startDate: start,
        endDate: end,
      });
    }

    const lastMonthDate = new Date(curYear, curMonth - 1, 1);
    tabs.push({
      id: "offset_-1",
      label: "LAST MONTH",
      startDate: new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1, 0, 0, 0, 0),
      endDate: new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0, 23, 59, 59, 999),
    });

    tabs.push({
      id: "offset_0",
      label: "THIS MONTH",
      startDate: new Date(curYear, curMonth, 1, 0, 0, 0, 0),
      endDate: new Date(curYear, curMonth + 1, 0, 23, 59, 59, 999),
    });

    tabs.push({
      id: "offset_1",
      label: "FUTURE",
      isFuture: true,
      startDate: new Date(curYear, curMonth + 1, 1, 0, 0, 0, 0),
    });
  } else if (unit === "WEEK") {
    const dayOfWeek = (now.getDay() + 6) % 7;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - dayOfWeek);
    thisMonday.setHours(0, 0, 0, 0);

    for (let offset = -4; offset <= -2; offset++) {
      const mon = new Date(thisMonday);
      mon.setDate(thisMonday.getDate() + offset * 7);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      sun.setHours(23, 59, 59, 999);
      const lbl = `${mon.getDate()} ${mon.toLocaleDateString("en-US", { month: "short" })} - ${sun.getDate()} ${sun.toLocaleDateString("en-US", { month: "short" })}`;
      tabs.push({
        id: `offset_${offset}`,
        label: lbl.toUpperCase(),
        startDate: mon,
        endDate: sun,
      });
    }

    const lastMon = new Date(thisMonday);
    lastMon.setDate(thisMonday.getDate() - 7);
    const lastSun = new Date(lastMon);
    lastSun.setDate(lastMon.getDate() + 6);
    lastSun.setHours(23, 59, 59, 999);
    tabs.push({
      id: "offset_-1",
      label: "LAST WEEK",
      startDate: lastMon,
      endDate: lastSun,
    });

    const thisSun = new Date(thisMonday);
    thisSun.setDate(thisMonday.getDate() + 6);
    thisSun.setHours(23, 59, 59, 999);
    tabs.push({
      id: "offset_0",
      label: "THIS WEEK",
      startDate: thisMonday,
      endDate: thisSun,
    });

    const nextMon = new Date(thisMonday);
    nextMon.setDate(thisMonday.getDate() + 7);
    tabs.push({
      id: "offset_1",
      label: "FUTURE",
      isFuture: true,
      startDate: nextMon,
    });
  } else if (unit === "DAY") {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    for (let offset = -4; offset <= -2; offset++) {
      const d = new Date(todayStart);
      d.setDate(todayStart.getDate() + offset);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      const lbl = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
      tabs.push({
        id: `offset_${offset}`,
        label: lbl.toUpperCase(),
        startDate: d,
        endDate: end,
      });
    }

    const yest = new Date(todayStart);
    yest.setDate(todayStart.getDate() - 1);
    const yestEnd = new Date(yest);
    yestEnd.setHours(23, 59, 59, 999);
    tabs.push({
      id: "offset_-1",
      label: "YESTERDAY",
      startDate: yest,
      endDate: yestEnd,
    });

    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
    tabs.push({
      id: "offset_0",
      label: "TODAY",
      startDate: todayStart,
      endDate: todayEnd,
    });

    const tmrw = new Date(todayStart);
    tmrw.setDate(todayStart.getDate() + 1);
    tabs.push({
      id: "offset_1",
      label: "FUTURE",
      isFuture: true,
      startDate: tmrw,
    });
  } else if (unit === "QUARTER") {
    const curYear = now.getFullYear();
    const curQuarter = Math.floor(now.getMonth() / 3);

    for (let offset = -4; offset <= -2; offset++) {
      const totalQ = curYear * 4 + curQuarter + offset;
      const y = Math.floor(totalQ / 4);
      const q = ((totalQ % 4) + 4) % 4;
      const start = new Date(y, q * 3, 1, 0, 0, 0, 0);
      const end = new Date(y, (q + 1) * 3, 0, 23, 59, 59, 999);
      tabs.push({
        id: `offset_${offset}`,
        label: `Q${q + 1} ${y}`,
        startDate: start,
        endDate: end,
      });
    }

    const totalQ1 = curYear * 4 + curQuarter - 1;
    const y1 = Math.floor(totalQ1 / 4);
    const q1 = ((totalQ1 % 4) + 4) % 4;
    tabs.push({
      id: "offset_-1",
      label: "LAST QUARTER",
      startDate: new Date(y1, q1 * 3, 1, 0, 0, 0, 0),
      endDate: new Date(y1, (q1 + 1) * 3, 0, 23, 59, 59, 999),
    });

    tabs.push({
      id: "offset_0",
      label: "THIS QUARTER",
      startDate: new Date(curYear, curQuarter * 3, 1, 0, 0, 0, 0),
      endDate: new Date(curYear, (curQuarter + 1) * 3, 0, 23, 59, 59, 999),
    });

    const totalQFuture = curYear * 4 + curQuarter + 1;
    const yF = Math.floor(totalQFuture / 4);
    const qF = ((totalQFuture % 4) + 4) % 4;
    tabs.push({
      id: "offset_1",
      label: "FUTURE",
      isFuture: true,
      startDate: new Date(yF, qF * 3, 1, 0, 0, 0, 0),
    });
  } else if (unit === "YEAR") {
    const curYear = now.getFullYear();

    for (let offset = -4; offset <= -2; offset++) {
      const y = curYear + offset;
      tabs.push({
        id: `offset_${offset}`,
        label: String(y),
        startDate: new Date(y, 0, 1, 0, 0, 0, 0),
        endDate: new Date(y, 11, 31, 23, 59, 59, 999),
      });
    }

    const y1 = curYear - 1;
    tabs.push({
      id: "offset_-1",
      label: "LAST YEAR",
      startDate: new Date(y1, 0, 1, 0, 0, 0, 0),
      endDate: new Date(y1, 11, 31, 23, 59, 59, 999),
    });

    tabs.push({
      id: "offset_0",
      label: "THIS YEAR",
      startDate: new Date(curYear, 0, 1, 0, 0, 0, 0),
      endDate: new Date(curYear, 11, 31, 23, 59, 59, 999),
    });

    tabs.push({
      id: "offset_1",
      label: "FUTURE",
      isFuture: true,
      startDate: new Date(curYear + 1, 0, 1, 0, 0, 0, 0),
    });
  }

  return tabs;
}

export default function TransactionsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const {
    wallets,
    setWallets,
    selectedWalletId,
    setSelectedWalletId,
    refreshWallets,
    activeWalletPermissions,
    getPermissionsForWallet,
  } = useWalletContext();

  const [timeRangeUnit, setTimeRangeUnit] = useState<TimeRangeUnit>("MONTH");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("offset_0");
  const [viewMode, setViewMode] = useState<ViewMode>("BY_DAY");
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (typeof window !== "undefined") {
      const cached = getCache<Transaction[]>("moneydocs_transactions");
      if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      const cached = getCache<Transaction[]>("moneydocs_transactions");
      if (cached && Array.isArray(cached) && cached.length > 0) return false;
    }
    return true;
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userCurrency, setUserCurrency] = useState("IDR");
  const [rates, setRates] = useState<Record<string, number>>({});

  const periodTabs = useMemo(() => generatePeriodTabs(timeRangeUnit), [timeRangeUnit]);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active tab into center on mount or when unit changes
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ inline: "center", behavior: "smooth" });
  }, [timeRangeUnit, selectedPeriodId]);

  // UI state
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const canEditBalance =
    selectedWalletId === "ALL"
      ? (wallets as any[]).some((w) => getPermissionsForWallet(w._id).editBalance)
      : activeWalletPermissions.editBalance;

  const canDeleteTransactions =
    selectedWalletId === "ALL"
      ? (wallets as any[]).some((w) => getPermissionsForWallet(w._id).transactions.delete)
      : activeWalletPermissions.transactions.delete;

  const [timeRangeDropdownOpen, setTimeRangeDropdownOpen] = useState(false);
  const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);

  // Currency switcher state (matching user image dropdown)
  const [selectedDisplayCurrency, setSelectedDisplayCurrency] = useState<string | null>(null);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  // Onboarding Spotlight Tour state
  const [tourOpen, setTourOpen] = useState(false);
  const [currentTourStep, setCurrentTourStep] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showCelebrationToast, setShowCelebrationToast] = useState(false);

  const handleStartTour = () => {
    setCurrentTourStep(0);
    setTourOpen(true);
  };

  const handleNextTourStep = () => {
    if (currentTourStep < ONBOARDING_STEPS.length - 1) {
      setCurrentTourStep((s) => s + 1);
    } else {
      handleCompleteTour();
    }
  };

  const handlePrevTourStep = () => {
    if (currentTourStep > 0) {
      setCurrentTourStep((s) => s - 1);
    }
  };

  const handleCompleteTour = () => {
    setTourOpen(false);
    setShowCelebration(true);
    setShowCelebrationToast(true);
    setTimeout(() => {
      setShowCelebrationToast(false);
    }, 4200);
  };

  // Modals
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const walletDropdownRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  const fetchWallets = refreshWallets;

  const fetchTransactions = async () => {
    if (transactions.length === 0) {
      setLoading(true);
    }
    try {
      const res = await fetch("/api/finance/transactions?limit=1000");
      const data = await res.json();
      const txList = data.transactions ?? [];
      setTransactions(txList);
      setCache("moneydocs_transactions", txList, 30_000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
    fetchTransactions();

    // Use sessionStorage cache to avoid redundant fetches on page revisit
    const cachedUser = getCache<{ baseCurrency: string }>(CACHE_KEYS.USER);
    if (cachedUser?.baseCurrency) {
      setUserCurrency(cachedUser.baseCurrency);
    } else {
      fetch("/api/finance/user")
        .then((r) => r.json())
        .then((d) => {
          if (d.user?.baseCurrency) {
            setUserCurrency(d.user.baseCurrency);
            setCache(CACHE_KEYS.USER, d.user, CACHE_TTL.USER);
          }
        });
    }

    const cachedRates = getCache<Record<string, number>>(CACHE_KEYS.EXCHANGE_RATES);
    if (cachedRates) {
      setRates(cachedRates);
    } else {
      fetch("/api/finance/exchange-rates")
        .then((r) => r.json())
        .then((d) => {
          if (d.rates) {
            setRates(d.rates);
            setCache(CACHE_KEYS.EXCHANGE_RATES, d.rates, CACHE_TTL.EXCHANGE_RATES);
          }
        });
    }

    const onAdded = () => {
      fetchTransactions();
      fetchWallets();
    };
    window.addEventListener("transaction-added", onAdded);
    return () => window.removeEventListener("transaction-added", onAdded);
  }, []);

  // Reset custom display currency if selected wallet changes so it matches the newly selected wallet by default
  const prevWalletIdRef = useRef(selectedWalletId);
  useEffect(() => {
    if (prevWalletIdRef.current !== selectedWalletId) {
      prevWalletIdRef.current = selectedWalletId;
      setSelectedDisplayCurrency(null);
    }
  }, [selectedWalletId]);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(e.target as Node)) {
        setWalletDropdownOpen(false);
      }
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setOptionsMenuOpen(false);
        setTimeRangeDropdownOpen(false);
      }
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target as Node)) {
        setCurrencyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedWallet = wallets.find((w) => w._id === selectedWalletId);
  const activeCurrency = selectedWallet ? selectedWallet.currency : userCurrency;
  const viewCurrency = selectedDisplayCurrency || activeCurrency;

  const toViewCurrency = (tx: Transaction): number => {
    const normTx = tx.currency === "NTD" ? "TWD" : tx.currency;
    const normView = viewCurrency === "NTD" ? "TWD" : viewCurrency;
    if (normTx === normView) return tx.amount;
    if (rates && Object.keys(rates).length > 0) {
      return convertCurrency(tx.amount, tx.currency, viewCurrency, rates);
    }
    if (viewCurrency === "IDR") return tx.convertedAmountIDR;
    const idrAmount = tx.convertedAmountIDR || convertCurrency(tx.amount, tx.currency, "IDR");
    return convertCurrency(idrAmount, "IDR", viewCurrency, rates);
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    const activeTab =
      periodTabs.find((t) => t.id === selectedPeriodId) ||
      periodTabs.find((t) => t.id === "offset_0");

    // When viewing ALL wallets, exclude transactions from "excludeFromTotal" wallets
    const excludedWalletIds =
      selectedWalletId === "ALL"
        ? new Set(wallets.filter((w) => w.excludeFromTotal).map((w) => w._id))
        : new Set<string>();

    return transactions.filter((tx) => {
      if (selectedWalletId !== "ALL") {
        const txWid =
          typeof tx.walletId === "string"
            ? tx.walletId
            : typeof tx.walletId === "object" && tx.walletId
            ? String(tx.walletId._id || "")
            : "";
        if (String(txWid) !== String(selectedWalletId)) return false;
      } else {
        // Exclude transactions belonging to excluded wallets
        const txWid =
          typeof tx.walletId === "string"
            ? tx.walletId
            : typeof tx.walletId === "object" && tx.walletId
            ? String(tx.walletId._id || "")
            : null;
        if (txWid && excludedWalletIds.has(txWid)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (tx.title || "").toLowerCase().includes(q);
        const catMatch = (tx.category || "").toLowerCase().includes(q);
        const subCatMatch = (tx.subCategory || "").toLowerCase().includes(q);
        const catNameMatch = getCategoryDisplayName(tx.category, tx.subCategory).toLowerCase().includes(q);
        if (!titleMatch && !catMatch && !subCatMatch && !catNameMatch) return false;
      }

      const txDate = tx.date && !isNaN(new Date(tx.date).getTime()) ? new Date(tx.date) : new Date();

      if (activeTab) {
        if (activeTab.isFuture) {
          if (activeTab.startDate && txDate < activeTab.startDate) return false;
        } else {
          if (activeTab.startDate && txDate < activeTab.startDate) return false;
          if (activeTab.endDate && txDate > activeTab.endDate) return false;
        }
      }

      if (showOnlyIssues) {
        const issues = getTransactionIssues(tx, wallets);
        if (issues.length === 0) return false;
      }

      return true;
    });
  }, [transactions, selectedWalletId, selectedPeriodId, periodTabs, searchQuery, showOnlyIssues, wallets]);

  // Total transactions with issues in current period (before showOnlyIssues filter)
  const periodIssuesCount = useMemo(() => {
    const activeTab =
      periodTabs.find((t) => t.id === selectedPeriodId) ||
      periodTabs.find((t) => t.id === "offset_0");

    const excludedWalletIds =
      selectedWalletId === "ALL"
        ? new Set(wallets.filter((w) => w.excludeFromTotal).map((w) => w._id))
        : new Set<string>();

    return transactions.filter((tx) => {
      if (selectedWalletId !== "ALL") {
        const txWid =
          typeof tx.walletId === "string" ? tx.walletId : tx.walletId?._id;
        if (txWid !== selectedWalletId) return false;
      } else {
        const txWid =
          typeof tx.walletId === "string" ? tx.walletId : tx.walletId?._id;
        if (txWid && excludedWalletIds.has(txWid)) return false;
      }
      const txDate = tx.date && !isNaN(new Date(tx.date).getTime()) ? new Date(tx.date) : new Date();
      if (activeTab) {
        if (activeTab.isFuture) {
          if (activeTab.startDate && txDate < activeTab.startDate) return false;
        } else {
          if (activeTab.startDate && txDate < activeTab.startDate) return false;
          if (activeTab.endDate && txDate > activeTab.endDate) return false;
        }
      }
      return getTransactionIssues(tx, wallets).length > 0;
    }).length;
  }, [transactions, selectedWalletId, selectedPeriodId, periodTabs, wallets]);

  // Transactions in current period across ALL wallets that have no wallet assigned or deleted wallet
  const periodUnassignedWalletsCount = useMemo(() => {
    const activeTab =
      periodTabs.find((t) => t.id === selectedPeriodId) ||
      periodTabs.find((t) => t.id === "offset_0");

    return transactions.filter((tx) => {
      const txDate = tx.date && !isNaN(new Date(tx.date).getTime()) ? new Date(tx.date) : new Date();
      if (activeTab) {
        if (activeTab.isFuture) {
          if (activeTab.startDate && txDate < activeTab.startDate) return false;
        } else {
          if (activeTab.startDate && txDate < activeTab.startDate) return false;
          if (activeTab.endDate && txDate > activeTab.endDate) return false;
        }
      }
      const rawWid =
        typeof tx.walletId === "string"
          ? tx.walletId
          : typeof tx.walletId === "object" && tx.walletId
          ? String(tx.walletId._id || "")
          : "";
      return !rawWid || rawWid.trim() === "" || !wallets.some((w) => String(w._id) === String(rawWid));
    }).length;
  }, [transactions, selectedPeriodId, periodTabs, wallets]);

  // Inflow, Outflow, Net
  const { inflow, outflow, net } = useMemo(() => {
    let inf = 0;
    let out = 0;
    filteredTransactions.forEach((tx) => {
      const amt = toViewCurrency(tx);
      const isLoan = isLoanCategory(tx.category, tx.subCategory);
      if (tx.type === "INCOME" || (tx.type === "DEBT" && isLoan)) inf += amt;
      else if (tx.type === "EXPENSE") out += amt;
    });
    return { inflow: inf, outflow: out, net: inf - out };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTransactions, viewCurrency, rates]);

  // Balance
  const totalBalance = useMemo(() => {
    if (selectedWallet) {
      if (selectedWallet.currency === viewCurrency) return selectedWallet.balance;
      return convertCurrency(selectedWallet.balance || 0, selectedWallet.currency, viewCurrency, rates);
    }
    return wallets.reduce((sum, w) => {
      return sum + convertCurrency(w.balance || 0, w.currency, viewCurrency, rates);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWallet, wallets, viewCurrency, rates]);

  // Group by day
  const groupedByDay = useMemo(() => {
    const groups: Record<string, { date: Date; items: Transaction[]; netDay: number; hasIssues: boolean }> = {};

    filteredTransactions.forEach((tx) => {
      const parsedDate = tx.date ? new Date(tx.date) : new Date();
      const d = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const issues = getTransactionIssues(tx, wallets);
      if (!groups[key]) groups[key] = { date: d, items: [], netDay: 0, hasIssues: false };
      groups[key].items.push(tx);
      if (issues.length > 0) groups[key].hasIssues = true;

      const amt = toViewCurrency(tx);
      const isLoan = isLoanCategory(tx.category, tx.subCategory);
      if (tx.type === "INCOME" || (tx.type === "DEBT" && isLoan)) groups[key].netDay += amt;
      else if (tx.type === "EXPENSE") groups[key].netDay -= amt;
    });

    return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTransactions, viewCurrency, rates, wallets]);

  // Group by Category
  const groupedByCategory = useMemo(() => {
    const groups: Record<
      string,
      {
        category: string;
        subCategory?: string;
        items: Transaction[];
        total: number;
        type: string;
        isMissingOrInvalidCategory: boolean;
      }
    > = {};

    filteredTransactions.forEach((tx) => {
      const catKey = tx.category || "uncategorized";
      const key = `${catKey}_${tx.subCategory || "all"}`;
      const catStatus = checkCategoryStatus(tx.category, tx.subCategory);
      const isMissingOrInvalid =
        catStatus.isCategoryMissing ||
        catStatus.isCategoryNotFound ||
        catStatus.isSubCategoryNotFound;

      if (!groups[key]) {
        groups[key] = {
          category: tx.category || "uncategorized",
          subCategory: tx.subCategory,
          items: [],
          total: 0,
          type: tx.type || "EXPENSE",
          isMissingOrInvalidCategory: isMissingOrInvalid,
        };
      }
      groups[key].items.push(tx);
      const amt = toViewCurrency(tx);
      if (tx.type === "EXPENSE") groups[key].total += amt;
      else if (tx.type === "INCOME") groups[key].total += amt;
      else groups[key].total += amt;
    });

    return Object.values(groups).sort((a, b) => {
      if (a.isMissingOrInvalidCategory && !b.isMissingOrInvalidCategory) return -1;
      if (!a.isMissingOrInvalidCategory && b.isMissingOrInvalidCategory) return 1;
      return b.total - a.total;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTransactions, viewCurrency, rates]);

  const getDayHeading = (date: Date) => {
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const dayName = isToday
      ? "Today"
      : isYesterday
      ? "Yesterday"
      : date.toLocaleDateString("en-US", { weekday: "long" });

    const monthYear = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return { dayNumber: String(date.getDate()).padStart(2, "0"), dayName, monthYear };
  };

  const handleSynchronize = async () => {
    setOptionsMenuOpen(false);
    setIsSyncing(true);
    try {
      await fetch("/api/finance/wallets/sync", { method: "POST" }).catch(() => {});
      await Promise.all([fetchTransactions(), fetchWallets()]);
      setSyncToast("Data synchronized successfully!");
      setTimeout(() => setSyncToast(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTxIds.length === 0) return;

    try {
      const res = await fetch("/api/finance/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedTxIds }),
      });
      if (res.ok) {
        setSelectedTxIds([]);
        setIsBulkDeleteMode(false);
        setShowBulkDeleteConfirm(false);
        fetchTransactions();
        fetchWallets();
      }
    } catch {
      toast("Failed to delete transactions", "error");
    }
  };

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTxIds.length === filteredTransactions.length) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(filteredTransactions.map((tx) => tx._id));
    }
  };

  const walletLabel = selectedWallet ? selectedWallet.name : "Global";
  const activeCurrencyDisplay = getCurrencyDisplayCode(activeCurrency);

  if (loading && transactions.length === 0) {
    return (
      <PageLoading
        title="Loading Transactions..."
        subtitle="Fetching financial records & categories"
      />
    );
  }

  return (
    <div className="px-4 pt-3 pb-nav-safe max-w-lg mx-auto space-y-4">
      {/* Toast Alert */}
      {syncToast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 text-white font-bold text-xs rounded-full shadow-xl flex items-center gap-2 animate-bounce"
          style={{ backgroundColor: "var(--color-primary)", boxShadow: "var(--color-primary-glow)" }}
        >
          <Check className="w-4 h-4" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* â”€â”€ Top Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isBulkDeleteMode ? (
        <div className="flex items-center justify-between py-1 bg-[#1a1c24] px-3 rounded-2xl border border-white/10 animate-fade-in">
          <button
            onClick={() => {
              setIsBulkDeleteMode(false);
              setSelectedTxIds([]);
            }}
            className="text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <span className="text-xs font-bold text-white">
            {selectedTxIds.length} selected
          </span>
          <button
            onClick={toggleSelectAll}
            className="text-xs font-semibold text-[var(--color-primary-light)] hover:opacity-80"
          >
            {selectedTxIds.length === filteredTransactions.length ? "Deselect All" : "Select All"}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between py-1">
          <button
            type="button"
            onClick={handleStartTour}
            className="relative w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer group"
            title="Interactive Tour & Guide"
            aria-label="Start Onboarding Spotlight Tour"
          >
            <HelpCircle className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-primary-light,#34d399)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--color-primary,#10b981)]" />
            </span>
          </button>

          {/* Wallet Switcher Pill with Global internet icon */}
          <WalletSwitcher />

          {/* Right: Search & 3-Dot Options */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen((s) => !s)}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* 3-Dot Options Menu */}
            <div className="relative" ref={optionsMenuRef}>
              <button
                onClick={() => setOptionsMenuOpen((v) => !v)}
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {optionsMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-[60] w-56 bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl py-2 divide-y divide-white/6 animate-fade-in text-sm text-slate-200">
                  <div className="py-1">
                    {/* 1. Select time range */}
                    <div className="relative">
                      <button
                        onClick={() => setTimeRangeDropdownOpen((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <CalendarIcon size={16} color="#94a3b8" />
                          <span>Select time range</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </button>

                      {timeRangeDropdownOpen && (
                        <div className="bg-[#21242d] px-2 py-1.5 mx-2 rounded-xl space-y-1 mb-1 border border-white/8">
                          {(["DAY", "WEEK", "MONTH", "QUARTER", "YEAR"] as const).map((r) => (
                            <button
                              key={r}
                              onClick={() => {
                                setTimeRangeUnit(r);
                                setSelectedPeriodId("offset_0");
                                setTimeRangeDropdownOpen(false);
                                setOptionsMenuOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                                timeRangeUnit === r
                                  ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]"
                                  : "text-slate-300 hover:bg-white/5"
                              }`}
                            >
                              <span>{r === "DAY" ? "Day" : r === "WEEK" ? "Week" : r === "MONTH" ? "Month" : r === "QUARTER" ? "Quarter" : "Year"}</span>
                              {timeRangeUnit === r && <Check className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 2. View by category */}
                    <button
                      onClick={() => {
                        setViewMode((m) => (m === "BY_DAY" ? "BY_CATEGORY" : "BY_DAY"));
                        setOptionsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                    >
                      <Layers className="w-4 h-4 text-slate-400" />
                      <span>{viewMode === "BY_DAY" ? "View by category" : "View by day"}</span>
                    </button>

                    {/* 3. Adjust Balance */}
                    {canEditBalance && (
                      <button
                        onClick={() => {
                          setOptionsMenuOpen(false);
                          const targetId = selectedWalletId !== "ALL" ? selectedWalletId : wallets[0]?._id;
                          router.push(`/transactions/adjust-balance${targetId ? `?walletId=${targetId}` : ""}`);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                      >
                        <Sliders className="w-4 h-4 text-slate-400" />
                        <span>Adjust Balance</span>
                      </button>
                    )}

                    {/* 4. Delete transactions */}
                    {canDeleteTransactions && (
                      <button
                        onClick={() => {
                          setIsBulkDeleteMode(true);
                          setOptionsMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/10 text-red-400 transition-colors text-left"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete transactions</span>
                      </button>
                    )}
                  </div>

                  <div className="py-1">
                    {/* 5. Transfer money */}
                    <button
                      onClick={() => {
                        setIsTransferModalOpen(true);
                        setOptionsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                    >
                      <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                      <span>Transfer money</span>
                    </button>

                    {/* 6. Synchronize */}
                    <button
                      onClick={handleSynchronize}
                      disabled={isSyncing}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                    >
                      <RefreshCw className={`w-4 h-4 text-slate-400 ${isSyncing ? "animate-spin text-[var(--color-primary-light)]" : ""}`} />
                      <span>{isSyncing ? "Synchronizing…" : "Synchronize"}</span>
                    </button>

                    {/* 7. Edit wallet */}
                    <button
                      onClick={() => {
                        setIsWalletModalOpen(true);
                        setOptionsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                    >
                      <Edit3 className="w-4 h-4 text-slate-400" />
                      <span>Edit wallet</span>
                    </button>

                    {/* 8. Share wallet */}
                    <button
                      onClick={() => {
                        setIsShareModalOpen(true);
                        setOptionsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                    >
                      <Share2 className="w-4 h-4 text-slate-400" />
                      <span>Share wallet</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Input */}
      {searchOpen && (
        <div className="flex items-center gap-2 bg-[#1b1d24] border border-white/10 rounded-2xl px-3 py-2 animate-fade-in">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search this period..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none"
            autoFocus
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}>
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      )}

      {/* Balance Summary */}
      <div id="spotlight-balance-section" className="text-center pt-1 pb-2">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Balance</p>
        <h1 className="text-white text-3xl font-extrabold tracking-tight mt-0.5">
          {formatMoney(totalBalance, viewCurrency)}
        </h1>
        
        {/* Currency Switcher Dropdown matching user image */}
        <div className="relative inline-block mt-1.5" ref={currencyDropdownRef}>
          <button
            type="button"
            onClick={() => setCurrencyDropdownOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1b1d24] border border-white/8 hover:border-white/15 transition-all text-xs font-bold text-slate-200 cursor-pointer shadow-sm active:scale-95"
            aria-label="Change currency"
          >
            <span>{getCurrencyDisplayCode(viewCurrency)}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                currencyDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {currencyDropdownOpen && (
            <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-[70] w-60 max-h-64 bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto animate-fade-in py-1 divide-y divide-white/6 text-left">
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

      {/* Horizontally scrollable period tabs */}
      <div id="spotlight-period-tabs" className="flex items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-white/8 text-xs font-bold tracking-wider px-2 scroll-smooth">
        {periodTabs.map((tab) => {
          const isActive = selectedPeriodId === tab.id;
          return (
            <button
              key={tab.id}
              ref={isActive ? activeTabRef : null}
              onClick={() => setSelectedPeriodId(tab.id)}
              className={`flex-shrink-0 px-3 pb-3 text-center transition-colors relative whitespace-nowrap ${
                isActive ? "text-white font-extrabold" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-white rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Inflow / Outflow Summary Card */}
      <div id="spotlight-cashflow-card" className="money-card p-4 bg-[#141519] border border-white/8 rounded-2xl space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Inflow</span>
          <span className="text-sky-400 font-bold">{formatMoney(inflow, viewCurrency)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Outflow</span>
          <span className="text-red-400 font-bold">{formatMoney(outflow, viewCurrency)}</span>
        </div>

        <div className="border-t border-white/8 pt-1 flex justify-end">
          <span className={`text-sm font-extrabold ${net >= 0 ? "text-slate-200" : "text-white"}`}>
            {net >= 0 ? "+" : ""}
            {formatMoney(net, viewCurrency)}
          </span>
        </div>

        <div className="pt-2 text-center">
          {(() => {
            const activePeriodTab =
              periodTabs.find((t) => t.id === selectedPeriodId) ||
              periodTabs.find((t) => t.id === "offset_0");
            const startParam = activePeriodTab?.startDate
              ? `&startDate=${encodeURIComponent(activePeriodTab.startDate.toISOString())}`
              : "";
            const endParam = activePeriodTab?.endDate
              ? `&endDate=${encodeURIComponent(activePeriodTab.endDate.toISOString())}`
              : "";
            const labelParam = activePeriodTab?.label
              ? `&label=${encodeURIComponent(activePeriodTab.label)}`
              : "";

            return (
              <Link
                href={`/transactions/report?period=${
                  selectedPeriodId === "offset_-1"
                    ? "LAST_MONTH"
                    : selectedPeriodId === "offset_1"
                    ? "FUTURE"
                    : "THIS_MONTH"
                }&unit=${timeRangeUnit}&periodId=${selectedPeriodId}&wallet=${selectedWalletId}&currency=${viewCurrency}${startParam}${endParam}${labelParam}`}
                className="block w-full py-2.5 rounded-full text-xs font-bold tracking-wide transition-opacity hover:opacity-90 border"
                style={{
                  backgroundColor: "var(--color-primary-subtle)",
                  borderColor: "var(--color-primary-border)",
                  color: "var(--color-primary-light)",
                }}
              >
                View report for this period
              </Link>
            );
          })()}
        </div>
      </div>

      {/* Warning Banners for Issues and Unassigned Wallets */}
      {selectedWalletId !== "ALL" && periodUnassignedWalletsCount > 0 && (
        <div className="bg-sky-500/10 border border-sky-500/25 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0 text-slate-300">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
              <WalletGraphic size={16} />
            </div>
            <span className="truncate">
              {periodUnassignedWalletsCount} transaction{periodUnassignedWalletsCount !== 1 ? "s" : ""} in this period have no wallet assigned.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedWalletId("ALL")}
            className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold text-[11px] whitespace-nowrap cursor-pointer transition-colors"
          >
            View in Global
          </button>
        </div>
      )}

      {periodIssuesCount > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/25 rounded-2xl p-3.5 flex items-start gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-white text-xs font-bold">
                {periodIssuesCount} transaction{periodIssuesCount !== 1 ? "s" : ""} need attention
              </p>
              <button
                type="button"
                onClick={() => setShowOnlyIssues((v) => !v)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                  showOnlyIssues
                    ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
                    : "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30"
                }`}
              >
                {showOnlyIssues ? "Show All" : "Filter Issues"}
              </button>
            </div>
            <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">
              Some transactions have missing or non-existent categories or wallets. Tap any item to fix its details.
            </p>
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div id="spotlight-transactions-list" className="space-y-4 pt-1">
        {selectedWalletId !== "ALL" && !activeWalletPermissions.transactions.read ? (
          <div className="text-center py-16 px-4 bg-[#141519] border border-white/8 rounded-3xl max-w-sm mx-auto animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-3 shadow-lg shadow-amber-500/5">
              <Lock className="w-7 h-7" />
            </div>
            <p className="text-white text-base font-bold mb-1">Access Restricted</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              You do not have permission to view transactions for this wallet.
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="text-3xl mb-2">{showOnlyIssues ? "🎉" : "📋"}</p>
            <p className="text-sm font-medium text-slate-400">
              {showOnlyIssues ? "All transactions look good!" : "No transactions in this period"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {showOnlyIssues
                ? "No missing categories or wallet issues found."
                : "Tap + below to add a transaction"}
            </p>
            {showOnlyIssues && (
              <button
                type="button"
                onClick={() => setShowOnlyIssues(false)}
                className="mt-3 text-xs font-bold text-[var(--color-primary-light)] hover:underline cursor-pointer"
              >
                View all transactions
              </button>
            )}
          </div>
        ) : viewMode === "BY_CATEGORY" ? (
          /* View By Category */
          <div className="space-y-3">
            {groupedByCategory.map((catGroup) => (
              <div
                key={`${catGroup.category}_${catGroup.subCategory}`}
                className={`bg-[#141519] border ${
                  catGroup.isMissingOrInvalidCategory
                    ? "border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.08)]"
                    : "border-white/8"
                } rounded-2xl overflow-hidden shadow-sm`}
              >
                <div
                  className={`flex items-center justify-between px-4 py-3 border-b ${
                    catGroup.isMissingOrInvalidCategory
                      ? "border-amber-500/20 bg-amber-500/10"
                      : "border-white/6 bg-[#171920]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon categoryId={catGroup.category} subCategoryId={catGroup.subCategory} size="md" />
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-white text-sm font-bold">
                          {getCategoryDisplayName(catGroup.category, catGroup.subCategory)}
                        </p>
                        {catGroup.isMissingOrInvalidCategory && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Category doesn't exist
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs">
                        {catGroup.items.length} {catGroup.items.length === 1 ? "transaction" : "transactions"}
                        {catGroup.isMissingOrInvalidCategory && " • Needs attention"}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${catGroup.type === "INCOME" ? "text-sky-400" : "text-red-400"}`}>
                    {catGroup.type === "INCOME" ? "+" : "-"}
                    {formatMoney(catGroup.total, viewCurrency)}
                  </span>
                </div>

                <div className="divide-y divide-white/4">
                  {catGroup.items.map((tx) => {
                    const isSelected = selectedTxIds.includes(tx._id);
                    const convertedAmt = toViewCurrency(tx);
                    const issues = getTransactionIssues(tx, wallets);
                    const isLoan = isLoanCategory(tx.category, tx.subCategory);
                    const repaid = Number(tx.debtRepaidAmount) || 0;
                    const remaining = Math.max(0, tx.amount - repaid);
                    const isDebtPaid = tx.type === "DEBT" && (repaid >= tx.amount || tx.debtStatus === "PAID");

                    return (
                      <div
                        key={tx._id}
                        onClick={() => {
                          if (isBulkDeleteMode) {
                            toggleSelectTx(tx._id);
                          } else {
                            router.push(`/transactions/${tx._id}`);
                          }
                        }}
                        className={`flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer ${
                          issues.length > 0 ? "bg-amber-500/[0.04] border-l-2 border-l-amber-400" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isBulkDeleteMode && (
                            <button type="button" className="text-slate-400 hover:text-white">
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-[var(--color-primary-light)]" />
                              ) : (
                                <Square className="w-5 h-5" />
                              )}
                            </button>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-white text-xs font-semibold">{tx.title || getCategoryDisplayName(tx.category, tx.subCategory)}</p>
                              {tx.eventName && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/20">
                                  {tx.eventName}
                                </span>
                              )}
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
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                              <span>{tx.date ? new Date(tx.date).toLocaleDateString() : "No date"}</span>
                              {tx.withPeople && tx.withPeople.length > 0 && (
                                <span>• with {tx.withPeople.join(", ")}</span>
                              )}
                              {issues.length > 0 && (
                                <span className="text-amber-400 font-semibold">• Tap to fix</span>
                              )}
                            </div>
                            {tx.type === "DEBT" && (
                              <div className="mt-1 pt-1 border-t border-white/5 flex items-center gap-1.5 text-[11px] flex-wrap">
                                {isDebtPaid ? (
                                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    <span>{isLoan ? "Fully returned" : "Fully paid"} ({formatMoney(repaid, tx.currency)})</span>
                                  </span>
                                ) : repaid > 0 ? (
                                  <span className="text-amber-400/90 font-medium">
                                    {isLoan ? "Returned: " : "Paid: "}
                                    <strong className="text-white font-semibold">{formatMoney(repaid, tx.currency)}</strong>
                                    {" • "}Remaining: <strong className="text-amber-300 font-semibold">{formatMoney(remaining, tx.currency)}</strong>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">
                                    {isLoan ? "Loan to return" : "Debt to pay"} • Remaining: {formatMoney(tx.amount, tx.currency)}
                                  </span>
                                )}
                                {tx.debtPayments && tx.debtPayments.length > 0 && (
                                  <span className="text-slate-400 text-[10px]">
                                    • {tx.debtPayments.length} payment{tx.debtPayments.length > 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-xs font-bold ${
                              isDebtPaid
                                ? "line-through text-slate-500 opacity-70"
                                : tx.type === "INCOME" || (tx.type === "DEBT" && isLoan)
                                ? "text-sky-400"
                                : "text-red-400"
                            }`}
                          >
                            {tx.type === "INCOME" || (tx.type === "DEBT" && isLoan) ? "+" : "-"}
                            {formatMoney(convertedAmt, viewCurrency)}
                          </span>
                          {isDebtPaid && (
                            <p className="text-[10px] text-emerald-400 font-bold">
                              ✓ {isLoan ? "Returned" : "Paid"}
                            </p>
                          )}
                          {tx.eventCurrency && tx.eventCurrency !== tx.currency && rates && Object.keys(rates).length > 0 && (
                            <p className="text-[10px] text-amber-300/80 font-medium">
                              {formatMoney(convertCurrency(tx.amount, tx.currency, tx.eventCurrency, rates), tx.eventCurrency)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* View By Day */
          groupedByDay.map(([dayKey, group]) => {
            const { dayNumber, dayName, monthYear } = getDayHeading(group.date);

            return (
              <div
                key={dayKey}
                className="bg-[#141519] border border-white/8 rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Day Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/6 bg-[#171920]">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-extrabold text-white tracking-tight">
                      {dayNumber}
                    </span>
                    <div>
                      <p className="text-white text-xs font-bold leading-tight">{dayName}</p>
                      <p className="text-slate-400 text-[11px] leading-tight">{monthYear}</p>
                    </div>
                  </div>

                  <span
                    className={`text-sm font-bold ${
                      group.netDay >= 0 ? "text-slate-200" : "text-white"
                    }`}
                  >
                    {group.netDay >= 0 ? "+" : ""}
                    {formatMoney(group.netDay, viewCurrency)}
                  </span>
                </div>

                {/* Day Transactions */}
                <div className="divide-y divide-white/4">
                  {group.items.map((tx) => {
                    const isExpense = tx.type === "EXPENSE";
                    const isIncome = tx.type === "INCOME";
                    const isLoan = isLoanCategory(tx.category, tx.subCategory);
                    const repaid = Number(tx.debtRepaidAmount) || 0;
                    const remaining = Math.max(0, tx.amount - repaid);
                    const isDebtPaid = tx.type === "DEBT" && (repaid >= tx.amount || tx.debtStatus === "PAID");

                    const convertedAmt = toViewCurrency(tx);
                    const normTxCurr = tx.currency === "NTD" ? "TWD" : tx.currency;
                    const normViewCurr = viewCurrency === "NTD" ? "TWD" : viewCurrency;
                    const showOriginal = normTxCurr !== normViewCurr;
                    const isSelected = selectedTxIds.includes(tx._id);
                    const issues = getTransactionIssues(tx, wallets);

                    return (
                      <div
                        key={tx._id}
                        onClick={() => {
                          if (isBulkDeleteMode) {
                            toggleSelectTx(tx._id);
                          } else {
                            router.push(`/transactions/${tx._id}`);
                          }
                        }}
                        className={`flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer ${
                          issues.length > 0 ? "bg-amber-500/[0.04] border-l-2 border-l-amber-400" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          {isBulkDeleteMode && (
                            <button type="button" className="text-slate-400 hover:text-white">
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-[var(--color-primary-light)]" />
                              ) : (
                                <Square className="w-5 h-5" />
                              )}
                            </button>
                          )}
                          <CategoryIcon
                            categoryId={tx.category}
                            subCategoryId={tx.subCategory}
                            size="md"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-white text-sm font-semibold">
                                {getCategoryDisplayName(tx.category, tx.subCategory)}
                              </p>
                              {tx.eventName && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/20">
                                  {tx.eventName}
                                </span>
                              )}
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
                            {tx.title &&
                              tx.title !== getCategoryDisplayName(tx.category, tx.subCategory) && (
                                <p className="text-slate-400 text-xs truncate max-w-[170px]">
                                  {tx.title}
                                </p>
                              )}
                            {tx.withPeople && tx.withPeople.length > 0 && (
                              <p className="text-[11px] text-slate-400">
                                with {tx.withPeople.join(", ")}
                              </p>
                            )}
                            {issues.length > 0 && (
                              <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                                <span>Tap to fix this transaction</span>
                              </p>
                            )}
                            {tx.type === "DEBT" && (
                              <div className="mt-1 pt-1 border-t border-white/5 flex items-center gap-1.5 text-[11px] flex-wrap">
                                {isDebtPaid ? (
                                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    <span>{isLoan ? "Fully returned" : "Fully paid"} ({formatMoney(repaid, tx.currency)})</span>
                                  </span>
                                ) : repaid > 0 ? (
                                  <span className="text-amber-400/90 font-medium">
                                    {isLoan ? "Returned: " : "Paid: "}
                                    <strong className="text-white font-semibold">{formatMoney(repaid, tx.currency)}</strong>
                                    {" • "}Remaining: <strong className="text-amber-300 font-semibold">{formatMoney(remaining, tx.currency)}</strong>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">
                                    {isLoan ? "Loan to return" : "Debt to pay"} • Remaining: {formatMoney(tx.amount, tx.currency)}
                                  </span>
                                )}
                                {tx.debtPayments && tx.debtPayments.length > 0 && (
                                  <span className="text-slate-400 text-[10px]">
                                    • {tx.debtPayments.length} payment{tx.debtPayments.length > 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <p
                            className={`text-sm font-bold tracking-tight ${
                              isDebtPaid
                                ? "line-through text-slate-500 opacity-70"
                                : isIncome || (tx.type === "DEBT" && isLoan)
                                ? "text-sky-400"
                                : isExpense
                                ? "text-red-400"
                                : "text-amber-400"
                            }`}
                          >
                            {isIncome || (tx.type === "DEBT" && isLoan) ? "+" : isExpense ? "-" : ""}
                            {formatMoney(convertedAmt, viewCurrency)}
                          </p>
                          {isDebtPaid && (
                            <p className="text-[10px] text-emerald-400 font-bold">
                              ✓ {isLoan ? "Returned" : "Paid"}
                            </p>
                          )}
                          {showOriginal && (
                            <p className="text-[10px] text-slate-500">
                              {isExpense ? "-" : isIncome || (tx.type === "DEBT" && isLoan) ? "+" : ""}
                              {formatMoney(tx.amount, tx.currency)}
                            </p>
                          )}
                          {tx.eventCurrency && tx.eventCurrency !== tx.currency && rates && Object.keys(rates).length > 0 && (
                            <p className="text-[10px] text-amber-300/80 font-medium">
                              {formatMoney(convertCurrency(tx.amount, tx.currency, tx.eventCurrency, rates), tx.eventCurrency)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bulk Delete Floating Button */}
      {isBulkDeleteMode && selectedTxIds.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto z-[60] animate-fade-in">
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-2xl shadow-2xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Selected ({selectedTxIds.length})</span>
          </button>
        </div>
      )}

      {/* Share Wallet Modal */}
      <ShareWalletModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        wallet={selectedWallet || (wallets[0] ?? null)}
        onUpdated={fetchWallets}
      />

      {/* Transfer Modal */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        wallets={wallets}
        onTransferred={() => {
          fetchTransactions();
          fetchWallets();
        }}
      />

      {/* Edit Wallet Modal */}
      <WalletManagerModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        wallets={wallets}
        onWalletUpdated={fetchWallets}
      />

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowBulkDeleteConfirm(false)}
          />
          <div className="relative z-10 w-full max-w-sm bg-[#1a1c24] border border-white/10 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white text-base font-bold">Delete {selectedTxIds.length} transaction{selectedTxIds.length !== 1 ? "s" : ""}?</h3>
              <p className="text-slate-400 text-xs mt-1">
                These transactions will be permanently removed and wallet balances will be rolled back.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shadow-lg shadow-red-600/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Celebratory Confetti & Toast */}
      {showCelebration && (
        <ConfettiEffect
          duration={3800}
          particleCount={140}
          onComplete={() => setShowCelebration(false)}
        />
      )}

      {showCelebrationToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#1a1c24]/95 border border-[var(--color-primary-border)] text-[var(--color-primary-light)] shadow-2xl backdrop-blur-xl animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center text-base">
            🎉
          </div>
          <div>
            <p className="text-xs font-bold text-white tracking-wide">
              You're all set! Onboarding Complete
            </p>
            <p className="text-[11px] text-slate-400">
              Tap the <span className="text-[var(--color-primary-light)] font-semibold">?</span> icon anytime if you need a walkthrough.
            </p>
          </div>
        </div>
      )}

      {/* Onboarding Spotlight Tour */}
      <OnboardingSpotlight
        isOpen={tourOpen}
        steps={ONBOARDING_STEPS}
        currentStep={currentTourStep}
        onNext={handleNextTourStep}
        onPrev={handlePrevTourStep}
        onClose={() => setTourOpen(false)}
        onComplete={handleCompleteTour}
        padding={10}
      />
    </div>
  );
}
