// â”€â”€â”€ Hierarchical Category System (Parent -> Child Subcategories) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SubCategory {
  id: string;
  name: string;
  iconName: string;
}

export interface ParentCategory {
  id: string;
  name: string;
  type: "EXPENSE" | "INCOME" | "DEBT";
  iconName: string;
  color: string;
  bgColor: string;
  badgeBorder: string;
  children: SubCategory[];
}

export const CATEGORIES_TREE: ParentCategory[] = [
  // â”€â”€ EXPENSE CATEGORIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "food_beverage",
    name: "Food & Beverage",
    type: "EXPENSE",
    iconName: "Utensils",
    color: "#38bdf8",
    bgColor: "#0c2b42",
    badgeBorder: "rgba(56, 189, 248, 0.3)",
    children: [
      { id: "all_food", name: "General Food", iconName: "Utensils" },
      { id: "drinks", name: "Drinks & Beverages", iconName: "GlassWater" },
      { id: "snacks", name: "Snacks", iconName: "Coffee" },
      { id: "groceries", name: "Groceries & Market", iconName: "ShoppingBasket" },
    ],
  },
  {
    id: "transportation",
    name: "Transportation",
    type: "EXPENSE",
    iconName: "Car",
    color: "#3b82f6",
    bgColor: "#14254f",
    badgeBorder: "rgba(59, 130, 246, 0.3)",
    children: [
      { id: "fuel", name: "Fuel & Gas", iconName: "Fuel" },
      { id: "public_transit", name: "Public Transit", iconName: "Bus" },
      { id: "taxi", name: "Taxi & Ride-Hailing", iconName: "CarTaxiFront" },
      { id: "parking_tolls", name: "Parking & Tolls", iconName: "CircleParking" },
      { id: "maintenance", name: "Maintenance & Repairs", iconName: "Wrench" },
    ],
  },
  {
    id: "shopping",
    name: "Shopping",
    type: "EXPENSE",
    iconName: "ShoppingBag",
    color: "#f97316",
    bgColor: "#3b1d0c",
    badgeBorder: "rgba(249, 115, 22, 0.3)",
    children: [
      { id: "clothing", name: "Clothing & Footwear", iconName: "Shirt" },
      { id: "electronics", name: "Electronics & Gadgets", iconName: "Smartphone" },
      { id: "home_living", name: "Home & Furniture", iconName: "Lamp" },
      { id: "beauty_care", name: "Personal Care & Beauty", iconName: "Sparkles" },
      { id: "personal_items", name: "Personal Items", iconName: "Sparkles" },
    ],
  },
  {
    id: "bills_utilities",
    name: "Bills & Utilities",
    type: "EXPENSE",
    iconName: "Zap",
    color: "#eab308",
    bgColor: "#382c09",
    badgeBorder: "rgba(234, 179, 8, 0.3)",
    children: [
      { id: "electricity_bill", name: "Electricity Bill", iconName: "Zap" },
      { id: "gas_bill", name: "Gas Bill", iconName: "Flame" },
      { id: "internet_bill", name: "Internet Bill", iconName: "Globe" },
      { id: "other_utility_bills", name: "Other Utility Bills", iconName: "FileText" },
      { id: "phone_bill", name: "Phone Bill", iconName: "Phone" },
      { id: "rentals", name: "Rentals", iconName: "Home" },
      { id: "television_bill", name: "Television Bill", iconName: "Tv" },
      { id: "water_bill", name: "Water Bill", iconName: "Droplet" },
      { id: "internet_phone", name: "Internet & Phone", iconName: "Wifi" },
      { id: "subscriptions", name: "Subscriptions & TV", iconName: "Tv" },
    ],
  },
  {
    id: "housing",
    name: "Housing & Rent",
    type: "EXPENSE",
    iconName: "Home",
    color: "#a855f7",
    bgColor: "#291442",
    badgeBorder: "rgba(168, 85, 247, 0.3)",
    children: [
      { id: "rent", name: "Rent & Mortgage", iconName: "Building" },
      { id: "house_repairs", name: "House Repairs", iconName: "Hammer" },
    ],
  },
  {
    id: "entertainment",
    name: "Entertainment & Leisure",
    type: "EXPENSE",
    iconName: "Gamepad2",
    color: "#ec4899",
    bgColor: "#380d24",
    badgeBorder: "rgba(236, 72, 153, 0.3)",
    children: [
      { id: "movies_games", name: "Movies & Gaming", iconName: "Gamepad2" },
      { id: "travel_vacation", name: "Travel & Vacations", iconName: "Plane" },
      { id: "hobbies", name: "Hobbies & Sports", iconName: "Palette" },
    ],
  },
  {
    id: "health_medical",
    name: "Health & Medical",
    type: "EXPENSE",
    iconName: "HeartPulse",
    color: "#ef4444",
    bgColor: "#361010",
    badgeBorder: "rgba(239, 68, 68, 0.3)",
    children: [
      { id: "pharmacy", name: "Pharmacy & Medicine", iconName: "Pill" },
      { id: "doctor_clinic", name: "Doctor & Clinic", iconName: "Stethoscope" },
      { id: "fitness", name: "Fitness & Gym", iconName: "Dumbbell" },
    ],
  },
  {
    id: "education",
    name: "Education",
    type: "EXPENSE",
    iconName: "GraduationCap",
    color: "#6366f1",
    bgColor: "#1a1b47",
    badgeBorder: "rgba(99, 102, 241, 0.3)",
    children: [
      { id: "courses_books", name: "Courses & Books", iconName: "BookOpen" },
      { id: "tuition", name: "Tuition Fees", iconName: "GraduationCap" },
    ],
  },
  {
    id: "other_expense",
    name: "Other Expense",
    type: "EXPENSE",
    iconName: "Package",
    color: "#94a3b8",
    bgColor: "#1f242d",
    badgeBorder: "rgba(148, 163, 184, 0.3)",
    children: [],
  },
  {
    id: "investment_expense",
    name: "Investment",
    type: "EXPENSE",
    iconName: "TrendingUp",
    color: "#84cc16",
    bgColor: "#1d3107",
    badgeBorder: "rgba(132, 204, 22, 0.3)",
    children: [],
  },
  {
    id: "adjust_balance",
    name: "Adjust Balance",
    type: "EXPENSE",
    iconName: "Sliders",
    color: "#38bdf8",
    bgColor: "#0c2b42",
    badgeBorder: "rgba(56, 189, 248, 0.3)",
    children: [],
  },
  {
    id: "lost",
    name: "Lost",
    type: "EXPENSE",
    iconName: "HelpCircle",
    color: "#ef4444",
    bgColor: "#361010",
    badgeBorder: "rgba(239, 68, 68, 0.3)",
    children: [],
  },

  // â”€â”€ INCOME CATEGORIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "salary",
    name: "Salary & Wages",
    type: "INCOME",
    iconName: "Briefcase",
    color: "#10b981",
    bgColor: "#093122",
    badgeBorder: "rgba(16, 185, 129, 0.3)",
    children: [
      { id: "monthly_salary", name: "Monthly Salary", iconName: "Briefcase" },
      { id: "bonus_commission", name: "Bonus & Commission", iconName: "Award" },
    ],
  },
  {
    id: "freelance",
    name: "Freelance & Business",
    type: "INCOME",
    iconName: "Laptop",
    color: "#06b6d4",
    bgColor: "#092931",
    badgeBorder: "rgba(6, 182, 212, 0.3)",
    children: [
      { id: "client_projects", name: "Client Projects", iconName: "Laptop" },
      { id: "business_profits", name: "Business Profits", iconName: "Building2" },
    ],
  },
  {
    id: "investments_income",
    name: "Investment",
    type: "INCOME",
    iconName: "TrendingUp",
    color: "#84cc16",
    bgColor: "#1d3107",
    badgeBorder: "rgba(132, 204, 22, 0.3)",
    children: [],
  },
  {
    id: "adjust_balance_income",
    name: "Adjust Balance",
    type: "INCOME",
    iconName: "Sliders",
    color: "#38bdf8",
    bgColor: "#0c2b42",
    badgeBorder: "rgba(56, 189, 248, 0.3)",
    children: [],
  },
  {
    id: "other_income",
    name: "Other Income",
    type: "INCOME",
    iconName: "Coins",
    color: "#f59e0b",
    bgColor: "#382407",
    badgeBorder: "rgba(245, 158, 11, 0.3)",
    children: [
      { id: "gifts_transfer", name: "Gifts & Transfers", iconName: "Gift" },
      { id: "selling_items", name: "Selling Used Items", iconName: "Tag" },
      { id: "cashback_rewards", name: "Cashback & Refunds", iconName: "Coins" },
    ],
  },

  // â”€â”€ DEBT & LOAN CATEGORIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "debt",
    name: "Debt",
    type: "DEBT",
    iconName: "CreditCard",
    color: "#ef4444",
    bgColor: "#361010",
    badgeBorder: "rgba(239, 68, 68, 0.3)",
    children: [
      { id: "credit_card_loan", name: "Credit Card", iconName: "CreditCard" },
      { id: "tuition_debt", name: "Tuition Debt", iconName: "GraduationCap" },
      { id: "friend_family_debt", name: "Friend/Family Debt", iconName: "Users" },
      { id: "debt_others", name: "Others", iconName: "MoreHorizontal" },
    ],
  },
  {
    id: "loan",
    name: "Loan",
    type: "DEBT",
    iconName: "HandCoins",
    color: "#f59e0b",
    bgColor: "#382307",
    badgeBorder: "rgba(245, 158, 11, 0.3)",
    children: [
      { id: "personal_loan", name: "Personal Loan", iconName: "HandCoins" },
      { id: "friends_family_loan", name: "Friend/Family Loan", iconName: "Users" },
      { id: "bank_loan", name: "Bank Loan", iconName: "Landmark" },
      { id: "loan_others", name: "Others", iconName: "MoreHorizontal" },
    ],
  },
];

/**
 * Find parent category by id or legacy key.
 */
export function getParentCategory(categoryId: string): ParentCategory | undefined {
  // Support legacy keys
  const normalized =
    categoryId === "food_drinks"
      ? "food_beverage"
      : categoryId === "debt_loan"
      ? "debt"
      : categoryId;
  return CATEGORIES_TREE.find((c) => c.id === normalized || c.id === categoryId);
}

/**
 * Find child subcategory across all parent categories.
 */
export function getSubCategory(subCategoryId: string): { parent: ParentCategory; child: SubCategory } | undefined {
  for (const parent of CATEGORIES_TREE) {
    const child = parent.children.find((c) => c.id === subCategoryId);
    if (child) return { parent, child };
  }
  return undefined;
}

/**
 * Check if category / subcategory represents a Loan (incoming funds that must be returned)
 */
export function isLoanCategory(categoryId?: string, subCategoryId?: string): boolean {
  if (!categoryId) return false;
  const c = categoryId.toLowerCase();
  if (c === "loan") return true;
  const parent = getParentCategory(categoryId);
  if (parent?.id === "loan") return true;
  const sub = getSubCategory(categoryId);
  if (sub?.parent.id === "loan") return true;
  if (subCategoryId) {
    const s = subCategoryId.toLowerCase();
    if (s.includes("loan")) return true;
    const sub2 = getSubCategory(subCategoryId);
    if (sub2?.parent.id === "loan") return true;
  }
  return c.includes("loan") && !c.includes("credit_card");
}

/**
 * Check if category / subcategory represents a Debt (money owed that must be paid)
 */
export function isDebtCategory(categoryId?: string, subCategoryId?: string): boolean {
  if (!categoryId) return false;
  if (isLoanCategory(categoryId, subCategoryId)) return false;
  const c = categoryId.toLowerCase();
  if (
    c === "debt" ||
    c === "credit_card_loan" ||
    c === "tuition_debt" ||
    c === "friend_family_debt" ||
    c === "debt_others" ||
    c === "other_debt"
  )
    return true;
  const parent = getParentCategory(categoryId);
  if (parent?.id === "debt") return true;
  const sub = getSubCategory(categoryId);
  if (sub?.parent.id === "debt") return true;
  if (subCategoryId) {
    const sub2 = getSubCategory(subCategoryId);
    if (sub2?.parent.id === "debt") return true;
    const s = subCategoryId.toLowerCase();
    if (s.includes("debt")) return true;
  }
  return c.includes("debt");
}

/**
 * Format category display name: either parent name or "Parent: Child".
 */
export function getCategoryDisplayName(categoryId?: string, subCategoryId?: string): string {
  if (!categoryId || categoryId.trim() === "") {
    return "Uncategorized";
  }
  if (categoryId === "ALL_CATEGORIES" || categoryId === "ALL" || categoryId === "all_categories") {
    return "All Categories";
  }
  if (categoryId === "OTHER_CATEGORIES" || categoryId === "other_categories") {
    return "Other Categories";
  }
  const parent = getParentCategory(categoryId);
  if (!parent) {
    const sub = getSubCategory(categoryId);
    if (sub) {
      return sub.child.name;
    }
    return categoryId.replace(/_/g, " ");
  }

  if (subCategoryId) {
    const child = parent.children.find((c) => c.id === subCategoryId);
    if (child) return child.name;
  }
  return parent.name;
}

/**
 * Build a human-readable display label for selected categories list.
 * - "All Categories" when ALL_CATEGORIES or empty
 * - Single: shows the category/subcategory name
 * - Multiple: first name + "+N more"
 */
export function getCategoriesDisplayLabel(keys?: string[]): string {
  if (!keys || keys.length === 0) return "Select Category";
  if (keys.includes("ALL_CATEGORIES") || keys.includes("ALL") || keys.includes("all_categories")) {
    return "All Categories";
  }

  const names = keys.map((key) => {
    const [parentId, childId] = key.split(":");
    return getCategoryDisplayName(parentId, childId);
  });

  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1} more`;
}

export interface TransactionIssue {
  type: "category" | "subcategory" | "wallet" | "date" | "amount";
  severity: "error" | "warning";
  label: string;
  message: string;
}

/**
 * Validates a category and optional subcategory against CATEGORIES_TREE.
 */
export function checkCategoryStatus(categoryId?: string, subCategoryId?: string): {
  isCategoryMissing: boolean;
  isCategoryNotFound: boolean;
  isSubCategoryNotFound: boolean;
  parent?: ParentCategory;
  child?: SubCategory;
} {
  if (!categoryId || categoryId.trim() === "") {
    return {
      isCategoryMissing: true,
      isCategoryNotFound: false,
      isSubCategoryNotFound: false,
    };
  }

  // Handle global/virtual category constants
  if (
    categoryId === "ALL_CATEGORIES" ||
    categoryId === "ALL" ||
    categoryId === "all_categories" ||
    categoryId === "OTHER_CATEGORIES" ||
    categoryId === "other_categories"
  ) {
    return {
      isCategoryMissing: false,
      isCategoryNotFound: false,
      isSubCategoryNotFound: false,
    };
  }

  const parent = getParentCategory(categoryId);
  if (!parent) {
    // Check if categoryId is a subcategory ID
    const sub = getSubCategory(categoryId);
    if (sub) {
      return {
        isCategoryMissing: false,
        isCategoryNotFound: false,
        isSubCategoryNotFound: false,
        parent: sub.parent,
        child: sub.child,
      };
    }
    return {
      isCategoryMissing: false,
      isCategoryNotFound: true,
      isSubCategoryNotFound: false,
    };
  }

  if (subCategoryId) {
    const child = parent.children.find((c) => c.id === subCategoryId);
    if (!child) {
      return {
        isCategoryMissing: false,
        isCategoryNotFound: false,
        isSubCategoryNotFound: true,
        parent,
      };
    }
    return {
      isCategoryMissing: false,
      isCategoryNotFound: false,
      isSubCategoryNotFound: false,
      parent,
      child,
    };
  }

  return {
    isCategoryMissing: false,
    isCategoryNotFound: false,
    isSubCategoryNotFound: false,
    parent,
  };
}

/**
 * Returns all issues for a given transaction so the UI can flag them with clear badges & actions.
 */
export function getTransactionIssues(
  tx: {
    category?: string;
    subCategory?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walletId?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    date?: any;
    amount?: number;
  },
  knownWallets: Array<{ _id: string; name?: string }> = []
): TransactionIssue[] {
  const issues: TransactionIssue[] = [];

  // 1. Category validation
  const catStatus = checkCategoryStatus(tx.category, tx.subCategory);
  if (catStatus.isCategoryMissing) {
    issues.push({
      type: "category",
      severity: "error",
      label: "Category missing",
      message: "No category assigned. Tap to select a category.",
    });
  } else if (catStatus.isCategoryNotFound) {
    issues.push({
      type: "category",
      severity: "error",
      label: "Category doesn't exist",
      message: `Category "${tx.category}" does not exist. Tap to fix.`,
    });
  } else if (catStatus.isSubCategoryNotFound) {
    issues.push({
      type: "subcategory",
      severity: "warning",
      label: "Subcategory doesn't exist",
      message: `Subcategory "${tx.subCategory}" does not exist. Tap to fix.`,
    });
  }

  // 2. Wallet validation
  let rawWid: string | null = null;
  if (tx.walletId) {
    if (typeof tx.walletId === "string") {
      rawWid = tx.walletId;
    } else if (typeof tx.walletId === "object") {
      if (tx.walletId._id) {
        rawWid = String(typeof tx.walletId._id === "object" && tx.walletId._id.toString ? tx.walletId._id.toString() : tx.walletId._id);
      } else if (tx.walletId.id) {
        rawWid = String(tx.walletId.id);
      } else if (typeof tx.walletId.toString === "function") {
        const s = tx.walletId.toString();
        if (s && s !== "[object Object]") {
          rawWid = s;
        }
      }
    }
  }

  if (!rawWid || rawWid.trim() === "") {
    issues.push({
      type: "wallet",
      severity: "warning",
      label: "No wallet assigned",
      message: "This transaction has no wallet. Tap to assign one.",
    });
  } else if (knownWallets.length > 0 && !knownWallets.some((w) => String(w._id) === String(rawWid))) {
    issues.push({
      type: "wallet",
      severity: "warning",
      label: "Wallet doesn't exist",
      message: "The linked wallet was deleted. Tap to reassign.",
    });
  }

  // 3. Date validation
  if (!tx.date || isNaN(new Date(tx.date).getTime())) {
    issues.push({
      type: "date",
      severity: "error",
      label: "Invalid date",
      message: "Date is invalid or missing. Tap to fix.",
    });
  }

  // 4. Amount validation
  if (tx.amount === undefined || tx.amount === null || isNaN(Number(tx.amount)) || Number(tx.amount) <= 0) {
    issues.push({
      type: "amount",
      severity: "error",
      label: "Invalid amount",
      message: "Amount is missing or invalid. Tap to fix.",
    });
  }

  return issues;
}

// Flat lists for backwards compatibility
export const EXPENSE_CATEGORIES = CATEGORIES_TREE.filter((c) => c.type === "EXPENSE").map((c) => ({
  label: c.name,
  value: c.id,
  icon: c.iconName,
  color: c.color,
  bgColor: c.bgColor,
}));

export const INCOME_CATEGORIES = CATEGORIES_TREE.filter((c) => c.type === "INCOME").map((c) => ({
  label: c.name,
  value: c.id,
  icon: c.iconName,
  color: c.color,
  bgColor: c.bgColor,
}));

export const DEBT_CATEGORIES = CATEGORIES_TREE.filter((c) => c.type === "DEBT").map((c) => ({
  label: c.name,
  value: c.id,
  icon: c.iconName,
  color: c.color,
  bgColor: c.bgColor,
}));


export interface ResolvedCategory {
  parentId: string;
  parentName: string;
  subId?: string;
  subName?: string;
  isCustom?: boolean;
}

/**
 * Resolves any category and optional subcategory into canonical parent and child.
 * Handles cases where category is already a subcategory, legacy keys, or direct parent transactions.
 */
export function resolveCategoryHierarchy(
  categoryId?: string,
  subCategoryId?: string
): ResolvedCategory {
  if (!categoryId || categoryId.trim() === "") {
    return {
      parentId: "other_expense",
      parentName: "Other Expense",
      subId: undefined,
      subName: undefined,
    };
  }

  // 1. Direct parent match
  const parent = getParentCategory(categoryId);
  if (parent) {
    if (subCategoryId) {
      const child = parent.children.find((c) => c.id === subCategoryId);
      if (child) {
        return {
          parentId: parent.id,
          parentName: parent.name,
          subId: child.id,
          subName: child.name,
        };
      }
      const otherSub = getSubCategory(subCategoryId);
      if (otherSub) {
        return {
          parentId: parent.id,
          parentName: parent.name,
          subId: otherSub.child.id,
          subName: otherSub.child.name,
        };
      }
      return {
        parentId: parent.id,
        parentName: parent.name,
        subId: subCategoryId,
        subName: subCategoryId.replace(/_/g, " "),
      };
    }
    return {
      parentId: parent.id,
      parentName: parent.name,
      subId: undefined,
      subName: undefined,
    };
  }

  // 2. Check if categoryId itself was passed as a subcategory id
  const sub = getSubCategory(categoryId);
  if (sub) {
    return {
      parentId: sub.parent.id,
      parentName: sub.parent.name,
      subId: sub.child.id,
      subName: sub.child.name,
    };
  }

  // 3. Custom / fallback category
  return {
    parentId: categoryId,
    parentName: categoryId.replace(/_/g, " "),
    subId: subCategoryId || undefined,
    subName: subCategoryId ? subCategoryId.replace(/_/g, " ") : undefined,
    isCustom: true,
  };
}

export interface TrendComparison {
  delta: number | null;
  trending: "up" | "down" | "flat";
  percentText: string;
}

/**
 * Calculates trend comparison between current and previous period.
 */
export function calculateTrendComparison(
  cur: number,
  prev: number,
  periodUnitLabel: string = "prev month"
): TrendComparison {
  if (prev === 0 && cur === 0) {
    return { delta: 0, trending: "flat", percentText: "–" };
  }
  if (prev === 0 && cur > 0) {
    return { delta: null, trending: "up", percentText: "New this month" };
  }
  if (prev > 0 && cur === 0) {
    return { delta: -100, trending: "down", percentText: `-100% vs ${periodUnitLabel}` };
  }
  const delta = ((cur - prev) / prev) * 100;
  const trending: "up" | "down" | "flat" =
    delta > 5 ? "up" : delta < -5 ? "down" : "flat";
  const sign = delta > 0 ? "▲" : delta < 0 ? "▼" : "–";
  const percentText = `${sign} ${Math.abs(Math.round(delta))}% vs ${periodUnitLabel}`;
  return { delta, trending, percentText };
}
