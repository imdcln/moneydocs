"use client";

import { useState } from "react";
import { ArrowLeft, Search, X, Check } from "lucide-react";
import { CATEGORIES_TREE } from "@/lib/categories";
import CategoryIcon, { AllCategoriesGlobeGraphic } from "@/components/ui/CategoryIcon";

/**
 * Each selected category key is one of:
 *   "ALL_CATEGORIES"          Ã¢â€ â€™ all expense categories
 *   "food_beverage"           Ã¢â€ â€™ entire parent (all subcategories included)
 *   "food_beverage:drinks"    Ã¢â€ â€™ specific subcategory
 */
export type CategoryKey = string;

interface SelectCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Current selection as an array of CategoryKeys */
  selectedCategories: CategoryKey[];
  onSelect: (categories: CategoryKey[]) => void;
}

export default function SelectCategoryModal({
  isOpen,
  onClose,
  selectedCategories,
  onSelect,
}: SelectCategoryModalProps) {
  const [search, setSearch] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(false);

  if (!isOpen) return null;

  const expenseParents = CATEGORIES_TREE.filter((c) => c.type === "EXPENSE");

  const isAllCategoriesSelected = selectedCategories.includes("ALL_CATEGORIES");

  /** Toggle "All Categories" */
  const handleToggleAllCategories = () => {
    if (isAllCategoriesSelected) {
      onSelect([]);
    } else {
      onSelect(["ALL_CATEGORIES"]);
    }
  };

  /** Check if a parent is fully selected (parent key exists OR all children are individually selected) */
  const isParentChecked = (parentId: string): boolean => {
    if (isAllCategoriesSelected) return true;
    return selectedCategories.includes(parentId);
  };

  /** Check if a child is selected (parent selected, all-categories, or child key exists) */
  const isChildChecked = (parentId: string, childId: string): boolean => {
    if (isAllCategoriesSelected) return true;
    if (selectedCategories.includes(parentId)) return true;
    return selectedCategories.includes(`${parentId}:${childId}`);
  };

  /** Toggle a parent category. Selecting parent removes individual child keys and adds parent key.
   *  Deselecting parent removes parent key and all its child keys. */
  const handleToggleParent = (parentId: string) => {
    const parent = expenseParents.find((p) => p.id === parentId);
    if (!parent) return;

    if (isAllCategoriesSelected) {
      onSelect([parentId]);
      return;
    }

    const childKeys = parent.children.map((c) => `${parentId}:${c.id}`);

    if (selectedCategories.includes(parentId)) {
      // Deselect: remove parent + all its child keys
      onSelect(selectedCategories.filter((k) => k !== parentId && !childKeys.includes(k)));
    } else {
      // Select: add parent key, remove individual child keys (parent implies all children)
      onSelect([
        ...selectedCategories.filter((k) => !childKeys.includes(k)),
        parentId,
      ]);
    }
  };

  /** Toggle a single child. If parent was checked, expand to individual children minus this one. */
  const handleToggleChild = (parentId: string, childId: string) => {
    const parent = expenseParents.find((p) => p.id === parentId);
    if (!parent) return;

    const childKey = `${parentId}:${childId}`;

    if (isAllCategoriesSelected) {
      onSelect([childKey]);
      return;
    }
    const allChildKeys = parent.children.map((c) => `${parentId}:${c.id}`);

    if (selectedCategories.includes(parentId)) {
      // Parent was selected Ã¢â€ â€™ expand to all child keys then remove this one
      const expanded = allChildKeys.filter((k) => k !== childKey);
      onSelect([
        ...selectedCategories.filter((k) => k !== parentId),
        ...expanded,
      ]);
    } else if (selectedCategories.includes(childKey)) {
      // Deselect this child
      onSelect(selectedCategories.filter((k) => k !== childKey));
    } else {
      // Select this child
      const newSel = [...selectedCategories, childKey];
      // If all children of parent are now selected, collapse to parent key
      const allChildrenSelected = allChildKeys.every((k) => newSel.includes(k));
      if (allChildrenSelected) {
        onSelect([
          ...newSel.filter((k) => !allChildKeys.includes(k)),
          parentId,
        ]);
      } else {
        onSelect(newSel);
      }
    }
  };

  /** Count of selected items (excluding ALL_CATEGORIES, counting parent as 1, each child as 1) */
  const selectedCount = isAllCategoriesSelected ? 0 : selectedCategories.length;

  return (
    <div className="fixed inset-0 z-[95] bg-[#0c0d10] text-white flex flex-col animate-in fade-in duration-200">
      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Top Bar Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-[#111216]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white active:bg-white/10 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
          <h2 className="text-lg font-bold text-white tracking-tight">Select categories</h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSearchInput((v) => !v)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white active:bg-white/10 transition-colors cursor-pointer"
          >
            <Search className="w-5 h-5 stroke-[2.2]" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-sm tracking-wider uppercase px-2 py-1 rounded cursor-pointer transition-colors"
            style={{ color: "var(--color-primary-light)" }}
          >
            DONE{selectedCount > 0 && ` (${selectedCount})`}
          </button>
        </div>
      </div>

      {/* Optional Search Bar */}
      {showSearchInput && (
        <div className="px-4 py-2.5 bg-[#16181e] border-b border-white/8 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search category or subcategory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Scrollable Category List Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-28">
        {/* Row 1: All Categories */}
        <div
          onClick={handleToggleAllCategories}
          className="flex items-center justify-between py-2 px-1 cursor-pointer group select-none"
        >
          <div className="flex items-center gap-3.5">
            <AllCategoriesGlobeGraphic size={36} />
            <span className="text-white text-base font-bold tracking-tight">
              All Categories
            </span>
          </div>

          {/* Checkbox */}
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all ${
              isAllCategoriesSelected
                ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                : "border-slate-600 bg-transparent"
            }`}
          >
            {isAllCategoriesSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/8" />

        {/* Section Header: EXPENSE */}
        <div>
          <span className="text-xs font-bold text-slate-500 tracking-wider uppercase block mb-3 px-1">
            EXPENSE
          </span>

          <div className="space-y-4">
            {expenseParents
              .filter((p) => {
                if (!search) return true;
                const matchParent = p.name.toLowerCase().includes(search.toLowerCase());
                const matchChild = p.children.some((c) =>
                  c.name.toLowerCase().includes(search.toLowerCase())
                );
                return matchParent || matchChild;
              })
              .map((parent) => {
                const parentChecked = isParentChecked(parent.id);
                const hasChildren = parent.children.length > 0;
                // Partially selected: some but not all children selected (parent key not present)
                const someChildrenSelected =
                  !parentChecked &&
                  !isAllCategoriesSelected &&
                  parent.children.some((c) =>
                    selectedCategories.includes(`${parent.id}:${c.id}`)
                  );

                return (
                  <div key={parent.id} className="space-y-2">
                    {/* Parent Row */}
                    <div
                      onClick={() => handleToggleParent(parent.id)}
                      className="flex items-center justify-between py-1.5 px-1 cursor-pointer group select-none"
                    >
                      <div className="flex items-center gap-3.5">
                        <CategoryIcon categoryId={parent.id} size="sm" />
                        <span className="text-white text-sm font-semibold tracking-wide">
                          {parent.name}
                        </span>
                      </div>

                      {/* Parent Checkbox (indeterminate style when partial) */}
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all ${
                          parentChecked
                            ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                            : someChildrenSelected
                            ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)]"
                            : "border-slate-600 bg-transparent"
                        }`}
                      >
                        {parentChecked && (
                          <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                        )}
                        {someChildrenSelected && !parentChecked && (
                          <div className="w-2 h-0.5 bg-[var(--color-primary-light)] rounded-full" />
                        )}
                      </div>
                    </div>

                    {/* Children */}
                    {hasChildren && (
                      <div className="relative pl-7 space-y-2">
                        {/* Vertical tree trunk line */}
                        <div className="absolute left-4 top-0 bottom-3 w-[1.5px] bg-slate-700/60" />

                        {parent.children
                          .filter((child) => {
                            if (!search) return true;
                            return (
                              child.name.toLowerCase().includes(search.toLowerCase()) ||
                              parent.name.toLowerCase().includes(search.toLowerCase())
                            );
                          })
                          .map((child) => {
                            const childChecked = isChildChecked(parent.id, child.id);

                            return (
                              <div
                                key={child.id}
                                onClick={() => handleToggleChild(parent.id, child.id)}
                                className="relative flex items-center justify-between py-1.5 px-1 cursor-pointer group select-none"
                              >
                                {/* Horizontal tree branch line */}
                                <div className="absolute -left-3 top-1/2 w-3 h-[1.5px] bg-slate-700/60 -translate-y-1/2" />

                                <div className="flex items-center gap-3">
                                  <CategoryIcon
                                    categoryId={parent.id}
                                    subCategoryId={child.id}
                                    size="sm"
                                  />
                                  <span className="text-slate-200 text-sm font-normal">
                                    {child.name}
                                  </span>
                                </div>

                                {/* Child Checkbox */}
                                <div
                                  className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all ${
                                    childChecked
                                      ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                                      : "border-slate-600 bg-transparent"
                                  }`}
                                >
                                  {childChecked && (
                                    <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
