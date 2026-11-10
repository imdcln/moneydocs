// ─── Multi-Currency & Exchange Rate Utility ──────────────────────────────────
// Uses frankfurter.app (ECB data, free, no API key required)

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface RatesCache {
  rates: Record<string, number>;
  fetchedAt: number;
  base: string;
}

let ratesCache: RatesCache | null = null;

export const SUPPORTED_CURRENCIES = [
  "IDR",
  "USD",
  "TWD",
  "EUR",
  "GBP",
  "JPY",
  "SGD",
  "MYR",
  "AUD",
  "CAD",
  "CNY",
  "THB",
  "VND",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export interface CurrencyMetadata {
  code: SupportedCurrency;
  displayCode: string; // UI label (e.g. NTD instead of TWD)
  name: string;
  symbol: string;
  flag: string;
  decimals: number;
}

export const CURRENCY_INFO: Record<SupportedCurrency, CurrencyMetadata> = {
  IDR: { code: "IDR", displayCode: "IDR", name: "Indonesian Rupiah", symbol: "Rp", flag: "🇮🇩", decimals: 0 },
  USD: { code: "USD", displayCode: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸", decimals: 2 },
  TWD: { code: "TWD", displayCode: "NTD", name: "New Taiwan Dollar", symbol: "NT$", flag: "🇹🇼", decimals: 0 },
  EUR: { code: "EUR", displayCode: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺", decimals: 2 },
  GBP: { code: "GBP", displayCode: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧", decimals: 2 },
  JPY: { code: "JPY", displayCode: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵", decimals: 0 },
  SGD: { code: "SGD", displayCode: "SGD", name: "Singapore Dollar", symbol: "$", flag: "🇸🇬", decimals: 2 },
  MYR: { code: "MYR", displayCode: "MYR", name: "Malaysian Ringgit", symbol: "RM", flag: "🇲🇾", decimals: 2 },
  AUD: { code: "AUD", displayCode: "AUD", name: "Australian Dollar", symbol: "$", flag: "🇦🇺", decimals: 2 },
  CAD: { code: "CAD", displayCode: "CAD", name: "Canadian Dollar", symbol: "$", flag: "🇨🇦", decimals: 2 },
  CNY: { code: "CNY", displayCode: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳", decimals: 2 },
  THB: { code: "THB", displayCode: "THB", name: "Thai Baht", symbol: "฿", flag: "🇹🇭", decimals: 2 },
  VND: { code: "VND", displayCode: "VND", name: "Vietnamese Dong", symbol: "₫", flag: "🇻🇳", decimals: 0 },
};

/** Returns the currency symbol (e.g. "NT$" for TWD/NTD, "$" for USD, SGD, AUD, CAD) */
export function getCurrencySymbol(code: string): string {
  const upper = (code || "IDR").toUpperCase();
  if (upper === "TWD" || upper === "NTD") {
    return "NT$";
  }
  if (upper === "USD" || upper === "SGD" || upper === "AUD" || upper === "CAD") {
    return "$";
  }
  const meta = CURRENCY_INFO[upper as SupportedCurrency];
  if (meta?.symbol) return meta.symbol;
  if (meta?.name.toLowerCase().includes("dollar")) return "$";
  return meta?.symbol ?? code;
}

/** Returns the display code (e.g. "NTD" for TWD) */
export function getCurrencyDisplayCode(code: string): string {
  const upper = (code || "IDR").toUpperCase();
  if (upper === "TWD" || upper === "NTD") return "NTD";
  const meta = CURRENCY_INFO[upper as SupportedCurrency];
  return meta?.displayCode ?? upper;
}

/**
 * Fetches exchange rates relative to a given base (default: USD).
 * Uses the Frankfurter API (https://www.frankfurter.app) — ECB data, free, no key required.
 *
 * Notes:
 * - Frankfurter omits the base currency from its response, so we inject base = 1.
 * - TWD (New Taiwan Dollar) is not in Frankfurter's dataset. We derive it from
 *   the USD cross-rate: TWD_per_base ≈ usdRate * 32.
 * - VND (Vietnamese Dong) is also not in Frankfurter's dataset; derived similarly (× 25400).
 */
export async function getExchangeRates(base = "USD", forceRefresh = false): Promise<Record<string, number>> {
  const now = Date.now();

  if (!forceRefresh && ratesCache && ratesCache.base === base && now - ratesCache.fetchedAt < CACHE_TTL_MS) {
    return ratesCache.rates;
  }

  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${base}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) throw new Error(`Frankfurter API error: ${res.status}`);

    const data = await res.json();
    const rates: Record<string, number> = { ...(data.rates ?? {}) };

    // Frankfurter omits the base currency itself — add it at 1
    rates[base] = 1;

    // TWD and VND are not in Frankfurter; derive from USD cross-rate
    if (!rates["TWD"]) {
      const usdRate = rates["USD"] ?? 1;
      // TWD/USD ≈ 32  →  TWD_per_base = usdRate * 32
      rates["TWD"] = usdRate * 32;
    }
    if (!rates["NTD"]) {
      rates["NTD"] = rates["TWD"];
    }
    if (!rates["VND"]) {
      const usdRate = rates["USD"] ?? 1;
      // VND/USD ≈ 25400  →  VND_per_base = usdRate * 25400
      rates["VND"] = usdRate * 25400;
    }

    ratesCache = { rates, fetchedAt: now, base };
    return rates;
  } catch (err) {
    console.error("[currency] Failed to fetch exchange rates from Frankfurter:", err);
    if (ratesCache) return ratesCache.rates;
    // Fallback static rates relative to USD if network fails
    return {
      USD: 1,
      IDR: 16200,
      TWD: 32,
      NTD: 32,
      EUR: 0.92,
      GBP: 0.78,
      JPY: 155,
      SGD: 1.34,
      MYR: 4.7,
      AUD: 1.52,
      CAD: 1.37,
      CNY: 7.24,
      THB: 36.5,
      VND: 25400,
    };
  }
}

/**
 * Converts an amount from `fromCurrency` to `toCurrency` using USD-based rates.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number> = {}
): number {
  const normFrom = (fromCurrency === "NTD" ? "TWD" : fromCurrency || "IDR").toUpperCase();
  const normTo = (toCurrency === "NTD" ? "TWD" : toCurrency || "IDR").toUpperCase();
  if (normFrom === normTo || !amount) return amount;
  
  // Default fallbacks if rates are missing
  const fromRate = rates[normFrom] || (normFrom === "IDR" ? 16200 : normFrom === "TWD" ? 32 : 1);
  const toRate = rates[normTo] || (normTo === "IDR" ? 16200 : normTo === "TWD" ? 32 : 1);

  // Convert from -> USD -> to
  const amountInUSD = amount / fromRate;
  return amountInUSD * toRate;
}

/**
 * Converts an amount from `fromCurrency` to IDR (kept for backwards compatibility).
 */
export function convertToIDR(
  amount: number,
  fromCurrency: string,
  rates: Record<string, number>
): number {
  return convertCurrency(amount, fromCurrency, "IDR", rates);
}

/**
 * Formats a number with standard commas every 1,000.
 */
export function formatThousands(value: number | string): string {
  if (value === "" || value === undefined || value === null) return "";
  const num = typeof value === "number" ? value : parseFloat(value.toString().replace(/,/g, ""));
  if (isNaN(num)) return "";
  const parts = value.toString().split(".");
  parts[0] = parts[0].replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0];
}

/**
 * Formats a currency value with its symbol and locale formatting.
 * e.g. formatMoney(1158.76, "USD") => "$ 1,158.76"
 * e.g. formatMoney(37009, "TWD") => "$ 37,009"
 * e.g. formatMoney(1500000, "IDR") => "Rp 1.500.000"
 */
export function formatMoney(amount: number, currencyCode: string = "IDR", showSymbol = true): string {
  const rawCode = (currencyCode || "IDR").toUpperCase();
  const code = rawCode === "NTD" ? "TWD" : rawCode;
  const meta = CURRENCY_INFO[code as SupportedCurrency] || { symbol: rawCode, decimals: 2 };
  const symbol = getCurrencySymbol(code);
  const decimals = meta.decimals ?? 2;

  const formattedNum = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  if (!showSymbol) return formattedNum;
  return `${symbol} ${formattedNum}`;
}

/**
 * Backwards compatibility helper
 */
export function formatIDR(amount: number): string {
  return formatMoney(amount, "IDR");
}
