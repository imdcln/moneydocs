"use client";

import { useState, useEffect, useRef, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  X,
  Coins,
  ChevronDown,
  Check,
  Lock,
  Package,
  ChevronRight,
  SquarePen,
  Trash2,
  LogOut,
  AlertTriangle,
  Plus,
} from "lucide-react";
import {
  formatMoney,
  SUPPORTED_CURRENCIES,
  getCurrencyDisplayCode,
  CURRENCY_INFO,
  SupportedCurrency,
} from "@/lib/currency";
import { WalletGraphic } from "@/components/ui/AppIcons";
import { useToast } from "@/components/ui/Toast";
import CurrencyFlag from "@/components/admin/CurrencyFlag";
import { CATEGORIES_TREE } from "@/lib/categories";
import { getUserWalletPermissions } from "@/lib/walletPermissions";
import CustomKeypad, { safeEvaluateMath } from "@/components/admin/CustomKeypad";
import WalletCategorySelectionModal from "@/components/admin/WalletCategorySelectionModal";
import PageLoading from "@/components/ui/PageLoading";
import MemberPermissionModal, { SharedMemberData } from "@/components/admin/MemberPermissionModal";

function formatThousands(val: string): string {
  if (!val) return "0";
  if (/[+\-*/×÷]/.test(val)) return val;
  const parts = val.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}


interface WalletData {
  _id: string;
  name: string;
  type?: string;
  balance: number;
  currency: string;
  isDefault?: boolean;
  enableNotification?: boolean;
  excludeFromTotal?: boolean;
  excludeFromReport?: boolean;
  archived?: boolean;
  disabledCategories?: string[];
  userId?: string;
  ownerEmail?: string;
  ownerName?: string;
  ownerImage?: string;
  ownerProfileColor?: string;
  sharedWith?: SharedMemberData[];
}

export default function EditWalletPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: walletId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [balance, setBalance] = useState("0");
  const [enableNotification, setEnableNotification] = useState(true);
  const [excludeFromTotal, setExcludeFromTotal] = useState(false);
  const [disabledCategories, setDisabledCategories] = useState<string[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  // Members management
  const [showAddMemberInput, setShowAddMemberInput] = useState(false);
  const [addMemberInput, setAddMemberInput] = useState("");
  const [invitingMember, setInvitingMember] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleteConfirmMember, setDeleteConfirmMember] = useState<{ email: string; name: string } | null>(null);
  const [deleteWalletConfirmOpen, setDeleteWalletConfirmOpen] = useState(false);
  const [deletingWallet, setDeletingWallet] = useState(false);
  const [editingMember, setEditingMember] = useState<SharedMemberData | null>(null);

  const balanceRef = useRef(balance);
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  // Physical keyboard listener while keypad is open
  useEffect(() => {
    if (!isKeypadOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        e.preventDefault();
        setIsKeypadOpen(false);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (/[+\-×÷*/]/.test(balanceRef.current)) {
          setBalance(safeEvaluateMath(balanceRef.current));
        } else {
          setIsKeypadOpen(false);
        }
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setBalance((prev) => (prev === "0" ? e.key : prev + e.key));
      } else if (e.key === "." || e.key === ",") {
        e.preventDefault();
        setBalance((prev) => {
          if (!prev) return "0.";
          if (prev.includes(".")) return prev;
          return prev + ".";
        });
      } else if (["+", "-", "*", "/"].includes(e.key)) {
        e.preventDefault();
        const op = e.key === "*" ? "×" : e.key === "/" ? "÷" : e.key;
        setBalance((prev) => {
          if (!prev) return prev;
          const last = prev[prev.length - 1];
          if (["+", "-", "×", "÷"].includes(last)) return prev.slice(0, -1) + op;
          return prev + op;
        });
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setBalance((prev) => prev.slice(0, -1) || "0");
      } else if (e.key === "c" || e.key === "C" || e.key === "Delete") {
        e.preventDefault();
        setBalance("0");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isKeypadOpen]);

  // Close currency dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
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

  // Fetch wallet data
  useEffect(() => {
    let isMounted = true;
    async function loadWallet() {
      try {
        setLoading(true);
        const res = await fetch(`/api/finance/wallets?id=${walletId}`);
        if (!res.ok) {
          throw new Error("Failed to load wallet");
        }
        const data = await res.json();
        if (!isMounted) return;

        const w: WalletData = data.wallet;
        setWallet(w);
        if (data.currentUser) {
          setCurrentUserId(data.currentUser.id || "");
          setCurrentUserEmail(data.currentUser.email || "");
        }

        setName(w.name || "");
        setCurrency(w.currency || "IDR");
        setBalance(String(w.balance ?? 0));
        setEnableNotification(w.enableNotification ?? true);
        setExcludeFromTotal(w.excludeFromTotal ?? w.excludeFromReport ?? false);
        setDisabledCategories(w.disabledCategories || []);
      } catch {
        toast("Unable to load wallet details", "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadWallet();
    return () => {
      isMounted = false;
    };
  }, [walletId, toast]);

  // Determine if current user is owner
  const isOwner = Boolean(
    (currentUserId && wallet?.userId && String(wallet.userId) === String(currentUserId)) ||
    (currentUserEmail && wallet?.ownerEmail && wallet.ownerEmail.toLowerCase() === currentUserEmail.toLowerCase()) ||
    (!wallet?.userId && !wallet?.ownerEmail)
  );

  const callerPermissions = useMemo(() => {
    return getUserWalletPermissions(wallet, currentUserEmail, currentUserId);
  }, [wallet, currentUserEmail, currentUserId]);

  const canEditBalance = isOwner || callerPermissions.editBalance;
  const canEditWallet = isOwner || callerPermissions.editWallet;
  const canInviteMember = isOwner || callerPermissions.inviteMember;
  const canManageMembers = isOwner || callerPermissions.manageMembers;

  const ownerEmail = isOwner
    ? (currentUserEmail || wallet?.ownerEmail || "")
    : (wallet?.ownerEmail || "");

  const ownerName = isOwner
    ? (currentUserName || wallet?.ownerName || (ownerEmail ? ownerEmail.split("@")[0] : "Owner"))
    : (wallet?.ownerName || (ownerEmail ? ownerEmail.split("@")[0] : "Owner"));

  const handleInviteMember = async () => {
    if (!addMemberInput.trim() || invitingMember || !wallet) return;
    setInvitingMember(true);
    setInviteError("");
    try {
      const res = await fetch("/api/finance/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: wallet._id, shareEmail: addMemberInput.trim() }),
      });
      const d = await res.json();
      if (!res.ok) {
        setInviteError(d.error || "Failed to invite member.");
      } else {
        if (d.wallet) setWallet(d.wallet);
        toast("Invitation sent!", "success");
        setAddMemberInput("");
        setShowAddMemberInput(false);
        setInviteError("");
      }
    } catch {
      setInviteError("Network error. Please try again.");
    } finally {
      setInvitingMember(false);
    }
  };

  const handleRemoveMember = async (memberEmail: string, isCancel: boolean = false) => {
    if (!wallet) return;
    try {
      const res = await fetch("/api/finance/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: wallet._id, removeShareEmail: memberEmail }),
      });
      const d = await res.json();
      if (res.ok && d.wallet) {
        setWallet(d.wallet);
        toast(isCancel ? "Invitation cancelled" : "Member removed", "info");
      } else {
        toast(d.error || (isCancel ? "Failed to cancel invitation" : "Failed to remove member"), "error");
      }
    } catch {
      toast("Network error", "error");
    }
  };

  const handleLeaveWallet = async () => {
    if (!wallet) return;
    setLeaving(true);
    try {
      const res = await fetch("/api/finance/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: wallet._id, leaveWallet: true }),
      });
      const d = await res.json();
      if (res.ok) {
        toast(`You left "${wallet.name}"`, "info");
        setLeaveConfirmOpen(false);
        router.push("/");
      } else {
        toast(d.error || "Failed to leave wallet", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setLeaving(false);
    }
  };

  const handleDeleteWallet = async () => {
    if (!wallet) return;
    setDeletingWallet(true);
    try {
      const res = await fetch(`/api/finance/wallets?id=${wallet._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast(`Wallet "${wallet.name}" deleted`, "success");
        setDeleteWalletConfirmOpen(false);
        router.push("/");
      } else {
        const d = await res.json();
        toast(d.error || "Failed to delete wallet", "error");
      }
    } catch {
      toast("Network error deleting wallet", "error");
    } finally {
      setDeletingWallet(false);
    }
  };

  const handleSave = async () => {
    if (canEditWallet && !name.trim()) {
      toast("Wallet name cannot be empty", "error");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        id: wallet?._id,
        enableNotification,
        excludeFromTotal,
      };
      if (canEditWallet) {
        payload.name = name.trim();
        payload.currency = currency;
        payload.disabledCategories = disabledCategories;
      }
      if (canEditBalance) {
        payload.balance = parseFloat(safeEvaluateMath(balance).replace(/,/g, "")) || 0;
      }

      const res = await fetch("/api/finance/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast("Wallet updated successfully", "success");
        handleBack();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to update wallet", "error");
      }
    } catch {
      toast("Error updating wallet", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  if (loading) {
    return <PageLoading title="Loading Wallet..." subtitle="Fetching wallet details" />;
  }

  if (!wallet) {
    return (
      <div className="min-h-screen bg-[#0e1014] text-white flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-400 font-bold mb-4">Wallet not found or access denied.</p>
        <button
          onClick={handleBack}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold transition-colors cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Calculate total number of categories
  let totalCategoriesCount = 0;
  CATEGORIES_TREE.forEach((p) => {
    totalCategoriesCount += 1;
    totalCategoriesCount += p.children.length;
  });
  const activeCategoriesCount = Math.max(
    0,
    totalCategoriesCount - disabledCategories.length
  );

  const currInfo = CURRENCY_INFO[currency as SupportedCurrency] || {
    name: currency,
    symbol: currency,
    displayCode: currency,
  };

  return (
    <div className={`min-h-screen bg-[#111216] text-white flex flex-col ${isCategoryModalOpen ? "overflow-hidden" : "overflow-y-auto"}`}>
      <div className="max-w-lg mx-auto w-full min-h-screen flex flex-col p-4 pb-28">
        <div>
          {/* Top Bar matching Edit Wallet design */}
          <div className="flex items-center justify-between py-3 border-b border-white/6 mb-4">
            <button
              onClick={handleBack}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-white text-base font-bold">Edit wallet</h2>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-white text-sm font-bold tracking-wider hover:text-[var(--color-primary-light)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? "SAVING…" : "SAVE"}
            </button>
          </div>

          {/* Wallet Name & Icon */}
          <div className="p-4 bg-[#181920] border border-white/6 rounded-2xl flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-600/20 flex items-center justify-center text-2xl flex-shrink-0">
              <WalletGraphic size={44} />
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Wallet name"
                disabled={!canEditWallet}
                className="w-full bg-transparent text-xl font-bold text-white outline-none placeholder-slate-500"
              />
            </div>
          </div>

          {/* Currency row */}
          <div className="p-4 bg-[#181920] border border-white/6 rounded-2xl relative z-20 mb-3" ref={currencyDropdownRef}>
            <button
              type="button"
              disabled={!canEditWallet}
              onClick={() => canEditWallet && setIsCurrencyDropdownOpen((v) => !v)}
              className="w-full flex items-center justify-between text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
                  <Coins className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <CurrencyFlag
                    flag={CURRENCY_INFO[currency as SupportedCurrency]?.flag ?? ""}
                    code={currency}
                    className="text-lg"
                  />
                  <span className="text-white text-base font-semibold group-hover:text-[var(--color-primary-light)] transition-colors">{currInfo.name}</span>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1b1d24] border border-white/8 hover:border-white/15 transition-all text-xs font-bold text-slate-200 shadow-sm active:scale-95">
                <span>{currInfo.displayCode}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isCurrencyDropdownOpen ? "rotate-180" : ""}`} />
              </div>
            </button>

            {isCurrencyDropdownOpen && (
              <div className="absolute right-4 top-[calc(100%+6px)] z-[85] w-60 max-h-64 bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto animate-fade-in py-1 divide-y divide-white/6 text-left">
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
                      {isSelected && <Check className="w-4 h-4 text-[var(--color-primary-light)] flex-shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Balance card with Custom Keypad Trigger */}
          <div className="p-5 bg-[#181920] border border-white/6 rounded-2xl mb-3">
            <p className="text-slate-400 text-xs font-medium mb-1">
              {canEditBalance ? "Enter current balance of this wallet" : "Current balance of this wallet"}
            </p>
            {!canEditBalance && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-slate-800 text-slate-400 border border-white/10 px-2 py-0.5 rounded-md font-semibold mb-1">
                <Lock className="w-2.5 h-2.5" />
                Read-only
              </span>
            )}
            <div
              className={`py-2 flex items-center gap-3 cursor-text border-b-2 transition-colors duration-200 ${
                isKeypadOpen ? "border-[var(--color-primary-light)]" : "border-[var(--color-primary)]/40"
              }`}
              onClick={canEditBalance ? () => setIsKeypadOpen(true) : undefined}
            >
              <span className="px-2.5 py-1 rounded-lg bg-white/10 text-slate-300 text-xs font-bold flex-shrink-0">
                {currInfo.displayCode}
              </span>
              <div className="flex-1 relative">
                <input
                  type="text"
                  inputMode="none"
                  readOnly
                  value={formatThousands(balance)}
                  onClick={canEditBalance ? () => setIsKeypadOpen(true) : undefined}
                  className="w-full bg-transparent text-2xl font-extrabold text-[#29b6f6] placeholder-[#29b6f6]/40 outline-none tracking-tight cursor-text select-none"
                />
                {isKeypadOpen && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-7 bg-[#29b6f6] animate-pulse rounded-full" />
                )}
              </div>
            </div>
            {!isKeypadOpen && (
              <p className="mt-1 text-[10px] text-slate-500">
                {canEditBalance ? "Tap to edit balance using keypad" : "You do not have permission to edit balance for this wallet"}
              </p>
            )}
          </div>

          {/* Categories Option */}
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            disabled={!canEditWallet}
            className={`w-full p-4 bg-[#181920] border border-white/6 rounded-2xl flex items-center justify-between transition-colors mb-4 ${
              canEditWallet ? "hover:bg-white/5 cursor-pointer" : "opacity-75 cursor-default"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300">
                <Package className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-semibold">Categories</p>
                <p className="text-slate-400 text-xs">
                  {activeCategoriesCount} categories
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>

          {/* Members section */}
          <div className="p-4 bg-[#181920] border border-white/6 rounded-2xl mb-3 space-y-3">
            <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              Members
            </h4>

            {/* Owner row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-white/10 flex items-center justify-center flex-shrink-0 shadow-md">
                  {wallet.ownerImage ? (
                    <img
                      src={wallet.ownerImage}
                      alt={ownerName || "Owner"}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className={`w-full h-full flex items-center justify-center text-white font-bold text-base bg-gradient-to-tr ${
                        wallet.ownerProfileColor || "from-purple-500 to-indigo-500"
                      }`}
                    >
                      {((ownerName || ownerEmail || "O")[0]).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-bold truncate">{ownerName || "Owner"}</p>
                  <p className="text-slate-400 text-xs truncate">{ownerEmail || ""}</p>
                </div>
              </div>
              <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold flex-shrink-0 ml-2">
                Owner
              </span>
            </div>

            {/* Shared members */}
            {wallet.sharedWith
              ?.filter((m) => {
                if (!isOwner) return m.status === "ACCEPTED";
                return m.status === "ACCEPTED" || m.status === "PENDING" || !m.status;
              })
              .map((m) => {
                const isPending = m.status === "PENDING" || !m.status;
                const displayName = m.name || m.email.split("@")[0];
                return (
                  <div key={m.email} className="flex items-center justify-between pt-2.5 border-t border-white/5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 border border-white/10 flex items-center justify-center flex-shrink-0 shadow-sm">
                        {m.image ? (
                          <img
                            src={m.image}
                            alt={displayName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div
                            className={`w-full h-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-tr ${
                              m.profileColor || "from-slate-600 to-slate-700"
                            }`}
                          >
                            {((displayName || m.email || "?")[0]).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-xs font-semibold truncate">
                          {displayName}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {m.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/25 px-2 py-0.5 rounded-md font-bold flex-shrink-0">
                        {m.roleName || (m.role === "VIEWER" ? "Viewer" : "Editor")}
                      </span>

                      {isPending && (
                        <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-md font-semibold tracking-wide">
                          Pending
                        </span>
                      )}

                      {/* Edit button - opens permission modal */}
                      {(isOwner || canManageMembers) && (
                        <button
                          type="button"
                          onClick={() => setEditingMember(m as SharedMemberData)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer flex items-center justify-center active:scale-95"
                          title="Edit member role & permissions"
                          aria-label="Edit member"
                        >
                          <SquarePen className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete button - owner only */}
                      {(isOwner || canManageMembers) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isPending) {
                              handleRemoveMember(m.email, true);
                            } else {
                              setDeleteConfirmMember({ email: m.email, name: displayName });
                            }
                          }}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all cursor-pointer flex items-center justify-center active:scale-95"
                          title={isPending ? "Cancel invitation" : "Delete member"}
                          aria-label={isPending ? "Cancel invitation" : "Delete member"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Leave button - member sees this for own row */}
                      {!isOwner && m.email.toLowerCase() === currentUserEmail.toLowerCase() && (
                        <button
                          type="button"
                          onClick={() => setLeaveConfirmOpen(true)}
                          disabled={leaving}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all cursor-pointer flex items-center justify-center active:scale-95 disabled:opacity-50"
                          title="Leave wallet"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* Add Member */}
            {(isOwner || canInviteMember) && (
              showAddMemberInput ? (
                <div className="pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter user email or username..."
                      value={addMemberInput}
                      onChange={(e) => { setAddMemberInput(e.target.value); setInviteError(""); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleInviteMember();
                        }
                      }}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[var(--color-primary)]"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={!addMemberInput.trim() || invitingMember}
                      onClick={handleInviteMember}
                      className="px-3 py-1.5 rounded-xl bg-[var(--color-primary)] hover:brightness-110 active:scale-95 text-white text-xs font-bold disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {invitingMember ? "Inviting…" : "Invite"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddMemberInput(false); setAddMemberInput(""); setInviteError(""); }}
                      className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {inviteError && (
                    <div className="flex items-center gap-1.5 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{inviteError}</span>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddMemberInput(true)}
                  className="flex items-center gap-2 text-xs font-bold text-[var(--color-primary-light)] hover:brightness-110 pt-2 cursor-pointer"
                >
                  <div className="w-5 h-5 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center">
                    <Plus className="w-3.5 h-3.5 text-[var(--color-primary-light)]" />
                  </div>
                  <span>ADD MEMBER</span>
                </button>
              )
            )}
          </div>

          {/* Toggle Switches */}
          <div className="p-4 bg-[#181920] border border-white/6 rounded-2xl space-y-4 mb-4">
            {/* Enable Notification */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-semibold">Enable Notification</p>
                <p className="text-slate-400 text-xs">
                  Get notified when there are changes to this wallet&apos;s transactions.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEnableNotification((prev) => !prev)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ml-3 ${
                  enableNotification ? "bg-[var(--color-primary)]" : "bg-slate-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 absolute top-0.5 shadow-md ${
                    enableNotification ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Excluded from Total */}
            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <div>
                <p className="text-white text-sm font-semibold">Excluded from Total</p>
                <p className="text-slate-400 text-xs">
                  Ignore this wallet and its balance in the &quot;Total&quot;
                </p>
              </div>

              <button
                type="button"
                onClick={() => setExcludeFromTotal((prev) => !prev)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ml-3 ${
                  excludeFromTotal ? "bg-[var(--color-primary)]" : "bg-slate-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 absolute top-0.5 shadow-md ${
                    excludeFromTotal ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Actions at bottom: Delete Wallet (Owner) or Leave Wallet (Member) */}
          <div className="p-4 bg-[#181920] border border-white/6 rounded-2xl mb-8 space-y-3">
            {isOwner ? (
              <button
                type="button"
                onClick={() => setDeleteWalletConfirmOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400 font-bold text-sm transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Wallet</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLeaveConfirmOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400 font-bold text-sm transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Leave Wallet</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Custom Keypad popup */}
      <AnimatePresence>
        {isKeypadOpen && (
          <>
            <motion.div
              key="edit-wallet-keypad-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsKeypadOpen(false)}
              className="fixed inset-0 z-[85] bg-black/50"
            />
            <motion.div
              key="edit-wallet-keypad-panel"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="fixed bottom-0 left-0 right-0 z-[90] w-full max-w-lg mx-auto bg-[#18191f] border-t border-white/10 rounded-t-3xl shadow-2xl px-4 pt-3 pb-safe"
            >
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="flex items-center justify-between px-2 pb-3 border-b border-white/6 mb-2">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Balance</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 bg-white/6 px-2 py-0.5 rounded-lg">
                    {currInfo.displayCode}
                  </span>
                  <span className="text-2xl font-extrabold text-[#29b6f6] tracking-tight">
                    {formatThousands(balance) || "0"}
                  </span>
                </div>
              </div>
              <CustomKeypad
                value={balance}
                onChange={(val) => setBalance(val)}
                onSubmit={() => {
                  if (/[+\-×÷*/]/.test(balance)) {
                    setBalance(safeEvaluateMath(balance));
                  } else {
                    setIsKeypadOpen(false);
                  }
                }}
                showQuickChips={false}
              />
              <div className="flex items-center gap-3 px-2 pt-3 pb-5 border-t border-white/8 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (/[+\-×÷*/]/.test(balance)) {
                      setBalance(safeEvaluateMath(balance));
                    }
                    setIsKeypadOpen(false);
                  }}
                  className="flex-1 py-3 rounded-full bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-bold text-sm tracking-wide transition-all shadow-md active:scale-[0.99] text-center cursor-pointer"
                  style={{ boxShadow: "0 6px 16px var(--color-primary-glow)" }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Nested Category Selector Modal */}
      <WalletCategorySelectionModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        disabledCategories={disabledCategories}
        onChangeDisabled={(newDisabled) => setDisabledCategories(newDisabled)}
      />

      {/* Confirm Delete Member Dialog */}
      <AnimatePresence>
        {deleteConfirmMember && (
          <div className="fixed inset-0 z-[115] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmMember(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative z-10 w-full max-w-xs bg-[#1a1c23] border border-white/10 rounded-3xl p-6 shadow-2xl text-center"
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h4 className="text-white font-bold text-base mb-1">Remove member?</h4>
              <p className="text-slate-400 text-sm mb-5">
                Are you sure you want to remove <span className="text-white font-semibold">{deleteConfirmMember.name}</span> from <span className="text-white font-semibold">{wallet.name}</span>? They will no longer have access to this wallet.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmMember(null)}
                  className="flex-1 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const emailToRemove = deleteConfirmMember.email;
                    setDeleteConfirmMember(null);
                    handleRemoveMember(emailToRemove, false);
                  }}
                  className="flex-1 py-2.5 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm transition-colors cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Leave Wallet Dialog */}
      <AnimatePresence>
        {leaveConfirmOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLeaveConfirmOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative z-10 w-full max-w-xs bg-[#1a1c23] border border-white/10 rounded-3xl p-6 shadow-2xl text-center"
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <LogOut className="w-6 h-6 text-red-400" />
              </div>
              <h4 className="text-white font-bold text-base mb-1">Leave wallet?</h4>
              <p className="text-slate-400 text-sm mb-5">
                Are you sure you want to leave <span className="text-white font-semibold">{wallet.name}</span>? You will no longer have access to this wallet.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setLeaveConfirmOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLeaveWallet}
                  disabled={leaving}
                  className="flex-1 py-2.5 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {leaving ? "Leaving…" : "Leave"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Wallet Dialog */}
      <AnimatePresence>
        {deleteWalletConfirmOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteWalletConfirmOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative z-10 w-full max-w-xs bg-[#1a1c23] border border-white/10 rounded-3xl p-6 shadow-2xl text-center"
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h4 className="text-white font-bold text-base mb-1">Delete wallet?</h4>
              <p className="text-slate-400 text-sm mb-5">
                Are you sure you want to delete <span className="text-white font-semibold">{wallet.name}</span>? All transaction records associated with this wallet will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteWalletConfirmOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteWallet}
                  disabled={deletingWallet}
                  className="flex-1 py-2.5 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {deletingWallet ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Member Permission Modal */}
      <MemberPermissionModal
        isOpen={!!editingMember}
        onClose={() => setEditingMember(null)}
        walletId={wallet._id}
        member={editingMember}
        onSaved={(updatedPermissions, updatedRoleName) => {
          if (!editingMember) return;
          setWallet((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              sharedWith: (prev.sharedWith || []).map((m) =>
                m.email.toLowerCase() === editingMember.email.toLowerCase()
                  ? { ...m, permissions: updatedPermissions, roleName: updatedRoleName }
                  : m
              ),
            };
          });
          setEditingMember(null);
        }}
      />
    </div>
  );
}
