/**
 * CurrencyFlag
 *
 * Renders a currency's flag icon consistently using flagcdn.com images
 * across all platforms (Windows, Android, iOS, macOS, Linux).
 * This eliminates inconsistent emoji font rendering where Windows shows
 * 2-letter country code text (ID, US, EU...) or Android suppresses specific flags.
 */

interface CurrencyFlagProps {
  /** Emoji flag string (kept for fallback / alt text) */
  flag?: string;
  /** Currency code (e.g. IDR, USD, TWD, EUR...) */
  code?: string;
  /** Custom sizing or styling classes */
  className?: string;
}

/**
 * Mapping of Currency code -> ISO 3166-1 alpha-2 2-letter country code
 * for flagcdn.com (https://flagcdn.com/w40/{countryCode}.png)
 */
const CURRENCY_TO_COUNTRY: Record<string, string> = {
  IDR: "id", // Indonesia
  USD: "us", // United States
  TWD: "tw", // Taiwan
  NTD: "tw", // New Taiwan Dollar
  EUR: "eu", // European Union
  GBP: "gb", // United Kingdom
  JPY: "jp", // Japan
  SGD: "sg", // Singapore
  MYR: "my", // Malaysia
  AUD: "au", // Australia
  CAD: "ca", // Canada
  CNY: "cn", // China
  THB: "th", // Thailand
  VND: "vn", // Vietnam
};

export default function CurrencyFlag({
  flag,
  code,
  className = "text-2xl",
}: CurrencyFlagProps) {
  const upperCode = (code || "").toUpperCase();
  const countryCode = CURRENCY_TO_COUNTRY[upperCode];

  if (countryCode) {
    return (
      <span className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://flagcdn.com/w40/${countryCode}.png`}
          srcSet={`https://flagcdn.com/w80/${countryCode}.png 2x`}
          alt={`${upperCode} flag`}
          className="rounded-[3px] object-cover shadow-sm flex-shrink-0"
          style={{ width: "1.35em", height: "0.95em" }}
          loading="lazy"
        />
      </span>
    );
  }

  // Fallback for custom or unknown currencies
  return <span className={className}>{flag || "🌐"}</span>;
}
