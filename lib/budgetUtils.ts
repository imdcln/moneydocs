// â”€â”€â”€ Budget Date & Calculation Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { getCategoryDisplayName, getCategoriesDisplayLabel } from "@/lib/categories";

export type BudgetPeriodType = "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";

export interface PeriodOption {
  type: BudgetPeriodType;
  label: string;
  rangeText: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Format a Date to "DD/MM"
 */
export function formatDayMonth(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

/**
 * Format a Date to "DD/MM/YYYY"
 */
export function formatDayMonthYear(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Calculates start and end of week (Monday 00:00:00 to Sunday 23:59:59.999)
 */
export function getWeekRange(refDate = new Date()): { startDate: Date; endDate: Date } {
  const d = new Date(refDate);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { startDate: monday, endDate: sunday };
}

/**
 * Calculates start and end of month (1st 00:00:00 to last day 23:59:59.999)
 */
export function getMonthRange(refDate = new Date()): { startDate: Date; endDate: Date } {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();

  const startDate = new Date(year, month, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return { startDate, endDate };
}

/**
 * Calculates start and end of quarter
 * Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
 */
export function getQuarterRange(refDate = new Date()): { startDate: Date; endDate: Date } {
  const year = refDate.getFullYear();
  const currentMonth = refDate.getMonth();
  const quarterIndex = Math.floor(currentMonth / 3);
  const startMonth = quarterIndex * 3;
  const endMonth = startMonth + 2;

  const startDate = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const endDate = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);

  return { startDate, endDate };
}

/**
 * Calculates start and end of year
 */
export function getYearRange(refDate = new Date()): { startDate: Date; endDate: Date } {
  const year = refDate.getFullYear();
  const startDate = new Date(year, 0, 1, 0, 0, 0, 0);
  const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

  return { startDate, endDate };
}

/**
 * Returns available preset options for the Select Time Range bottom sheet
 */
export function getStandardPeriodOptions(refDate = new Date()): PeriodOption[] {
  const week = getWeekRange(refDate);
  const month = getMonthRange(refDate);
  const quarter = getQuarterRange(refDate);
  const year = getYearRange(refDate);

  return [
    {
      type: "WEEK",
      label: "This week",
      rangeText: `(${formatDayMonth(week.startDate)} - ${formatDayMonth(week.endDate)})`,
      startDate: week.startDate,
      endDate: week.endDate,
    },
    {
      type: "MONTH",
      label: "This month",
      rangeText: `(${formatDayMonth(month.startDate)} - ${formatDayMonth(month.endDate)})`,
      startDate: month.startDate,
      endDate: month.endDate,
    },
    {
      type: "QUARTER",
      label: "This quarter",
      rangeText: `(${formatDayMonth(quarter.startDate)} - ${formatDayMonth(quarter.endDate)})`,
      startDate: quarter.startDate,
      endDate: quarter.endDate,
    },
    {
      type: "YEAR",
      label: "This year",
      rangeText: `(${formatDayMonthYear(year.startDate)} - ${formatDayMonthYear(year.endDate)})`,
      startDate: year.startDate,
      endDate: year.endDate,
    },
  ];
}

/**
 * Compute the next consecutive period dates for repeating budgets
 */
export function getNextPeriodRange(
  periodType: BudgetPeriodType,
  currentStartDate: Date,
  currentEndDate: Date
): { startDate: Date; endDate: Date } {
  const start = new Date(currentStartDate);
  const end = new Date(currentEndDate);

  switch (periodType) {
    case "WEEK": {
      const nextStart = new Date(start);
      nextStart.setDate(start.getDate() + 7);
      nextStart.setHours(0, 0, 0, 0);
      const nextEnd = new Date(nextStart);
      nextEnd.setDate(nextStart.getDate() + 6);
      nextEnd.setHours(23, 59, 59, 999);
      return { startDate: nextStart, endDate: nextEnd };
    }
    case "MONTH": {
      const nextYear = start.getMonth() === 11 ? start.getFullYear() + 1 : start.getFullYear();
      const nextMonth = (start.getMonth() + 1) % 12;
      const nextStart = new Date(nextYear, nextMonth, 1, 0, 0, 0, 0);
      const nextEnd = new Date(nextYear, nextMonth + 1, 0, 23, 59, 59, 999);
      return { startDate: nextStart, endDate: nextEnd };
    }
    case "QUARTER": {
      const nextDate = new Date(start.getFullYear(), start.getMonth() + 3, 1, 0, 0, 0, 0);
      const nextYear = nextDate.getFullYear();
      const nextMonth = nextDate.getMonth();
      const nextStart = new Date(nextYear, nextMonth, 1, 0, 0, 0, 0);
      const nextEnd = new Date(nextYear, nextMonth + 3, 0, 23, 59, 59, 999);
      return { startDate: nextStart, endDate: nextEnd };
    }
    case "YEAR": {
      const nextStart = new Date(start.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
      const nextEnd = new Date(start.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
      return { startDate: nextStart, endDate: nextEnd };
    }
    case "CUSTOM":
    default: {
      const durationMs = Math.max(86400000, end.getTime() - start.getTime());
      const nextStart = new Date(end.getTime() + 1000);
      nextStart.setHours(0, 0, 0, 0);
      const nextEnd = new Date(nextStart.getTime() + durationMs);
      nextEnd.setHours(23, 59, 59, 999);
      return { startDate: nextStart, endDate: nextEnd };
    }
  }
}

/**
 * Display label for time range in forms & cards
 */
export function formatBudgetPeriodDisplay(
  periodType: BudgetPeriodType | undefined,
  startDate: Date | string,
  endDate: Date | string
): string {
  const start = new Date(startDate);
  let end = new Date(endDate);

  if ((periodType === "MONTH" || !periodType) && end.getDate() === 1 && end.getMonth() !== start.getMonth()) {
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const startDM = formatDayMonth(start);
  const endDM = formatDayMonth(end);
  const startDMY = formatDayMonthYear(start);
  const endDMY = formatDayMonthYear(end);

  if (periodType === "WEEK") {
    return `This week (${startDM} - ${endDM})`;
  }
  if (periodType === "MONTH") {
    return `This month (${startDM} - ${endDM})`;
  }
  if (periodType === "QUARTER") {
    return `This quarter (${startDM} - ${endDM})`;
  }
  if (periodType === "YEAR") {
    return `This year (${startDMY} - ${endDMY})`;
  }
  return `${startDM} - ${endDM}`;
}

/**
 * Calculates total calendar days between two dates inclusive of both start and end days
 */
export function getDaysBetween(startDateInput: Date | string, endDateInput: Date | string): number {
  const s = new Date(startDateInput);
  const e = new Date(endDateInput);
  const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
  const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
  return Math.max(1, Math.round((endDay - startDay) / 86400000) + 1);
}

/**
 * Budget statistics formulas (Requirement 5)
 */
export function calculateBudgetStats(
  amountLimit: number,
  spent: number,
  startDateInput: Date | string,
  endDateInput: Date | string,
  now = new Date()
) {
  const startDate = new Date(startDateInput);
  let endDate = new Date(endDateInput);

  if (endDate.getDate() === 1 && endDate.getMonth() !== startDate.getMonth()) {
    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // Total calendar days in range (inclusive)
  const totalDays = Math.max(1, Math.round((endDay - startDay) / 86400000) + 1);

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const nowMs = now.getTime();

  // Is finished?
  const isFinished = nowMs > endMs;

  // Days passed: from startDate to today (or totalDays if finished)
  let daysPassed = 1;
  if (isFinished) {
    daysPassed = totalDays;
  } else if (nowDay < startDay) {
    daysPassed = 0;
  } else {
    daysPassed = Math.max(1, Math.min(totalDays, Math.round((nowDay - startDay) / 86400000) + 1));
  }

  // Remaining days: from today to endDate
  let remainingDays = 0;
  if (!isFinished && nowDay >= startDay) {
    remainingDays = Math.max(0, totalDays - daysPassed);
  } else if (!isFinished && nowDay < startDay) {
    remainingDays = totalDays;
  }

  const remaining = Math.max(0, amountLimit - spent);
  const overspent = Math.max(0, spent - amountLimit);

  // Recommended daily spending = remaining budget divided by remaining days
  const recommendedDaily =
    isFinished || remainingDays <= 0 || remaining <= 0
      ? 0
      : Math.round((remaining / remainingDays) * 10) / 10;

  // Actual daily spending = budget spent divided by days passed
  const actualDaily =
    daysPassed <= 0
      ? 0
      : Math.round((spent / daysPassed) * 10) / 10;

  // Projected spending = actual daily spending times total of days (time range)
  const projectedSpending =
    daysPassed <= 0
      ? 0
      : Math.round(actualDaily * totalDays);

  return {
    totalDays,
    daysPassed,
    remainingDays,
    isFinished,
    remaining,
    overspent,
    recommendedDaily,
    actualDaily,
    projectedSpending,
  };
}

export interface BudgetIconInfo {
  parentId: string;
  childId?: string;
}

/**
 * Derives up to 3 category icons to display for a budget.
 * Rules:
 * - If "ALL_CATEGORIES" -> 1 globe icon
 * - Deduplicate by parent category so that if user selected multiple categories
 *   that belong to the same parent category, only 1 icon is shown.
 * - If only 2 categories selected from 2 parents -> show 2 icons.
 * - MAX OF THE ICON IS 3, no more.
 */
export function getBudgetCategoryIcons(budget: {
  category?: string;
  subCategory?: string;
  categories?: string[];
}): BudgetIconInfo[] {
  const isAllCategories =
    budget.category === "ALL_CATEGORIES" ||
    budget.category === "ALL" ||
    budget.category === "all_categories" ||
    budget.categories?.includes("ALL_CATEGORIES");

  if (isAllCategories) {
    return [{ parentId: "ALL_CATEGORIES" }];
  }

  if (budget.category === "OTHER_CATEGORIES" || budget.category === "other_categories") {
    return [{ parentId: "OTHER_CATEGORIES" }];
  }

  const rawKeys =
    Array.isArray(budget.categories) && budget.categories.length > 0
      ? budget.categories
      : budget.category
      ? [budget.subCategory ? `${budget.category}:${budget.subCategory}` : budget.category]
      : [];

  if (rawKeys.length === 0) {
    return [];
  }

  // Deduplicate by parent category while preserving selection order
  const parentMap = new Map<string, { parentId: string; childId?: string; count: number }>();

  for (const key of rawKeys) {
    const [parentId, childId] = key.split(":");
    if (!parentId) continue;

    if (!parentMap.has(parentId)) {
      parentMap.set(parentId, { parentId, childId, count: 1 });
    } else {
      const entry = parentMap.get(parentId)!;
      entry.count += 1;
      // When multiple categories under the same parent are selected,
      // represent the whole parent (clear childId to show the parent's icon)
      entry.childId = undefined;
    }
  }

  // Return up to 3 icons
  return Array.from(parentMap.values())
    .slice(0, 3)
    .map(({ parentId, childId }) => ({ parentId, childId }));
}

/**
 * Returns the display name for a budget.
 * - If custom name is set (nullable/optional), use that.
 * - Otherwise fallback to category display label (e.g. "General Food +2 more" or "Electricity Bill").
 */
export function getBudgetDisplayName(budget: {
  name?: string | null;
  category?: string;
  subCategory?: string;
  categories?: string[];
}): string {
  if (budget.name && budget.name.trim().length > 0) {
    return budget.name.trim();
  }

  if (Array.isArray(budget.categories) && budget.categories.length > 0) {
    return getCategoriesDisplayLabel(budget.categories);
  }

  if (
    budget.category === "ALL_CATEGORIES" ||
    budget.category === "ALL" ||
    budget.category === "all_categories"
  ) {
    return "All Categories";
  }

  if (budget.category === "OTHER_CATEGORIES" || budget.category === "other_categories") {
    return "Other Categories";
  }

  return getCategoryDisplayName(budget.category, budget.subCategory);
}
