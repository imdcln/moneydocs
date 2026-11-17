"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  Search,
  Sparkles,
  AlertCircle,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  CATEGORIES_TREE,
  ParentCategory,
  SubCategory,
  getCategoryDisplayName,
  isLoanCategory,
} from "@/lib/categories";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { formatMoney } from "@/lib/currency";

export interface ConvertDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: {
    _id: string;
    type: string;
    title: string;
    amount: number;
    currency: string;
    category: string;
    subCategory?: string;
    debtRepaidAmount?: number;
    debtStatus?: string;
    debtParty?: string;
    withPeople?: string[];
  };
  onConverted: (updatedTx: any) => void;
}

export default function ConvertDebtModal({
  isOpen,
  onClose,
  transaction,
  onConverted,
}: ConvertDebtModalProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | undefined>(undefined);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({
    bills_utilities: true,
    food_beverage: true,
    shopping: true,
    transportation: true,
    housing: true,
  });
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter only standard EXPENSE categories
  const expenseCategories = useMemo(
    () => CATEGORIES_TREE.filter((c) => c.type === "EXPENSE"),
    []
  );

  const repaidAmount = Number(transaction.debtRepaidAmount) || 0;
  const remainingDebt = Math.max(0, transaction.amount - repaidAmount);
  const isFullyRepaid = remainingDebt <= 0 || transaction.debtStatus === "PAID";
  const party = transaction.debtParty || (transaction.withPeople?.[0]) || "";

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setError(null);
      setConverting(false);
      // Pre-select popular or sensible default category if not selected
      setSelectedCategory("bills_utilities");
      setSelectedSubCategory(undefined);
    }
  }, [isOpen]);

  const toggleExpand = (id: string) => {
    setExpandedParents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const matchesSearch = (text: string) =>
    text.toLowerCase().includes(search.toLowerCase());

  const handleSelectParent = (parent: ParentCategory) => {
    setSelectedCategory(parent.id);
    setSelectedSubCategory(undefined);
    setError(null);
  };

  const handleSelectChild = (parent: ParentCategory, child: SubCategory) => {
    setSelectedCategory(parent.id);
    setSelectedSubCategory(child.id);
    setError(null);
  };

  const handleConvert = async () => {
    if (!selectedCategory) {
      setError("Please choose an expense category first.");
      return;
    }

    if (!isFullyRepaid) {
      setError(
        `Debt is not fully repaid yet. Remaining balance: ${formatMoney(
          remainingDebt,
          transaction.currency
        )}.`
      );
      return;
    }

    setConverting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/finance/transactions/${transaction._id}/convert-to-expense`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: selectedCategory,
            subCategory: selectedSubCategory || undefined,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to convert debt into an expense transaction");
      }

      onConverted(data.transaction);
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while converting");
    } finally {
      setConverting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="w-full max-w-lg bg-[#12141a] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-white/8 bg-[#161820] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[var(--color-primary-subtle)] border border-[var(--color-primary-border)] text-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Convert Paid Debt</h2>
                  <p className="text-xs text-slate-400">
                    Select an expense category for this debt
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={converting}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Debt Summary Pill */}
            <div className="p-4 bg-gradient-to-r from-[var(--color-primary-subtle)] via-white/[0.02] to-transparent border-b border-white/6">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">
                  {party ? `Debt paid to ${party}` : transaction.title || "Repaid Debt"}
                </span>
                <span className="font-extrabold text-[var(--color-primary-light)] text-sm">
                  {formatMoney(transaction.amount, transaction.currency)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Select an expense category to convert this debt.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Search Categories */}
            <div className="p-3 border-b border-white/6 bg-[#12141a]">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search expense category (e.g. Dining, Rent, Travel)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#181a22] border border-white/8 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>

            {/* Category Tree List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {expenseCategories.map((parent) => {
                const isParentSelected =
                  selectedCategory === parent.id && !selectedSubCategory;
                const isExpanded = search ? true : expandedParents[parent.id] ?? false;

                const filteredChildren = parent.children.filter(
                  (child) =>
                    matchesSearch(parent.name) || matchesSearch(child.name)
                );

                if (
                  search &&
                  !matchesSearch(parent.name) &&
                  filteredChildren.length === 0
                ) {
                  return null;
                }

                return (
                  <div
                    key={parent.id}
                    className={`rounded-2xl border transition-all ${
                      selectedCategory === parent.id
                        ? "bg-[#181d26] border-[var(--color-primary-border)] shadow-sm shadow-[var(--color-primary-glow)]"
                        : "bg-[#15171e] border-white/6 hover:border-white/10"
                    }`}
                  >
                    {/* Parent Row */}
                    <div className="flex items-center justify-between p-3">
                      <button
                        type="button"
                        onClick={() => handleSelectParent(parent)}
                        className="flex items-center gap-3 flex-1 text-left min-w-0"
                      >
                        <CategoryIcon categoryId={parent.id} size="md" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {parent.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {parent.children.length} subcategories
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 ml-2">
                        {isParentSelected && (
                          <span className="w-6 h-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center flex-shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                        )}
                        {parent.children.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(parent.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Subcategories (Collapsible) */}
                    {isExpanded && filteredChildren.length > 0 && (
                      <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-1">
                        {filteredChildren.map((child) => {
                          const isChildSelected =
                            selectedCategory === parent.id &&
                            selectedSubCategory === child.id;
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => handleSelectChild(parent, child)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all ${
                                isChildSelected
                                  ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)] border border-[var(--color-primary-border)]"
                                  : "hover:bg-white/5 text-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <CategoryIcon
                                  categoryId={parent.id}
                                  subCategoryId={child.id}
                                  size="sm"
                                />
                                <span className="text-xs font-medium truncate">
                                  {child.name}
                                </span>
                              </div>
                              {isChildSelected && (
                                <Check className="w-3.5 h-3.5 text-[var(--color-primary-light)] stroke-[3]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer with Selected Category & Actions */}
            <div className="p-4 border-t border-white/8 bg-[#161820] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Target Category:</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <CategoryIcon
                    categoryId={selectedCategory || "other_expense"}
                    subCategoryId={selectedSubCategory}
                    size="sm"
                  />
                  <span>
                    {selectedCategory
                      ? getCategoryDisplayName(selectedCategory, selectedSubCategory)
                      : "None selected"}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={converting}
                  className="w-1/3 py-3 px-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-colors text-center disabled:opacity-50"
                >
                  Keep as Debt
                </button>
                <button
                  type="button"
                  onClick={handleConvert}
                  disabled={converting || !selectedCategory || !isFullyRepaid}
                  style={{
                    background: "var(--color-primary-gradient, var(--color-primary))",
                    boxShadow: "0 6px 20px var(--color-primary-glow)",
                  }}
                  className="flex-1 py-3 px-4 rounded-2xl bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {converting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Converting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Confirm & Convert</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
