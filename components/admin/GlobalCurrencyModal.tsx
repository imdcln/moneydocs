"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Globe2, X } from "lucide-react";
import { CURRENCY_INFO, SUPPORTED_CURRENCIES, SupportedCurrency } from "@/lib/currency";
import CurrencyFlag from "@/components/admin/CurrencyFlag";

interface GlobalCurrencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCurrency: string;
  onCurrencyChanged?: (newCurrency: string) => void;
  isOnboarding?: boolean;
}

export default function GlobalCurrencyModal({
  isOpen,
  onClose,
  currentCurrency,
  onCurrencyChanged,
  isOnboarding = false,
}: GlobalCurrencyModalProps) {
  const [selected, setSelected] = useState<SupportedCurrency>(
    (currentCurrency as SupportedCurrency) || "IDR"
  );
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (currentCurrency) {
      setSelected(currentCurrency as SupportedCurrency);
    }
  }, [currentCurrency]);

  const filteredCurrencies = SUPPORTED_CURRENCIES.filter((code) => {
    const info = CURRENCY_INFO[code];
    return (
      info.code.toLowerCase().includes(search.toLowerCase()) ||
      info.name.toLowerCase().includes(search.toLowerCase()) ||
      info.symbol.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/finance/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseCurrency: selected,
          hasCompletedOnboarding: true,
        }),
      });

      if (res.ok) {
        if (onCurrencyChanged) onCurrencyChanged(selected);
        onClose();
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }
    } catch (err) {
      console.error("Failed to save currency:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isOnboarding ? undefined : onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Modal Box */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-[#16171b] border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[var(--color-primary-subtle)] border border-[var(--color-primary-border)] flex items-center justify-center text-[var(--color-primary-light)]">
                  <Globe2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">
                    {isOnboarding ? "Choose Global Currency" : "Global Currency"}
                  </h3>
                  <p className="text-slate-400 text-xs">
                    {isOnboarding
                      ? "Set your main currency for total balance & reports"
                      : "Total balance will be calculated in this currency"}
                  </p>
                </div>
              </div>

              {!isOnboarding && (
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 text-slate-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search filter */}
            <div className="my-3">
              <input
                type="text"
                placeholder="Search currency (e.g. IDR, USD, TWD)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1e2025] border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[var(--color-primary)]"
              />
            </div>

            {/* Currency list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-1">
              {filteredCurrencies.map((code) => {
                const info = CURRENCY_INFO[code];
                const isSelected = selected === code;
                return (
                  <button
                    key={code}
                    onClick={() => setSelected(code)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all duration-150 text-left ${
                      isSelected
                        ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary-border)] text-white shadow-sm"
                        : "bg-[#1b1c21] border-white/5 text-slate-300 hover:bg-[#202228] hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CurrencyFlag flag={info.flag} code={info.code} className="text-2xl" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{info.code}</span>
                          <span className="text-xs text-slate-400">({info.symbol})</span>
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

            {/* Save Button */}
            <div className="pt-4 mt-2 border-t border-white/8">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-bold text-sm transition-all shadow-lg disabled:opacity-50"
                style={{ boxShadow: "0 4px 14px var(--color-primary-glow)" }}
              >
                {saving ? "Saving…" : `Confirm ${selected} (${CURRENCY_INFO[selected]?.symbol || ""})`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
