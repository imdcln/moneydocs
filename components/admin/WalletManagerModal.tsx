"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  X,
  Plus,
  Trash2,
  Wallet as WalletIcon,
  ChevronDown,
  MoreVertical,
  Check,
  Star,
  ArrowRightLeft,
  Edit3,
  Archive,
  Sliders,
  LogOut,
  GripVertical,
  Banknote,
  Landmark,
  Smartphone,
  TrendingUp,
  Layers,
  AlertTriangle,
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
import TransferModal from "@/components/admin/TransferModal";
import CurrencyFlag from "@/components/admin/CurrencyFlag";

export interface Wallet {
  _id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  icon?: string;
  isDefault?: boolean;
  excludeFromTotal?: boolean;
  excludeFromReport?: boolean;
  archived?: boolean;
  order?: number;
  enableNotification?: boolean;
  disabledCategories?: string[];
  sharedWith?: Array<{
    email: string;
    name?: string;
    role: string;
    roleName?: string;
    permissions?: any;
    status?: string;
    image?: string;
    profileColor?: string;
  }>;
  userId?: string;
  ownerEmail?: string;
  ownerName?: string;
  ownerImage?: string;
  ownerProfileColor?: string;
}

interface WalletTypeOption {
  value: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}

const WALLET_TYPE_OPTIONS: WalletTypeOption[] = [
  {
    value: "CASH",
    label: "Cash",
    description: "Physical cash, paper bills & coins",
    icon: Banknote,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
  {
    value: "BANK",
    label: "Bank Account",
    description: "Checking, savings & debit accounts",
    icon: Landmark,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  {
    value: "E_WALLET",
    label: "E-Wallet",
    description: "Digital wallet & mobile payment apps",
    icon: Smartphone,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
  },
  {
    value: "INVESTMENT",
    label: "Investment",
    description: "Stocks, crypto, mutual funds & bonds",
    icon: TrendingUp,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  {
    value: "OTHER",
    label: "Other",
    description: "Gift cards, vouchers & other assets",
    icon: Layers,
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/20",
  },
];

const TYPE_DEFAULT_ICONS: Record<string, string> = {
  CASH: "💵",
  BANK: "🏦",
  E_WALLET: "📱",
  INVESTMENT: "📈",
  OTHER: "💳",
};

interface WalletManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  onWalletUpdated: (updatedWallets?: Wallet[]) => void;
}

interface ConfirmDialogState {
  open: boolean;
  walletId: string;
  walletName: string;
}

// ── Draggable Wallet Item for Drag & Drop Reordering ────────────────────────
function DraggableWalletItem({
  wallet,
  currentUserEmail,
  onOpenMenu,
  onSelectWallet,
}: {
  wallet: Wallet;
  currentUserEmail: string;
  onOpenMenu: (walletId: string, rect: DOMRect) => void;
  onSelectWallet?: (walletId: string) => void;
}) {
  const dragControls = useDragControls();
  const isMember = Boolean(
    wallet.ownerEmail &&
      currentUserEmail &&
      wallet.ownerEmail.toLowerCase() !== currentUserEmail.toLowerCase()
  );
  const ownerDisplayName =
    wallet.ownerName || (wallet.ownerEmail ? wallet.ownerEmail.split("@")[0] : "Owner");

  return (
    <Reorder.Item
      value={wallet}
      id={wallet._id}
      dragListener={false}
      dragControls={dragControls}
      className="relative flex items-center justify-between p-3.5 rounded-2xl bg-[#1b1c22] border border-white/6 hover:border-white/12 transition-colors select-none"
      whileDrag={{
        scale: 1.02,
        boxShadow: "0 12px 28px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--color-primary, #6366f1)",
        zIndex: 50,
        backgroundColor: "#22252e",
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Grip Drag Handle */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            dragControls.start(e);
          }}
          className="cursor-grab active:cursor-grabbing p-1.5 -ml-1 text-slate-500 hover:text-slate-200 transition-colors touch-none flex-shrink-0"
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div
          onClick={() => onSelectWallet?.(wallet._id)}
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
        >
          <WalletGraphic size={40} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-bold text-sm truncate">{wallet.name}</p>
              {wallet.isDefault && (
                <span className="text-[10px] bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)] border border-[var(--color-primary-border)] px-2 py-0.5 rounded-full font-bold">
                  Default
                </span>
              )}
              {isMember && (
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-medium">
                  {ownerDisplayName}&apos;s wallet
                </span>
              )}
              {wallet.archived && (
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                  Archived
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs">
              {formatMoney(wallet.balance, wallet.currency)}{" "}
              <span className="text-slate-500">
                · {getCurrencyDisplayCode(wallet.currency)}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* 3-Dot Options Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          onOpenMenu(wallet._id, rect);
        }}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex-shrink-0 ml-1"
        aria-label="Wallet options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
    </Reorder.Item>
  );
}

// ── Main WalletManagerModal ─────────────────────────────────────────────────
export default function WalletManagerModal({
  isOpen,
  onClose,
  wallets: initialWallets,
  onWalletUpdated,
}: WalletManagerModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [wallets, setWallets] = useState<Wallet[]>(initialWallets);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("CASH");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [saving, setSaving] = useState(false);

  // Custom dropdown states for Create New Wallet
  const [isCreateTypeDropdownOpen, setIsCreateTypeDropdownOpen] = useState(false);
  const [isCreateCurrencyDropdownOpen, setIsCreateCurrencyDropdownOpen] = useState(false);
  const createTypeDropdownRef = useRef<HTMLDivElement>(null);
  const createCurrencyDropdownRef = useRef<HTMLDivElement>(null);

  // Close create wallet dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        createTypeDropdownRef.current &&
        !createTypeDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCreateTypeDropdownOpen(false);
      }
      if (
        createCurrencyDropdownRef.current &&
        !createCurrencyDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCreateCurrencyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  // Current user info for owner detection
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");

  // 3-dot dropdown menu state
  const [activeMenuWalletId, setActiveMenuWalletId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  // Transfer modal state
  const [transferOpen, setTransferOpen] = useState(false);

  // Confirm delete state
  const [confirm, setConfirm] = useState<ConfirmDialogState>({
    open: false,
    walletId: "",
    walletName: "",
  });

  // Confirm leave state
  const [leaveConfirm, setLeaveConfirm] = useState<{
    open: boolean;
    walletId: string;
    walletName: string;
  }>({
    open: false,
    walletId: "",
    walletName: "",
  });

  useEffect(() => {
    if (isOpen) {
      setWallets(initialWallets);
      setShowAddForm(false);
      setIsCreateTypeDropdownOpen(false);
      setIsCreateCurrencyDropdownOpen(false);
      setActiveMenuWalletId(null);
      setMenuPosition(null);
    }
  }, [isOpen, initialWallets]);

  // Fetch current user info and fresh wallets on open
  useEffect(() => {
    if (isOpen) {
      if (!currentUserId) {
        fetch("/api/finance/user")
          .then((r) => r.json())
          .then((d) => {
            if (d.user?.id) setCurrentUserId(d.user.id);
            if (d.user?.email) setCurrentUserEmail(d.user.email);
            if (d.user?.name) setCurrentUserName(d.user.name);
          })
          .catch(() => {});
      }

      fetch("/api/finance/wallets")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.wallets)) {
            setWallets(d.wallets);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, currentUserId]);

  const syncedWallets = [...wallets].sort((a, b) => {
    if (a.archived && !b.archived) return 1;
    if (!a.archived && b.archived) return -1;
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });

  const handleReorder = async (newOrder: Wallet[]) => {
    const updated = newOrder.map((w, index) => ({ ...w, order: index }));
    setWallets(updated);
    onWalletUpdated(updated);

    try {
      const reorderPayload = updated.map((w) => ({
        id: w._id,
        order: w.order,
      }));
      await fetch("/api/finance/wallets/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallets: reorderPayload }),
      });
    } catch {
      toast("Failed to save wallet order", "error");
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/finance/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          currency,
          balance: parseFloat(balance) || 0,
          icon: TYPE_DEFAULT_ICONS[type] || "💳",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = [...wallets, data.wallet];
        setWallets(updated);
        onWalletUpdated(updated);
        setName("");
        setBalance("");
        setType("CASH");
        setCurrency("IDR");
        setShowAddForm(false);
        setIsCreateTypeDropdownOpen(false);
        setIsCreateCurrencyDropdownOpen(false);
        toast("Wallet created successfully", "success");
      } else {
        toast("Failed to create wallet", "error");
      }
    } catch {
      toast("Error creating wallet", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (walletId: string) => {
    try {
      const res = await fetch("/api/finance/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: walletId, isDefault: true }),
      });

      if (res.ok) {
        const updated = wallets.map((w) => ({
          ...w,
          isDefault: w._id === walletId,
        }));
        setWallets(updated);
        onWalletUpdated(updated);
        toast("Default wallet updated", "success");
      } else {
        toast("Failed to set default wallet", "error");
      }
    } catch {
      toast("Error setting default wallet", "error");
    }
  };

  const handleToggleArchive = async (wallet: Wallet) => {
    try {
      const res = await fetch("/api/finance/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: wallet._id, archived: !wallet.archived }),
      });

      if (res.ok) {
        const updated = wallets.map((w) =>
          w._id === wallet._id ? { ...w, archived: !w.archived } : w
        );
        setWallets(updated);
        onWalletUpdated(updated);
        toast(
          wallet.archived ? "Wallet unarchived" : "Wallet archived",
          "success"
        );
      } else {
        toast("Failed to update wallet", "error");
      }
    } catch {
      toast("Error updating wallet", "error");
    }
  };

  const handleDeleteConfirmed = async () => {
    const { walletId } = confirm;
    setConfirm({ open: false, walletId: "", walletName: "" });
    try {
      const res = await fetch(`/api/finance/wallets?id=${walletId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const updated = wallets.filter((w) => w._id !== walletId);
        setWallets(updated);
        onWalletUpdated(updated);
        toast("Wallet deleted", "success");
      } else {
        toast("Failed to delete wallet", "error");
      }
    } catch {
      toast("Error deleting wallet", "error");
    }
  };

  const handleLeaveConfirmed = async () => {
    const { walletId, walletName } = leaveConfirm;
    setLeaveConfirm({ open: false, walletId: "", walletName: "" });
    try {
      const res = await fetch("/api/finance/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: walletId, leaveWallet: true }),
      });

      if (res.ok) {
        const updated = wallets.filter((w) => w._id !== walletId);
        setWallets(updated);
        onWalletUpdated(updated);
        toast(`You left "${walletName}"`, "info");
      } else {
        toast("Failed to leave wallet", "error");
      }
    } catch {
      toast("Error leaving wallet", "error");
    }
  };

  const handleEditWallet = (walletId: string) => {
    onClose();
    router.push(`/wallets/${walletId}`);
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-md bg-[#131418] border border-white/10 rounded-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/8">
                <div>
                  <h3 className="text-white font-bold text-lg">My Wallets</h3>
                  <p className="text-slate-400 text-xs">
                    Manage your financial accounts
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {syncedWallets.length === 0 && !showAddForm ? (
                  <div className="text-center py-8 text-slate-500">
                    <WalletIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium text-slate-400">No wallets yet</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Add a Cash wallet to begin recording transactions
                    </p>
                  </div>
                ) : (
                  <>
                    {syncedWallets.length > 1 && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 font-medium select-none">
                        <span className="flex items-center gap-1.5">
                          <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                          Drag handle to reorder
                        </span>
                        <span>{syncedWallets.length} wallets</span>
                      </div>
                    )}
                    <Reorder.Group
                      axis="y"
                      values={syncedWallets}
                      onReorder={handleReorder}
                      className="space-y-3"
                    >
                      {syncedWallets.map((w) => (
                        <DraggableWalletItem
                          key={w._id}
                          wallet={w}
                          currentUserEmail={currentUserEmail}
                          onSelectWallet={handleEditWallet}
                          onOpenMenu={(id, rect) => {
                            if (activeMenuWalletId === id) {
                              setActiveMenuWalletId(null);
                              setMenuPosition(null);
                            } else {
                              const dropdownHeight = 220;
                              const openUpward =
                                rect.bottom + dropdownHeight > window.innerHeight;
                              setMenuPosition({
                                top: openUpward
                                  ? Math.max(10, rect.top - dropdownHeight - 4)
                                  : rect.bottom + 4,
                                right: Math.max(16, window.innerWidth - rect.right),
                              });
                              setActiveMenuWalletId(id);
                            }
                          }}
                        />
                      ))}
                    </Reorder.Group>
                  </>
                )}

                {/* Add Form */}
                {showAddForm && (
                  <div
                    className="p-4 rounded-2xl bg-[#1d1f26] space-y-3 animate-fade-in border"
                    style={{ borderColor: "var(--color-primary-border)" }}
                  >
                    <h4 className="text-white text-xs font-bold uppercase tracking-wider">
                      New Wallet
                    </h4>

                    {/* Wallet Name */}
                    <input
                      type="text"
                      placeholder="Wallet Name (e.g. Cash, Bank BCA)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[var(--color-primary)] transition-colors"
                    />

                    {/* Type + Currency */}
                    {(() => {
                      const selectedTypeOption =
                        WALLET_TYPE_OPTIONS.find((opt) => opt.value === type) || WALLET_TYPE_OPTIONS[0];
                      const SelectedTypeIcon = selectedTypeOption.icon;
                      const selectedCurrencyInfo =
                        CURRENCY_INFO[currency as SupportedCurrency] || {
                          name: currency,
                          symbol: currency,
                          flag: "💳",
                          displayCode: currency,
                        };

                      return (
                        <div className="flex gap-2">
                          {/* Wallet Type Custom Dropdown */}
                          <div
                            className={`relative flex-1 ${
                              isCreateTypeDropdownOpen ? "z-30" : "z-10"
                            }`}
                            ref={createTypeDropdownRef}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreateTypeDropdownOpen((v) => !v);
                                setIsCreateCurrencyDropdownOpen(false);
                              }}
                              className="w-full flex items-center justify-between bg-[#16171b] border border-white/10 hover:border-white/20 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--color-primary)] transition-all cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${selectedTypeOption.bgColor} border ${selectedTypeOption.borderColor}`}
                                >
                                  <SelectedTypeIcon className={`w-3 h-3 ${selectedTypeOption.color}`} />
                                </div>
                                <span className="font-semibold text-xs truncate text-white">
                                  {selectedTypeOption.label}
                                </span>
                              </div>
                              <ChevronDown
                                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ml-1 ${
                                  isCreateTypeDropdownOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            {isCreateTypeDropdownOpen && (
                              <div className="absolute left-0 top-[calc(100%+6px)] z-[85] w-72 max-h-60 bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto animate-fade-in py-1 divide-y divide-white/6 text-left">
                                {WALLET_TYPE_OPTIONS.map((opt) => {
                                  const IconComp = opt.icon;
                                  const isSelected = type === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setType(opt.value);
                                        setIsCreateTypeDropdownOpen(false);
                                      }}
                                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                                        isSelected
                                          ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]"
                                          : "text-slate-300 hover:bg-white/5"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                          className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${opt.bgColor} border ${opt.borderColor}`}
                                        >
                                          <IconComp className={`w-3.5 h-3.5 ${opt.color}`} />
                                        </div>
                                        <div className="truncate text-left">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-white">{opt.label}</span>
                                          </div>
                                          <p className="text-[10px] text-slate-400 font-normal truncate">
                                            {opt.description}
                                          </p>
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

                          {/* Currency Custom Dropdown */}
                          <div
                            className={`relative ${
                              isCreateCurrencyDropdownOpen ? "z-30" : "z-10"
                            }`}
                            ref={createCurrencyDropdownRef}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreateCurrencyDropdownOpen((v) => !v);
                                setIsCreateTypeDropdownOpen(false);
                              }}
                              className="h-full flex items-center justify-between bg-[#16171b] border border-white/10 hover:border-white/20 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-[var(--color-primary)] transition-all cursor-pointer gap-2"
                            >
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <CurrencyFlag
                                  flag={selectedCurrencyInfo.flag}
                                  code={currency}
                                  className="text-base flex-shrink-0"
                                />
                                <span>{getCurrencyDisplayCode(currency)}</span>
                              </div>
                              <ChevronDown
                                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                                  isCreateCurrencyDropdownOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            {isCreateCurrencyDropdownOpen && (
                              <div className="absolute right-0 top-[calc(100%+6px)] z-[85] w-64 max-h-60 bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto animate-fade-in py-1 divide-y divide-white/6 text-left">
                                {SUPPORTED_CURRENCIES.map((code) => {
                                  const info = CURRENCY_INFO[code as SupportedCurrency];
                                  const isSelected = currency === code;
                                  return (
                                    <button
                                      key={code}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrency(code);
                                        setIsCreateCurrencyDropdownOpen(false);
                                      }}
                                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                                        isSelected
                                          ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]"
                                          : "text-slate-300 hover:bg-white/5"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <CurrencyFlag
                                          flag={info?.flag ?? ""}
                                          code={code}
                                          className="text-base flex-shrink-0"
                                        />
                                        <div className="truncate text-left">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-white">
                                              {info?.displayCode ?? code}
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                              ({info?.symbol})
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-slate-400 font-normal truncate">
                                            {info?.name}
                                          </p>
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
                        </div>
                      );
                    })()}

                    {/* Balance */}
                    <input
                      type="number"
                      placeholder="Initial balance"
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                      className="w-full bg-[#16171b] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[var(--color-primary)]"
                    />

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          setShowAddForm(false);
                          setIsCreateTypeDropdownOpen(false);
                          setIsCreateCurrencyDropdownOpen(false);
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreate}
                        disabled={saving || !name}
                        className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                        style={{ backgroundColor: "var(--color-primary)" }}
                      >
                        {saving ? "Creating…" : "Save Wallet"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Button */}
              {!showAddForm && (
                <div className="pt-3 border-t border-white/8">
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-bold text-sm transition-opacity hover:opacity-90 cursor-pointer"
                    style={{
                      backgroundColor: "var(--color-primary)",
                      boxShadow: "var(--color-primary-glow)",
                    }}
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    Add New Wallet
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating 3-Dot Options Menu for Wallets */}
      {typeof document !== "undefined" &&
        activeMenuWalletId &&
        menuPosition &&
        (() => {
          const targetWallet = syncedWallets.find((w) => w._id === activeMenuWalletId);
          if (!targetWallet) return null;

          const isTargetWalletOwner = Boolean(
            (!targetWallet.ownerEmail && !targetWallet.userId) ||
            (currentUserId && targetWallet.userId && String(targetWallet.userId) === String(currentUserId)) ||
            (currentUserEmail && targetWallet.ownerEmail && targetWallet.ownerEmail.toLowerCase() === currentUserEmail.toLowerCase())
          );

          return createPortal(
            <>
              {/* Transparent backdrop overlay */}
              <div
                className="fixed inset-0 z-[98] bg-transparent cursor-default"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuWalletId(null);
                  setMenuPosition(null);
                }}
              />

              {/* Floating 3-dot dropdown menu */}
              <div
                style={{
                  position: "fixed",
                  top: menuPosition.top,
                  right: menuPosition.right,
                }}
                className="z-[99] w-52 bg-[#22242c] border border-white/10 rounded-2xl shadow-2xl py-1.5 animate-fade-in divide-y divide-white/6 text-xs font-semibold"
              >
                <div className="py-1">
                  {/* 1. Set as default wallet */}
                  {!targetWallet.isDefault && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuWalletId(null);
                        setMenuPosition(null);
                        handleSetDefault(targetWallet._id);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-200 hover:bg-white/5 hover:text-white transition-colors text-left cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-400" />
                      <span>Set as default wallet</span>
                    </button>
                  )}

                  {/* 2. Transfer money */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuWalletId(null);
                      setMenuPosition(null);
                      setTransferOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-200 hover:bg-white/5 hover:text-white transition-colors text-left cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
                    <span>Transfer money</span>
                  </button>

                  {/* 2b. Adjust balance */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuWalletId(null);
                      setMenuPosition(null);
                      onClose();
                      router.push(`/transactions/adjust-balance?walletId=${targetWallet._id}`);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-200 hover:bg-white/5 hover:text-white transition-colors text-left cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Adjust balance</span>
                  </button>

                  {/* 3. Edit -> Redirects to dedicated URL */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuWalletId(null);
                      setMenuPosition(null);
                      handleEditWallet(targetWallet._id);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-200 hover:bg-white/5 hover:text-white transition-colors text-left cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[var(--color-primary-light)]" />
                    <span>Edit</span>
                  </button>

                  {/* 4. Archive */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuWalletId(null);
                      setMenuPosition(null);
                      handleToggleArchive(targetWallet);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-200 hover:bg-white/5 hover:text-white transition-colors text-left cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5 text-slate-400" />
                    <span>{targetWallet.archived ? "Unarchive" : "Archive"}</span>
                  </button>
                </div>

                {/* 5. Delete (Owner only) or Leave wallet (Member only) */}
                <div className="py-1">
                  {isTargetWalletOwner ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuWalletId(null);
                        setMenuPosition(null);
                        setConfirm({
                          open: true,
                          walletId: targetWallet._id,
                          walletName: targetWallet.name,
                        });
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-red-400 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete wallet</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuWalletId(null);
                        setMenuPosition(null);
                        setLeaveConfirm({
                          open: true,
                          walletId: targetWallet._id,
                          walletName: targetWallet.name,
                        });
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-red-400 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Leave wallet</span>
                    </button>
                  )}
                </div>
              </div>
            </>,
            document.body
          );
        })()}

      {/* Transfer Modal */}
      <TransferModal
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        wallets={syncedWallets}
        onTransferred={() => {
          setTransferOpen(false);
          onWalletUpdated();
        }}
      />

      {/* Custom Confirm Delete Dialog */}
      <AnimatePresence>
        {confirm.open && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirm({ open: false, walletId: "", walletName: "" })}
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
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h4 className="text-white font-bold text-base mb-1">Delete wallet?</h4>
              <p className="text-slate-400 text-sm mb-5">
                <span className="text-white font-semibold">{confirm.walletName}</span> will be
                permanently removed. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirm({ open: false, walletId: "", walletName: "" })}
                  className="flex-1 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirmed}
                  className="flex-1 py-2.5 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirm Leave Dialog */}
      <AnimatePresence>
        {leaveConfirm.open && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLeaveConfirm({ open: false, walletId: "", walletName: "" })}
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
                Are you sure you want to leave <span className="text-white font-semibold">{leaveConfirm.walletName}</span>? You will no longer have access to this wallet.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setLeaveConfirm({ open: false, walletId: "", walletName: "" })}
                  className="flex-1 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeaveConfirmed}
                  className="flex-1 py-2.5 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm transition-colors cursor-pointer"
                >
                  Leave
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
