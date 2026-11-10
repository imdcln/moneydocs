"use client";

import { useState } from "react";
import { X, ArrowRightLeft } from "lucide-react";
import { formatMoney } from "@/lib/currency";

interface Wallet {
  _id: string;
  name: string;
  currency: string;
  balance: number;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  onTransferred: () => void;
}

export default function TransferModal({
  isOpen,
  onClose,
  wallets,
  onTransferred,
}: TransferModalProps) {
  const [fromId, setFromId] = useState(wallets[0]?._id || "");
  const [toId, setToId] = useState(wallets[1]?._id || "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const fromWallet = wallets.find((w) => w._id === fromId);
  const toWallet = wallets.find((w) => w._id === toId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount.replace(/,/g, ""));
    if (!num || num <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }
    if (fromId === toId) {
      setError("Cannot transfer to the same wallet.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/finance/wallets/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWalletId: fromId,
          toWalletId: toId,
          amount: num,
          note: note.trim() || undefined,
        }),
      });

      if (res.ok) {
        onTransferred();
        onClose();
      } else {
        const d = await res.json();
        setError(d.error || "Transfer failed.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-[#16181e] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center text-[var(--color-primary-light)]">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <h2 className="text-white font-bold text-base">Transfer Money</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">From Wallet</label>
              <select
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="w-full bg-[#20222a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
              >
                {wallets.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name} ({formatMoney(w.balance, w.currency)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">To Wallet</label>
              <select
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="w-full bg-[#20222a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
              >
                {wallets.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name} ({formatMoney(w.balance, w.currency)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Amount ({fromWallet?.currency || "IDR"})
              </label>
              <input
                type="text"
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, "").slice(0, 15);
                  setAmount(val);
                }}
                className="w-full bg-[#20222a] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Note (Optional)</label>
              <input
                type="text"
                placeholder="e.g. ATM withdrawal, top-up"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-[#20222a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-bold text-xs tracking-wide transition-all disabled:opacity-50 shadow-md"
            style={{ boxShadow: "0 4px 14px var(--color-primary-glow)" }}
          >
            {loading ? "Transferring…" : "Confirm Transfer"}
          </button>
        </form>
      </div>
    </div>
  );
}
