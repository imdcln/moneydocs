import { getCategoryDisplayName } from "@/lib/categories";

/**
 * Cleans up corrupted UTF-8 / mojibake characters in notification strings
 * (e.g. "âš ï¸" or "âš ï¸" -> "⚠️", "â€º" -> "›", "â€”" -> "—")
 * and converts raw category slugs in quotes (e.g. "food_beverage") to friendly names.
 */
export function cleanNotificationText(text?: string | null): string {
  if (!text) return "";
  let cleaned = text
    .replace(/âš[\s\u00A0]*ï¸[\s\u00A0]*/g, "⚠️")
    .replace(/â€º/g, "›")
    .replace(/â€”/g, "—")
    .replace(/â€“/g, "–")
    .trim();

  // Ensure consistent spacing before ⚠️ in warning titles
  cleaned = cleaned.replace(/Budget Warning\s*⚠️/g, "Budget Warning ⚠️");

  // Fix raw slug category names in quotes e.g. "food_beverage" -> "Food & Beverage"
  cleaned = cleaned.replace(/"([a-z0-9_]+)"/g, (match, slug) => {
    const formatted = getCategoryDisplayName(slug);
    return formatted && formatted !== slug ? `"${formatted}"` : match;
  });

  return cleaned;
}
