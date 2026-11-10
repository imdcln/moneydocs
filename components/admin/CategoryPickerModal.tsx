"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronDown, ChevronRight, Search, Check } from "lucide-react";
import { CATEGORIES_TREE, ParentCategory, SubCategory } from "@/lib/categories";
import CategoryIcon from "@/components/ui/CategoryIcon";

interface CategoryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "EXPENSE" | "INCOME" | "DEBT";
  selectedCategory: string;
  selectedSubCategory?: string;
  onSelect: (categoryId: string, subCategoryId?: string) => void;
}

export default function CategoryPickerModal({
  isOpen,
  onClose,
  type,
  selectedCategory,
  selectedSubCategory,
  onSelect,
}: CategoryPickerModalProps) {
  const [search, setSearch] = useState("");
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({
    food_beverage: true,
    transportation: true,
    shopping: true,
    debt: true,
    loan: true,
  });

  const relevantCategories = CATEGORIES_TREE.filter((c) => c.type === type);

  const toggleExpand = (id: string) => {
    setExpandedParents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectParent = (parent: ParentCategory) => {
    onSelect(parent.id, undefined);
    onClose();
  };

  const handleSelectChild = (parent: ParentCategory, child: SubCategory) => {
    onSelect(parent.id, child.id);
    onClose();
  };

  const matchesSearch = (text: string) =>
    text.toLowerCase().includes(search.toLowerCase());

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0.8 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0.8 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="fixed inset-0 z-[90] bg-[#0e1014] text-white flex flex-col"
        >
          {/* Top Bar */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8 bg-[#14161b]">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </button>
            <h2 className="text-base font-bold text-white">Select Category</h2>
            <div className="ml-auto text-xs px-2.5 py-1 rounded-full bg-white/5 text-slate-400 font-medium">
              {type === "EXPENSE" ? "Expense" : type === "INCOME" ? "Income" : "Debt"}
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-white/6 bg-[#111216]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search category or item (e.g. Drinks, Fuel, Dinner)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1a1c22] border border-white/8 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Category Tree List */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-24">
            {relevantCategories.map((parent) => {
              const isParentSelected =
                selectedCategory === parent.id && !selectedSubCategory;
              const isExpanded = search ? true : expandedParents[parent.id] ?? false;

              // Filter children by search
              const filteredChildren = parent.children.filter(
                (child) => matchesSearch(parent.name) || matchesSearch(child.name)
              );

              if (search && !matchesSearch(parent.name) && filteredChildren.length === 0) {
                return null;
              }

              return (
                <div
                  key={parent.id}
                  className="bg-[#16181d] border border-white/6 rounded-2xl overflow-hidden shadow-sm transition-all"
                >
                  {/* Parent Row */}
                  <div className="flex items-center justify-between p-3.5 hover:bg-white/3 transition-colors">
                    <button
                      onClick={() => handleSelectParent(parent)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <CategoryIcon categoryId={parent.id} size="md" />
                      <div>
                        <p className="text-white text-sm font-semibold">{parent.name}</p>
                        {parent.children.length > 0 && (
                          <p className="text-slate-400 text-xs">
                            {parent.children.length} {parent.children.length === 1 ? "subcategory" : "subcategories"}
                          </p>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      {isParentSelected && (
                        <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                      {parent.children.length > 0 && (
                        <button
                          onClick={() => toggleExpand(parent.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5"
                          aria-label="Toggle subcategories"
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

                  {/* Children / Subcategories list */}
                  {isExpanded && filteredChildren.length > 0 && (
                    <div className="border-t border-white/5 bg-[#121418] divide-y divide-white/4 px-2 py-1">
                      {filteredChildren.map((child) => {
                        const isChildSelected =
                          selectedCategory === parent.id &&
                          selectedSubCategory === child.id;

                        return (
                          <button
                            key={child.id}
                            onClick={() => handleSelectChild(parent, child)}
                            className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors ${
                              isChildSelected
                                ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]"
                                : "hover:bg-white/5 text-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <CategoryIcon
                                categoryId={parent.id}
                                subCategoryId={child.id}
                                size="sm"
                              />
                              <span className="text-sm font-medium">{child.name}</span>
                            </div>

                            {isChildSelected && (
                              <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
