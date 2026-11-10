"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpDown,
  ArrowRightLeft,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import {
  CURRENCY_INFO,
  SupportedCurrency,
  convertCurrency,
  getCurrencyDisplayCode,
} from "@/lib/currency";
import CurrencyFlag from "@/components/admin/CurrencyFlag";
import CurrencyPickerModal from "@/components/admin/CurrencyPickerModal";

interface MoneyConverterCalculatorProps {
  defaultFrom?: string;
  defaultTo?: string;
  userBaseCurrency?: string;
  className?: string;
}

// Popular quick currency pairs for one-tap switching
const POPULAR_PAIRS: [string, string][] = [
  ["TWD", "IDR"], // NTD ⇄ IDR
  ["USD", "IDR"], // USD ⇄ IDR
  ["TWD", "USD"], // NTD ⇄ USD
  ["SGD", "IDR"], // SGD ⇄ IDR
  ["EUR", "IDR"], // EUR ⇄ IDR
  ["JPY", "IDR"], // JPY ⇄ IDR
  ["MYR", "IDR"], // MYR ⇄ IDR
];

/** Formats a precise unit exchange rate for headline and inverse display */
function formatPreciseRate(rate: number): string {
  if (!rate || isNaN(rate)) return "0.00";
  if (rate >= 1000) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rate);
  }
  if (rate >= 1) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(rate);
  }
  if (rate >= 0.0001) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    }).format(rate);
  }
  return rate.toPrecision(4);
}

/** Formats dynamic converted numbers in the input boxes (Google style: clean, unbundled) */
function formatCalculated(val: number, maxDecimals: number): string {
  if (!val || isNaN(val)) return "";
  if (val < 0.0001) return val.toPrecision(4);
  if (val < 1) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
      useGrouping: false,
    }).format(val);
  }
  const hasFractions = val % 1 !== 0;
  const decimals = hasFractions ? Math.min(Math.max(maxDecimals, 2), 4) : 0;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
    useGrouping: false,
  }).format(val);
}

/** Sanitize numeric input (digits and up to one decimal dot) */
function cleanNumberInput(val: string): string {
  let clean = val.replace(/[^0-9.]/g, "");
  const parts = clean.split(".");
  if (parts.length > 2) {
    clean = parts[0] + "." + parts.slice(1).join("");
  }
  return clean;
}

/** Format timestamp like Google's currency card */
function formatTimestamp(date: Date | null): string {
  if (!date) return "Market rates";
  try {
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
    return `${dateStr}, ${timeStr} · Market rates`;
  } catch {
    return "Market rates";
  }
}

export default function MoneyConverterCalculator({
  defaultFrom = "TWD",
  defaultTo = "IDR",
  userBaseCurrency,
  className = "",
}: MoneyConverterCalculatorProps) {
  // Normalize codes (NTD maps to TWD in SUPPORTED_CURRENCIES)
  const normInitFrom = defaultFrom === "NTD" ? "TWD" : defaultFrom;
  const normInitTo =
    (userBaseCurrency || defaultTo) === "NTD" ? "TWD" : userBaseCurrency || defaultTo;

  const [fromCurrency, setFromCurrency] = useState<string>(normInitFrom);
  const [toCurrency, setToCurrency] = useState<string>(normInitTo);

  // Two-way input states
  const [lastEdited, setLastEdited] = useState<"from" | "to">("from");
  const [fromInput, setFromInput] = useState<string>("100");
  const [toInput, setToInput] = useState<string>("");

  const [rates, setRates] = useState<Record<string, number>>({});
  const [loadingRates, setLoadingRates] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [pickerTarget, setPickerTarget] = useState<"from" | "to">("from");
  const [swapDegree, setSwapDegree] = useState<number>(0);
  const [, startTransition] = useTransition();

  // Load exchange rates
  useEffect(() => {
    let ignore = false;
    fetch("/api/finance/exchange-rates?base=USD")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data?.rates) {
          setRates(data.rates);
          setLastUpdated(new Date(data.timestamp || Date.now()));
          setLoadingRates(false);
        }
      })
      .catch((err) => {
        console.error("[MoneyConverter] Failed to load exchange rates:", err);
        if (!ignore) setLoadingRates(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Refresh live rates
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/finance/exchange-rates?base=USD&refresh=true");
      if (res.ok) {
        const data = await res.json();
        if (data.rates) {
          setRates(data.rates);
          setLastUpdated(new Date(data.timestamp || Date.now()));
        }
      }
    } catch (err) {
      console.error("[MoneyConverter] Failed to refresh rates:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Unit exchange rates
  const unitRateFromTo = useMemo(() => {
    return convertCurrency(1, fromCurrency, toCurrency, rates);
  }, [fromCurrency, toCurrency, rates]);

  const unitRateToFrom = useMemo(() => {
    return convertCurrency(1, toCurrency, fromCurrency, rates);
  }, [fromCurrency, toCurrency, rates]);

  const fromDisplayCode = getCurrencyDisplayCode(fromCurrency);
  const toDisplayCode = getCurrencyDisplayCode(toCurrency);

  const fromMeta = CURRENCY_INFO[fromCurrency as SupportedCurrency] || {
    name: fromCurrency,
    displayCode: fromDisplayCode,
    symbol: fromDisplayCode,
    flag: "🌐",
    decimals: 2,
  };
  const toMeta = CURRENCY_INFO[toCurrency as SupportedCurrency] || {
    name: toCurrency,
    displayCode: toDisplayCode,
    symbol: toDisplayCode,
    flag: "🌐",
    decimals: 2,
  };

  // Compute displayed values for both inputs (Google 2-way sync)
  let displayFromVal = "";
  let displayToVal = "";

  if (lastEdited === "from") {
    displayFromVal = fromInput;
    if (fromInput === "") {
      displayToVal = "";
    } else {
      const num = parseFloat(fromInput);
      if (!isNaN(num) && unitRateFromTo > 0) {
        displayToVal = formatCalculated(num * unitRateFromTo, toMeta.decimals);
      } else {
        displayToVal = "";
      }
    }
  } else {
    displayToVal = toInput;
    if (toInput === "") {
      displayFromVal = "";
    } else {
      const num = parseFloat(toInput);
      if (!isNaN(num) && unitRateToFrom > 0) {
        displayFromVal = formatCalculated(num * unitRateToFrom, fromMeta.decimals);
      } else {
        displayFromVal = "";
      }
    }
  }

  // Handle input changes
  const handleFromChange = (val: string) => {
    const cleaned = cleanNumberInput(val);
    setLastEdited("from");
    setFromInput(cleaned);
  };

  const handleToChange = (val: string) => {
    const cleaned = cleanNumberInput(val);
    setLastEdited("to");
    setToInput(cleaned);
  };

  // Swap currencies (Google style)
  const handleSwap = () => {
    setSwapDegree((prev) => prev + 180);
    startTransition(() => {
      const prevFrom = fromCurrency;
      const prevTo = toCurrency;
      setFromCurrency(prevTo);
      setToCurrency(prevFrom);

      // Keep active converted amount aligned with swapped view
      if (lastEdited === "from") {
        setFromInput(displayToVal || "100");
      } else {
        setFromInput(displayFromVal || "100");
        setLastEdited("from");
      }
    });
  };

  // Open currency picker modal
  const handleOpenPicker = (target: "from" | "to") => {
    setPickerTarget(target);
    setIsPickerOpen(true);
  };

  const handleSelectCurrency = (currency: string) => {
    const norm = currency === "NTD" ? "TWD" : currency;
    if (pickerTarget === "from") {
      if (norm === toCurrency) {
        setToCurrency(fromCurrency);
      }
      setFromCurrency(norm);
    } else {
      if (norm === fromCurrency) {
        setFromCurrency(toCurrency);
      }
      setToCurrency(norm);
    }
    setIsPickerOpen(false);
  };

  // Select quick pair
  const handleSelectPair = (pairFrom: string, pairTo: string) => {
    setFromCurrency(pairFrom);
    setToCurrency(pairTo);
  };

  // Copy result to clipboard
  const handleCopyResult = async () => {
    const currentResult = lastEdited === "from" ? displayToVal : displayFromVal;
    const targetDisplay = lastEdited === "from" ? toDisplayCode : fromDisplayCode;
    if (!currentResult) return;
    try {
      await navigator.clipboard.writeText(`${currentResult} ${targetDisplay}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  return (
    <div
      className={`bg-[#141519] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden transition-all ${className}`}
    >
      {/* Subtle ambient accent glow */}
      <div
        className="absolute -top-20 -right-20 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-10"
        style={{ backgroundColor: "var(--color-primary, #6366f1)" }}
      />

      {/* ── Google Finance Style Headline Rate Display ──────────────── */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-slate-400 font-medium tracking-normal truncate">
            1 {fromMeta.name} equals
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight break-words leading-tight">
            {formatPreciseRate(unitRateFromTo)} {toMeta.name}
          </h2>
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 pt-0.5">
            <span className="truncate">{formatTimestamp(lastUpdated)}</span>
            <span>·</span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || loadingRates}
              className="text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 flex-shrink-0"
              title="Refresh live exchange rates"
            >
              <RefreshCw
                className={`w-3 h-3 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Circular Google-style Swap Button */}
        <motion.button
          type="button"
          onClick={handleSwap}
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: swapDegree }}
          transition={{ type: "spring", stiffness: 350, damping: 20 }}
          className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md flex-shrink-0 cursor-pointer group mt-1"
          title="Swap currencies"
        >
          <ArrowUpDown className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
        </motion.button>
      </div>

      {/* ── Google Style Compact Conversion Input Boxes ─────────────── */}
      <div className="space-y-3">
        {/* Box 1 (From) */}
        <div className="bg-[#191b22] border border-white/10 hover:border-white/15 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/20 rounded-2xl px-3.5 py-3 sm:px-4 sm:py-3.5 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                inputMode="decimal"
                value={displayFromVal}
                onChange={(e) => handleFromChange(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent text-white text-xl sm:text-2xl font-bold focus:outline-none placeholder:text-slate-600 tracking-tight"
              />
            </div>

            <div className="h-7 w-px bg-white/10 mx-1 flex-shrink-0" />

            <button
              type="button"
              onClick={() => handleOpenPicker("from")}
              className="flex items-center gap-1.5 sm:gap-2 py-1 px-1.5 sm:px-2 -mr-1 rounded-xl hover:bg-white/5 active:bg-white/10 text-white transition-colors flex-shrink-0 cursor-pointer group"
            >
              <CurrencyFlag
                code={fromDisplayCode}
                flag={fromMeta.flag}
                className="text-base flex-shrink-0"
              />
              <span className="font-bold text-sm tracking-tight">{fromDisplayCode}</span>
              <span className="hidden sm:inline text-xs text-slate-400 font-normal truncate max-w-[120px]">
                {fromMeta.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors flex-shrink-0" />
            </button>
          </div>
        </div>

        {/* Box 2 (To) */}
        <div className="bg-[#191b22] border border-white/10 hover:border-white/15 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/20 rounded-2xl px-3.5 py-3 sm:px-4 sm:py-3.5 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                inputMode="decimal"
                value={displayToVal}
                onChange={(e) => handleToChange(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent text-white text-xl sm:text-2xl font-bold focus:outline-none placeholder:text-slate-600 tracking-tight"
              />
            </div>

            <div className="h-7 w-px bg-white/10 mx-1 flex-shrink-0" />

            <button
              type="button"
              onClick={() => handleOpenPicker("to")}
              className="flex items-center gap-1.5 sm:gap-2 py-1 px-1.5 sm:px-2 -mr-1 rounded-xl hover:bg-white/5 active:bg-white/10 text-white transition-colors flex-shrink-0 cursor-pointer group"
            >
              <CurrencyFlag
                code={toDisplayCode}
                flag={toMeta.flag}
                className="text-base flex-shrink-0"
              />
              <span className="font-bold text-sm tracking-tight">{toDisplayCode}</span>
              <span className="hidden sm:inline text-xs text-slate-400 font-normal truncate max-w-[120px]">
                {toMeta.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer: Minimal Inverse Rate & Copy Action ─────────────── */}
      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-400">
        <span className="text-[11px] sm:text-xs text-slate-400 font-medium truncate">
          1 {toDisplayCode} = {formatPreciseRate(unitRateToFrom)} {fromDisplayCode}
        </span>

        <button
          type="button"
          onClick={handleCopyResult}
          disabled={!displayToVal && !displayFromVal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-slate-300 hover:text-white transition-all text-xs cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex-shrink-0"
          title="Copy converted result"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* ── Quick Popular Currency Pairs (Clean Subtle Pills) ──────── */}
      <div className="mt-5 pt-4 border-t border-white/5">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 -mx-1 px-1">
          {POPULAR_PAIRS.map(([pFrom, pTo]) => {
            const isCurrent =
              (fromCurrency === pFrom && toCurrency === pTo) ||
              (fromCurrency === pTo && toCurrency === pFrom);
            const labelA = getCurrencyDisplayCode(pFrom);
            const labelB = getCurrencyDisplayCode(pTo);
            return (
              <button
                key={`${pFrom}-${pTo}`}
                type="button"
                onClick={() => handleSelectPair(pFrom, pTo)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer ${
                  isCurrent
                    ? "bg-white/15 text-white border border-white/20 shadow-sm"
                    : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                <span>{labelA}</span>
                <ArrowRightLeft className="w-2.5 h-2.5 text-slate-500" />
                <span>{labelB}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Currency Picker Modal */}
      <CurrencyPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        selectedCurrency={pickerTarget === "from" ? fromCurrency : toCurrency}
        onSelect={handleSelectCurrency}
        title={pickerTarget === "from" ? "Select Source Currency" : "Select Target Currency"}
        description={
          pickerTarget === "from"
            ? "Choose the currency you want to convert from"
            : "Choose the target conversion currency"
        }
      />
    </div>
  );
}
