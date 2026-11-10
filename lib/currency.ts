// ─── Multi-Currency & Exchange Rate Utility ──────────────────────────────────
// Uses https://github.com/fawazahmed0/exchange-api
// Provides precise daily rates for 200+ currencies (including TWD, VND, IDR, etc.)
// Primary: jsDelivr CDN (@fawazahmed0/currency-api)
// Fallback: Cloudflare Pages (currency-api.pages.dev)
// Secondary Fallback: frankfurter.app

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface RatesCache {
  rates: Record<string, number>;
  fetchedAt: number;
  base: string;
  date?: string;
}

const ratesCacheMap: Record<string, RatesCache> = {};

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
 * Uses fawazahmed0/exchange-api (https://github.com/fawazahmed0/exchange-api):
 * - Primary: https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{base}.min.json
 * - Fallback: https://latest.currency-api.pages.dev/v1/currencies/{base}.min.json
 * - Secondary Fallback: https://api.frankfurter.app/latest?from={base}
 *
 * Supports precise exchange rates for 200+ currencies including TWD, VND, IDR, etc.
 */
export async function getExchangeRates(base = "USD", forceRefresh = false): Promise<Record<string, number>> {
  const normBase = (base === "NTD" ? "TWD" : base || "USD").toUpperCase();
  const baseKey = normBase.toLowerCase();
  const now = Date.now();

  const cached = ratesCacheMap[normBase];
  if (!forceRefresh && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rates;
  }

  const fetchWithTimeout = async (url: string, timeoutMs = 6000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        signal: controller.signal,
        next: { revalidate: 3600 },
      });
    } finally {
      clearTimeout(timer);
    }
  };

  // Try 1: jsDelivr CDN from @fawazahmed0/currency-api
  // Try 2: Cloudflare Pages fallback
  const endpoints = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${baseKey}.min.json`,
    `https://latest.currency-api.pages.dev/v1/currencies/${baseKey}.min.json`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetchWithTimeout(url, 6000);
      if (!res.ok) continue;

      const data = await res.json();
      const rawRates = data?.[baseKey];

      if (rawRates && typeof rawRates === "object") {
        const rates: Record<string, number> = {};
        for (const [key, val] of Object.entries(rawRates)) {
          if (typeof val === "number" && !isNaN(val)) {
            rates[key.toUpperCase()] = val;
          }
        }

        // Base currency itself is 1
        rates[normBase] = 1;

        // Alias NTD to TWD
        if (normBase === "TWD" || normBase === "NTD") {
          rates["TWD"] = 1;
          rates["NTD"] = 1;
        } else if (rates["TWD"] !== undefined) {
          rates["NTD"] = rates["TWD"];
        }

        ratesCacheMap[normBase] = {
          rates,
          fetchedAt: now,
          base: normBase,
          date: data?.date,
        };

        return rates;
      }
    } catch {
      // Try next endpoint
    }
  }

  // Try 3: Frankfurter API as a secondary backup
  try {
    const frankfurterUrl = `https://api.frankfurter.app/latest?from=${normBase}`;
    const res = await fetchWithTimeout(frankfurterUrl, 5000);
    if (res.ok) {
      const data = await res.json();
      const rates: Record<string, number> = { ...(data.rates ?? {}) };
      rates[normBase] = 1;

      if (!rates["TWD"]) {
        const usdRate = rates["USD"] ?? 1;
        rates["TWD"] = usdRate * 32.85;
      }
      if (!rates["NTD"]) {
        rates["NTD"] = rates["TWD"];
      }
      if (!rates["VND"]) {
        const usdRate = rates["USD"] ?? 1;
        rates["VND"] = usdRate * 25537;
      }

      ratesCacheMap[normBase] = { rates, fetchedAt: now, base: normBase };
      return rates;
    }
  } catch (err) {
    console.error("[currency] Secondary Frankfurter fallback failed:", err);
  }

  // Return any existing memory cache (even if expired)
  if (cached?.rates) {
    return cached.rates;
  }
  const anyCache = Object.values(ratesCacheMap)[0];
  if (anyCache?.rates) {
    return anyCache.rates;
  }

  // Fallback static rates relative to USD if all network requests fail
  return {
    USD: 1,
    IDR: 18100,
    TWD: 32.85,
    NTD: 32.85,
    EUR: 0.896,
    GBP: 0.747,
    JPY: 158.3,
    SGD: 1.28,
    MYR: 4.06,
    AUD: 1.45,
    CAD: 1.41,
    CNY: 6.67,
    THB: 33.47,
    VND: 25537,
  };
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
  const fromRate = rates[normFrom] || (normFrom === "IDR" ? 18100 : normFrom === "TWD" ? 32.85 : 1);
  const toRate = rates[normTo] || (normTo === "IDR" ? 18100 : normTo === "TWD" ? 32.85 : 1);

  // Convert from -> Base -> to
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
