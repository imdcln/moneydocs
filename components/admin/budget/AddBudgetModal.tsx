"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Wallet as WalletIcon,
  ChevronRight,
  Check,
  AlertCircle,
} from "lucide-react";
import CategoryIcon, { AllCategoriesGlobeGraphic } from "@/components/ui/CategoryIcon";
import { CalendarIcon } from "@/components/ui/AppIcons";
import { CATEGORIES_TREE, getCategoryDisplayName, getCategoriesDisplayLabel } from "@/lib/categories";
import { formatThousands, getCurrencyDisplayCode } from "@/lib/currency";
import {
  BudgetPeriodType,
  getMonthRange,
  formatBudgetPeriodDisplay,
  getBudgetCategoryIcons,
} from "@/lib/budgetUtils";
import BudgetCategoryIcons from "./BudgetCategoryIcons";
import CustomKeypad from "@/components/admin/CustomKeypad";
import SelectTimeRangeModal from "./SelectTimeRangeModal";
import SelectCategoryModal, { CategoryKey } from "./SelectCategoryModal";

interface Wallet {
  _id: string;
  name: string;
  currency: string;
}

interface BudgetEditData {
  _id: string;
  name?: string;
  category: string;
  subCategory?: string;
  /** Multi-category list (new format) */
  categories?: string[];
  amountLimit: number;
  currency?: string;
  periodType?: BudgetPeriodType;
  startDate?: Date | string;
  endDate?: Date | string;
  repeat?: boolean;
  walletId?: { _id: string; name: string } | string;
}

interface AddBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userCurrency?: string;
  wallets: Wallet[];
  initialBudget?: BudgetEditData | null;
  initialWalletId?: string;
}

/**
 * Derive a CategoryKey[] from legacy category/subCategory fields.
 * Used when loading old budget data that doesn't have `categories` array yet.
 */
function legacyCategoryToKeys(category: string, subCategory?: string): CategoryKey[] {
  if (category === "ALL_CATEGORIES" || category === "ALL" || category === "all_categories") {
    return ["ALL_CATEGORIES"];
  }
  if (subCategory) {
    return [`${category}:${subCategory}`];
  }
  if (category) {
    return [category];
  }
  return ["ALL_CATEGORIES"];
}

/**
 * Get the primary category key for the icon display (first key in list).
 */
function getPrimaryIconKey(keys: CategoryKey[]): { parentId: string; childId?: string } {
  if (keys.length === 0 || keys.includes("ALL_CATEGORIES")) {
    return { parentId: "ALL_CATEGORIES" };
  }
  const [parentId, childId] = keys[0].split(":");
  return { parentId, childId };
}

export default function AddBudgetModal({
  isOpen,
  onClose,
  onSuccess,
  userCurrency = "IDR",
  wallets,
  initialBudget = null,
  initialWalletId = "ALL",
}: AddBudgetModalProps) {
  const isEditing = !!initialBudget;

  const [selectedCategories, setSelectedCategories] = useState<CategoryKey[]>(["ALL_CATEGORIES"]);
  const [budgetName, setBudgetName] = useState<string>("");
  const [rawAmount, setRawAmount] = useState<string>("0");
  const [periodType, setPeriodType] = useState<BudgetPeriodType>("MONTH");
  const [startDate, setStartDate] = useState<Date>(getMonthRange(new Date()).startDate);
  const [endDate, setEndDate] = useState<Date>(getMonthRange(new Date()).endDate);
  const [walletId, setWalletId] = useState<string>(initialWalletId || "ALL");
  const [repeat, setRepeat] = useState<boolean>(false);

  // Sub-modal states
  const [isTimeRangeModalOpen, setIsTimeRangeModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [isWalletPickerOpen, setIsWalletPickerOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Initialize or reset when modal opens or initialBudget changes
  useEffect(() => {
    if (!isOpen) return;

    Promise.resolve().then(() => {
      if (initialBudget) {
        setBudgetName(initialBudget.name || "");
        // Prefer new `categories` array; fall back to legacy fields
        if (initialBudget.categories && initialBudget.categories.length > 0) {
          setSelectedCategories(initialBudget.categories);
        } else {
          setSelectedCategories(
            legacyCategoryToKeys(
              initialBudget.category || "ALL_CATEGORIES",
              initialBudget.subCategory
            )
          );
        }
        setRawAmount(String(initialBudget.amountLimit || "0"));
        setPeriodType(initialBudget.periodType || "MONTH");
        const s = initialBudget.startDate ? new Date(initialBudget.startDate) : getMonthRange(new Date()).startDate;
        let e = initialBudget.endDate ? new Date(initialBudget.endDate) : getMonthRange(new Date()).endDate;
        if ((initialBudget.periodType === "MONTH" || !initialBudget.periodType) && e.getDate() === 1 && e.getMonth() !== s.getMonth()) {
          e = new Date(s.getFullYear(), s.getMonth() + 1, 0, 23, 59, 59, 999);
        }
        setStartDate(s);
        setEndDate(e);
        setRepeat(!!initialBudget.repeat);
        const wId = typeof initialBudget.walletId === "object" && initialBudget.walletId?._id
          ? initialBudget.walletId._id
          : typeof initialBudget.walletId === "string"
          ? initialBudget.walletId
          : "ALL";
        setWalletId(wId);
      } else {
        setSelectedCategories(["ALL_CATEGORIES"]);
        setBudgetName("");
        setRawAmount("0");
        const defMonth = getMonthRange(new Date());
        setPeriodType("MONTH");
        setStartDate(defMonth.startDate);
        setEndDate(defMonth.endDate);
        setRepeat(false);
        // Default creation budget to currently opened wallet
        setWalletId(initialWalletId || "ALL");
      }
      setIsKeypadOpen(false);
      setError("");
    });
  }, [isOpen, initialBudget, initialWalletId]);

  const selectedWallet = wallets.find((w) => w._id === walletId);
  const walletDisplayName = selectedWallet ? selectedWallet.name : "Total";
  const activeCurrency = selectedWallet ? selectedWallet.currency : (initialBudget?.currency || userCurrency);
  const displayCurrencyCode = getCurrencyDisplayCode(activeCurrency);

  /**
   * Derive legacy `category` / `subCategory` from the first selected key
   * for backward-compat with the API and duplicate-check logic.
   */
  const primaryKey = selectedCategories[0] || "ALL_CATEGORIES";
  const isAllCategories = selectedCategories.includes("ALL_CATEGORIES") || selectedCategories.length === 0;
  const [primaryParentId, primaryChildId] = primaryKey.split(":");
  const legacyCategory = isAllCategories ? "ALL_CATEGORIES" : primaryParentId;
  const legacySubCategory = isAllCategories ? undefined : primaryChildId;

  const handleSave = async () => {
    const numAmount = parseFloat(rawAmount.replace(/,/g, ""));
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid budget amount limit greater than 0.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let safeEnd = new Date(endDate);
      if ((periodType === "MONTH" || !periodType) && safeEnd.getDate() === 1 && safeEnd.getMonth() !== startDate.getMonth()) {
        safeEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      // Build the canonical categories list (deduplicated)
      const finalCategories: CategoryKey[] = isAllCategories
        ? ["ALL_CATEGORIES"]
        : [...new Set(selectedCategories)];

      const midTime = startDate.getTime() + (safeEnd.getTime() - startDate.getTime()) / 2;
      const mid = new Date(midTime);
      const calculatedMonthYear = `${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, "0")}`;

      const payload = {
        name: budgetName.trim() ? budgetName.trim() : null,
        // Legacy fields derived from primary key (for backward compat)
        category: legacyCategory,
        subCategory: legacySubCategory || undefined,
        // New multi-category array
        categories: finalCategories,
        amountLimit: numAmount,
        currency: activeCurrency,
        periodType,
        startDate: startDate.toISOString(),
        endDate: safeEnd.toISOString(),
        repeat,
        walletId: walletId !== "ALL" ? walletId : undefined,
        monthYear: calculatedMonthYear,
      };

      let res: Response;
      if (isEditing && initialBudget?._id) {
        res = await fetch("/api/finance/budgets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, _id: initialBudget._id }),
        });
      } else {
        res = await fetch("/api/finance/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || "Failed to save budget.");
      }
    } catch {
      setError("A network error occurred. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const periodDisplayText = formatBudgetPeriodDisplay(periodType, startDate, endDate);
  const displayLabel = getCategoriesDisplayLabel(selectedCategories);
  const isAllCats = selectedCategories.includes("ALL_CATEGORIES") || selectedCategories.length === 0;
  const isMultiCategories = !isAllCats && selectedCategories.length > 1;
  const showBudgetNameSection = isMultiCategories || (isEditing && !!initialBudget?.name);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          {/* Dark Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Main Sheet: slides up from bottom covering the entire page (just like AddTransactionModal) */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative z-[70] w-full max-w-lg mx-auto bg-[#131418] border-t border-white/10 rounded-t-[2.5rem] shadow-2xl flex flex-col h-[94vh] overflow-hidden"
          >
            {/* Top Header */}
            <div className="flex items-center gap-4 px-6 pt-5 pb-3 border-b border-white/6 bg-[#131418]">
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5 stroke-[2.2]" />
              </button>
              <h2 className="text-white font-bold text-lg tracking-tight">
                {isEditing ? "Edit Budget" : "Add Budget"}
              </h2>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Card 1: Category, Amount, Time Range, Wallet */}
              <div className="bg-[#1b1c21] border border-white/6 rounded-2xl divide-y divide-white/6 overflow-hidden">
                {/* Budget Name Section (automatically added above select category when multiple categories are selected) */}
                {showBudgetNameSection && (
                  <div className="p-4 bg-white/[0.015]">
                    <label className="text-slate-400 text-xs font-medium block mb-1.5">
                      Budget Name <span className="text-slate-500 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={budgetName}
                      onChange={(e) => setBudgetName(e.target.value)}
                      placeholder="e.g. Utilities & Food"
                      maxLength={50}
                      className="w-full bg-transparent text-white text-base font-semibold placeholder:text-slate-600 focus:outline-none"
                    />
                  </div>
                )}

                {/* Row 1: Select Category */}
                <div
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <BudgetCategoryIcons
                      icons={getBudgetCategoryIcons({ categories: selectedCategories })}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <span className="text-white text-base font-semibold truncate block">
                        {budgetName.trim() || displayLabel}
                      </span>
                      {!isAllCats && selectedCategories.length > 1 && (
                        <span className="text-slate-400 text-xs block truncate">
                          {displayLabel} • {selectedCategories.length} categories
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                </div>

                {/* Row 2: Amount Display with Large Green Number & Currency Badge */}
                <div
                  onClick={() => setIsKeypadOpen(true)}
                  className="p-4 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors"
                >
                  <span className="text-slate-400 text-xs block mb-1">Amount</span>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-md bg-[#252830] text-slate-300 text-xs font-bold tracking-wide">
                      {displayCurrencyCode}
                    </span>
                    <span className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-primary-light)" }}>
                      {formatThousands(rawAmount) || "0"}
                    </span>
                  </div>
                </div>

                {/* Row 3: Time Range Selector */}
                <div
                  onClick={() => setIsTimeRangeModalOpen(true)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <CalendarIcon size={20} color="#94a3b8" className="flex-shrink-0" />
                    <span className="text-white text-sm font-medium truncate">
                      {periodDisplayText}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                </div>

                {/* Row 4: Wallet Selector (defaults to currently opened wallet) */}
                <div
                  onClick={() => setIsWalletPickerOpen((v) => !v)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <WalletIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <span className="text-white text-sm font-medium truncate">
                      {walletDisplayName}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                </div>
              </div>

              {/* Wallet Picker Dropdown Drawer if open */}
              {isWalletPickerOpen && (
                <div className="bg-[#1f2128] border border-white/10 rounded-2xl p-2 space-y-1 shadow-xl animate-in fade-in duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      setWalletId("ALL");
                      setIsWalletPickerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                      walletId === "ALL" ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]" : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <span>Total (All Wallets)</span>
                    {walletId === "ALL" && <Check className="w-4 h-4 text-[var(--color-primary-light)]" />}
                  </button>
                  {wallets.map((w) => (
                    <button
                      key={w._id}
                      type="button"
                      onClick={() => {
                        setWalletId(w._id);
                        setIsWalletPickerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                        walletId === w._id ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]" : "text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      <span>💳 {w.name} ({w.currency})</span>
                      {walletId === w._id && <Check className="w-4 h-4 text-[var(--color-primary-light)]" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Card 2: Repeat this budget checkbox */}
              <div
                onClick={() => setRepeat((v) => !v)}
                className="bg-[#1b1c21] border border-white/6 rounded-2xl p-4 flex items-center gap-3.5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors select-none"
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                    repeat
                      ? "bg-[var(--color-primary)] text-white border border-[var(--color-primary)]"
                      : "border-2 border-slate-600 bg-transparent"
                  }`}
                >
                  {repeat && <Check className="w-3.5 h-3.5 text-white stroke-[3.5]" />}
                </div>

                <div>
                  <p className="text-white text-sm font-semibold">Repeat this budget</p>
                  <p className="text-slate-400 text-xs">Budget will renew automatically.</p>
                </div>
              </div>

              {/* Polished UX Error Display */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3.5 flex items-start gap-3 animate-in fade-in duration-150">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 min-w-0">
                    <p className="text-red-400 text-xs font-semibold">Cannot Save Budget</p>
                    <p className="text-slate-300 text-xs leading-relaxed">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Save Footer */}
            <div className="px-6 py-4 border-t border-white/8 bg-[#131418]">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3.5 rounded-full bg-[#26282f] hover:bg-[#32353e] active:bg-[#22c55e] active:text-white text-white font-bold text-sm tracking-wide transition-all shadow-md active:scale-[0.99] cursor-pointer disabled:opacity-50 text-center"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.div>

          {/* Floating Custom Keypad — slides up from bottom covering bottom nav */}
          <AnimatePresence>
            {isKeypadOpen && (
              <>
                <motion.div
                  key="keypad-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setIsKeypadOpen(false)}
                  className="fixed inset-0 z-[75] bg-black/50"
                />
                <motion.div
                  key="keypad-panel"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 350 }}
                  className="fixed bottom-0 left-0 right-0 z-[80] w-full max-w-lg mx-auto bg-[#18191f] border-t border-white/10 rounded-t-3xl shadow-2xl px-4 pt-3 pb-6"
                >
                  <div className="flex justify-center mb-3">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                  </div>
                  <div className="flex items-center justify-between px-2 pb-3 border-b border-white/6 mb-2">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Amount</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 bg-white/6 px-2 py-0.5 rounded-lg">{displayCurrencyCode}</span>
                      <span className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--color-primary-light)" }}>{formatThousands(rawAmount) || "0"}</span>
                    </div>
                  </div>
                  <CustomKeypad
                    value={rawAmount}
                    onChange={(val) => setRawAmount(val)}
                    onSubmit={() => setIsKeypadOpen(false)}
                    showQuickChips={false}
                  />
                  <div className="px-2 pt-3 pb-2 border-t border-white/8 mt-2">
                    <button
                      type="button"
                      onClick={() => setIsKeypadOpen(false)}
                      className="w-full py-3.5 rounded-full bg-[#26282f] hover:bg-[#32353e] active:bg-[#1f2026] text-white font-bold text-sm tracking-wide transition-all shadow-md active:scale-[0.99] text-center cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Sub Modals */}
          <SelectTimeRangeModal
            isOpen={isTimeRangeModalOpen}
            onClose={() => setIsTimeRangeModalOpen(false)}
            selectedPeriodType={periodType}
            startDate={startDate}
            endDate={endDate}
            onSave={(type, s, e) => {
              setPeriodType(type);
              let safeE = e;
              if ((type === "MONTH" || !type) && safeE.getDate() === 1 && safeE.getMonth() !== s.getMonth()) {
                safeE = new Date(s.getFullYear(), s.getMonth() + 1, 0, 23, 59, 59, 999);
              }
              setStartDate(s);
              setEndDate(safeE);
            }}
          />

          <SelectCategoryModal
            isOpen={isCategoryModalOpen}
            onClose={() => setIsCategoryModalOpen(false)}
            selectedCategories={selectedCategories}
            onSelect={(cats) => setSelectedCategories(cats)}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
