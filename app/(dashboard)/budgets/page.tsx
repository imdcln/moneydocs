"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  HelpCircle,
  ChevronRight,
  Repeat,
  CheckCircle2,
  PlayCircle,
  GripVertical,
  ArrowUpDown,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { Reorder, useDragControls, motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import { EmptyBudgetIllustration } from "@/components/ui/AppIcons";
import CategoryIcon, { AllCategoriesGlobeGraphic } from "@/components/ui/CategoryIcon";
import { getCategoryDisplayName } from "@/lib/categories";
import { type BudgetPeriodType, getDaysBetween, getBudgetCategoryIcons, getBudgetDisplayName } from "@/lib/budgetUtils";
import BudgetCategoryIcons from "@/components/admin/budget/BudgetCategoryIcons";
import AddBudgetModal from "@/components/admin/budget/AddBudgetModal";
import WalletSwitcher from "@/components/admin/WalletSwitcher";
import { useWalletContext } from "@/hooks/useWalletContext";
import PageLoading from "@/components/ui/PageLoading";
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from "@/lib/clientCache";

interface BudgetDetailData {
  _id: string;
  name?: string;
  category: string;
  subCategory?: string;
  /** Multi-category list (new format) */
  categories?: string[];
  amountLimit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  currency?: string;
  periodType?: "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
  startDate: Date | string;
  endDate: Date | string;
  repeat?: boolean;
  order?: number;
  walletId?: { _id: string; name: string; currency?: string } | string;
  isOtherCategories?: boolean;
  childBudgetsTotal?: number;
  childBudgetsExceed?: boolean;
  childBudgetsExceededAmount?: number;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Speedometer Gauge SVG Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// A true upper semicircle (180Ã‚Â° arc) running from left (-R, 0) to right (+R, 0).
// Both ends sit at the exact same horizontal baseline (the same Y axis).
// Green progress sweeps clockwise from the left (0% spent) up over the arch.
// A white-filled circular indicator with green border marks the spent boundary.
function SpeedometerGauge({
  spentPercent,      // 0Ã¢â‚¬â€œ100, percentage of total budget spent
  canSpend,          // numeric remaining amount
  isOver = false,    // whether spending is above budget limit
  overspentAmount = 0, // how much over budget
}: {
  spentPercent: number;
  canSpend: number;
  isOver?: boolean;
  overspentAmount?: number;
}) {
  const cx = 140;
  const cy = 135;
  const R = 110;
  const strokeWidth = 8;

  // Semicircle: from 180Ã‚Â° (left, (cx - R, cy)) clockwise over the top (90Ã‚Â°) to 0Ã‚Â° (right, (cx + R, cy))
  // In standard SVG coordinate system:
  // Left point: (cx - R, cy)
  // Right point: (cx + R, cy)
  // Arc over the top: A R R 0 0 1 (cx + R) cy
  const leftX = cx - R;
  const leftY = cy;
  const rightX = cx + R;
  const rightY = cy;

  const trackPath = `M ${leftX} ${leftY} A ${R} ${R} 0 0 1 ${rightX} ${rightY}`;

  // Clamped spent percentage (0 to 100), full (100) if over budget
  const clamped = isOver ? 100 : Math.min(100, Math.max(0, spentPercent));
  
  // Angle for progress:
  // at 0%: theta = Ãâ‚¬ (180Ã‚Â°), x = cx - R, y = cy
  // at 50%: theta = Ãâ‚¬/2 (90Ã‚Â°), x = cx, y = cy - R (the top peak)
  // at 100%: theta = 0 (0Ã‚Â°), x = cx + R, y = cy
  const theta = Math.PI - (clamped / 100) * Math.PI;
  const dotX = cx + R * Math.cos(theta);
  const dotY = cy - R * Math.sin(theta);

  // Large arc flag is 1 if angle swept > 180Ã‚Â°, but for a semicircle max sweep is 180Ã‚Â°, so largeArc is always 0
  const progressPath =
    clamped > 0.5
      ? `M ${leftX} ${leftY} A ${R} ${R} 0 0 1 ${dotX.toFixed(2)} ${dotY.toFixed(2)}`
      : "";

  return (
    <div className="w-full max-w-[280px] mx-auto select-none">
      <svg
        viewBox="0 0 280 155"
        className="w-full h-auto overflow-visible"
      >
        {/* Grey background semicircle track */}
        <path
          d={trackPath}
          fill="none"
          stroke="#272932"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Progress arc */}
        {progressPath && (
          <path
            d={progressPath}
            fill="none"
            stroke={isOver ? "#ef4444" : "var(--color-primary)"}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}

        {/* Indicator dot at boundary */}
        <circle
          cx={dotX}
          cy={dotY}
          r="6.5"
          fill="#ffffff"
          stroke={isOver ? "#ef4444" : "var(--color-primary)"}
          strokeWidth="3.5"
        />

        {/* Label: Amount you can spend */}
        <text
          x={cx}
          y={cy - 48}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="12.5"
          fontWeight="500"
          fontFamily="inherit"
        >
          Amount you can spend
        </text>

        {/* Primary value: 1,775 or 46,531 */}
        <text
          x={cx}
          y={isOver ? cy - 16 : cy - 12}
          textAnchor="middle"
          fill={isOver ? "#ef4444" : "var(--color-primary)"}
          fontSize="30"
          fontWeight="800"
          fontFamily="inherit"
          letterSpacing="-0.02em"
        >
          {Math.round(canSpend).toLocaleString()}
        </text>

        {/* Small text below the amount you can spend number: overspend text + amount */}
        {isOver && (
          <text
            x={cx}
            y={cy + 6}
            textAnchor="middle"
            fill="#ef4444"
            fontSize="11"
            fontWeight="600"
            fontFamily="inherit"
            letterSpacing="0.02em"
          >
            {`Overspent ${overspentAmount >= 1_000_000 ? `${(overspentAmount / 1_000_000).toFixed(1)}M` : overspentAmount >= 1_000 ? `${(overspentAmount / 1_000).toFixed(overspentAmount % 1_000 === 0 ? 0 : 1)}K` : Math.round(overspentAmount).toLocaleString()}`}
          </text>
        )}
      </svg>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Finished Budget Period Group Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Groups finished budgets that share the same period (same startDate+endDate).
interface FinishedPeriodGroup {
  key: string;
  startDate: Date;
  endDate: Date;
  budgets: BudgetDetailData[];
}

function groupFinishedBudgetsByPeriod(budgets: BudgetDetailData[]): FinishedPeriodGroup[] {
  const groups: Map<string, FinishedPeriodGroup> = new Map();
  for (const b of budgets) {
    const start = new Date(b.startDate);
    let end = new Date(b.endDate);
    if ((b.periodType === "MONTH" || !b.periodType) && end.getDate() === 1 && end.getMonth() !== start.getMonth()) {
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    // Key: period start+end strings
    const key = `${start.toDateString()}__${end.toDateString()}`;
    if (!groups.has(key)) {
      groups.set(key, { key, startDate: start, endDate: end, budgets: [] });
    }
    groups.get(key)!.budgets.push(b);
  }
  // Sort groups by endDate descending (most recently finished first)
  return Array.from(groups.values()).sort(
    (a, b) => b.endDate.getTime() - a.endDate.getTime()
  );
}

function DraggableBudgetCard({
  budget,
  isReordering,
  monthYear,
  selectedWalletId,
}: {
  budget: BudgetDetailData;
  isReordering: boolean;
  monthYear: string;
  selectedWalletId?: string;
}) {
  const controls = useDragControls();
  const isOver = budget.spent > budget.amountLimit;
  const startObj = new Date(budget.startDate);
  let endObj = new Date(budget.endDate);
  if (
    (budget.periodType === "MONTH" || !budget.periodType) &&
    endObj.getDate() === 1 &&
    endObj.getMonth() !== startObj.getMonth()
  ) {
    endObj = new Date(startObj.getFullYear(), startObj.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  const totalDays = getDaysBetween(startObj, endObj);
  const now = new Date();
  const daysPassed = Math.max(
    0,
    Math.min(
      totalDays,
      Math.round((now.getTime() - startObj.getTime()) / 86400000) + 1
    )
  );
  const todayPercent = Math.min(95, Math.max(5, (daysPassed / totalDays) * 100));
  const isBudgetFinished = now > endObj;

  const innerContent = (
    <div
      className={`bg-[#141519] border rounded-3xl p-4 transition-all ${
        isReordering
          ? "border-white/15 shadow-md cursor-default"
          : "border-white/8 cursor-pointer hover:border-white/15 active:scale-[0.99]"
      }`}
    >
      {/* Row: 6-button handle + Icon + Name | Amount + Overspent */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* 6 button at very left div for drag and drop order */}
          {isReordering && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                controls.start(e);
              }}
              className="cursor-grab active:cursor-grabbing p-1.5 -ml-1 text-slate-500 hover:text-slate-200 transition-colors touch-none flex-shrink-0"
              aria-label="Drag to reorder"
              title="Drag to reorder"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          <BudgetCategoryIcons
            icons={getBudgetCategoryIcons(budget)}
            size="md"
          />
          <div className="min-w-0 flex items-center gap-1.5 flex-1">
            <h3 className="text-white font-bold text-base truncate">
              {getBudgetDisplayName(budget)}
            </h3>
            {budget.repeat && (
              <Repeat
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: "var(--color-primary-light)" }}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col items-end flex-shrink-0 ml-2">
          <span className="text-white font-bold text-base">
            {Number(budget.amountLimit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          {isOver ? (
            <span className="text-red-400 text-xs font-semibold">
              Overspent{" "}
              {Number(budget.spent - budget.amountLimit).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </span>
          ) : (
            <span className="text-slate-400 text-xs">
              {Number(budget.remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })} left
            </span>
          )}
        </div>
      </div>

      {/* Progress bar + Today marker */}
      <div className="relative mt-2.5 pb-5">
        <div className="w-full h-2 rounded-full bg-[#1e2027] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, budget.percentUsed)}%`,
              backgroundColor: isOver ? "#ef4444" : "var(--color-primary)",
            }}
          />
        </div>
        {!isBudgetFinished && (
          <div
            className="absolute top-2.5 -translate-x-1/2 flex flex-col items-center pointer-events-none"
            style={{ left: `${todayPercent}%` }}
          >
            <div className="w-0.5 h-1.5 bg-white/40 mb-0.5" />
            <span className="px-2 py-0.5 rounded-md bg-[#252830] text-slate-300 text-[9px] font-medium">
              Today
            </span>
          </div>
        )}
      </div>
    </div>
  );

  if (isReordering) {
    return (
      <Reorder.Item
        value={budget}
        id={budget._id}
        dragListener={false}
        dragControls={controls}
        className="relative list-none select-none"
        whileDrag={{
          scale: 1.02,
          boxShadow: "0 12px 28px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--color-primary, #6366f1)",
          zIndex: 50,
        }}
      >
        {innerContent}
      </Reorder.Item>
    );
  }

  return (
    <Link
      href={`/budgets/${budget._id}?monthYear=${monthYear}${
        selectedWalletId && selectedWalletId !== "ALL" ? `&walletId=${selectedWalletId}` : ""
      }`}
      className="block"
    >
      {innerContent}
    </Link>
  );
}

const PERIOD_CONFIG: Record<BudgetPeriodType, { label: string; endLabel: string }> = {
  MONTH: { label: "This Month", endLabel: "End of month" },
  WEEK: { label: "This Week", endLabel: "End of week" },
  QUARTER: { label: "This Quarter", endLabel: "End of quarter" },
  YEAR: { label: "This Year", endLabel: "End of year" },
  CUSTOM: { label: "Custom", endLabel: "End of period" },
};
const ORDERED_PERIODS: BudgetPeriodType[] = ["MONTH", "WEEK", "QUARTER", "YEAR", "CUSTOM"];

export default function BudgetsPage() {
  const now = new Date();
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Ã¢â€â‚¬Ã¢â€â‚¬ Mode: "running" | "finished" Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [pageMode, setPageMode] = useState<"running" | "finished">("running");
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);

  const [monthYear, setMonthYear] = useState(currentMonthYear);
  const [activePeriodTab, setActivePeriodTab] = useState<BudgetPeriodType>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("last_opened_budget_tab") as BudgetPeriodType | null;
      if (saved && ["WEEK", "MONTH", "QUARTER", "YEAR", "CUSTOM"].includes(saved)) {
        return saved;
      }
    }
    return "MONTH";
  });
  const [budgets, setBudgets] = useState<BudgetDetailData[]>(() => {
    if (typeof window !== "undefined") {
      const cached = getCache<BudgetDetailData[]>("moneydocs_budgets_initial");
      if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      const cached = getCache<BudgetDetailData[]>("moneydocs_budgets_initial");
      if (cached && Array.isArray(cached) && cached.length > 0) return false;
    }
    return true;
  });
  const [userCurrency, setUserCurrency] = useState("IDR");

  const { wallets, selectedWalletId, activeWalletPermissions, getPermissionsForWallet } = useWalletContext();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetDetailData | null>(null);
  const canReadBudgets =
    selectedWalletId === "ALL"
      ? (wallets as any[]).some((w) => getPermissionsForWallet(w._id).budgets.read)
      : activeWalletPermissions.budgets.read;

  const canCreateBudgets =
    selectedWalletId === "ALL"
      ? (wallets as any[]).some((w) => getPermissionsForWallet(w._id).budgets.create)
      : activeWalletPermissions.budgets.create;

  const budgetFetchAbortRef = useRef<AbortController | null>(null);

  // Drag and drop reordering state
  const [isReordering, setIsReordering] = useState(false);
  const [reorderList, setReorderList] = useState<BudgetDetailData[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isBarFloating, setIsBarFloating] = useState(false);
  const reorderBarSentinelRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setShowModeDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchBudgets = async () => {
    budgetFetchAbortRef.current?.abort();
    const controller = new AbortController();
    budgetFetchAbortRef.current = controller;
    await Promise.resolve();
    if (budgets.length === 0) {
      setLoading(true);
    }
    try {
      const walletParam =
        selectedWalletId !== "ALL" ? `&walletId=${selectedWalletId}` : "&walletId=GLOBAL";

      let url: string;
      if (pageMode === "finished") {
        url = `/api/finance/budgets?mode=finished${walletParam}`;
      } else if (pageMode === "running") {
        url = `/api/finance/budgets?mode=running${walletParam}`;
      } else {
        url = `/api/finance/budgets?monthYear=${monthYear}${walletParam}`;
      }

      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();
      const bList = data.budgets ?? [];
      setBudgets(bList);
      if (pageMode === "running" && (!selectedWalletId || selectedWalletId === "ALL")) {
        setCache("moneydocs_budgets_initial", bList, 30_000);
      }
      if (data.globalCurrency) setUserCurrency(data.globalCurrency);
    } catch (e) {
      if ((e as Error).name !== "AbortError") throw e;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Use sessionStorage cache to avoid redundant user fetch on revisit
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setIsReordering(false);
    Promise.resolve().then(fetchBudgets);
  }, [monthYear, selectedWalletId, pageMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Float the reorder action bar when it scrolls out of view
  useEffect(() => {
    if (!isReordering) {
      setIsBarFloating(false);
      return;
    }
    const sentinel = reorderBarSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsBarFloating(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isReordering]);

  const handleOpenAddModal = () => {
    if (!canCreateBudgets) {
      toast("You do not have permission to create budgets in this wallet.", "error");
      return;
    }
    setEditingBudget(null);
    setShowAddModal(true);
  };

  const handleStartReorder = () => {
    setShowModeDropdown(false);
    const reorderable = cardBudgets.filter((b) => !b.isOtherCategories);
    if (reorderable.length < 2) {
      toast("Need at least 2 category budgets to reorder", "info");
      return;
    }
    setReorderList(reorderable);
    setIsReordering(true);
  };

  const handleCancelReorder = () => {
    setIsReordering(false);
    setReorderList([]);
  };

  const handleSaveReorder = async () => {
    setIsSavingOrder(true);
    try {
      const orderedIds = reorderList.map((b) => b._id);
      const res = await fetch("/api/finance/budgets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      if (!res.ok) {
        throw new Error("Failed to save budget order");
      }
      toast("Budget order saved", "success");
      setIsReordering(false);
      // Re-fetch from server so the displayed order reflects what was actually persisted
      await fetchBudgets();
    } catch {
      toast("Failed to update budget order", "error");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const selectedWallet = wallets.find((w) => w._id === selectedWalletId);
  const walletLabel    = selectedWallet ? selectedWallet.name : "Global";
  const activeCurrency = selectedWallet ? selectedWallet.currency : userCurrency;

  // Days left in the selected month
  const [yearStr, monthStr] = monthYear.split("-");
  const daysInMonth = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10), 0).getDate();
  const daysLeft    = Math.max(0, daysInMonth - now.getDate());

  // Ã¢â€â‚¬Ã¢â€â‚¬ Separate ALL_CATEGORIES budget from the rest Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // â”€â”€ Dynamic Period Tabs Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const existingPeriodTypes = Array.from(
    new Set(budgets.map((b) => (b.periodType || "MONTH") as BudgetPeriodType))
  );
  let availablePeriods: BudgetPeriodType[] = ORDERED_PERIODS.filter((p) =>
    existingPeriodTypes.includes(p)
  );
  if (availablePeriods.length === 0) {
    availablePeriods = ["MONTH"];
  }

  // Ensure active tab stays in sync with available tabs
  useEffect(() => {
    if (availablePeriods.length > 0 && !availablePeriods.includes(activePeriodTab)) {
      setActivePeriodTab(availablePeriods[0]);
    }
  }, [availablePeriods, activePeriodTab]);

  const handleSelectTab = (tab: BudgetPeriodType) => {
    setActivePeriodTab(tab);
    if (typeof window !== "undefined") {
      localStorage.setItem("last_opened_budget_tab", tab);
      document.cookie = `last_opened_budget_tab=${tab}; path=/; max-age=31536000; SameSite=Lax`;
    }
  };

  // â”€â”€ Filter budgets for active tab (running mode) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const currentTabBudgets = pageMode === "running"
    ? budgets.filter((b) => (b.periodType || "MONTH") === activePeriodTab)
    : budgets;

  const allCatBudget = currentTabBudgets.find(
    (b) => b.category === "ALL_CATEGORIES" || b.category === "ALL"
  );
  // Only show non-ALL_CATEGORIES budgets in the card list
  const cardBudgets = currentTabBudgets.filter(
    (b) => b.category !== "ALL_CATEGORIES" && b.category !== "ALL"
  );

  // â”€â”€ Child budgets exceeding limit check for All Categories card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const specificChildBudgets = cardBudgets.filter(
    (b) => !b.isOtherCategories && b.category !== "OTHER_CATEGORIES"
  );
  const childBudgetsTotal = allCatBudget
    ? (allCatBudget.childBudgetsTotal ?? specificChildBudgets.reduce((s, b) => s + (b.amountLimit || 0), 0))
    : 0;
  const childBudgetsExceed = allCatBudget
    ? (allCatBudget.childBudgetsExceed ?? childBudgetsTotal > allCatBudget.amountLimit)
    : false;
  const childBudgetsExceededAmount = allCatBudget
    ? (allCatBudget.childBudgetsExceededAmount ?? Math.max(0, childBudgetsTotal - allCatBudget.amountLimit))
    : 0;

  // â”€â”€ Days left in active period â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let daysLeftInPeriod = daysLeft;
  if (pageMode === "running") {
    const refEnd = allCatBudget?.endDate
      ? new Date(allCatBudget.endDate)
      : cardBudgets[0]?.endDate
      ? new Date(cardBudgets[0].endDate)
      : null;
    if (refEnd) {
      daysLeftInPeriod = Math.max(0, Math.ceil((refEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  // â”€â”€ Gauge stats: prefer ALL_CATEGORIES budget; fall back to sum of cards â”€â”€
  const totalBudgetLimit = allCatBudget
    ? allCatBudget.amountLimit
    : cardBudgets.reduce((s, b) => s + (b.amountLimit || 0), 0);

  const totalSpent = allCatBudget
    ? allCatBudget.spent
    : cardBudgets.reduce((s, b) => s + (b.spent || 0), 0);

  const canSpend    = Math.max(0, totalBudgetLimit - totalSpent);
  const overspentAmount = Math.max(0, totalSpent - totalBudgetLimit);
  const spentPercent =
    totalBudgetLimit > 0 ? Math.min(100, (totalSpent / totalBudgetLimit) * 100) : 0;
  const isOverBudget =
    (totalBudgetLimit > 0 ? totalSpent > totalBudgetLimit : totalSpent > 0) ||
    (cardBudgets.length > 0 && cardBudgets.every((b) => b.spent > b.amountLimit));

  const formatK = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} M`;
    if (val >= 1_000)     return `${(val / 1_000).toFixed(val % 1_000 === 0 ? 0 : 2)} K`;
    return val.toLocaleString();
  };

  // Ã¢â€â‚¬Ã¢â€â‚¬ Finished budgets: group by period Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const finishedGroups = pageMode === "finished"
    ? groupFinishedBudgetsByPeriod(budgets)
    : [];

  if (loading && budgets.length === 0) {
    return (
      <PageLoading
        title="Loading Budgets..."
        subtitle="Calculating spending & allowances"
      />
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Header Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h1 className="text-white font-extrabold text-2xl tracking-tight">
          {pageMode === "finished" ? "Finished Budgets" : "Running Budgets"}
        </h1>
        <div className="flex items-center gap-2">
          <WalletSwitcher iconOnly />
          {/* Ã¢â€â‚¬Ã¢â€â‚¬ Three-dot menu for mode switching Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
          <div className="relative" ref={modeDropdownRef}>
            <button
              onClick={() => setShowModeDropdown((v) => !v)}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              aria-label="More options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {showModeDropdown && (
              <div className="absolute right-0 top-11 w-52 bg-[#1a1d27] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                {pageMode === "running" ? (
                  <>
                    <button
                      onClick={() => {
                        setPageMode("finished");
                        setShowModeDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-slate-200 hover:bg-white/5 transition-colors border-b border-white/6"
                    >
                      <CheckCircle2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="font-medium">Finished Budgets</span>
                    </button>
                    <button
                      onClick={handleStartReorder}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-slate-200 hover:bg-white/5 transition-colors"
                    >
                      <ArrowUpDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="font-medium">Order Budget</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setPageMode("running");
                      setShowModeDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-slate-200 hover:bg-white/5 transition-colors"
                  >
                    <PlayCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="font-medium">Running Budgets</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Tab row (only for running mode) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {pageMode === "running" && (
        <div className="flex items-center gap-6 px-5 pb-1 border-b border-white/8 overflow-x-auto no-scrollbar">
          {availablePeriods.map((period) => {
            const isActive = activePeriodTab === period;
            return (
              <button
                key={period}
                type="button"
                onClick={() => handleSelectTab(period)}
                className={`pb-2.5 text-sm font-bold transition-all relative whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {PERIOD_CONFIG[period]?.label || period}
                {isActive && (
                  <motion.div
                    layoutId="activeBudgetTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* â”€â”€ Reorder Action Bar (inline) â”€â”€ */}
      {isReordering && pageMode === "running" && (
        <div className="px-5 pt-3">
          <div className="p-3.5 rounded-2xl bg-[#1b1c23] border border-white/10 flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-2.5 min-w-0 mr-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
                <GripVertical className="w-4 h-4 text-[var(--color-primary-light)]" />
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-bold leading-tight">Order Budgets</p>
                <p className="text-slate-400 text-[11px] leading-tight truncate">Drag handles to sort</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                disabled={isSavingOrder}
                onClick={handleCancelReorder}
                className="px-3.5 py-1.5 rounded-full border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingOrder}
                onClick={handleSaveReorder}
                className="px-4 py-1.5 rounded-full text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                {isSavingOrder ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
          {/* Sentinel â€” when this leaves the viewport the floating clone appears */}
          <div ref={reorderBarSentinelRef} aria-hidden="true" />
        </div>
      )}

      {/* â”€â”€ Reorder Action Bar (floating clone, shown when scrolled past inline bar) â”€â”€ */}
      <AnimatePresence>
        {isReordering && pageMode === "running" && isBarFloating && (
          <motion.div
            key="floating-reorder-bar"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2.5rem)] max-w-lg"
          >
            <div className="p-3.5 rounded-2xl bg-[#1b1c23]/95 border border-white/15 backdrop-blur-md flex items-center justify-between shadow-2xl">
              <div className="flex items-center gap-2.5 min-w-0 mr-2">
                <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
                  <GripVertical className="w-4 h-4 text-[var(--color-primary-light)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-bold leading-tight">Order Budgets</p>
                  <p className="text-slate-400 text-[11px] leading-tight truncate">Drag handles to sort</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  disabled={isSavingOrder}
                  onClick={handleCancelReorder}
                  className="px-3.5 py-1.5 rounded-full border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingOrder}
                  onClick={handleSaveReorder}
                  className="px-4 py-1.5 rounded-full text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  {isSavingOrder ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Content Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {loading ? (
        <div className="space-y-3 px-5 pt-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 rounded-3xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : pageMode === "finished" ? (
        /* Ã¢â€â‚¬Ã¢â€â‚¬ FINISHED BUDGETS VIEW Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
        budgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center pt-16 pb-12 px-6 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-slate-600" />
            <h2 className="text-white text-xl font-extrabold tracking-tight mt-2">
              No finished budgets
            </h2>
            <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
              Budgets that have passed their end date will appear here
            </p>
          </div>
        ) : (
          <div className="px-5 pt-4 space-y-6">
            {finishedGroups.map((group) => (
              <div key={group.key}>
                {/* Period header */}
                <p className="text-slate-300 font-semibold text-sm mb-3">
                  {`${String(group.startDate.getDate()).padStart(2, "0")}/${String(group.startDate.getMonth() + 1).padStart(2, "0")}/${group.startDate.getFullYear()} - ${String(group.endDate.getDate()).padStart(2, "0")}/${String(group.endDate.getMonth() + 1).padStart(2, "0")}/${group.endDate.getFullYear()}`}
                </p>

                {/* Budget cards for this period Ã¢â‚¬â€ ALL_CATEGORIES rendered as flat card */}
                <div className="space-y-3">
                  {group.budgets.map((b) => {
                    const isOver = b.spent > b.amountLimit;
                    const isAllCat = b.category === "ALL_CATEGORIES" || b.category === "ALL";
                    return (
                      <Link
                        key={b._id}
                        href={`/budgets/${b._id}?monthYear=${b.startDate ? `${new Date(b.startDate).getFullYear()}-${String(new Date(b.startDate).getMonth() + 1).padStart(2, "0")}` : monthYear}${selectedWalletId && selectedWalletId !== "ALL" ? `&walletId=${selectedWalletId}` : ""}`}
                        className="block bg-[#141519] border border-white/8 rounded-3xl p-4 cursor-pointer hover:border-white/15 active:scale-[0.99] transition-all"
                      >
                        {/* Row: Icon + Name | Amount + status */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <BudgetCategoryIcons
                              icons={getBudgetCategoryIcons(b)}
                              size="md"
                            />
                            <div className="min-w-0 flex items-center gap-1.5 flex-1">
                              <h3 className="text-white font-bold text-base truncate">
                                {getBudgetDisplayName(b)}
                              </h3>
                            </div>
                          </div>

                          <div className="flex flex-col items-end flex-shrink-0 ml-2">
                            <span className="text-white font-bold text-base">
                              {Number(b.amountLimit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                            {isOver ? (
                              <span className="text-red-400 text-xs font-semibold">
                                Overspent{" "}
                                {Number(b.spent - b.amountLimit).toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">
                                Left {Number(b.remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress bar (no Today marker for finished) */}
                        <div className="mt-2.5">
                          <div className="w-full h-2 rounded-full bg-[#1e2027] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${Math.min(100, b.percentUsed)}%`,
                                backgroundColor: isOver ? "#ef4444" : "var(--color-primary)",
                              }}
                            />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      ) : currentTabBudgets.length === 0 ? (
        /* â”€â”€ RUNNING BUDGETS EMPTY STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        <div className="flex flex-col items-center justify-center text-center pt-16 pb-12 px-6 space-y-4">
          <EmptyBudgetIllustration />
          <h2 className="text-white text-xl font-extrabold tracking-tight mt-2">
            You have no {PERIOD_CONFIG[activePeriodTab]?.label.toLowerCase() || ""} budget for {walletLabel}
          </h2>
          <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
            Start saving money by creating budgets and we will help you stick with it
          </p>
          <div className="pt-2 w-full max-w-xs">
            <button
              onClick={handleOpenAddModal}
              className="w-full py-4 rounded-full text-white font-bold text-sm shadow-xl active:scale-[0.98] transition-all cursor-pointer hover:opacity-95"
              style={{
                backgroundColor: "var(--color-primary)",
                boxShadow: "0 10px 25px -4px var(--color-primary-glow)",
              }}
            >
              Create a budget
            </button>
          </div>
        </div>
      ) : (
        /* Ã¢â€â‚¬Ã¢â€â‚¬ RUNNING BUDGETS VIEW Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
        <>
          {/* Ã¢â€â‚¬Ã¢â€â‚¬ Unified All Categories Card (Clickable unity into detail page) Ã¢â€â‚¬Ã¢â€â‚¬ */}
          {allCatBudget ? (
            <Link
              href={`/budgets/${allCatBudget._id}?monthYear=${monthYear}${
                selectedWalletId && selectedWalletId !== "ALL" ? `&walletId=${selectedWalletId}` : ""
              }`}
              className="block mx-5 mt-4 bg-[#141519] border border-white/8 rounded-3xl overflow-hidden cursor-pointer hover:border-white/15 active:scale-[0.99] transition-all"
            >
              {/* All Categories header row Ã¢â‚¬â€ seamless with card, no divider line */}
              <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
                <div className="flex items-center gap-3">
                  <AllCategoriesGlobeGraphic size={34} />
                  <span className="text-white font-semibold text-sm">All Categories</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>

              {/* Gauge + stats */}
              <div className="px-5 pt-2 pb-5 space-y-4">
                {/* Speedometer */}
                <SpeedometerGauge spentPercent={spentPercent} canSpend={canSpend} isOver={isOverBudget} overspentAmount={overspentAmount} />

                {/* 3 stats */}
                <div className="flex items-center divide-x divide-white/10 pt-1">
                  <div className="flex-1 text-center px-1">
                    <p className="text-white font-bold text-sm tracking-tight">{formatK(totalBudgetLimit)}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">Total budgets</p>
                  </div>
                  <div className="flex-1 text-center px-1">
                    <p className="text-white font-bold text-sm tracking-tight">{formatK(totalSpent)}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">Total spent</p>
                  </div>
                  <div className="flex-1 text-center px-1">
                    <p className="text-white font-bold text-sm tracking-tight">{daysLeftInPeriod} days</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">{PERIOD_CONFIG[activePeriodTab]?.endLabel || "End of period"}</p>
                  </div>
                </div>

                {/* Warning when child budgets exceed All Categories limit */}
                {childBudgetsExceed && (
                  <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
                    <p className="leading-snug">
                      <span className="font-semibold text-amber-200">Warning:</span> Total child budgets ({formatK(childBudgetsTotal)}) exceed the All Categories budget limit ({formatK(allCatBudget.amountLimit)}) by {formatK(childBudgetsExceededAmount)}.
                    </p>
                  </div>
                )}

                {/* Create Budget */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenAddModal();
                  }}
                  className="w-full py-3.5 rounded-full text-white font-bold text-sm shadow-xl active:scale-[0.98] transition-all cursor-pointer hover:opacity-95"
                  style={{
                    backgroundColor: "var(--color-primary)",
                    boxShadow: "0 10px 25px -4px var(--color-primary-glow)",
                  }}
                >
                  Create Budget
                </button>
              </div>
            </Link>
          ) : (
            <div
              onClick={handleOpenAddModal}
              className="mx-5 mt-4 bg-[#141519] border border-white/8 rounded-3xl overflow-hidden cursor-pointer hover:border-white/15 active:scale-[0.99] transition-all"
            >
              {/* All Categories header row Ã¢â‚¬â€ seamless with card, no divider line */}
              <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
                <div className="flex items-center gap-3">
                  <AllCategoriesGlobeGraphic size={34} />
                  <span className="text-white font-semibold text-sm">All Categories</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>

              {/* Gauge + stats */}
              <div className="px-5 pt-2 pb-5 space-y-4">
                {/* Speedometer */}
                <SpeedometerGauge spentPercent={spentPercent} canSpend={canSpend} isOver={isOverBudget} overspentAmount={overspentAmount} />

                {/* 3 stats */}
                <div className="flex items-center divide-x divide-white/10 pt-1">
                  <div className="flex-1 text-center px-1">
                    <p className="text-white font-bold text-sm tracking-tight">{formatK(totalBudgetLimit)}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">Total budgets</p>
                  </div>
                  <div className="flex-1 text-center px-1">
                    <p className="text-white font-bold text-sm tracking-tight">{formatK(totalSpent)}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">Total spent</p>
                  </div>
                  <div className="flex-1 text-center px-1">
                    <p className="text-white font-bold text-sm tracking-tight">{daysLeft} days</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">End of month</p>
                  </div>
                </div>

                {/* Create Budget */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAddModal();
                  }}
                  className="w-full py-3.5 rounded-full text-white font-bold text-sm shadow-xl active:scale-[0.98] transition-all cursor-pointer hover:opacity-95"
                  style={{
                    backgroundColor: "var(--color-primary)",
                    boxShadow: "0 10px 25px -4px var(--color-primary-glow)",
                  }}
                >
                  Create Budget
                </button>
              </div>
            </div>
          )}

          {/* Ã¢â€â‚¬Ã¢â€â‚¬ Individual budget cards (ALL_CATEGORIES excluded) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
          {isReordering ? (
            <div className="space-y-3.5">
              <Reorder.Group
                axis="y"
                values={reorderList}
                onReorder={setReorderList}
                className="px-5 mt-4 space-y-3.5 list-none"
              >
                {reorderList.map((b) => (
                  <DraggableBudgetCard
                    key={b._id}
                    budget={b}
                    isReordering={true}
                    monthYear={monthYear}
                    selectedWalletId={selectedWalletId}
                  />
                ))}
              </Reorder.Group>

              {cardBudgets
                .filter((b) => b.category === "OTHER_CATEGORIES" || b.isOtherCategories)
                .map((b) => (
                  <div key={b._id} className="px-5">
                    <div className="my-5 flex items-center">
                      <div className="h-px bg-white/10 flex-1" />
                    </div>
                    <DraggableBudgetCard
                      budget={b}
                      isReordering={false}
                      monthYear={monthYear}
                      selectedWalletId={selectedWalletId}
                    />
                  </div>
                ))}
            </div>
          ) : (
            <div className="px-5 mt-4 space-y-3.5">
              {cardBudgets.map((b, idx) => {
                const isOther = b.category === "OTHER_CATEGORIES" || b.isOtherCategories;
                return (
                  <div key={b._id}>
                    {/* Separator line and negative space when entering Other Categories (no text) */}
                    {isOther && idx > 0 && (
                      <div className="my-5 flex items-center">
                        <div className="h-px bg-white/10 flex-1" />
                      </div>
                    )}
                    <DraggableBudgetCard
                      budget={b}
                      isReordering={false}
                      monthYear={monthYear}
                      selectedWalletId={selectedWalletId}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Add / Edit Budget Modal Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <AddBudgetModal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingBudget(null); }}
        onSuccess={async (createdPeriod) => {
          await fetchBudgets();
          if (createdPeriod) {
            handleSelectTab(createdPeriod);
          }
        }}
        userCurrency={activeCurrency || userCurrency}
        wallets={wallets}
        initialBudget={editingBudget}
        initialWalletId={selectedWalletId}
        initialPeriodType={activePeriodTab}
      />
    </div>
  );
}
