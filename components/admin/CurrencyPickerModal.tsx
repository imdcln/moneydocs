"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowLeftRight, X } from "lucide-react";
import {
  CURRENCY_INFO,
  SUPPORTED_CURRENCIES,
  SupportedCurrency,
  getCurrencyDisplayCode,
} from "@/lib/currency";
import CurrencyFlag from "@/components/admin/CurrencyFlag";

interface CurrencyPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCurrency: string;
  walletCurrency?: string; // Highlighted as "wallet currency"
  onSelect: (currency: string) => void;
  title?: string;
  description?: string;
}

export default function CurrencyPickerModal({
  isOpen,
  onClose,
  selectedCurrency,
  walletCurrency,
  onSelect,
  title = "Transaction Currency",
  description,
}: CurrencyPickerModalProps) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) setSearch("");
  }, [isOpen]);

  const filtered = SUPPORTED_CURRENCIES.filter((code) => {
    const info = CURRENCY_INFO[code];
    const q = search.toLowerCase();
    return (
      info.displayCode.toLowerCase().includes(q) ||
      code.toLowerCase().includes(q) ||
      info.name.toLowerCase().includes(q) ||
      info.symbol.toLowerCase().includes(q)
    );
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative z-10 w-full max-w-lg bg-[#16171b] border-t border-white/10 rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[80vh]"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/15 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-3 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-subtle)] border border-[var(--color-primary-border)] flex items-center justify-center text-[var(--color-primary-light)]">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">{title}</h3>
                  <p className="text-slate-400 text-xs">
                    {description
                      ? description
                      : walletCurrency
                      ? `Wallet is in ${getCurrencyDisplayCode(walletCurrency)} — pick transaction currency`
                      : "Select the currency for this transaction"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 pb-3">
              <input
                type="text"
                placeholder="Search (e.g. NTD, IDR, Euro)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1e2025] border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[var(--color-primary)]"
                autoFocus
              />
            </div>

            {/* Currency List */}
            <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-2">
              {walletCurrency && walletCurrency !== selectedCurrency && (
                <p className="text-xs text-slate-500 uppercase tracking-wider pb-1">
                  Wallet currency
                </p>
              )}
              {filtered.map((code) => {
                const info = CURRENCY_INFO[code];
                const isSelected = selectedCurrency === code;
                const isWallet = code === walletCurrency;

                return (
                  <button
                    key={code}
                    onClick={() => {
                      onSelect(code);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all duration-150 text-left ${
                      isSelected
                        ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary-border)]"
                        : isWallet
                        ? "bg-sky-500/8 border-sky-500/25 hover:border-sky-500/40"
                        : "bg-[#1b1c21] border-white/5 hover:bg-[#202228] hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CurrencyFlag flag={info.flag} code={code} className="text-2xl" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            {info.displayCode}
                          </span>
                          <span className="text-xs text-slate-400">
                            ({info.symbol})
                          </span>
                          {isWallet && !isSelected && (
                            <span className="text-[10px] bg-sky-500/15 text-sky-400 px-1.5 py-0.5 rounded-full font-bold">
                              Wallet
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{info.name}</p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
