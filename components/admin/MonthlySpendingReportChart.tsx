"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { getCategoryDisplayName, resolveCategoryHierarchy, calculateTrendComparison } from "@/lib/categories";
import CategoryIcon from "@/components/ui/CategoryIcon";

interface Transaction {
  date: string | Date;
  type: string;
  category?: string;
  subCategory?: string;
  convertedAmountIDR?: number;
  convertedToGlobal?: number;
  amount: number;
  currency?: string;
}

interface MonthlySpendingReportChartProps {
  currentTransactions: Transaction[];
  previousTransactions: Transaction[];
  totalIncome: number;
  totalExpense: number;
  globalCurrency: string;
  monthYear: string;
}

type ReportMode = "trending" | "spending";

// ─── Spending Report sub-view ───────────────────────────────────────────────
interface SubCategorySpendItem {
  subId: string;
  subName: string;
  cur: number;
  prev: number;
  isDirectParent?: boolean;
}

interface ParentCategorySpendItem {
  parentId: string;
  parentName: string;
  cur: number;
  prev: number;
  directCur: number;
  directPrev: number;
  hasChildTransactions: boolean;
  subCategories: SubCategorySpendItem[];
}

function SpendingReportView({
  currentTransactions,
  previousTransactions,
  totalExpense,
  totalIncome,
  globalCurrency,
  month,
}: {
  currentTransactions: Transaction[];
  previousTransactions: Transaction[];
  totalExpense: number;
  totalIncome: number;
  globalCurrency: string;
  month: number;
}) {
  const getAmt = (tx: Transaction) =>
    tx.convertedToGlobal ?? tx.convertedAmountIDR ?? tx.amount ?? 0;

  const { categoryData, topCategory } = useMemo(() => {
    const parentMap: Record<
      string,
      {
        parentId: string;
        parentName: string;
        directCur: number;
        directPrev: number;
        subs: Record<string, { subId: string; subName: string; cur: number; prev: number }>;
      }
    > = {};

    const ensureParent = (pId: string, pName: string) => {
      if (!parentMap[pId]) {
        parentMap[pId] = {
          parentId: pId,
          parentName: pName,
          directCur: 0,
          directPrev: 0,
          subs: {},
        };
      }
      return parentMap[pId];
    };

    currentTransactions.forEach((tx) => {
      if (tx.type !== "EXPENSE") return;
      const { parentId, parentName, subId, subName } = resolveCategoryHierarchy(tx.category, tx.subCategory);
      const parent = ensureParent(parentId, parentName);
      const amt = getAmt(tx);
      if (subId) {
        if (!parent.subs[subId]) {
          parent.subs[subId] = { subId, subName: subName || subId, cur: 0, prev: 0 };
        }
        parent.subs[subId].cur += amt;
      } else {
        parent.directCur += amt;
      }
    });

    previousTransactions.forEach((tx) => {
      if (tx.type !== "EXPENSE") return;
      const { parentId, parentName, subId, subName } = resolveCategoryHierarchy(tx.category, tx.subCategory);
      const parent = ensureParent(parentId, parentName);
      const amt = getAmt(tx);
      if (subId) {
        if (!parent.subs[subId]) {
          parent.subs[subId] = { subId, subName: subName || subId, cur: 0, prev: 0 };
        }
        parent.subs[subId].prev += amt;
      } else {
        parent.directPrev += amt;
      }
    });

    const parsedCategories: ParentCategorySpendItem[] = Object.values(parentMap)
      .map((p) => {
        const rawSubs = Object.values(p.subs);
        // Only active subcategories that had spending in either current or previous month
        const activeSubs = rawSubs.filter((s) => s.cur > 0 || s.prev > 0);
        const hasChildTransactions = activeSubs.length > 0;

        const subCategories: SubCategorySpendItem[] = activeSubs.map((s) => ({
          subId: s.subId,
          subName: s.subName,
          cur: Math.round(s.cur),
          prev: Math.round(s.prev),
        }));

        // If parent category has direct spending AND child categories done transactions,
        // include direct spending as a sub-category so the breakdown transparently accounts for parent total
        if (hasChildTransactions && (p.directCur > 0 || p.directPrev > 0)) {
          subCategories.unshift({
            subId: "_direct",
            subName: `${p.parentName} (General)`,
            cur: Math.round(p.directCur),
            prev: Math.round(p.directPrev),
            isDirectParent: true,
          });
        }

        // Sum up direct + all child categories
        const cur = Math.round(p.directCur + activeSubs.reduce((s, c) => s + c.cur, 0));
        const prev = Math.round(p.directPrev + activeSubs.reduce((s, c) => s + c.prev, 0));

        // Sort subcategories by cur descending, then prev descending
        subCategories.sort((a, b) => b.cur - a.cur || b.prev - a.prev);

        return {
          parentId: p.parentId,
          parentName: p.parentName,
          cur,
          prev,
          directCur: Math.round(p.directCur),
          directPrev: Math.round(p.directPrev),
          hasChildTransactions,
          subCategories,
        };
      })
      .filter((p) => p.cur > 0 || p.prev > 0)
      .sort((a, b) => b.cur - a.cur || b.prev - a.prev);

    const topCategory = parsedCategories.find((c) => c.cur > 0) ?? null;

    return { categoryData: parsedCategories, topCategory };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTransactions, previousTransactions]);

  const netSavings = totalIncome - totalExpense;
  const maxBar = Math.max(...categoryData.flatMap((c) => [c.cur, c.prev]), 1);
  const monthLabel = new Date(2000, month - 1, 1).toLocaleString("en-US", {
    month: "short",
  });

  return (
    <div className="space-y-4">
      {/* Net savings + top category pills */}
      <div className="flex items-center gap-3">
        <div
          className={`flex-1 rounded-2xl px-3.5 py-2.5 border ${
            netSavings >= 0
              ? "bg-emerald-500/10 border-emerald-500/20"
              : "bg-red-500/10 border-red-500/20"
          }`}
        >
          <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">
            Net savings
          </p>
          <p
            className={`font-extrabold text-base mt-0.5 ${
              netSavings >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {netSavings >= 0 ? "+" : ""}
            {formatMoney(netSavings, globalCurrency)}
          </p>
        </div>

        {topCategory && (
          <div className="flex-1 rounded-2xl px-3.5 py-2.5 bg-white/4 border border-white/6">
            <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">
              Top spend
            </p>
            <p className="text-white font-bold text-sm mt-0.5 truncate">
              {topCategory.parentName}
            </p>
          </div>
        )}
      </div>

      {/* Per-category bars */}
      {categoryData.length > 0 ? (
        <div className="space-y-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider px-0.5">
            Category breakdown · {monthLabel}
          </p>

          {categoryData.map((item) => {
            const pctCur = (item.cur / maxBar) * 100;
            const pctPrev = (item.prev / maxBar) * 100;
            const parentTrend = calculateTrendComparison(item.cur, item.prev);

            return (
              <div
                key={item.parentId}
                className="rounded-2xl bg-[#1b1d24] border border-white/5 p-3.5 space-y-2.5"
              >
                {/* Parent Row: icon + name + amount + trend icon */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <CategoryIcon
                      categoryId={item.parentId}
                      size="sm"
                    />
                    <span className="text-white text-xs font-bold truncate">
                      {item.parentName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-red-400 font-extrabold text-xs">
                      {formatMoney(item.cur, globalCurrency)}
                    </span>
                    {parentTrend.trending === "up" && (
                      <TrendingUp className="w-3 h-3 text-red-400" />
                    )}
                    {parentTrend.trending === "down" && (
                      <TrendingDown className="w-3 h-3 text-emerald-400" />
                    )}
                    {parentTrend.trending === "flat" && (
                      <Minus className="w-3 h-3 text-slate-500" />
                    )}
                  </div>
                </div>

                {/* Parent Bars: Current month bar & Previous month bar */}
                <div className="space-y-1">
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-500 transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(item.cur > 0 ? 3 : 0, pctCur))}%` }}
                    />
                  </div>
                  {item.prev > 0 && (
                    <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-600 transition-all duration-700"
                        style={{ width: `${Math.min(100, Math.max(2, pctPrev))}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Parent Delta label */}
                <p
                  className={`text-[10px] font-medium ${
                    parentTrend.trending === "up"
                      ? "text-red-400"
                      : parentTrend.trending === "down"
                      ? "text-emerald-400"
                      : "text-slate-500"
                  }`}
                >
                  {parentTrend.percentText}
                </p>

                {/* Sub-categories breakdown (only if child categories have transactions) */}
                {item.hasChildTransactions && (
                  <div className="pt-2.5 mt-2.5 border-t border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-0.5">
                      <span>Sub-categories</span>
                      <span className="text-slate-500">{item.subCategories.length} sub-items</span>
                    </div>

                    <div className="space-y-2 pl-2 border-l-2 border-white/10">
                      {item.subCategories.map((sub) => {
                        const subTrend = calculateTrendComparison(sub.cur, sub.prev);
                        const subPctCur = item.cur > 0 ? (sub.cur / item.cur) * 100 : 0;
                        const subPctPrev = Math.max(item.cur, item.prev, 1) > 0
                          ? (sub.prev / Math.max(item.cur, item.prev, 1)) * 100
                          : 0;

                        return (
                          <div
                            key={sub.subId}
                            className="p-2 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CategoryIcon
                                  categoryId={item.parentId}
                                  subCategoryId={sub.isDirectParent ? undefined : sub.subId}
                                  size="sm"
                                />
                                <span className="text-slate-200 text-xs font-medium truncate max-w-[130px]">
                                  {sub.subName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="text-red-400 font-semibold text-xs">
                                  {formatMoney(sub.cur, globalCurrency)}
                                </span>
                                {subTrend.trending === "up" && (
                                  <TrendingUp className="w-3 h-3 text-red-400" />
                                )}
                                {subTrend.trending === "down" && (
                                  <TrendingDown className="w-3 h-3 text-emerald-400" />
                                )}
                                {subTrend.trending === "flat" && (
                                  <Minus className="w-3 h-3 text-slate-500" />
                                )}
                              </div>
                            </div>

                            {/* Sub Bars */}
                            <div className="space-y-1">
                              <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-red-500/80 transition-all duration-700"
                                  style={{ width: `${Math.min(100, Math.max(sub.cur > 0 ? 3 : 0, subPctCur))}%` }}
                                />
                              </div>
                              {sub.prev > 0 && (
                                <div className="w-full h-0.5 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-slate-600 transition-all duration-700"
                                    style={{ width: `${Math.min(100, Math.max(2, subPctPrev))}%` }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Sub Delta Label */}
                            <p
                              className={`text-[9px] font-medium ${
                                subTrend.trending === "up"
                                  ? "text-red-400"
                                  : subTrend.trending === "down"
                                  ? "text-emerald-400"
                                  : "text-slate-500"
                              }`}
                            >
                              {subTrend.percentText}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-slate-500 text-sm">
          No expense data this month
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-1.5 rounded-full bg-red-500" />
          <span className="text-slate-300 font-medium">This month</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-1 rounded-full bg-slate-600" />
          <span className="text-slate-400 font-medium">Prev month</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function MonthlySpendingReportChart({
  currentTransactions,
  previousTransactions,
  totalIncome,
  totalExpense,
  globalCurrency,
  monthYear,
}: MonthlySpendingReportChartProps) {
  const [reportMode, setReportMode] = useState<ReportMode>("trending");
  // slideDir: 1 = going right (trending→spending), -1 = going left (spending→trending)
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref for the spending-report scrollable div — used for native wheel interception
  const scrollRef = useRef<HTMLDivElement>(null);

  // Attach a non-passive native wheel listener so we can call preventDefault()
  // before the browser commits to scrolling the page.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      const atTop = el.scrollTop <= 0;
      const scrollingDown = e.deltaY > 0;
      const scrollingUp = e.deltaY < 0;

      // At a boundary AND moving in the exhausted direction → let the page scroll
      if ((scrollingDown && atBottom) || (scrollingUp && atTop)) return;

      // Card can still scroll in this direction → absorb the event entirely
      e.preventDefault();
      el.scrollTop += e.deltaY;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [reportMode]); // re-attach when the spending panel mounts/unmounts

  const today = new Date();
  const currentDay = today.getDate();
  const [selectedDay, setSelectedDay] = useState<number>(currentDay);

  const [yearStr, monthStr] = monthYear.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-indexed
  const daysInMonth = new Date(year, month, 0).getDate();

  // ─── Animated mode switch ─────────────────────────────────────────────────
  const switchMode = (dir: 1 | -1) => {
    if (isAnimating) return;
    setSlideDir(dir);
    setIsAnimating(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setReportMode((m) => (m === "trending" ? "spending" : "trending"));
      setIsAnimating(false);
    }, 240);
  };

  // Compute daily cumulative spending for current month & previous month
  // Always use convertedToGlobal so amounts match the user's chosen global currency
  const chartData = useMemo(() => {
    const dailyCurrent: number[] = new Array(daysInMonth + 1).fill(0);
    const dailyPrev: number[] = new Array(daysInMonth + 1).fill(0);

    currentTransactions.forEach((tx) => {
      if (tx.type === "EXPENSE") {
        const d = new Date(tx.date).getDate();
        if (d >= 1 && d <= daysInMonth) {
          // Prefer pre-converted global amount; fall back to convertedAmountIDR only if unavailable
          dailyCurrent[d] +=
            tx.convertedToGlobal ?? tx.convertedAmountIDR ?? tx.amount ?? 0;
        }
      }
    });

    previousTransactions.forEach((tx) => {
      if (tx.type === "EXPENSE") {
        const d = new Date(tx.date).getDate();
        if (d >= 1 && d <= daysInMonth) {
          dailyPrev[d] +=
            tx.convertedToGlobal ?? tx.convertedAmountIDR ?? tx.amount ?? 0;
        }
      }
    });

    // Cumulative sums
    let cumCurrent = 0;
    let cumPrev = 0;
    const points = [];

    for (let day = 1; day <= daysInMonth; day++) {
      cumPrev += dailyPrev[day];

      // Current month only shows points up to today if it's the active month
      const isPastOrToday = day <= currentDay;
      if (isPastOrToday) {
        cumCurrent += dailyCurrent[day];
      }

      points.push({
        day,
        label: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`,
        current: isPastOrToday ? Math.round(cumCurrent) : null,
        previous: Math.round(cumPrev),
      });
    }

    return points;
  }, [currentTransactions, previousTransactions, daysInMonth, currentDay, month]);

  // Selected day amounts
  const selectedPoint =
    chartData[Math.min(selectedDay - 1, chartData.length - 1)] || chartData[0];
  const selectedCurrent = selectedPoint?.current ?? totalExpense;
  const selectedPrev = selectedPoint?.previous ?? 0;
  const formattedSelectedDate = `${String(selectedDay).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;

  // Slide transition style
  const bodyStyle: React.CSSProperties = isAnimating
    ? {
        transform: `translateX(${slideDir * -32}px)`,
        opacity: 0,
        transition:
          "transform 240ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease",
      }
    : {
        transform: "translateX(0px)",
        opacity: 1,
        transition:
          "transform 240ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease",
      };

  return (
    <div className="money-card p-5 space-y-4 bg-[#141519] border border-white/8 rounded-3xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-white text-base font-bold tracking-tight">
          Report this month
        </h3>
        <Link
          href="/transactions"
          className="text-[var(--color-primary-light)] hover:opacity-80 text-xs font-semibold tracking-wide transition-colors"
        >
          See reports
        </Link>
      </div>

      {/* 2-Column Summary */}
      <div className="grid grid-cols-2 pt-1 pb-2 border-b border-white/6">
        <div>
          <p className="text-slate-400 text-xs font-medium">Total spent</p>
          <p className="text-red-400 font-extrabold text-lg mt-0.5 tracking-tight">
            ≈ {formatMoney(totalExpense, globalCurrency)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-xs font-medium">Total income</p>
          <p className="text-sky-400 font-extrabold text-lg mt-0.5 tracking-tight">
            ≈ {formatMoney(totalIncome, globalCurrency)}
          </p>
        </div>
      </div>

      {/* ── Animated report body — fixed height so the card never grows ────── */}
      <div className="h-[312px] overflow-hidden relative" style={bodyStyle}>
        {reportMode === "trending" ? (
          <>
            {/* Selected Day Stats Badge */}
            <div className="bg-[#1b1d24] border border-white/6 rounded-2xl p-3 shadow-inner mb-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{formattedSelectedDate}:</span>
                <span className="text-red-400 font-bold">
                  ≈ {formatMoney(selectedCurrent, globalCurrency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-slate-500">Previous month:</span>
                <span className="text-slate-400 font-medium">
                  ≈ {formatMoney(selectedPrev, globalCurrency)}
                </span>
              </div>
            </div>

            {/* Cumulative Line Chart */}
            <div className="w-full h-48 -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  onMouseMove={(state) => {
                    if (
                      state &&
                      state.activeTooltipIndex !== undefined &&
                      state.activeTooltipIndex !== null
                    ) {
                      const idx = Number(state.activeTooltipIndex);
                      if (!isNaN(idx)) {
                        setSelectedDay(idx + 1);
                      }
                    }
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(255, 255, 255, 0.06)"
                  />
                  <XAxis
                    dataKey="day"
                    ticks={[1, daysInMonth]}
                    tickFormatter={(d) =>
                      `${String(d).padStart(2, "0")}/${String(month).padStart(2, "0")}`
                    }
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${Math.round(v / 1000)}k` : v
                    }
                  />
                  <Tooltip content={<></>} />

                  {/* Previous month grey curve */}
                  <Line
                    type="monotone"
                    dataKey="previous"
                    stroke="#64748b"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />

                  {/* Current month red curve */}
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="#ef4444"
                    strokeWidth={2.8}
                    dot={(props) => {
                      if (props.payload.day === currentDay) {
                        return (
                          <circle
                            key="active-dot"
                            cx={props.cx}
                            cy={props.cy}
                            r={5}
                            fill="#ef4444"
                            stroke="#ffffff"
                            strokeWidth={2}
                            className="animate-pulse"
                          />
                        );
                      }
                      return <></>;
                    }}
                    activeDot={{
                      r: 6,
                      fill: "#ef4444",
                      stroke: "#ffffff",
                      strokeWidth: 2,
                    }}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chart Legend */}
            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-slate-300 font-medium">This month</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                  <span className="text-slate-400 font-medium">
                    Previous month
                  </span>
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto overscroll-y-auto pr-0.5"
            style={{ scrollbarWidth: "none" }}
          >
            <SpendingReportView
              currentTransactions={currentTransactions}
              previousTransactions={previousTransactions}
              totalExpense={totalExpense}
              totalIncome={totalIncome}
              globalCurrency={globalCurrency}
              month={month}
            />
          </div>
        )}
      </div>

      {/* ── Bottom Mode Navigator ─────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 pt-2 text-xs font-semibold text-[var(--color-primary-light)] border-t border-white/6">
        <button
          type="button"
          onClick={() => switchMode(-1)}
          disabled={isAnimating}
          className="p-1 hover:opacity-80 transition-opacity disabled:opacity-40"
          aria-label="Previous report"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Pill indicators + label */}
        <div className="flex items-center gap-2">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              reportMode === "trending"
                ? "w-4 bg-[var(--color-primary-light)]"
                : "w-1.5 bg-white/20"
            }`}
          />
          <span className="tracking-wide min-w-[108px] text-center">
            {reportMode === "trending" ? "Trending report" : "Spending report"}
          </span>
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              reportMode === "spending"
                ? "w-4 bg-[var(--color-primary-light)]"
                : "w-1.5 bg-white/20"
            }`}
          />
        </div>

        <button
          type="button"
          onClick={() => switchMode(1)}
          disabled={isAnimating}
          className="p-1 hover:opacity-80 transition-opacity disabled:opacity-40"
          aria-label="Next report"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
