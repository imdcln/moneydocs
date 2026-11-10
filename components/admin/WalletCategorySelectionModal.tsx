"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Search } from "lucide-react";
import { CATEGORIES_TREE, ParentCategory, SubCategory } from "@/lib/categories";
import CategoryIcon from "@/components/ui/CategoryIcon";

export interface WalletCategorySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  disabledCategories: string[];
  onChangeDisabled: (newDisabled: string[]) => void;
}

export default function WalletCategorySelectionModal({
  isOpen,
  onClose,
  disabledCategories,
  onChangeDisabled,
}: WalletCategorySelectionModalProps) {
  const [activeTab, setActiveTab] = useState<"EXPENSE" | "INCOME" | "DEBT">("EXPENSE");
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll when category modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const currentCategories = CATEGORIES_TREE.filter((c) => c.type === activeTab);

  // Flatten all items for current tab (parents and children)
  const allTabItemIds: string[] = [];
  currentCategories.forEach((parent) => {
    allTabItemIds.push(parent.id);
    parent.children.forEach((c) => allTabItemIds.push(c.id));
  });

  const allActiveInTab = allTabItemIds.every((id) => !disabledCategories.includes(id));

  const handleToggleAll = () => {
    if (allActiveInTab) {
      // Inactive all in this tab
      const set = new Set(disabledCategories);
      allTabItemIds.forEach((id) => set.add(id));
      onChangeDisabled(Array.from(set));
    } else {
      // Active all in this tab
      const set = new Set(disabledCategories);
      allTabItemIds.forEach((id) => set.delete(id));
      onChangeDisabled(Array.from(set));
    }
  };

  const toggleParent = (parent: (typeof currentCategories)[number]) => {
    const set = new Set(disabledCategories);
    const isCurrentlyDisabled = set.has(parent.id);

    if (isCurrentlyDisabled) {
      // Activating parent: turn on parent AND all its subcategories
      set.delete(parent.id);
      parent.children.forEach((c) => set.delete(c.id));
    } else {
      // Deactivating parent: turn off parent AND all its subcategories
      set.add(parent.id);
      parent.children.forEach((c) => set.add(c.id));
    }

    onChangeDisabled(Array.from(set));
  };

  const toggleChild = (parentId: string, childId: string) => {
    const set = new Set(disabledCategories);
    const isChildDisabled = set.has(childId);

    if (isChildDisabled) {
      // Turning ON subcategory: activate subcategory
      set.delete(childId);
      // If parent category is inactive, turn parent category ON too
      set.delete(parentId);
    } else {
      // Turning OFF subcategory: deactivate subcategory
      set.add(childId);
    }

    onChangeDisabled(Array.from(set));
  };

  const matchesSearch = (text: string) =>
    text.toLowerCase().includes(search.toLowerCase());

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-[#0c0d10] text-white flex flex-col overscroll-contain">
      <div className="max-w-lg mx-auto w-full h-full flex flex-col">
        {/* Top Bar matching Screenshot 3 */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8 bg-[#14161b]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-white">Category</h2>
          </div>

          <button
            type="button"
            onClick={handleToggleAll}
            className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary-light)] hover:brightness-110 cursor-pointer"
          >
            {allActiveInTab ? "INACTIVE ALL" : "ACTIVE ALL"}
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-white/6 bg-[#111216]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1c1e26] border border-white/8 rounded-2xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>

        {/* Tabs: EXPENSE | INCOME | DEBT/LOAN */}
        <div className="flex border-b border-white/8 bg-[#14161b] text-xs font-bold tracking-wider">
          <button
            type="button"
            onClick={() => setActiveTab("EXPENSE")}
            className={`flex-1 py-3 text-center transition-colors relative cursor-pointer ${
              activeTab === "EXPENSE" ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            EXPENSE
            {activeTab === "EXPENSE" && (
              <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-white rounded-full" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("INCOME")}
            className={`flex-1 py-3 text-center transition-colors relative cursor-pointer ${
              activeTab === "INCOME" ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            INCOME
            {activeTab === "INCOME" && (
              <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-white rounded-full" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("DEBT")}
            className={`flex-1 py-3 text-center transition-colors relative cursor-pointer ${
              activeTab === "DEBT" ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            DEBT/LOAN
            {activeTab === "DEBT" && (
              <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-white rounded-full" />
            )}
          </button>
        </div>

        {/* Category List with Toggle Switches */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4 pb-8">
          {currentCategories.map((parent) => {
            const isParentDisabled = disabledCategories.includes(parent.id);
            const filteredChildren = parent.children.filter(
              (c) => matchesSearch(parent.name) || matchesSearch(c.name)
            );

            if (search && !matchesSearch(parent.name) && filteredChildren.length === 0) {
              return null;
            }

            return (
              <div key={parent.id} className="space-y-1">
                {/* Parent Category Row */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#171920] border border-white/6">
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon categoryId={parent.id} size="sm" />
                    <span className="text-white text-sm font-semibold truncate">
                      {parent.name}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleParent(parent)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                      !isParentDisabled ? "bg-[var(--color-primary)]" : "bg-slate-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 absolute top-0.5 shadow-md ${
                        !isParentDisabled ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Child Subcategories */}
                {filteredChildren.length > 0 && (
                  <div className="pl-6 space-y-1">
                    {filteredChildren.map((child) => {
                      const isChildDisabled = disabledCategories.includes(child.id);

                      return (
                        <div
                          key={child.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-[#14151b] border border-white/4"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CategoryIcon
                              categoryId={parent.id}
                              subCategoryId={child.id}
                              size="sm"
                            />
                            <span className="text-slate-300 text-xs font-medium truncate">
                              {child.name}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleChild(parent.id, child.id)}
                            className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                              !isChildDisabled ? "bg-[var(--color-primary)]" : "bg-slate-700"
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-0.5 shadow-md ${
                                !isChildDisabled ? "left-[18px]" : "left-0.5"
                              }`}
                            />
                          </button>
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
    </div>,
    document.body
  );
}
