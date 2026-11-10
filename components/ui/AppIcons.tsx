import React, { useRef } from "react";

/**
 * Orange Leather Wallet graphic matching Screenshot 1 & 2
 */
export function WalletGraphic({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 54 54"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`rounded-2xl shadow-md ${className}`}
    >
      <rect width="54" height="54" rx="16" fill="#1b2533" />
      {/* Wallet Body */}
      <rect x="10" y="14" width="34" height="26" rx="6" fill="#ea580c" />
      {/* Wallet Top Fold Shadow */}
      <path
        d="M10 20C10 16.6863 12.6863 14 16 14H38C41.3137 14 44 16.6863 44 20V22H10V20Z"
        fill="#f97316"
      />
      {/* Card Peek */}
      <rect x="14" y="11" width="18" height="6" rx="2" fill="#fed7aa" opacity="0.9" />
      {/* Wallet Stitching / Flap */}
      <path
        d="M32 23H44V31H32C29.7909 31 28 29.2091 28 27C28 24.7909 29.7909 23 32 23Z"
        fill="#c2410c"
      />
      {/* Clasp button */}
      <circle cx="33" cy="27" r="2.5" fill="#fef08a" />
      <circle cx="33" cy="27" r="1.2" fill="#ca8a04" />
    </svg>
  );
}

/**
 * Cute Empty Box with Fluttering Note Wings illustration matching Screenshot 4
 */
export function EmptyBudgetIllustration({ className = "" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        width="140"
        height="140"
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Fluttering note with wings */}
        <g className="animate-bounce" style={{ animationDuration: "3s" }}>
          {/* Dashed trail */}
          <path
            d="M80 82C75 75 70 70 76 60C82 50 85 45 80 38"
            stroke="#22c55e"
            strokeWidth="2.5"
            strokeDasharray="4 4"
            fill="none"
          />
          {/* Wings */}
          <ellipse cx="76" cy="36" rx="8" ry="4" transform="rotate(-30 76 36)" fill="#86efac" />
          <ellipse cx="86" cy="36" rx="8" ry="4" transform="rotate(30 86 36)" fill="#86efac" />
          {/* Note body */}
          <circle cx="81" cy="36" r="4.5" fill="#22c55e" />
        </g>

        {/* 3D Open Box */}
        {/* Box back flaps */}
        <polygon points="45,68 80,48 115,68 80,88" fill="#cbd5e1" opacity="0.6" />
        <polygon points="45,68 80,48 65,40 32,58" fill="#e2e8f0" />
        <polygon points="115,68 80,48 95,40 128,58" fill="#94a3b8" />

        {/* Box Front and Sides */}
        {/* Left Side */}
        <polygon points="45,68 80,88 80,126 45,106" fill="#bfdbfe" />
        {/* Right Side */}
        <polygon points="80,88 115,68 115,106 80,126" fill="#93c5fd" />
        {/* Front Left Flap Open */}
        <polygon points="45,68 80,88 70,102 32,82" fill="#dbeafe" />
        {/* Front Right Flap Open */}
        <polygon points="80,88 115,68 128,82 90,102" fill="#60a5fa" />

        {/* Subtle shadow on ground */}
        <ellipse cx="80" cy="134" rx="45" ry="10" fill="#000000" opacity="0.3" />
      </svg>
    </div>
  );
}

/**
 * Custom calendar icon designed for dark-mode UI.
 * Uses soft white/slate tones so it reads clearly on dark backgrounds,
 * unlike the default Lucide Calendar which renders in black.
 */
export function CalendarIcon({
  className = "",
  size = 20,
  color = "currentColor",
}: {
  className?: string;
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Page body */}
      <rect x="3" y="4" width="18" height="17" rx="3" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      {/* Top spine / header fill */}
      <rect x="3" y="4" width="18" height="6" rx="3" fill={color} fillOpacity="0.15" />
      {/* Ring pegs */}
      <line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Date dots grid — 3 × 2 */}
      <circle cx="8"  cy="14" r="1.1" fill={color} />
      <circle cx="12" cy="14" r="1.1" fill={color} />
      <circle cx="16" cy="14" r="1.1" fill={color} />
      <circle cx="8"  cy="18" r="1.1" fill={color} />
      <circle cx="12" cy="18" r="1.1" fill={color} />
      <circle cx="16" cy="18" r="1.1" fill={color} />
    </svg>
  );
}

/**
 * A styled date picker that shows a placeholder label ("Ending date", etc.)
 * instead of the browser's default "mm/dd/yyyy" chrome.
 * Clicking anywhere on the row opens the native date picker.
 */
export function CustomDatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className = "",
  min,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  min?: string;
  max?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formatted = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div
      className={`relative flex items-center cursor-pointer ${className}`}
      onClick={() => inputRef.current?.showPicker?.() ?? inputRef.current?.click()}
    >
      {/* Visible label */}
      <span className={`text-sm select-none ${formatted ? "text-slate-200" : "text-slate-500"}`}>
        {formatted ?? placeholder}
      </span>
      {/* Hidden native date input — positioned over the div so it can receive focus */}
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        style={{ colorScheme: "dark" }}
      />
    </div>
  );
}

/**
 * Clean Smartphone with Flying Yellow Envelopes illustration matching 1Money Get Support screen
 */
export function EmptySupportIllustration({ className = "" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        width="190"
        height="190"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft Circular Backdrop */}
        <circle cx="98" cy="100" r="72" fill="#384252" opacity="0.65" />

        {/* Smartphone Device */}
        <g>
          {/* Phone Outer Shadow / Glow */}
          <rect
            x="38"
            y="35"
            width="78"
            height="132"
            rx="18"
            fill="#1e293b"
            opacity="0.3"
          />
          {/* Phone Body */}
          <rect
            x="36"
            y="32"
            width="78"
            height="132"
            rx="18"
            fill="#dbeafe"
            stroke="#93c5fd"
            strokeWidth="1.5"
          />
          {/* Screen area */}
          <rect
            x="42"
            y="42"
            width="66"
            height="112"
            rx="12"
            fill="#f8fafc"
          />
          {/* Top Speaker / Notch */}
          <rect
            x="67"
            y="37"
            width="16"
            height="3"
            rx="1.5"
            fill="#94a3b8"
          />
          {/* UI placeholder content on screen */}
          <rect x="52" y="88" width="46" height="4" rx="2" fill="#cbd5e1" />
          <rect x="59" y="96" width="32" height="4" rx="2" fill="#93c5fd" />
          {/* Bottom Home indicator */}
          <rect x="63" y="146" width="24" height="3" rx="1.5" fill="#cbd5e1" />
        </g>

        {/* Small Upper Right Envelope */}
        <g transform="translate(132, 72) rotate(4)">
          <rect width="44" height="30" rx="3" fill="#facc15" />
          {/* Flap top fold */}
          <path d="M0 0 L22 17 L44 0 Z" fill="#eab308" />
          {/* Inner bottom shadow */}
          <path d="M0 30 L16 16 M44 30 L28 16" stroke="#ca8a04" strokeWidth="1.2" strokeLinecap="round" />
        </g>

        {/* Lower Right Medium Envelope */}
        <g transform="translate(112, 108)">
          <rect width="52" height="36" rx="3.5" fill="#facc15" />
          {/* Flap top fold */}
          <path d="M0 0 L26 20 L52 0 Z" fill="#eab308" />
          {/* Bottom folds */}
          <path d="M0 36 L19 19 M52 36 L33 19" stroke="#ca8a04" strokeWidth="1.4" strokeLinecap="round" />
        </g>

        {/* Main Central Large Envelope */}
        <g transform="translate(56, 74)">
          {/* Drop shadow */}
          <rect x="2" y="3" width="66" height="46" rx="4" fill="#000000" opacity="0.15" />
          {/* Main Envelope Body */}
          <rect width="66" height="46" rx="4" fill="#fde047" />
          {/* Flap fold */}
          <path d="M0 0 L33 25 L66 0 Z" fill="#facc15" stroke="#eab308" strokeWidth="0.5" />
          {/* Diagonal crease lines */}
          <path d="M0 46 L24 24 M66 46 L42 24" stroke="#ca8a04" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

/**
 * Official Google 'G' icon for Google Auth
 */
export function GoogleIcon({ className = "w-4 h-4", size }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}
