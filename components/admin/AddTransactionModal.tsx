"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Wallet as WalletIcon,
  AlignLeft,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Trash2,
  ChevronDown,
  Check,
  Users,
  Briefcase,
  Sparkles,
} from "lucide-react";
import { useAdminModal } from "@/hooks/useAdminModal";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import {
  SUPPORTED_CURRENCIES,
  convertCurrency,
  formatMoney,
  CURRENCY_INFO,
  SupportedCurrency,
  getCurrencyDisplayCode,
} from "@/lib/currency";
import { getCategoryDisplayName } from "@/lib/categories";
import CategoryIcon from "@/components/ui/CategoryIcon";
import CategoryPickerModal from "./CategoryPickerModal";
import WithPeopleModal from "./WithPeopleModal";
import SelectEventModal from "./SelectEventModal";
import CustomKeypad, { safeEvaluateMath } from "./CustomKeypad";
import { useWalletContext } from "@/hooks/useWalletContext";
import CurrencyFlag from "@/components/admin/CurrencyFlag";
import { CalendarIcon, CustomDatePicker } from "@/components/ui/AppIcons";

type TabType = "EXPENSE" | "INCOME" | "DEBT";

export default function AddTransactionModal() {
  const router = useRouter();
  const { isOpen, closeModal } = useAdminModal();
  const [activeTab, setActiveTab] = useState<TabType>("EXPENSE");

  // ── Use the global wallet list + selected wallet ──────────────────────────
  const {
    wallets,
    selectedWalletId: globalSelectedWalletId,
    refreshWallets,
    getPermissionsForWallet,
  } = useWalletContext();

  const creatableWallets = useMemo(() => {
    return (wallets as any[]).filter((w) => getPermissionsForWallet(w._id).transactions.create);
  }, [wallets, getPermissionsForWallet]);

  const [rates, setRates] = useState<Record<string, number>>({});

  const [rawAmount, setRawAmount] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [walletCurrency, setWalletCurrency] = useState("IDR");
  const [walletId, setWalletId] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState<string | undefined>(undefined);
  const [autoAppliedInfo, setAutoAppliedInfo] = useState<{
    category: string;
    subCategory?: string;
    description?: string;
    count: number;
    forAmount: number;
  } | null>(null);
  const [isUserManualCategory, setIsUserManualCategory] = useState(false);
  const [isUserManualDescription, setIsUserManualDescription] = useState(false);
  const [frequentSuggestions, setFrequentSuggestions] = useState<
    Record<
      string,
      { category: string; subCategory?: string; description?: string; count: number }
    >
  >({});
  const autoAppliedRef = useRef<typeof autoAppliedInfo>(null);
  const isUserManualCategoryRef = useRef(false);
  const isUserManualDescriptionRef = useRef(false);
  const rawAmountRef = useRef(rawAmount);

  useEffect(() => {
    autoAppliedRef.current = autoAppliedInfo;
  }, [autoAppliedInfo]);

  useEffect(() => {
    isUserManualCategoryRef.current = isUserManualCategory;
  }, [isUserManualCategory]);

  useEffect(() => {
    isUserManualDescriptionRef.current = isUserManualDescription;
  }, [isUserManualDescription]);

  useEffect(() => {
    rawAmountRef.current = rawAmount;
  }, [rawAmount]);
  const [description, setDescription] = useState("");
  const [isDescFocused, setIsDescFocused] = useState(false);
  const [allDescriptions, setAllDescriptions] = useState<string[]>([]);
  const [showAllDescriptions, setShowAllDescriptions] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [tags, setTags] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const [debtParty, setDebtParty] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");
  const [debtInterestRate, setDebtInterestRate] = useState("");

  const [withPeople, setWithPeople] = useState<string[]>([]);
  const [isWithModalOpen, setIsWithModalOpen] = useState(false);
  const [eventId, setEventId] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventCurrency, setEventCurrency] = useState("");
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const walletDropdownRef = useRef<HTMLDivElement>(null);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [amountError, setAmountError] = useState(false);
  const [categoryError, setCategoryError] = useState(false);
  const [navigatingToEvents, setNavigatingToEvents] = useState(false);

  const keyboardHeight = useKeyboardOffset();
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const focusScrollTopRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleKeypadSubmitRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (amountError) {
      const evaluated = safeEvaluateMath(rawAmount);
      const numericAmount = parseFloat(evaluated);
      if (numericAmount && numericAmount > 0) {
        setAmountError(false);
      }
    }
  }, [rawAmount, amountError]);

  useEffect(() => {
    if (categoryError && category && category.trim().length > 0) {
      setCategoryError(false);
    }
  }, [category, categoryError]);

  useEffect(() => {
    if (isOpen) {
      setIsKeypadOpen(true);

      // Pick the wallet to pre-select:
      // 1. If a specific wallet is globally selected, use it.
      // 2. Otherwise fall back to the marked-default, then the first wallet.
      if (creatableWallets.length > 0) {
        const preSelected =
          (globalSelectedWalletId !== "ALL" && creatableWallets.find((w) => w._id === globalSelectedWalletId)) ||
          creatableWallets.find((w) => w.isDefault) ||
          creatableWallets[0];
        if (preSelected) {
          setWalletId(preSelected._id);
          setCurrency(preSelected.currency || "IDR");
          setWalletCurrency(preSelected.currency || "IDR");
        }
      } else {
        // Wallets not loaded yet (edge case on very first open) — refresh context
        refreshWallets();
      }

      fetch("/api/finance/exchange-rates")
        .then((r) => r.json())
        .then((d) => { if (d.rates) setRates(d.rates); })
        .catch(() => {});
    } else {
      setIsKeypadOpen(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Physical keyboard support while keypad is open:
  // digits, operators, decimal, backspace, C (clear), Enter, Escape
  useEffect(() => {
    if (!isKeypadOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // Don't intercept if focus is inside a text input / textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Enter") {
        e.preventDefault();
        handleKeypadSubmitRef.current();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsKeypadOpen(false);
        return;
      }
      // Digits 0-9
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setRawAmount((prev) => {
          if (prev === "0") return e.key;
          if (prev.length >= 15) return prev;
          return prev + e.key;
        });
        return;
      }
      // Decimal point
      if (e.key === "." || e.key === ",") {
        e.preventDefault();
        setRawAmount((prev) => {
          if (!prev) return "0.";
          if (prev.includes(".")) return prev;
          return prev + ".";
        });
        return;
      }
      // Operators
      if (e.key === "+" || e.key === "-" || e.key === "*" || e.key === "/") {
        e.preventDefault();
        const op = e.key === "*" ? "×" : e.key === "/" ? "÷" : e.key;
        setRawAmount((prev) => {
          if (!prev) return prev;
          const last = prev[prev.length - 1];
          if (["+", "-", "×", "÷"].includes(last)) return prev.slice(0, -1) + op;
          return prev + op;
        });
        return;
      }
      // Backspace
      if (e.key === "Backspace") {
        e.preventDefault();
        setRawAmount((prev) => prev.slice(0, -1));
        return;
      }
      // C / Delete — clear
      if (e.key === "c" || e.key === "C" || e.key === "Delete") {
        e.preventDefault();
        setRawAmount("");
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKeypadOpen]);

  // Close wallet dropdown on outside click
  useEffect(() => {
    if (!isWalletDropdownOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        walletDropdownRef.current &&
        !walletDropdownRef.current.contains(e.target as Node)
      ) {
        setIsWalletDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [isWalletDropdownOpen]);

  // Close currency dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        currencyDropdownRef.current &&
        !currencyDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCurrencyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  // Fetch frequent suggestions map for the active currency & transaction type
  useEffect(() => {
    if (!isOpen) return;
    const fetchFrequent = async () => {
      try {
        const res = await fetch(
          `/api/finance/transactions/suggest-category?currency=${encodeURIComponent(
            currency
          )}&type=${encodeURIComponent(activeTab)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.suggestions) {
            setFrequentSuggestions(data.suggestions);
          }
        }
      } catch {
        // non-blocking
      }
    };
    fetchFrequent();

    const onTxAdded = () => fetchFrequent();
    window.addEventListener("transaction-added", onTxAdded);
    return () => window.removeEventListener("transaction-added", onTxAdded);
  }, [isOpen, currency, activeTab]);

  // Fetch previous descriptions for smart autocomplete — filtered by exact category + subCategory
  useEffect(() => {
    if (!isOpen) return;
    // Only fetch descriptions if a category has been selected
    if (!category) {
      setAllDescriptions([]);
      setShowAllDescriptions(false);
      return;
    }
    const fetchDescriptions = async () => {
      try {
        const params = new URLSearchParams({ category });
        if (subCategory) params.set("subCategory", subCategory);
        const res = await fetch(`/api/finance/transactions/descriptions?${params}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.descriptions)) {
            setAllDescriptions(data.descriptions);
          }
        }
      } catch {
        // non-blocking
      }
    };
    setShowAllDescriptions(false);
    fetchDescriptions();

    const onTxAdded = () => fetchDescriptions();
    window.addEventListener("transaction-added", onTxAdded);
    return () => window.removeEventListener("transaction-added", onTxAdded);
  }, [isOpen, category, subCategory]);

  // Auto-apply category and description based on transaction frequency (>= 3 transactions)
  useEffect(() => {
    const evaluated = safeEvaluateMath(rawAmount);
    const numericAmount = parseFloat(evaluated);

    if (!numericAmount || numericAmount <= 0) {
      if (autoAppliedRef.current) {
        const t = setTimeout(() => {
          if (!isUserManualCategoryRef.current) {
            setCategory("");
            setSubCategory(undefined);
          }
          if (!isUserManualDescriptionRef.current) {
            setDescription("");
          }
          setAutoAppliedInfo(null);
        }, 0);
        return () => clearTimeout(t);
      }
      return;
    }

    // 1. Instant check against preloaded frequent suggestions
    const cachedMatch = frequentSuggestions[String(numericAmount)];
    if (cachedMatch) {
      const t = setTimeout(() => {
        if (!isUserManualCategoryRef.current) {
          setCategory(cachedMatch.category);
          setSubCategory(cachedMatch.subCategory);
        }
        if (!isUserManualDescriptionRef.current && cachedMatch.description) {
          setDescription(cachedMatch.description);
        }
        setAutoAppliedInfo({
          category: cachedMatch.category,
          subCategory: cachedMatch.subCategory,
          description: cachedMatch.description,
          count: cachedMatch.count,
          forAmount: numericAmount,
        });
      }, 0);
      return () => clearTimeout(t);
    }

    // 2. Debounced fallback in case not yet cached
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/finance/transactions/suggest-category?amount=${numericAmount}&currency=${encodeURIComponent(
            currency
          )}&type=${encodeURIComponent(activeTab)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data?.suggestion) {
          if (!isUserManualCategoryRef.current) {
            setCategory(data.suggestion.category);
            setSubCategory(data.suggestion.subCategory);
          }
          if (!isUserManualDescriptionRef.current && data.suggestion.description) {
            setDescription(data.suggestion.description);
          }
          setAutoAppliedInfo({
            category: data.suggestion.category,
            subCategory: data.suggestion.subCategory,
            description: data.suggestion.description,
            count: data.suggestion.count,
            forAmount: numericAmount,
          });
        } else {
          // If previously auto-applied for an amount that no longer has 3+ frequent category, clear it
          if (autoAppliedRef.current && autoAppliedRef.current.forAmount !== numericAmount) {
            if (!isUserManualCategoryRef.current) {
              setCategory("");
              setSubCategory(undefined);
            }
            if (!isUserManualDescriptionRef.current) {
              setDescription("");
            }
            setAutoAppliedInfo(null);
          }
        }
      } catch {
        // Ignore network errors
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [rawAmount, currency, activeTab, frequentSuggestions]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.+\-*/\u00d7\u00f7]/g, "").slice(0, 16);
    setRawAmount(value);
  };

  const handleDateShift = (days: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + days);
    setSelectedDate(next);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { setError("Image size should be less than 4MB"); return; }
      const reader = new FileReader();
      reader.onload = (ev) => { setReceiptUrl(ev.target?.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setRawAmount(""); setCategory(""); setSubCategory(undefined);
    setDescription(""); setIsUserManualDescription(false); setIsDescFocused(false);
    setSelectedDate(new Date()); setShowMoreDetails(false);
    setTags(""); setReceiptUrl(null); setDebtParty(""); setDebtDueDate("");
    setDebtInterestRate(""); setError(""); setWalletId(""); setIsKeypadOpen(false);
    setIsWalletDropdownOpen(false); setWithPeople([]); setEventId(""); setEventName(""); setEventCurrency("");
    setAutoAppliedInfo(null); setIsUserManualCategory(false); setAmountError(false); setCategoryError(false); setShowAllDescriptions(false);
  };

  const handleClose = () => { resetForm(); closeModal(); };

  const handleManageEvents = () => {
    // Close the SelectEvent overlay and show loading, then close the add modal and navigate
    setIsEventModalOpen(false);
    setNavigatingToEvents(true);
    // Allow exit animation to play (~300ms), then close add modal and navigate
    setTimeout(() => {
      closeModal();
      resetForm();
      router.push("/events");
    }, 320);
  };

  const handleSubmit = async () => {
    const evaluated = safeEvaluateMath(rawAmount);
    const numericAmount = parseFloat(evaluated);
    const isAmountValid = Boolean(numericAmount && numericAmount > 0);
    const isCategoryValid = Boolean(category && category.trim().length > 0);

    if (!isAmountValid || !isCategoryValid) {
      setAmountError(!isAmountValid);
      setCategoryError(!isCategoryValid);
      return;
    }


    setSaving(true); setError("");
    const trimmedDesc = description.trim();
    const payload = {
      type: activeTab,
      title: trimmedDesc || getCategoryDisplayName(category, subCategory),
      amount: numericAmount,
      currency,
      category,
      subCategory: subCategory || undefined,
      walletId: walletId || undefined,
      date: selectedDate.toISOString(),
      description: trimmedDesc || undefined,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      receiptUrl: receiptUrl || undefined,
      debtParty: debtParty.trim() || undefined,
      debtDueDate: debtDueDate || undefined,
      debtInterestRate: debtInterestRate ? parseFloat(debtInterestRate) : undefined,
      eventId: eventId || undefined,
      eventName: eventName || undefined,
      eventCurrency: eventCurrency || undefined,
      withPeople: withPeople.length > 0 ? withPeople : undefined,
    };

    try {
      const res = await fetch("/api/finance/transactions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json(); setError(err.error ?? "Failed to save transaction."); setSaving(false); return; }
      handleClose(); router.refresh();
      if (typeof window !== "undefined") window.dispatchEvent(new Event("transaction-added"));
    } catch { setError("Network error. Please try again."); }
    finally { setSaving(false); }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollTop = e.currentTarget.scrollTop;
    if (isDescFocused) {
      if (currentScrollTop - focusScrollTopRef.current > 30) {
        setIsScrolledDown(true);
      } else if (currentScrollTop - focusScrollTopRef.current <= 10) {
        setIsScrolledDown(false);
      }
    }
  };

  const handleAmountEnter = () => {
    handleKeypadSubmitRef.current = handleAmountEnter;
    if (/[+×÷*/-]/.test(rawAmount)) {
      setRawAmount(safeEvaluateMath(rawAmount));
    }
    setIsKeypadOpen(false);
  };

  const handleSaveFromKeypad = () => {
    if (/[+×÷*/-]/.test(rawAmount)) {
      setRawAmount(safeEvaluateMath(rawAmount));
    }
    setIsKeypadOpen(false);
    handleSubmit();
  };

  /**
   * Format a raw amount string with thousands commas for display.
   * Pure numbers  → "1,000,000.50"
   * Expressions   → shown as-is (e.g. "5000+200")
   */
  const formatDisplayAmount = (val: string): string => {
    if (!val) return "0";
    // If it contains an operator, show expression as-is so the user can see what they typed
    if (/[+\-\u00d7\u00f7*/]/.test(val)) return val;
    const parts = val.split(".");
    // Add commas every 3 digits on the integer part
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  const formattedDateString = selectedDate.toLocaleDateString("en-GB", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
  });

  const selectedWallet = wallets.find((w) => w._id === walletId);
  const numericAmountParsed = parseFloat(rawAmount) || 0;
  const showConversionPreview = numericAmountParsed > 0 && currency !== walletCurrency && walletCurrency && Object.keys(rates).length > 0;
  const convertedPreview = showConversionPreview ? convertCurrency(numericAmountParsed, currency, walletCurrency, rates) : 0;
  const walletCurrencyInfo = CURRENCY_INFO[walletCurrency as keyof typeof CURRENCY_INFO];

  const DESC_COLLAPSED_LIMIT = 6;
  const filteredDescriptions = description.trim()
    ? allDescriptions.filter((d) =>
        d.toLowerCase().includes(description.trim().toLowerCase())
      )
    : allDescriptions;
  const hasMoreDescriptions = filteredDescriptions.length > DESC_COLLAPSED_LIMIT;
  const visibleDescriptions = showAllDescriptions ? filteredDescriptions : filteredDescriptions.slice(0, DESC_COLLAPSED_LIMIT);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose} className="fixed inset-0 bg-black/80 backdrop-blur-sm" />

          <motion.div key="sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative z-[70] w-full max-w-lg mx-auto bg-[#131418] border-t border-white/10 rounded-t-[2.5rem] shadow-2xl flex flex-col h-[94vh] overflow-hidden">

            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <button onClick={handleClose} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-white font-bold text-lg">Add transaction</h2>
              <div className="w-9" />
            </div>

            <div className="px-6 py-2">
              <div className="grid grid-cols-3 p-1 rounded-2xl bg-[#1b1c21] border border-white/6">
                {(["EXPENSE", "INCOME", "DEBT"] as const).map((tab) => {
                  const isActive = activeTab === tab;
                  const label = tab === "EXPENSE" ? "Expense" : tab === "INCOME" ? "Income" : "Debt/Loan";
                  return (
                    <button key={tab} onClick={() => { setActiveTab(tab); setCategory(""); setSubCategory(undefined); setIsUserManualCategory(false); setIsUserManualDescription(false); setAutoAppliedInfo(null); setCategoryError(false); }}
                      className={`py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${isActive ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)] shadow-sm border border-[var(--color-primary-border)]" : "text-slate-400 hover:text-slate-200"}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-6 py-3 space-y-5 pb-4">
              {/* Wallet Row */}
              <div className="flex items-center justify-between py-2 border-b border-white/6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#1d1f25] flex items-center justify-center text-slate-300"><WalletIcon className="w-5 h-5" /></div>
                  <span className="text-white font-medium text-sm">{selectedWallet?.name || "Cash"}</span>
                </div>
                <div className="relative" ref={walletDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsWalletDropdownOpen((v) => !v)}
                    className="flex items-center gap-1.5 bg-[#1d1f25] border border-white/8 hover:border-white/15 rounded-xl px-2.5 py-1.5 transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-slate-300">{selectedWallet?.name ?? "Select"}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isWalletDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isWalletDropdownOpen && (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-[85] w-64 bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
                      <div className="max-h-64 overflow-y-auto">
                        {creatableWallets.length === 0 ? (
                          <p className="p-4 text-xs text-slate-400 text-center">No wallets available with create permission</p>
                        ) : creatableWallets.map((w) => {
                          const isActive = walletId === w._id;
                          const meta = CURRENCY_INFO[w.currency as SupportedCurrency];
                          return (
                            <button
                              key={w._id}
                              type="button"
                              onClick={() => {
                                setWalletId(w._id);
                                if (w.currency) {
                                  setCurrency(w.currency);
                                  setWalletCurrency(w.currency);
                                }
                                setIsWalletDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                                isActive
                                  ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]"
                                  : "text-slate-300 hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <CurrencyFlag flag={meta?.flag ?? "💳"} code={w.currency} className="text-base" />
                                <div className="text-left min-w-0">
                                  <p className="font-semibold text-sm truncate">{w.name}</p>
                                  <p className="text-[11px] text-slate-400">
                                    {getCurrencyDisplayCode(w.currency)}
                                    {w.isDefault && (
                                      <span className="ml-1.5 text-[var(--color-primary-light)] font-bold">· Default</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              {isActive && (
                                <Check className="w-4 h-4 text-[var(--color-primary-light)] flex-shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount Row — tap to open custom keypad */}
              <div
                className={`py-3 border-b-2 cursor-text transition-colors duration-200 ${
                amountError
                  ? "border-red-500"
                  : isKeypadOpen
                  ? "border-[var(--color-primary-light)]"
                  : "border-[var(--color-primary)]/60"
              }`}
                onClick={() => setIsKeypadOpen(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="relative" ref={currencyDropdownRef} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => { setIsKeypadOpen(false); setIsCurrencyDropdownOpen((v) => !v); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1b1d24] border border-white/8 hover:border-white/15 transition-all text-xs font-bold text-slate-200 cursor-pointer shadow-sm active:scale-95"
                    >
                      <span>{currency}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isCurrencyDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isCurrencyDropdownOpen && (
                      <div className="absolute left-0 top-[calc(100%+6px)] z-[85] w-60 max-h-64 bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto animate-fade-in py-1 divide-y divide-white/6 text-left">
                        {SUPPORTED_CURRENCIES.map((code) => {
                          const info = CURRENCY_INFO[code as SupportedCurrency];
                          const isActive = currency === code;
                          return (
                            <button
                              key={code}
                              type="button"
                              onClick={() => { setCurrency(code); setIsCurrencyDropdownOpen(false); }}
                              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                                isActive
                                  ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]"
                                  : "text-slate-300 hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <CurrencyFlag flag={info?.flag ?? ""} code={code} className="text-base flex-shrink-0" />
                                <div className="truncate">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white">{info?.displayCode ?? code}</span>
                                    <span className="text-[11px] text-slate-400">({info?.symbol})</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-normal truncate">{info?.name}</p>
                                </div>
                              </div>
                              {isActive && <Check className="w-4 h-4 text-[var(--color-primary-light)] flex-shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="text"
                      inputMode="none"
                      readOnly
                      placeholder="0"
                      value={formatDisplayAmount(rawAmount)}
                      onChange={handleAmountChange}
                      onFocus={() => setIsKeypadOpen(true)}
                      className={`w-full bg-transparent text-4xl font-extrabold outline-none tracking-tight cursor-text select-none ${
                        amountError
                          ? "text-red-400 placeholder-red-400/40"
                          : "text-[var(--color-primary-light)] placeholder-[var(--color-primary)]/40"
                      }`}
                      aria-label="Transaction amount"
                    />
                    {isKeypadOpen && !amountError && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-[var(--color-primary-light)] animate-pulse rounded-full" />
                    )}
                  </div>
                  {amountError && (
                    <div
                      className="w-6 h-6 rounded-full bg-red-500 text-white font-bold text-xs flex items-center justify-center shadow-md shrink-0 select-none"
                      title="Amount is required"
                    >
                      !
                    </div>
                  )}
                </div>
                {showConversionPreview && (
                  <p className="mt-1.5 text-xs text-slate-400 pl-1 flex items-center gap-1">
                    <span className="text-slate-500">approx.</span>
                    <span className="font-semibold text-slate-300">{formatMoney(convertedPreview, walletCurrency)}</span>
                    <span className="text-slate-500 flex items-center gap-1">in wallet (<CurrencyFlag flag={walletCurrencyInfo?.flag ?? ""} code={walletCurrency} className="text-xs" /> {walletCurrency})</span>
                  </p>
                )}
                {!isKeypadOpen && <p className="mt-1 text-[10px] text-slate-600 pl-1">Tap to enter amount</p>}
              </div>

              {/* Category Row */}
              <button
                type="button"
                onClick={() => {
                  setIsKeypadOpen(false);
                  setIsCategoryPickerOpen(true);
                }}
                className={`w-full flex items-center justify-between py-2 text-left group transition-colors duration-200 ${
                  categoryError
                    ? "border-b-2 border-red-500"
                    : "border-b border-white/6"
                }`}
              >
                <div className="flex items-center gap-3">
                  {category ? (
                    <div className="relative">
                      <CategoryIcon categoryId={category} subCategoryId={subCategory} size="md" />
                      {autoAppliedInfo && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-primary)] ring-2 ring-[#131418] shadow-sm animate-pulse">
                          <Sparkles className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        categoryError
                          ? "bg-red-500/15 border-2 border-red-500 text-red-400"
                          : "bg-white/15 border border-white/20 text-slate-400"
                      }`}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-base font-medium transition-colors ${
                          category
                            ? "text-white"
                            : categoryError
                            ? "text-red-400"
                            : "text-slate-400"
                        }`}
                      >
                        {category ? getCategoryDisplayName(category, subCategory) : "Select category"}
                      </span>
                      {autoAppliedInfo && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)] border border-[var(--color-primary-border)] text-[10px] font-bold animate-fade-in">
                          <Sparkles className="w-2.5 h-2.5" />
                          Auto-applied ({autoAppliedInfo.count}x)
                          {autoAppliedInfo.description && (
                            <span className="opacity-80">· &ldquo;{autoAppliedInfo.description}&rdquo;</span>
                          )}
                        </span>
                      )}
                    </div>
                    {subCategory && <p className="text-xs text-slate-400">{getCategoryDisplayName(category)}</p>}
                  </div>
                </div>
                <ChevronRight
                  className={`w-5 h-5 transition-colors ${
                    categoryError ? "text-red-400" : "text-slate-500 group-hover:text-white"
                  }`}
                />
              </button>

              {/* Description Row with Smart Options */}
              <div className="py-2 border-b border-white/6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#1d1f25] flex items-center justify-center text-slate-400 flex-shrink-0">
                    <AlignLeft className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    placeholder="Write description"
                    value={description}
                    onFocus={() => {
                      setIsKeypadOpen(false);
                      setIsDescFocused(true);
                    }}
                    onBlur={() => {
                      setTimeout(() => setIsDescFocused(false), 200);
                    }}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setIsUserManualDescription(true);
                    }}
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                  />
                  {description && (
                    <button
                      type="button"
                      onClick={() => {
                        setDescription("");
                        setIsUserManualDescription(true);
                      }}
                      className="text-slate-500 hover:text-white p-1"
                      aria-label="Clear description"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Smart Description Options when input is focused */}
                <AnimatePresence>
                  {isDescFocused && category && filteredDescriptions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden pt-2.5"
                    >
                      <div className="p-2.5 rounded-2xl bg-[#181920] border border-white/8 space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-[var(--color-primary-light)]" />
                            Previous descriptions
                          </span>
                          <span className="text-[10px] text-slate-500">Tap to select</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {visibleDescriptions.map((desc) => (
                            <button
                              key={desc}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setDescription(desc);
                                setIsUserManualDescription(true);
                              }}
                              className={`max-w-[180px] truncate px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                                description.trim().toLowerCase() === desc.trim().toLowerCase()
                                  ? "bg-[var(--color-primary)] text-white shadow-sm ring-1 ring-white/20"
                                  : "bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/6"
                              }`}
                              title={desc}
                            >
                              {desc}
                            </button>
                          ))}
                          {hasMoreDescriptions && (
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setShowAllDescriptions((v) => !v)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all text-[var(--color-primary-light)] bg-[var(--color-primary-subtle)] border border-[var(--color-primary-border)] hover:brightness-110"
                            >
                              {showAllDescriptions
                                ? "Show less"
                                : `+${filteredDescriptions.length - DESC_COLLAPSED_LIMIT} more`}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Date Row */}
              <div className="flex items-center gap-3 py-2 border-t border-white/6">
                <div className="w-9 h-9 rounded-xl bg-[#1d1f25] flex items-center justify-center text-slate-400 flex-shrink-0"><CalendarIcon size={20} color="#94a3b8" /></div>
                <div className="flex-1 flex items-center justify-between bg-[#191a20] rounded-2xl px-3 py-2 border border-white/6">
                  <button type="button" onClick={() => handleDateShift(-1)} className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--color-primary-light)] hover:bg-white/5"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-xs font-semibold text-[var(--color-primary-light)]">{formattedDateString}</span>
                  <button type="button" onClick={() => handleDateShift(1)} className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--color-primary-light)] hover:bg-white/5"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>

              {receiptUrl && (
                <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={receiptUrl} alt="Receipt" className="w-full h-40 object-cover rounded-xl" />
                  <button type="button" onClick={() => setReceiptUrl(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-red-600/80 flex items-center justify-center text-white shadow-lg hover:bg-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />

              <div className="pt-1 text-center">
                <button type="button" onClick={() => setShowMoreDetails((prev) => !prev)}
                  className="text-xs font-bold tracking-wider text-[var(--color-primary-light)] hover:text-white transition-colors uppercase">
                  {showMoreDetails ? "Hide Details" : "Add More Details"}
                </button>
              </div>

              {showMoreDetails && (
                <div className="space-y-4 pt-2 border-t border-white/6">
                  {/* With & Select Event Card — matching edit transaction style */}
                  <div className="bg-[#181920] border border-white/6 rounded-2xl p-4 space-y-4">
                    {/* With Section */}
                    <div
                      onClick={() => {
                        setIsKeypadOpen(false);
                        setIsWithModalOpen(true);
                      }}
                      className="flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-slate-400 flex-shrink-0 group-hover:text-white transition-colors">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {withPeople.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {withPeople.map((p) => (
                                <span
                                  key={p}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)] border border-[var(--color-primary-border)] text-xs font-semibold"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">With</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>

                    <div className="border-t border-white/5" />

                    {/* Select Event Section */}
                    <div
                      onClick={() => {
                        setIsKeypadOpen(false);
                        setIsEventModalOpen(true);
                      }}
                      className="flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-slate-400 flex-shrink-0 group-hover:text-white transition-colors">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {eventName ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)] border border-[var(--color-primary-border)] text-xs font-bold">
                              <span>✈️</span>
                              <span>{eventName}</span>
                              {eventCurrency && (
                                <span className="text-slate-400 font-normal">
                                  ({eventCurrency})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-sm">Select event</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>


                  <input type="text" placeholder="Tags (comma separated, e.g. dinner, friends, weekend)" value={tags}
                    onFocus={() => setIsKeypadOpen(false)} enterKeyHint="done" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} onChange={(e) => setTags(e.target.value)}
                    className="w-full bg-[#1a1c22] border border-white/8 rounded-2xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[var(--color-primary)]/40" />
                  {activeTab === "DEBT" && (
                    <div className="space-y-2 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                      <input type="text" placeholder="Party involved (Lender or Borrower name)" value={debtParty}
                        onFocus={() => setIsKeypadOpen(false)} enterKeyHint="done" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} onChange={(e) => setDebtParty(e.target.value)}
                        className="w-full bg-[#1a1c22] border border-white/8 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none" />
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 block mb-1">Due Date</label>
                          <div className="w-full bg-[#1a1c22] border border-white/8 rounded-xl px-2 py-1.5">
                            <CustomDatePicker
                              value={debtDueDate}
                              onChange={setDebtDueDate}
                              placeholder="Due date"
                            />
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 block mb-1">Interest %</label>
                          <input type="number" placeholder="0" value={debtInterestRate} onFocus={() => setIsKeypadOpen(false)} enterKeyHint="done" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} onChange={(e) => setDebtInterestRate(e.target.value)}
                            className="w-full bg-[#1a1c22] border border-white/8 rounded-xl px-2 py-1.5 text-xs text-white outline-none" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{error}</div>
              )}
            </div>

            {/* Floating Save Footer — pops out above keyboard when editing description */}
            <AnimatePresence>
              {isDescFocused && !isScrolledDown && (
                <motion.div
                  key="floating-save-bar"
                  initial={{ opacity: 0, y: 25, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.95 }}
                  transition={{ type: "spring", damping: 26, stiffness: 360 }}
                  style={{
                    bottom: keyboardHeight > 0 ? `${keyboardHeight + 12}px` : "16px",
                  }}
                  className="fixed left-4 right-4 max-w-lg mx-auto z-[75] bg-[#1a1c24]/95 backdrop-blur-xl border border-white/12 shadow-[0_16px_40px_rgba(0,0,0,0.65)] rounded-2xl p-2.5 flex items-center gap-2.5"
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex-1 py-3 px-4 rounded-xl bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-bold text-sm tracking-wide transition-all shadow-md active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    style={{ boxShadow: "0 4px 14px var(--color-primary-glow)" }}
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>{saving ? "Saving..." : "Save"}</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/5 text-white flex items-center justify-center transition-all flex-shrink-0 cursor-pointer border border-white/6"
                    title="Attach photo / receipt"
                  >
                    <ImageIcon className="w-5 h-5 stroke-[2]" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sticky Save Footer — always at bottom of transaction card, sticks back when scrolled */}
            <div
              className={`px-6 py-4 border-t border-white/8 bg-[#131418] flex items-center gap-3 transition-opacity duration-200 ${
                isDescFocused && !isScrolledDown ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
            >
              <button type="button" onClick={handleSubmit} disabled={saving}
                className="flex-1 py-3.5 rounded-full bg-[#26282f] hover:bg-[#32353e] active:bg-[#1f2026] text-white font-bold text-sm tracking-wide transition-all shadow-md active:scale-[0.99] disabled:opacity-50 text-center cursor-pointer">
                {saving ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 rounded-full bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all flex-shrink-0 cursor-pointer"
                style={{ boxShadow: "0 6px 16px var(--color-primary-glow)" }}
                title="Attach photo / receipt">
                <ImageIcon className="w-5 h-5 stroke-[2.2]" />
              </button>
            </div>
          </motion.div>

          {/* Floating Custom Keypad — slides up from bottom only when amount tapped */}
          <AnimatePresence>
            {isKeypadOpen && (
              <>
                <motion.div key="keypad-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }} onClick={() => setIsKeypadOpen(false)}
                  className="fixed inset-0 z-[75] bg-black/40" />
                <motion.div key="keypad-panel" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 350 }}
                  className="fixed bottom-0 left-0 right-0 z-[80] w-full max-w-lg mx-auto bg-[#18191f] border-t border-white/10 rounded-t-3xl shadow-2xl px-4 pt-3">
                  <div className="flex justify-center mb-3"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
                  <div className="flex items-center justify-between px-2 pb-3 border-b border-white/6 mb-2">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Amount</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 bg-white/6 px-2 py-0.5 rounded-lg">{currency}</span>
                      <span className="text-2xl font-extrabold text-[var(--color-primary-light)] tracking-tight">{formatDisplayAmount(rawAmount)}</span>
                    </div>
                  </div>
                  {autoAppliedInfo && (
                    <div className="flex items-center justify-between px-3 py-1.5 mb-2.5 rounded-xl bg-[var(--color-primary-subtle)] border border-[var(--color-primary-border)] text-xs text-[var(--color-primary-light)] animate-fade-in">
                      <div className="flex items-center gap-2 min-w-0">
                        <Sparkles className="w-3.5 h-3.5 flex-shrink-0 animate-pulse" />
                        <span className="truncate">
                          Auto-applied: <strong className="font-bold">{getCategoryDisplayName(autoAppliedInfo.category, autoAppliedInfo.subCategory)}</strong>
                          {autoAppliedInfo.description && (
                            <span className="opacity-90 font-normal"> · &ldquo;{autoAppliedInfo.description}&rdquo;</span>
                          )}
                        </span>
                      </div>
                      <span className="text-[10px] opacity-80 flex-shrink-0 ml-2 font-semibold">
                        {autoAppliedInfo.count} frequent txs
                      </span>
                    </div>
                  )}
                  <CustomKeypad value={rawAmount} onChange={(val) => setRawAmount(val)} onSubmit={handleAmountEnter} showQuickChips={true} />
                  {/* Save & image buttons inside keypad panel */}
                  <div className="flex items-center gap-3 px-2 pt-3 pb-5 border-t border-white/8 mt-2">
                    <button type="button" onClick={handleSaveFromKeypad} disabled={saving}
                      className="flex-1 py-3.5 rounded-full bg-[#26282f] hover:bg-[#32353e] active:bg-[#1f2026] text-white font-bold text-sm tracking-wide transition-all shadow-md active:scale-[0.99] disabled:opacity-50 text-center cursor-pointer">
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button type="button" onClick={() => { setIsKeypadOpen(false); fileInputRef.current?.click(); }}
                      className="w-12 h-12 rounded-full bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all flex-shrink-0 cursor-pointer"
                      style={{ boxShadow: "0 6px 16px var(--color-primary-glow)" }}
                      title="Attach photo / receipt">
                      <ImageIcon className="w-5 h-5 stroke-[2.2]" />
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <CategoryPickerModal isOpen={isCategoryPickerOpen} onClose={() => setIsCategoryPickerOpen(false)}
            type={activeTab} selectedCategory={category} selectedSubCategory={subCategory}
            onSelect={(cat, subCat) => { setCategory(cat); setSubCategory(subCat); setIsUserManualCategory(true); setAutoAppliedInfo(null); }} />

          <WithPeopleModal
            isOpen={isWithModalOpen}
            onClose={() => setIsWithModalOpen(false)}
            selectedPeople={withPeople}
            onSave={(people) => {
              setWithPeople(people);
              setIsWithModalOpen(false);
            }}
          />

          <SelectEventModal
            isOpen={isEventModalOpen}
            onClose={() => setIsEventModalOpen(false)}
            selectedEventId={eventId}
            onSelect={(ev) => {
              if (ev) {
                setEventId(ev._id);
                setEventName(ev.name);
                setEventCurrency(ev.currency);
              } else {
                setEventId("");
                setEventName("");
                setEventCurrency("");
              }
              setIsEventModalOpen(false);
            }}
            onManage={handleManageEvents}
            navigating={navigatingToEvents}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
