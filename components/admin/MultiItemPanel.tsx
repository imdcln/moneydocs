"use client";

import { useEffect, useCallback } from "react";
import { Trash2, Plus } from "lucide-react";
import { getCategoryDisplayName } from "@/lib/categories";
import CategoryIcon from "@/components/ui/CategoryIcon";
import CategoryPickerModal from "./CategoryPickerModal";
import { useState } from "react";

export interface SplitItem {
  id: string;
  title: string;
  amount: string;
  category: string;
  subCategory?: string;
}

interface MultiItemPanelProps {
  transactionType: "EXPENSE" | "INCOME" | "DEBT";
  currency: string;
  mainCategory: string;
  mainSubCategory?: string;
  items: SplitItem[];
  onChange: (items: SplitItem[]) => void;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeDefaultItem(category: string, subCategory?: string): SplitItem {
  return { id: generateId(), title: "", amount: "", category, subCategory };
}

export default function MultiItemPanel({
  transactionType,
  currency,
  mainCategory,
  mainSubCategory,
  items,
  onChange,
}: MultiItemPanelProps) {
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const [prevMainCategory, setPrevMainCategory] = useState(mainCategory);
  const [prevMainSubCategory, setPrevMainSubCategory] = useState(mainSubCategory);

  // Seed 2 rows on first activation
  useEffect(() => {
    if (items.length === 0) {
      onChange([
        makeDefaultItem(mainCategory, mainSubCategory),
        makeDefaultItem(mainCategory, mainSubCategory),
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync category when parent changes it
  useEffect(() => {
    if (mainCategory !== prevMainCategory || mainSubCategory !== prevMainSubCategory) {
      if (items.length > 0) {
        onChange(
          items.map((item) =>
            item.category === prevMainCategory && item.subCategory === prevMainSubCategory
              ? { ...item, category: mainCategory, subCategory: mainSubCategory }
              : item
          )
        );
      }
      setPrevMainCategory(mainCategory);
      setPrevMainSubCategory(mainSubCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainCategory, mainSubCategory]);

  const updateItem = useCallback(
    (id: string, patch: Partial<Omit<SplitItem, "id">>) => {
      onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    },
    [items, onChange]
  );

  const addItem = () => {
    onChange([...items, makeDefaultItem(mainCategory, mainSubCategory)]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    onChange(items.filter((item) => item.id !== id));
  };

  const pickerItem = items.find((i) => i.id === pickerOpenFor);

  return (
    <div className="rounded-2xl bg-[#1a1c22] border border-white/8 overflow-visible">
      {/* Item rows */}
      <div className="divide-y divide-white/5">
        {items.map((item, index) => (
          <div key={item.id} className="px-3 py-3 space-y-2">
            {/* Row top: index + name + delete */}
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-white/8 text-slate-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0 select-none">
                {index + 1}
              </span>
              <input
                type="text"
                placeholder="Item name"
                value={item.title}
                onChange={(e) => updateItem(item.id, { title: e.target.value })}
                className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-slate-500 outline-none border-b border-white/10 focus:border-[var(--color-primary)]/60 pb-0.5 transition-colors duration-150"
              />
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={items.length <= 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                aria-label="Remove item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Row bottom: amount + category */}
            <div className="flex items-center gap-2 pl-7">
              {/* Amount */}
              <div className="flex items-center gap-1 bg-[#131418] border border-white/8 rounded-xl px-2.5 py-1.5 focus-within:border-[var(--color-primary)]/50 transition-colors flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-slate-500 flex-shrink-0">{currency}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={item.amount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, "");
                    updateItem(item.id, { amount: val });
                  }}
                  className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-slate-500 outline-none text-right"
                />
              </div>

              {/* Category selector */}
              <button
                type="button"
                onClick={() => setPickerOpenFor(item.id)}
                className="flex items-center gap-1.5 shrink-0 max-w-[140px] px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 hover:border-white/15 transition-colors"
              >
                {item.category ? (
                  <CategoryIcon categoryId={item.category} subCategoryId={item.subCategory} size="sm" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-white/10 flex-shrink-0" />
                )}
                <span className="text-[11px] text-slate-300 truncate">
                  {item.category
                    ? getCategoryDisplayName(item.category, item.subCategory)
                    : "Category"}
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add item footer */}
      <div className="px-3 py-2.5 border-t border-white/6">
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 text-xs text-slate-300 hover:text-white hover:bg-white/8 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add item
        </button>
      </div>

      {/* Per-item category picker */}
      {pickerOpenFor && pickerItem && (
        <CategoryPickerModal
          isOpen
          onClose={() => setPickerOpenFor(null)}
          type={transactionType}
          selectedCategory={pickerItem.category}
          selectedSubCategory={pickerItem.subCategory}
          onSelect={(cat, subCat) => {
            updateItem(pickerOpenFor, { category: cat, subCategory: subCat });
            setPickerOpenFor(null);
          }}
        />
      )}
    </div>
  );
}
