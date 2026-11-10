"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { WalletGraphic } from "@/components/ui/AppIcons";
import { CURRENCY_INFO, SupportedCurrency, getCurrencyDisplayCode } from "@/lib/currency";
import { useWalletContext } from "@/hooks/useWalletContext";
import CurrencyFlag from "@/components/admin/CurrencyFlag";

interface WalletSwitcherProps {
  className?: string;
  dropdownAlign?: "center" | "left" | "right";
  /** When true, shows only the icon with no label or chevron (used on the Budgets page header). */
  iconOnly?: boolean;
}

export default function WalletSwitcher({
  className = "",
  dropdownAlign = "center",
  iconOnly = false,
}: WalletSwitcherProps) {
  const { wallets, selectedWalletId, setSelectedWalletId } = useWalletContext();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedWallet = wallets.find((w) => w._id === selectedWalletId);
  const walletLabel = selectedWallet ? selectedWallet.name : "Global";

  const alignClass =
    dropdownAlign === "left"
      ? "left-0"
      : dropdownAlign === "right"
      ? "right-0"
      : "left-1/2 -translate-x-1/2";

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {iconOnly ? (
        /* Icon + chevron button, no text (Budgets page) */
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/15 transition-all cursor-pointer"
          aria-label="Select wallet"
        >
          {selectedWalletId === "ALL" ? (
            <Globe className="w-4 h-4 text-[var(--color-primary-light)] flex-shrink-0" />
          ) : (
            <WalletGraphic size={20} className="rounded-md flex-shrink-0" />
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      ) : (
        /* Default pill button with icon + label + chevron */
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1b1d24] border border-white/8 hover:border-white/15 transition-all cursor-pointer"
          aria-label="Select wallet"
        >
          {selectedWalletId === "ALL" ? (
            <Globe className="w-4 h-4 text-[var(--color-primary-light)] flex-shrink-0" />
          ) : (
            <WalletGraphic size={20} className="rounded-md flex-shrink-0" />
          )}
          <span className="text-white text-xs font-bold truncate max-w-[120px]">{walletLabel}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      )}

      {open && (
        <div
          className={`fixed sm:absolute top-[60px] sm:top-[calc(100%+8px)] ${alignClass} z-[70] w-64 bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in`}
        >
          {/* Global (All Wallets) */}
          <button
            type="button"
            onClick={() => {
              setSelectedWalletId("ALL");
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors ${
              selectedWalletId === "ALL"
                ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]"
                : "text-slate-300 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[var(--color-primary-subtle)] flex items-center justify-center text-[var(--color-primary-light)]">
                <Globe className="w-4 h-4" />
              </div>
              <span>Global</span>
            </div>
            {selectedWalletId === "ALL" && (
              <Check className="w-4 h-4 text-[var(--color-primary-light)] flex-shrink-0" />
            )}
          </button>

          {wallets.length > 0 && (
            <div className="border-t border-white/6 max-h-64 overflow-y-auto">
              {wallets.map((w) => {
                const isActive = selectedWalletId === w._id;
                const meta = CURRENCY_INFO[w.currency as SupportedCurrency];
                return (
                  <button
                    key={w._id}
                    type="button"
                    onClick={() => {
                      setSelectedWalletId(w._id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                      isActive
                        ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CurrencyFlag flag={meta?.flag ?? "💳"} code={w.currency} className="text-base" />
                      <div className="text-left min-w-0">
                        <p className="font-semibold text-sm truncate">{w.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {getCurrencyDisplayCode(w.currency)}
                          {w.isDefault && (
                            <span className="ml-1.5 text-[var(--color-primary-light)] font-bold">· Default</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {isActive && (
                      <Check className="w-4 h-4 text-[var(--color-primary-light)] flex-shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
