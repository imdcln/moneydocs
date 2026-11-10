"use client";

import React from "react";
import CategoryIcon, { AllCategoriesGlobeGraphic } from "@/components/ui/CategoryIcon";
import { BudgetIconInfo } from "@/lib/budgetUtils";

interface BudgetCategoryIconsProps {
  icons: BudgetIconInfo[];
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function BudgetCategoryIcons({
  icons,
  size = "md",
  className = "",
}: BudgetCategoryIconsProps) {
  if (!icons || icons.length === 0) return null;

  if (icons.length === 1 && icons[0].parentId === "ALL_CATEGORIES") {
    const globeSizes = { sm: 32, md: 44, lg: 52 };
    return <AllCategoriesGlobeGraphic size={globeSizes[size] || 44} className={className} />;
  }

  // Stacking offset:
  // Left icon sits in front (higher zIndex), subsequent icons slide underneath on their left edge.
  const overlapClasses = {
    sm: "-ml-3",
    md: "-ml-4",
    lg: "-ml-5",
  };

  return (
    <div className={`flex items-center flex-shrink-0 ${className}`}>
      {icons.map((item, index) => (
        <div
          key={`${item.parentId}-${item.childId || "all"}-${index}`}
          className={`relative ${index > 0 ? overlapClasses[size] : ""}`}
          style={{ zIndex: icons.length - index }}
        >
          <CategoryIcon
            categoryId={item.parentId}
            subCategoryId={item.childId}
            size={size}
          />
        </div>
      ))}
    </div>
  );
}
