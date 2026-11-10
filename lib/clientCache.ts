/**
 * Lightweight sessionStorage-based client cache.
 *
 * Data is scoped to the browser tab session so it's automatically cleared
 * when the user closes the tab or signs out (since sessionStorage is cleared
 * on window close). We additionally track a TTL so stale data is re-fetched.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export function getCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      sessionStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore quota errors
  }
}

export function invalidateCache(...keys: string[]): void {
  if (typeof window === "undefined") return;
  for (const key of keys) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

// Well-known cache keys used across pages
export const CACHE_KEYS = {
  USER: "moneydocs_user",
  WALLETS: "moneydocs_wallets",
  EXCHANGE_RATES: "moneydocs_exchange_rates",
} as const;

// TTLs
export const CACHE_TTL = {
  USER: 60_000,           // 60 seconds
  WALLETS: 15_000,        // 15 seconds
  EXCHANGE_RATES: 3_600_000, // 1 hour
} as const;
