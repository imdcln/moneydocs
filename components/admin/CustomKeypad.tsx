"use client";

import React from "react";
import { Delete, ChevronRight } from "lucide-react";

interface CustomKeypadProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit?: () => void;
  className?: string;
  showQuickChips?: boolean;
}

/**
 * Safely evaluates simple math expressions (+, -, *, /) without eval()
 * Protects against code injection and arithmetic overflow.
 */
export function safeEvaluateMath(expr: string): string {
  if (!expr) return "0";
  // Clean allowed characters only
  const sanitized = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/[^0-9.+\-*/]/g, "");
  if (!sanitized) return "0";

  try {
    // Tokenize into numbers and operators
    const tokens = sanitized.match(/([0-9.]+|[+\-*/])/g);
    if (!tokens) return "0";

    // Filter out trailing incomplete operators
    let validTokens = [...tokens];
    while (validTokens.length > 0 && /[+\-*/]/.test(validTokens[validTokens.length - 1])) {
      validTokens.pop();
    }
    if (validTokens.length === 0) return "0";

    // 1st pass: multiplication and division
    const intermediate: (number | string)[] = [];
    for (let i = 0; i < validTokens.length; i++) {
      const token = validTokens[i];
      if (token === "*" || token === "/") {
        const prev = intermediate.pop();
        const next = parseFloat(validTokens[++i]);
        if (typeof prev !== "number" || isNaN(next)) return "0";
        if (token === "*") intermediate.push(prev * next);
        else intermediate.push(next === 0 ? prev : prev / next);
      } else {
        intermediate.push(isNaN(Number(token)) ? token : Number(token));
      }
    }

    // 2nd pass: addition and subtraction
    let result = typeof intermediate[0] === "number" ? intermediate[0] : 0;
    for (let i = 1; i < intermediate.length; i += 2) {
      const op = intermediate[i];
      const next = intermediate[i + 1];
      if (typeof next === "number") {
        if (op === "+") result += next;
        else if (op === "-") result -= next;
      }
    }

    if (isNaN(result) || !isFinite(result)) return "0";
    // Round to 2 decimal places max
    const rounded = Math.round(result * 100) / 100;
    return String(Math.max(0, rounded));
  } catch {
    return "0";
  }
}

export default function CustomKeypad({
  value,
  onChange,
  onSubmit,
  className = "",
  showQuickChips = true,
}: CustomKeypadProps) {
  const quickAmounts = ["100.0", "1000.0", "10000.0", "20000.0", "50000.0"];

  const handleKeyClick = (key: string) => {
    if (key === "C") {
      onChange("");
      return;
    }

    if (key === "BACKSPACE") {
      if (value.length > 0) {
        onChange(value.slice(0, -1));
      }
      return;
    }

    if (key === "SUBMIT") {
      // Evaluate if math expression
      if (/[+×÷\-\*\/]/.test(value)) {
        const evaluated = safeEvaluateMath(value);
        onChange(evaluated);
      } else if (onSubmit) {
        onSubmit();
      }
      return;
    }

    if (key === "000") {
      if (!value || value === "0") {
        onChange("0");
      } else if (value.length < 12) {
        onChange(value + "000");
      }
      return;
    }

    if (key === ".") {
      if (!value) {
        onChange("0.");
      } else if (!value.includes(".")) {
        onChange(value + ".");
      }
      return;
    }

    // Operators
    if (["+", "-", "×", "÷"].includes(key)) {
      if (!value) return;
      const lastChar = value[value.length - 1];
      if (["+", "-", "×", "÷"].includes(lastChar)) {
        onChange(value.slice(0, -1) + key);
      } else {
        onChange(value + key);
      }
      return;
    }

    // Digits 0-9: sanitize and check max length
    if (/^[0-9]$/.test(key)) {
      if (value === "0") {
        onChange(key);
      } else if (value.length < 15) {
        onChange(value + key);
      }
    }
  };

  const handleQuickChip = (amt: string) => {
    // Clean formatted number to pure float string
    const num = parseFloat(amt);
    if (!isNaN(num)) {
      onChange(String(num));
    }
  };

  return (
    <div className={`w-full select-none ${className}`}>
      {/* Quick Chips Row */}
      {showQuickChips && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 px-1">
          {quickAmounts.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => handleQuickChip(amt)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full bg-[#202228] border border-white/6 hover:border-[var(--color-primary-border)] text-slate-300 text-xs font-semibold hover:text-white transition-all active:scale-95"
            >
              {amt}
            </button>
          ))}
        </div>
      )}

      {/* Calculator Grid: 4 columns x 5 rows */}
      <div className="grid grid-cols-4 gap-2 pt-1">
        {/* Row 1 */}
        <button
          type="button"
          onClick={() => handleKeyClick("C")}
          className="h-13 rounded-2xl bg-[#22242b] active:bg-[#2c2f38] text-[var(--color-primary-light)] font-bold text-lg flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick("÷")}
          className="h-13 rounded-2xl bg-[#22242b] active:bg-[#2c2f38] text-[var(--color-primary-light)] font-bold text-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          ÷
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick("×")}
          className="h-13 rounded-2xl bg-[#22242b] active:bg-[#2c2f38] text-[var(--color-primary-light)] font-bold text-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          ×
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick("BACKSPACE")}
          className="h-13 rounded-2xl bg-[#22242b] active:bg-[#2c2f38] text-[var(--color-primary-light)] font-bold flex items-center justify-center transition-transform active:scale-95 shadow-sm"
          aria-label="Backspace"
        >
          <Delete className="w-5 h-5 text-[var(--color-primary-light)]" />
        </button>

        {/* Row 2 */}
        <button
          type="button"
          onClick={() => handleKeyClick("7")}
          className="h-13 rounded-2xl bg-[#282a32] active:bg-[#343742] text-white font-bold text-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          7
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick("8")}
          className="h-13 rounded-2xl bg-[#282a32] active:bg-[#343742] text-white font-bold text-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          8
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick("9")}
          className="h-13 rounded-2xl bg-[#282a32] active:bg-[#343742] text-white font-bold text-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          9
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick("-")}
          className="h-13 rounded-2xl bg-[#22242b] active:bg-[#2c2f38] text-[var(--color-primary-light)] font-bold text-2xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          −
        </button>

        {/* Row 3 */}
        <button
          type="button"
          onClick={() => handleKeyClick("4")}
          className="h-13 rounded-2xl bg-[#282a32] active:bg-[#343742] text-white font-bold text-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick("5")}
          className="h-13 rounded-2xl bg-[#282a32] active:bg-[#343742] text-white font-bold text-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          5
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick("6")}
          className="h-13 rounded-2xl bg-[#282a32] active:bg-[#343742] text-white font-bold text-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          6
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick("+")}
          className="h-13 rounded-2xl bg-[#22242b] active:bg-[#2c2f38] text-[var(--color-primary-light)] font-bold text-2xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          +
        </button>

        {/* Rows 4 & 5 (Cols 1-3) + Big submit button spanning 2 rows in Col 4 */}
        <button
          type="button"
          onClick={() => handleKeyClick("1")}
          className="h-13 rounded-2xl bg-[#282a32] active:bg-[#343742] text-white font-bold text-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick("2")}
          className="h-13 rounded-2xl bg-[#282a32] active:bg-[#343742] text-white font-bold text-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          2
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick("3")}
          className="h-13 rounded-2xl bg-[#282a32] active:bg-[#343742] text-white font-bold text-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          3
        </button>

        {/* Big submit button spanning Row 4 & Row 5 */}
        <button
          type="button"
          onClick={() => handleKeyClick("SUBMIT")}
          className="row-span-2 rounded-2xl bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white flex items-center justify-center transition-transform active:scale-95 shadow-lg cursor-pointer"
          style={{ boxShadow: "0 8px 20px -4px var(--color-primary-glow)" }}
          aria-label="Submit or evaluate"
        >
          <ChevronRight className="w-8 h-8 text-white stroke-[2.5]" />
        </button>

        {/* Row 5 (Cols 1-3) */}
        <button
          type="button"
          onClick={() => handleKeyClick("0")}
          className="h-13 rounded-2xl bg-[#282a32] active:bg-[#343742] text-white font-bold text-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick("000")}
          className="h-13 rounded-2xl bg-[#282a32] active:bg-[#343742] text-white font-bold text-base flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          000
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick(".")}
          className="h-13 rounded-2xl bg-[#282a32] active:bg-[#343742] text-white font-bold text-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
        >
          .
        </button>
      </div>
    </div>
  );
}
