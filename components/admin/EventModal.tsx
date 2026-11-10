"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Coins,
  Wallet as WalletIcon,
  ChevronDown,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletContext } from "@/hooks/useWalletContext";
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_INFO,
  SupportedCurrency,
  getCurrencyDisplayCode,
} from "@/lib/currency";
import { CalendarIcon, CustomDatePicker } from "@/components/ui/AppIcons";
import { useToast } from "@/components/ui/Toast";
import CurrencyFlag from "@/components/admin/CurrencyFlag";

export interface EventData {
  _id?: string;
  name: string;
  icon?: string;
  endingDate?: string | Date;
  currency: string;
  walletId?: {
    _id: string;
    name: string;
    currency?: string;
  } | string | null;
  status?: "RUNNING" | "FINISHED";
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventToEdit?: EventData | null;
}

const EVENT_ICONS = ["✈️", "🌴", "💼", "🎉", "🏔️", "🚗", "🏖️", "🏨", "🚢", "🎒", "🏕️", "🎟️"];

export default function EventModal({
  isOpen,
  onClose,
  onSaved,
  eventToEdit,
}: EventModalProps) {
  const { toast } = useToast();
  const { wallets } = useWalletContext();

  const isEditing = Boolean(eventToEdit && eventToEdit._id);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("✈️");
  const [endingDate, setEndingDate] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [walletId, setWalletId] = useState("");
  const [saving, setSaving] = useState(false);

  // Dropdown states
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const walletDropdownRef = useRef<HTMLDivElement>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (eventToEdit) {
        setName(eventToEdit.name || "");
        setIcon(eventToEdit.icon || "✈️");
        setCurrency(eventToEdit.currency || "IDR");

        if (eventToEdit.endingDate) {
          const d = new Date(eventToEdit.endingDate);
          if (!isNaN(d.getTime())) {
            setEndingDate(d.toISOString().slice(0, 10));
          } else {
            setEndingDate(String(eventToEdit.endingDate));
          }
        } else {
          setEndingDate("");
        }

        if (eventToEdit.walletId) {
          const wid = typeof eventToEdit.walletId === "object" ? eventToEdit.walletId._id : eventToEdit.walletId;
          setWalletId(wid || "");
        } else {
          setWalletId("");
        }
      } else {
        setName("");
        setIcon("✈️");
        setEndingDate("");
        const defWallet = wallets.find((w) => w.isDefault) || wallets[0];
        setWalletId(defWallet?._id || "");
        setCurrency(defWallet?.currency || "IDR");
      }
    }
  }, [isOpen, eventToEdit, wallets]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(e.target as Node)) {
        setWalletDropdownOpen(false);
      }
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target as Node)) {
        setIsCurrencyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      toast("Please enter event name", "error");
      return;
    }

    setSaving(true);
    try {
      const url = isEditing
        ? `/api/finance/events/${eventToEdit?._id}`
        : "/api/finance/events";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          icon,
          endingDate: endingDate ? new Date(endingDate).toISOString() : null,
          currency,
          walletId: walletId || null,
        }),
      });

      if (res.ok) {
        toast(isEditing ? "Event updated" : "Event created", "success");
        onSaved();
        onClose();
      } else {
        toast(isEditing ? "Failed to update event" : "Failed to create event", "error");
      }
    } catch {
      toast("Error saving event", "error");
    } finally {
      setSaving(false);
    }
  };

  const selectedWallet = wallets.find((w) => w._id === walletId);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90] bg-[#111216] text-white flex flex-col overflow-y-auto">
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="max-w-lg mx-auto w-full min-h-screen flex flex-col justify-between p-4 pb-8"
          >
            <div>
              {/* Top Bar */}
              <div className="flex items-center justify-between py-3 border-b border-white/6 mb-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <h2 className="text-white text-base font-bold">
                  {isEditing ? "Edit event" : "Add event"}
                </h2>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="text-white text-sm font-bold tracking-wider hover:text-[var(--color-primary-light)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "SAVING…" : "SAVE"}
                </button>
              </div>

              {/* Form Items */}
              <div className="space-y-6 px-1">
                {/* Row 1: Avatar circle + Name input */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setIconPickerOpen((v) => !v)}
                    className="w-12 h-12 rounded-full bg-[#1e2027] border border-white/10 flex items-center justify-center text-2xl hover:scale-105 transition-transform flex-shrink-0 cursor-pointer"
                  >
                    {icon}
                  </button>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    autoFocus
                    className="flex-1 bg-transparent text-2xl font-normal text-white placeholder-slate-500 outline-none"
                  />
                </div>

                {/* Icon Picker Popover */}
                {iconPickerOpen && (
                  <div className="p-3 bg-[#181920] border border-white/10 rounded-2xl grid grid-cols-6 gap-2 animate-fade-in">
                    {EVENT_ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => {
                          setIcon(ic);
                          setIconPickerOpen(false);
                        }}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-xl cursor-pointer"
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                )}

                {/* Row 2: Calendar icon + Ending date picker */}
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 flex items-center justify-center text-slate-400">
                    <CalendarIcon size={20} color="#94a3b8" />
                  </div>
                  <div className="flex-1">
                    <CustomDatePicker
                      value={endingDate}
                      onChange={setEndingDate}
                      placeholder="Ending date"
                    />
                  </div>
                </div>

                {/* Row 3: Coins icon + Currency selector dropdown */}
                <div className="relative z-20" ref={currencyDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsCurrencyDropdownOpen((v) => !v)}
                    className="w-full flex items-center justify-between py-2 text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                        <Coins className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <CurrencyFlag
                          flag={CURRENCY_INFO[currency as SupportedCurrency]?.flag ?? ""}
                          code={currency}
                          className="text-base"
                        />
                        <span className="text-slate-200 text-sm group-hover:text-white transition-colors">
                          {CURRENCY_INFO[currency as SupportedCurrency]?.name || currency}
                        </span>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1b1d24] border border-white/8 hover:border-white/15 transition-all text-xs font-bold text-slate-200 shadow-sm active:scale-95">
                      <span>{getCurrencyDisplayCode(currency)}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                          isCurrencyDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {isCurrencyDropdownOpen && (
                    <div className="absolute right-0 top-[calc(100%+6px)] z-[95] w-60 max-h-64 bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto animate-fade-in py-1 divide-y divide-white/6 text-left">
                      {SUPPORTED_CURRENCIES.map((code) => {
                        const info = CURRENCY_INFO[code];
                        const isSelected = currency === code;
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrency(code);
                              setIsCurrencyDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]"
                                : "text-slate-300 hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <CurrencyFlag flag={info.flag} code={code} className="text-base flex-shrink-0" />
                              <div className="truncate">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-white">{info.displayCode}</span>
                                  <span className="text-[11px] text-slate-400">({info.symbol})</span>
                                </div>
                                <p className="text-[10px] text-slate-400 font-normal truncate">{info.name}</p>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-[var(--color-primary-light)] flex-shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Row 4: Wallet icon + Wallet selector dropdown */}
                <div className="relative z-10" ref={walletDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setWalletDropdownOpen((v) => !v)}
                    className="w-full flex items-center justify-between py-2 text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                        <WalletIcon className="w-5 h-5" />
                      </div>
                      <span className="text-slate-200 text-sm group-hover:text-white transition-colors">
                        {selectedWallet?.name || "All Wallets"}
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1b1d24] border border-white/8 hover:border-white/15 transition-all text-xs font-bold text-slate-200 shadow-sm active:scale-95">
                      <span className="truncate max-w-[120px]">{selectedWallet?.name ?? "All Wallets"}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                          walletDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {walletDropdownOpen && (
                    <div className="absolute right-0 top-[calc(100%+6px)] z-[85] w-64 bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto animate-fade-in py-1 divide-y divide-white/6 text-left max-h-64">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setWalletId("");
                          setWalletDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-3 text-xs font-semibold transition-colors cursor-pointer ${
                          !walletId ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]" : "text-slate-300 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <WalletIcon className="w-4 h-4 opacity-60" />
                          <span className="font-semibold text-sm">All Wallets</span>
                        </div>
                        {!walletId && <Check className="w-4 h-4 text-[var(--color-primary-light)] flex-shrink-0 ml-2" />}
                      </button>
                      {wallets.map((w) => {
                        const isActive = walletId === w._id;
                        return (
                          <button
                            key={w._id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWalletId(w._id);
                              if (w.currency) setCurrency(w.currency);
                              setWalletDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-3 text-xs font-semibold transition-colors cursor-pointer ${
                              isActive
                                ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]"
                                : "text-slate-300 hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <CurrencyFlag
                                flag={CURRENCY_INFO[w.currency as SupportedCurrency]?.flag ?? "💳"}
                                code={w.currency}
                                className="text-base"
                              />
                              <div className="text-left min-w-0">
                                <p className="font-bold text-white text-sm truncate">{w.name}</p>
                                <p className="text-[11px] text-slate-400">
                                  {getCurrencyDisplayCode(w.currency)}
                                  {w.isDefault && (
                                    <span className="ml-1.5 text-[var(--color-primary-light)] font-bold">· Default</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {isActive && <Check className="w-4 h-4 text-[var(--color-primary-light)] flex-shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
