"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Check,
  ChevronRight,
  Wallet as WalletIcon,
  Landmark,
  Smartphone,
  TrendingUp,
  Layers,
  Banknote,
  LucideIcon,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CustomKeypad, { safeEvaluateMath } from "@/components/admin/CustomKeypad";
import { useWalletContext } from "@/hooks/useWalletContext";
import { getCurrencyDisplayCode } from "@/lib/currency";
import PageLoading from "@/components/ui/PageLoading";

interface Wallet {
  _id: string;
  name: string;
  type: "CASH" | "BANK" | "E_WALLET" | "INVESTMENT" | "OTHER" | string;
  balance: number;
  currency: string;
  isDefault?: boolean;
  excludeFromReport?: boolean;
}

const WALLET_TYPE_CONFIG: Record<
  string,
  { label: string; icon: LucideIcon; color: string; bgColor: string }
> = {
  CASH: {
    label: "Cash",
    icon: Banknote,
    color: "#10b981",
    bgColor: "#093122",
  },
  BANK: {
    label: "Bank Account",
    icon: Landmark,
    color: "#3b82f6",
    bgColor: "#14254f",
  },
  E_WALLET: {
    label: "E-Wallet",
    icon: Smartphone,
    color: "#a855f7",
    bgColor: "#291442",
  },
  INVESTMENT: {
    label: "Investment",
    icon: TrendingUp,
    color: "#f59e0b",
    bgColor: "#382307",
  },
  OTHER: {
    label: "Other",
    icon: Layers,
    color: "#94a3b8",
    bgColor: "#1f242d",
  },
};

function getWalletIconConfig(type: string) {
  return WALLET_TYPE_CONFIG[type] || WALLET_TYPE_CONFIG.OTHER;
}

/** Show commas for thousands */
function formatThousands(val: string): string {
  if (!val) return "0";
  if (/[+\-*/×÷]/.test(val)) return val;
  const parts = val.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

// ── Wallet Picker Modal Component ───────────────────────────────────────────
interface WalletPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  selectedWalletId: string;
  onSelect: (wallet: Wallet) => void;
}

function WalletPickerModal({
  isOpen,
  onClose,
  wallets,
  selectedWalletId,
  onSelect,
}: WalletPickerModalProps) {
  const [search, setSearch] = useState("");

  const filtered = wallets.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  // Group filtered wallets by wallet type
  const groups: { type: string; label: string; items: Wallet[] }[] = [];
  const order = ["CASH", "BANK", "E_WALLET", "INVESTMENT", "OTHER"];

  order.forEach((t) => {
    const items = filtered.filter((w) => (w.type || "CASH") === t);
    if (items.length > 0) {
      groups.push({
        type: t,
        label: WALLET_TYPE_CONFIG[t]?.label || t,
        items,
      });
    }
  });

  // Any leftover unclassified types
  const leftovers = filtered.filter((w) => !order.includes(w.type || "CASH"));
  if (leftovers.length > 0) {
    groups.push({ type: "OTHER", label: "Other", items: leftovers });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0.8 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0.8 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="fixed inset-0 z-[95] bg-[#0e1014] text-white flex flex-col"
        >
          {/* Top Bar */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8 bg-[#14161b]">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </button>
            <h2 className="text-base font-bold text-white">Select Wallet</h2>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-white/6 bg-[#111216]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search wallet name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1a1c22] border border-white/8 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[var(--color-primary)]"
                autoFocus
              />
            </div>
          </div>

          {/* Grouped List */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 pb-20">
            {groups.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No wallets match your search.
              </div>
            ) : (
              groups.map((group) => {
                const conf = getWalletIconConfig(group.type);
                const IconComponent = conf.icon;

                return (
                  <div
                    key={group.type}
                    className="bg-[#16181d] border border-white/6 rounded-2xl overflow-hidden shadow-sm"
                  >
                    {/* Group Header */}
                    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#121418] border-b border-white/5">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center text-xs"
                        style={{ backgroundColor: conf.bgColor, color: conf.color }}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {group.label}
                      </span>
                    </div>

                    {/* Wallets */}
                    <div className="divide-y divide-white/4">
                      {group.items.map((w) => {
                        const isSelected = w._id === selectedWalletId;
                        const wConf = getWalletIconConfig(w.type || "CASH");
                        const WIcon = wConf.icon;

                        return (
                          <button
                            key={w._id}
                            type="button"
                            onClick={() => {
                              onSelect(w);
                              onClose();
                            }}
                            className={`w-full flex items-center justify-between p-3.5 transition-colors text-left ${
                              isSelected
                                ? "bg-[var(--color-primary-subtle)] text-white"
                                : "hover:bg-white/5 text-slate-200"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm"
                                style={{
                                  backgroundColor: wConf.bgColor,
                                  color: wConf.color,
                                  border: `1.5px solid ${wConf.color}40`,
                                }}
                              >
                                <WIcon className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white">{w.name}</p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {formatThousands(String(w.balance || 0))}{" "}
                                  <span className="text-slate-500 font-medium">
                                    {getCurrencyDisplayCode(w.currency)}
                                  </span>
                                </p>
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
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main Page Content ───────────────────────────────────────────────────────
function AdjustBalanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialWalletId = searchParams.get("walletId");

  const { selectedWalletId: globalSelectedWalletId, refreshWallets, getPermissionsForWallet } = useWalletContext();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [rawAmount, setRawAmount] = useState<string>("0");
  const [excludeFromReport, setExcludeFromReport] = useState<boolean>(true);
  const [description, setDescription] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isWalletPickerOpen, setIsWalletPickerOpen] = useState(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const permittedWallets = wallets.filter((w) => getPermissionsForWallet(w._id).editBalance);
  const currentWalletPerms = getPermissionsForWallet(selectedWalletId);
  const canEditCurrentWallet = !selectedWalletId || currentWalletPerms.editBalance;


  useEffect(() => {
    fetch("/api/finance/wallets")
      .then((r) => r.json())
      .then((d) => {
        const list: Wallet[] = d.wallets ?? [];
        setWallets(list);
        const editableList = list.filter((w) => getPermissionsForWallet(w._id).editBalance);
        if (editableList.length > 0) {
          const preferredId =
            initialWalletId ||
            (globalSelectedWalletId !== "ALL" ? globalSelectedWalletId : null);
          const match =
            editableList.find((w) => w._id === preferredId) ||
            editableList.find((w) => w.isDefault) ||
            editableList[0];
          setSelectedWalletId(match._id);
          setRawAmount(String(match.balance || 0));
          setExcludeFromReport(match.excludeFromReport ?? true);
        } else if (list.length > 0) {
          setSelectedWalletId(list[0]._id);
        }
      })
      .catch((err) => {
        console.error("Failed to load wallets:", err);
        setError("Failed to load wallets.");
      })
      .finally(() => setLoading(false));
  }, [initialWalletId, globalSelectedWalletId]);

  const rawAmountRef = useRef<string>(rawAmount);
  useEffect(() => {
    rawAmountRef.current = rawAmount;
  }, [rawAmount]);

  // Physical keyboard listener — only active while keypad popup is open
  useEffect(() => {
    if (!isKeypadOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (isWalletPickerOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        e.preventDefault();
        setIsKeypadOpen(false);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (/[+\-×÷*/]/.test(rawAmountRef.current)) {
          setRawAmount(safeEvaluateMath(rawAmountRef.current));
        } else {
          setIsKeypadOpen(false);
          handleSave();
        }
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setRawAmount((prev) => (prev === "0" ? e.key : prev + e.key));
      } else if (e.key === "." || e.key === ",") {
        e.preventDefault();
        setRawAmount((prev) => {
          if (!prev) return "0.";
          if (prev.includes(".")) return prev;
          return prev + ".";
        });
      } else if (["+", "-", "*", "/"].includes(e.key)) {
        e.preventDefault();
        const op = e.key === "*" ? "×" : e.key === "/" ? "÷" : e.key;
        setRawAmount((prev) => {
          if (!prev) return prev;
          const last = prev[prev.length - 1];
          if (["+", "-", "×", "÷"].includes(last)) return prev.slice(0, -1) + op;
          return prev + op;
        });
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setRawAmount((prev) => prev.slice(0, -1) || "0");
      } else if (e.key === "c" || e.key === "C" || e.key === "Delete") {
        e.preventDefault();
        setRawAmount("0");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKeypadOpen, isWalletPickerOpen]);

  const handleWalletSelect = (wallet: Wallet) => {
    setSelectedWalletId(wallet._id);
    setRawAmount(String(wallet.balance || 0));
    setExcludeFromReport(wallet.excludeFromReport ?? true);
  };

  const handleSave = async () => {
    if (!selectedWalletId) {
      setError("Please select a wallet to adjust.");
      return;
    }

    const evaluated = safeEvaluateMath(rawAmountRef.current);
    const num = parseFloat(evaluated);
    if (isNaN(num)) {
      setError("Please enter a valid numeric balance.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/finance/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedWalletId,
          balance: num,
          excludeFromReport,
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Failed to adjust balance.");
        setSaving(false);
        return;
      }

      refreshWallets();
      window.dispatchEvent(new Event("transaction-added"));
      router.push("/transactions");
      router.refresh();
    } catch {
      setError("Network error while adjusting balance.");
    } finally {
      setSaving(false);
    }
  };

  const handleKeypadSubmit = () => {
    if (/[+\-×÷*/]/.test(rawAmount)) {
      setRawAmount(safeEvaluateMath(rawAmount));
    } else {
      setIsKeypadOpen(false);
      handleSave();
    }
  };

  if (loading) {
    return (
      <PageLoading
        title="Loading Wallets..."
        subtitle="Preparing balance adjustment"
      />
    );
  }
  if (!loading && (permittedWallets.length === 0 || !canEditCurrentWallet)) {
    return (
      <div className="min-h-screen bg-[#0e1014] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/5">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
          You do not have permission to adjust the balance for this wallet.
        </p>
        <button
          onClick={() => router.push("/transactions")}
          className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold transition-colors"
        >
          Back to transactions
        </button>
      </div>
    );
  }


  if (wallets.length === 0) {
    return (
      <div className="min-h-[100dvh] text-white px-4 pt-3 pb-safe max-w-lg mx-auto flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-400">
          <WalletIcon className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white">No Wallets Found</h2>
        <p className="text-slate-400 text-xs max-w-xs">
          Please create a wallet first before adjusting its balance.
        </p>
        <Link
          href="/transactions"
          className="px-5 py-2.5 rounded-full bg-[var(--color-primary)] hover:brightness-110 text-white font-bold text-xs tracking-wide transition-all shadow-md active:scale-95"
        >
          Return to Transactions
        </Link>
      </div>
    );
  }

  const selectedWallet = wallets.find((w) => w._id === selectedWalletId);
  const walletTypeConf = getWalletIconConfig(selectedWallet?.type || "CASH");
  const WalletTypeIcon = walletTypeConf.icon;

  return (
    <div className="min-h-[100dvh] text-white px-4 pt-3 pb-safe max-w-lg mx-auto flex flex-col">
      <div>
        {/* Top Header matching Screenshot 1 */}
        <div className="flex items-center justify-between py-2">
          <Link
            href="/transactions"
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-white text-lg font-bold">Adjust Balance</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-white text-sm font-bold tracking-wider hover:text-[var(--color-primary-light)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? "SAVING…" : "SAVE"}
          </button>
        </div>

        {error && (
          <div className="my-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* ── Wallet & Balance Card matching Screenshot 1 ─────────────────── */}
        <div className="mt-4 p-5 bg-[#141519] border border-white/8 rounded-2xl relative">
          {/* Wallet Selector Row */}
          <button
            type="button"
            onClick={() => setIsWalletPickerOpen(true)}
            className="flex items-center gap-3.5 w-full text-left cursor-pointer group"
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-transform group-hover:scale-105"
              style={{
                backgroundColor: walletTypeConf.bgColor,
                color: walletTypeConf.color,
                border: `1.5px solid ${walletTypeConf.color}40`,
              }}
            >
              <WalletTypeIcon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-white text-base font-bold truncate block">
                {selectedWallet?.name || "Select Wallet"}
              </span>
              <span className="text-slate-400 text-xs block">
                {selectedWallet ? `${walletTypeConf.label}` : "Tap to choose"}
              </span>
            </div>

            <ChevronRight className="w-5 h-5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Prompt Subtitle */}
          <p className="text-slate-400 text-xs mt-6 mb-1 font-medium">
            Enter current balance of this wallet
          </p>

          {/* Large Balance Display — tap to open keypad popup */}
          <div
            className={`py-2 flex items-center gap-3 cursor-text border-b-2 transition-colors duration-200 ${isKeypadOpen ? "border-[var(--color-primary-light)]" : "border-[var(--color-primary)]/40"}`}
            onClick={() => setIsKeypadOpen(true)}
          >
            <span className="px-2.5 py-1 rounded-lg bg-white/10 text-slate-300 text-xs font-bold flex-shrink-0">
              {getCurrencyDisplayCode(selectedWallet?.currency || "IDR")}
            </span>
            <div className="flex-1 relative">
              <input
                type="text"
                inputMode="none"
                readOnly
                value={formatThousands(rawAmount)}
                onClick={() => setIsKeypadOpen(true)}
                className="w-full bg-transparent text-3xl font-extrabold text-[#29b6f6] placeholder-[#29b6f6]/40 outline-none tracking-tight cursor-text select-none"
              />
              {isKeypadOpen && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-[#29b6f6] animate-pulse rounded-full" />
              )}
            </div>
          </div>
          {!isKeypadOpen && (
            <p className="mt-1 text-[10px] text-slate-600">Tap to enter balance</p>
          )}
        </div>

        {/* ── Exclude From Report Card matching Screenshot 1 ──────────────── */}
        <div className="mt-3 p-4 bg-[#141519] border border-white/8 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setExcludeFromReport((prev) => !prev)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  excludeFromReport ? "bg-[var(--color-primary)]" : "bg-slate-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 absolute top-0.5 shadow-md ${
                    excludeFromReport ? "left-[26px]" : "left-0.5"
                  }`}
                />
              </button>
              <span className="text-white text-sm font-semibold">Exclude from report</span>
            </div>
          </div>

          {/* Pops out description input when Exclude from report is turned OFF */}
          {!excludeFromReport && (
            <div className="pt-2 border-t border-white/6 animate-fade-in space-y-1">
              <p className="text-[11px] text-slate-400 font-medium">
                This adjustment will create an &quot;Adjust Balance&quot; transaction in your report:
              </p>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onFocus={() => setIsKeypadOpen(false)}
                placeholder="Description / note (e.g. Balance correction)"
                className="w-full bg-[#1c1e26] border border-white/8 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Floating Custom Keypad — slides up from bottom when amount tapped */}
      <AnimatePresence>
        {isKeypadOpen && (
          <div key="balance-keypad-container">
            <motion.div
              key="balance-keypad-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsKeypadOpen(false)}
              className="fixed inset-0 z-[75] bg-black/40"
            />
            <motion.div
              key="balance-keypad-panel"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="fixed bottom-0 left-0 right-0 z-[80] w-full max-w-lg mx-auto bg-[#18191f] border-t border-white/10 rounded-t-3xl shadow-2xl px-4 pt-3 pb-safe"
            >
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="flex items-center justify-between px-2 pb-3 border-b border-white/6 mb-2">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Balance</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 bg-white/6 px-2 py-0.5 rounded-lg">
                    {getCurrencyDisplayCode(selectedWallet?.currency || "IDR")}
                  </span>
                  <span className="text-2xl font-extrabold text-[#29b6f6] tracking-tight">
                    {formatThousands(rawAmount) || "0"}
                  </span>
                </div>
              </div>
              <CustomKeypad
                value={rawAmount}
                onChange={(val) => setRawAmount(val)}
                onSubmit={handleKeypadSubmit}
                showQuickChips={false}
              />
              <div className="flex items-center gap-3 px-2 pt-3 pb-5 border-t border-white/8 mt-2">
                <button
                  type="button"
                  onClick={handleKeypadSubmit}
                  disabled={saving}
                  className="flex-1 py-3.5 rounded-full bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-bold text-sm tracking-wide transition-all shadow-md active:scale-[0.99] disabled:opacity-50 text-center cursor-pointer"
                  style={{ boxShadow: "0 6px 16px var(--color-primary-glow)" }}
                >
                  {saving ? "Saving…" : "Save Balance"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Wallet Picker Modal */}
      <WalletPickerModal
        isOpen={isWalletPickerOpen}
        onClose={() => setIsWalletPickerOpen(false)}
        wallets={permittedWallets}
        selectedWalletId={selectedWalletId}
        onSelect={handleWalletSelect}
      />
    </div>
  );
}

export default function AdjustBalancePage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex items-center justify-center text-slate-400 text-sm">
          Loading wallet…
        </div>
      }
    >
      <AdjustBalanceContent />
    </Suspense>
  );
}
