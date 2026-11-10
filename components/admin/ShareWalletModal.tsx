"use client";

import { useState } from "react";
import { X, Share2, Mail, Trash2, Check, AlertTriangle } from "lucide-react";

interface ShareWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: {
    _id: string;
    name: string;
    sharedWith?: Array<{ email: string; role: string }>;
  } | null;
  onUpdated: () => void;
}

export default function ShareWalletModal({
  isOpen,
  onClose,
  wallet,
  onUpdated,
}: ShareWalletModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [removeConfirmEmail, setRemoveConfirmEmail] = useState<string | null>(null);

  if (!isOpen || !wallet) return null;

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/finance/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: wallet._id,
          shareEmail: email.trim().toLowerCase(),
        }),
      });

      if (res.ok) {
        setSuccess(`Shared successfully with ${email}`);
        setEmail("");
        onUpdated();
      } else {
        const d = await res.json();
        setError(d.error || "Failed to share wallet.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = (removeEmail: string) => {
    setRemoveConfirmEmail(removeEmail);
  };

  const confirmRemove = async () => {
    if (!removeConfirmEmail) return;
    const targetEmail = removeConfirmEmail;
    setRemoveConfirmEmail(null);
    setLoading(true);
    try {
      await fetch("/api/finance/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: wallet._id,
          removeShareEmail: targetEmail,
        }),
      });
      onUpdated();
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
              <Share2 className="w-4 h-4" />
            </div>
            <h2 className="text-white font-bold text-base">Share {wallet.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-slate-400 text-xs">
          Allow other users to view and add transactions to this wallet together.
        </p>

        <form onSubmit={handleShare} className="space-y-3">
          <div className="flex items-center gap-2 bg-[#1f222b] border border-white/10 rounded-2xl px-3 py-2.5">
            <Mail className="w-4 h-4 text-slate-400" />
            <input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
          {success && <p className="text-emerald-400 text-xs flex items-center gap-1"><Check className="w-3.5 h-3.5" />{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-full bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-bold text-xs tracking-wide transition-all disabled:opacity-50 shadow-md"
            style={{ boxShadow: "0 4px 12px var(--color-primary-glow)" }}
          >
            {loading ? "Sharing…" : "Invite Collaborator"}
          </button>
        </form>

        {/* Existing shared members */}
        {wallet.sharedWith && wallet.sharedWith.length > 0 && (
          <div className="border-t border-white/6 pt-3 space-y-2">
            <p className="text-slate-400 text-xs font-semibold">Shared with:</p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {wallet.sharedWith.map((sw) => (
                <div
                  key={sw.email}
                  className="flex items-center justify-between p-2 rounded-xl bg-white/3 text-xs"
                >
                  <span className="text-slate-200 truncate">{sw.email}</span>
                  <button
                    onClick={() => handleRemove(sw.email)}
                    className="text-red-400 hover:text-red-300 ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Remove Access Confirmation Modal */}
      {removeConfirmEmail && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setRemoveConfirmEmail(null)}
          />
          <div className="relative z-10 w-full max-w-sm bg-[#1a1c24] border border-white/10 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white text-base font-bold">Remove access?</h3>
              <p className="text-slate-400 text-xs mt-1">
                <span className="text-white font-semibold">{removeConfirmEmail}</span> will no longer have access to this wallet.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRemoveConfirmEmail(null)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shadow-lg shadow-red-600/30"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
