"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpDown,
  ArrowRightLeft,
  RefreshCw,
  Copy,
  Check,
  TrendingUp,
  Sparkles,
  Calculator,
  ChevronDown,
} from "lucide-react";
import {
  CURRENCY_INFO,
  SupportedCurrency,
  convertCurrency,
  getCurrencyDisplayCode,
  getCurrencySymbol,
  formatMoney,
  formatThousands,
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

// Preset quick adjustment buttons
const PRESET_AMOUNTS = [100, 500, 1000, 5000, 10000];

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

export default function MoneyConverterCalculator({
  defaultFrom = "TWD",
  defaultTo = "IDR",
  userBaseCurrency,
  className = "",
}: MoneyConverterCalculatorProps) {
  // Normalize codes (NTD maps to TWD in SUPPORTED_CURRENCIES)
  const normInitFrom = defaultFrom === "NTD" ? "TWD" : defaultFrom;
  const normInitTo = (userBaseCurrency || defaultTo) === "NTD" ? "TWD" : (userBaseCurrency || defaultTo);

  const [fromCurrency, setFromCurrency] = useState<string>(normInitFrom);
  const [toCurrency, setToCurrency] = useState<string>(normInitTo);
  const [amountStr, setAmountStr] = useState<string>("5,000");
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loadingRates, setLoadingRates] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [pickerTarget, setPickerTarget] = useState<"from" | "to">("from");
  const [swapDegree, setSwapDegree] = useState<number>(0);
  const [, startTransition] = useTransition();

  // Initial load of exchange rates
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

  // Manual refresh of live rates
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

  // Numeric amount parsed from user input
  const numericAmount = useMemo(() => {
    if (!amountStr) return 0;
    const clean = amountStr.replace(/,/g, "").trim();
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }, [amountStr]);

  // Calculated converted value
  const convertedAmount = useMemo(() => {
    if (numericAmount <= 0) return 0;
    return convertCurrency(numericAmount, fromCurrency, toCurrency, rates);
  }, [numericAmount, fromCurrency, toCurrency, rates]);

  // Unit exchange rate: 1 fromCurrency = ? toCurrency
  const unitRateFromTo = useMemo(() => {
    return convertCurrency(1, fromCurrency, toCurrency, rates);
  }, [fromCurrency, toCurrency, rates]);

  // Inverse exchange rate: 1 toCurrency = ? fromCurrency
  const unitRateToFrom = useMemo(() => {
    return convertCurrency(1, toCurrency, fromCurrency, rates);
  }, [fromCurrency, toCurrency, rates]);

  // Swap currencies
  const handleSwap = () => {
    setSwapDegree((prev) => prev + 180);
    startTransition(() => {
      const prevFrom = fromCurrency;
      const prevTo = toCurrency;
      setFromCurrency(prevTo);
      setToCurrency(prevFrom);
    });
  };

  // Open picker
  const handleOpenPicker = (target: "from" | "to") => {
    setPickerTarget(target);
    setIsPickerOpen(true);
  };

  const handleSelectCurrency = (currency: string) => {
    const norm = currency === "NTD" ? "TWD" : currency;
    if (pickerTarget === "from") {
      if (norm === toCurrency) {
        // Swap if picked same
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

  // Handle amount change with numeric input sanitizing
  const handleAmountChange = (val: string) => {
    // Keep numbers, decimal dot, and strip invalid characters
    const clean = val.replace(/[^0-9.]/g, "");
    // Prevent multiple decimals
    const parts = clean.split(".");
    let formatted = parts[0];
    if (parts.length > 1) {
      formatted = `${parts[0]}.${parts.slice(1).join("").slice(0, 4)}`;
    }
    setAmountStr(formatThousands(formatted));
  };

  // Add preset amount
  const handleAddPreset = (preset: number) => {
    const nextVal = numericAmount + preset;
    setAmountStr(formatThousands(nextVal.toString()));
  };

  // Copy converted result to clipboard
  const handleCopyResult = async () => {
    if (!convertedAmount) return;
    try {
      const toDisplay = getCurrencyDisplayCode(toCurrency);
      const textToCopy = `${formatMoney(convertedAmount, toCurrency)} (${toDisplay})`;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  const fromDisplayCode = getCurrencyDisplayCode(fromCurrency);
  const toDisplayCode = getCurrencyDisplayCode(toCurrency);
  const fromMeta = CURRENCY_INFO[fromCurrency as SupportedCurrency] || {
    name: fromCurrency,
    symbol: getCurrencySymbol(fromCurrency),
    flag: "🌐",
    decimals: 2,
  };
  const toMeta = CURRENCY_INFO[toCurrency as SupportedCurrency] || {
    name: toCurrency,
    symbol: getCurrencySymbol(toCurrency),
    flag: "🌐",
    decimals: 2,
  };

  return (
    <div
      className={`money-card bg-[#141519] border border-white/8 hover:border-white/15 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden transition-all ${className}`}
    >
      {/* Background ambient decorative glow */}
      <div
        className="absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-15"
        style={{ backgroundColor: "var(--color-primary, #6366f1)" }}
      />

      {/* ── Section Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md transition-transform group-hover:scale-105"
            style={{
              backgroundColor: "var(--color-primary-subtle, rgba(99, 102, 241, 0.15))",
              color: "var(--color-primary-light, #818cf8)",
              border: "1px solid var(--color-primary-border, rgba(99, 102, 241, 0.3))",
            }}
          >
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-bold text-base tracking-tight">
                Money Converter
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Rates
              </span>
            </div>
            <p className="text-slate-400 text-xs">Real-time currency exchange calculator</p>
          </div>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing || loadingRates}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/8 text-slate-300 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
          title="Refresh live exchange rates"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[var(--color-primary-light)]" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ── Popular Quick Currency Pairs ───────────────────────────── */}
      <div className="pt-3 pb-1">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 -mx-1 px-1">
          <span className="text-[11px] font-medium text-slate-400 flex-shrink-0 mr-0.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[var(--color-primary-light)]" />
            Quick:
          </span>
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
                    ? "bg-white/15 text-white border border-white/25 shadow-sm"
                    : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5"
                }`}
              >
                <span>{labelA}</span>
                <ArrowRightLeft className="w-2.5 h-2.5 text-slate-400" />
                <span>{labelB}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Converter Core Workspace ───────────────────────────────── */}
      <div className="mt-3 space-y-3">
        {/* Currency A: From */}
        <div className="bg-[#1b1d24] border border-white/8 focus-within:border-[var(--color-primary-light)] focus-within:ring-1 focus-within:ring-[var(--color-primary-light)]/30 rounded-2xl p-3.5 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">You Send / From</span>
            <span className="text-[11px] text-slate-400">{fromMeta.name}</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            {/* Currency Selector Button */}
            <button
              type="button"
              onClick={() => handleOpenPicker("from")}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm tracking-tight transition-all active:scale-95 flex-shrink-0 cursor-pointer group"
            >
              <CurrencyFlag code={fromDisplayCode} flag={fromMeta.flag} className="text-lg" />
              <span>{fromDisplayCode}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
            </button>

            {/* Amount Input */}
            <div className="relative flex-1 flex items-center justify-end">
              <span className="text-slate-400 font-semibold text-sm mr-2 pointer-events-none select-none">
                {fromMeta.symbol}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                className="w-full text-right bg-transparent text-white text-xl md:text-2xl font-extrabold focus:outline-none placeholder:text-slate-600 tracking-tight"
              />
              {amountStr && (
                <button
                  type="button"
                  onClick={() => setAmountStr("")}
                  className="ml-2 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors flex-shrink-0 cursor-pointer"
                  title="Clear amount"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Quick Amount Preset Chips */}
          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/5 overflow-x-auto scrollbar-none">
            <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 flex-shrink-0">Add:</span>
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleAddPreset(amt)}
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-colors flex-shrink-0 cursor-pointer active:scale-95"
              >
                +{formatThousands(amt)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmountStr("5,000")}
              className="ml-auto px-2 py-0.5 rounded-md text-[11px] font-semibold text-[var(--color-primary-light)] hover:bg-[var(--color-primary-subtle)] transition-colors flex-shrink-0 cursor-pointer"
            >
              5K Reset
            </button>
          </div>
        </div>

        {/* ── Swap / Switch Action Bar ────────────────────────────── */}
        <div className="relative flex items-center justify-center my-[-6px] z-10">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5" />
          </div>
          <motion.button
            type="button"
            onClick={handleSwap}
            whileTap={{ scale: 0.9 }}
            animate={{ rotate: swapDegree }}
            transition={{ type: "spring", stiffness: 350, damping: 20 }}
            className="relative px-3.5 py-1.5 rounded-full bg-[#1e2029] hover:bg-[#252834] border border-white/15 text-white shadow-lg flex items-center gap-2 group transition-colors cursor-pointer"
            title="Swap currency positions"
          >
            <ArrowUpDown className="w-4 h-4 text-[var(--color-primary-light)] transition-transform group-hover:scale-110" />
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-300 group-hover:text-white">
              Switch
            </span>
          </motion.button>
        </div>

        {/* Currency B: To */}
        <div className="bg-[#1b1d24] border border-white/8 rounded-2xl p-3.5 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">You Receive / To</span>
            <span className="text-[11px] text-slate-400">{toMeta.name}</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            {/* Currency Selector Button */}
            <button
              type="button"
              onClick={() => handleOpenPicker("to")}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm tracking-tight transition-all active:scale-95 flex-shrink-0 cursor-pointer group"
            >
              <CurrencyFlag code={toDisplayCode} flag={toMeta.flag} className="text-lg" />
              <span>{toDisplayCode}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
            </button>

            {/* Calculated Result Display */}
            <div className="flex-1 flex items-center justify-end text-right overflow-hidden">
              <div className="truncate">
                <span className="text-emerald-400/90 font-bold text-sm mr-1.5 select-none">
                  {toMeta.symbol}
                </span>
                <span className="text-white text-xl md:text-2xl font-black tracking-tight select-all">
                  {convertedAmount > 0
                    ? new Intl.NumberFormat("en-US", {
                        minimumFractionDigits: toMeta.decimals,
                        maximumFractionDigits: toMeta.decimals,
                      }).format(convertedAmount)
                    : "0"}
                </span>
              </div>

              {/* Copy button */}
              <button
                type="button"
                onClick={handleCopyResult}
                disabled={convertedAmount <= 0}
                className="ml-2.5 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 text-slate-300 hover:text-white transition-all flex-shrink-0 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                title="Copy converted amount"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Quick Result Summary pill */}
          <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] text-slate-400">Formatted Result</span>
            <span className="font-semibold text-slate-200 text-xs">
              {formatMoney(convertedAmount, toCurrency)} {toDisplayCode}
            </span>
          </div>
        </div>
      </div>

      {/* ── Key Exchange Rate Details ("1 a is ___ b" and reverse) ───── */}
      <div className="mt-4 p-3.5 rounded-2xl bg-[#181920] border border-white/6 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <TrendingUp className="w-3.5 h-3.5 text-[var(--color-primary-light)]" />
            <span>Exchange Rate Details</span>
          </div>
          {lastUpdated && (
            <span className="text-[10px] text-slate-400">
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Primary rate: 1 A = X B */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/3 border border-white/5">
          <div className="flex items-center gap-2">
            <CurrencyFlag code={fromDisplayCode} flag={fromMeta.flag} className="text-sm" />
            <span className="text-xs font-bold text-white">1 {fromDisplayCode}</span>
            <span className="text-xs text-slate-400">=</span>
            <span className="text-xs font-extrabold text-emerald-400">
              {toMeta.symbol} {formatPreciseRate(unitRateFromTo)} {toDisplayCode}
            </span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-slate-300">
            Base
          </span>
        </div>

        {/* Reverse rate: 1 B = Y A */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/3 border border-white/5">
          <div className="flex items-center gap-2">
            <CurrencyFlag code={toDisplayCode} flag={toMeta.flag} className="text-sm" />
            <span className="text-xs font-bold text-white">1 {toDisplayCode}</span>
            <span className="text-xs text-slate-400">=</span>
            <span className="text-xs font-extrabold text-slate-200">
              {fromMeta.symbol} {formatPreciseRate(unitRateToFrom)} {fromDisplayCode}
            </span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
            Inverse
          </span>
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
