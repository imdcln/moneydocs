"use client";

import { useState, useEffect, use, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, Check } from "lucide-react";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { getCategoryDisplayName } from "@/lib/categories";
import {
  formatMoney,
  convertCurrency,
  getCurrencyDisplayCode,
  CURRENCY_INFO,
  SUPPORTED_CURRENCIES,
} from "@/lib/currency";
import CurrencyFlag from "@/components/admin/CurrencyFlag";
import PageLoading from "@/components/ui/PageLoading";

interface EventTransaction {
  _id: string;
  date: string | Date;
  title: string;
  category: string;
  subCategory?: string;
  amount: number;
  rawAmount?: number;
  rawCurrency?: string;
  currency?: string;
  type?: string;
}

interface EventData {
  _id: string;
  name: string;
  icon?: string;
  currency: string;
  walletId?: { _id: string; name: string; currency?: string };
  transactions?: EventTransaction[];
}

interface DayGroup {
  date: Date;
  dayNumber: string;
  dayName: string;
  monthYear: string;
  dayTotal: number;
  items: EventTransaction[];
}

function groupByDay(
  transactions: EventTransaction[],
  toViewCurrency: (tx: EventTransaction) => number
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
    if (tx.type === "INCOME") {
      groups[key].dayTotal -= amt;
    } else {
      groups[key].dayTotal += amt;
    }
  }

  return Object.entries(groups)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([, g]) => g);
}

export default function EventTransactionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [selectedDisplayCurrency, setSelectedDisplayCurrency] = useState<string | null>(null);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/finance/exchange-rates")
      .then((r) => r.json())
      .then((d) => {
        if (d.rates) setRates(d.rates);
      })
      .catch(() => {});
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
    const fetchEvent = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/finance/events/${id}`);
        if (res.ok) {
          const data = await res.json();
          setEvent(data.event ?? null);
        } else {
          setEvent(null);
        }
      } catch {
        setEvent(null);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  const eventCurrency = event?.currency || "IDR";
  const viewCurrency = selectedDisplayCurrency || eventCurrency;
  const currDisplay = getCurrencyDisplayCode(viewCurrency);

  const toViewCurrency = useCallback(
    (tx: EventTransaction): number => {
      const fromCurr = tx.rawCurrency || tx.currency || eventCurrency;
      const fromAmt = tx.rawAmount ?? tx.amount;
      const normFrom = fromCurr === "NTD" ? "TWD" : fromCurr;
      const normView = viewCurrency === "NTD" ? "TWD" : viewCurrency;
      if (normFrom === normView) return fromAmt;
      if (rates && Object.keys(rates).length > 0) {
        return convertCurrency(fromAmt, fromCurr, viewCurrency, rates);
      }
      return convertCurrency(fromAmt, fromCurr, viewCurrency);
    },
    [eventCurrency, viewCurrency, rates]
  );

  const transactions: EventTransaction[] = event?.transactions ?? [];
  const dayGroups = useMemo(
    () => groupByDay(transactions, toViewCurrency),
    [transactions, toViewCurrency]
  );

  const totalIncome = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === "INCOME")
        .reduce((sum, tx) => sum + toViewCurrency(tx), 0),
    [transactions, toViewCurrency]
  );

  const totalExpense = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type !== "INCOME")
        .reduce((sum, tx) => sum + toViewCurrency(tx), 0),
    [transactions, toViewCurrency]
  );

  const net = totalIncome - totalExpense;

  if (loading) {
    return (
      <PageLoading
        title="Loading Event Transactions..."
        subtitle="Calculating event expense records"
      />
    );
  }

  if (!event) {
    return (
      <div className="py-20 p-6 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
        <p className="text-red-400 font-semibold mb-4">Event not found</p>
        <button
          onClick={() => router.push("/events")}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-bold text-white transition-colors cursor-pointer"
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
          onClick={() => router.push(`/events/${id}`)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0 cursor-pointer"
          aria-label="Back to event"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-white font-bold text-lg tracking-tight">
            Transactions list
          </h1>
          <p className="text-slate-400 text-xs">
            {event.icon ? `${event.icon} ` : ""}{event.name}
          </p>
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
            {totalIncome > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Income</span>
                <span className="text-sky-400 font-bold">
                  {formatMoney(totalIncome, viewCurrency)}
                </span>
              </div>
            )}
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
            <p className="text-slate-400 text-sm font-medium">No transactions in this event</p>
            <p className="text-slate-500 text-xs mt-1">Connect transactions to this event when creating or editing them.</p>
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
                    const origCurr = tx.rawCurrency || tx.currency || eventCurrency;
                    const normOrig = origCurr === "NTD" ? "TWD" : origCurr;
                    const normView = viewCurrency === "NTD" ? "TWD" : viewCurrency;
                    const showOriginal = normOrig !== normView;
                    const isTxIncome = tx.type === "INCOME";

                    return (
                      <div
                        key={tx._id}
                        onClick={() => router.push(`/transactions/${tx._id}`)}
                        className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer"
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
                            <p className="text-white text-sm font-semibold">
                              {tx.title ||
                                getCategoryDisplayName(tx.category, tx.subCategory)}
                            </p>
                            {showOriginal && (
                              <p className="text-slate-500 text-[10px]">
                                {isTxIncome ? "+" : "-"}{formatMoney(tx.rawAmount ?? tx.amount, origCurr)}
                              </p>
                            )}
                          </div>
                        </div>
                        <span
                          className={`font-bold text-sm flex-shrink-0 ${
                            isTxIncome ? "text-sky-400" : "text-red-400"
                          }`}
                        >
                          {isTxIncome ? "+" : "-"}{formatMoney(convertedAmt, viewCurrency)}
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
