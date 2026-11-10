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
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Check,
  Star,
  ArrowRightLeft,
  Edit3,
  Archive,
  ArrowLeft,
  Search,
  Package,
  Sparkles,
  Coins,
  ChevronRight,
  Sliders,
  LogOut,
  GripVertical,
  Banknote,
  Landmark,
  Smartphone,
  TrendingUp,
  Layers,
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
import { CATEGORIES_TREE, ParentCategory, SubCategory } from "@/lib/categories";
import CategoryIcon from "@/components/ui/CategoryIcon";
import CustomKeypad, { safeEvaluateMath } from "@/components/admin/CustomKeypad";

function formatThousands(val: string): string {
  if (!val) return "0";
  if (/[+\-*/×÷]/.test(val)) return val;
  const parts = val.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

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
  enableNotification?: boolean;
  disabledCategories?: string[];
  sharedWith?: Array<{ email: string; name?: string; role: string; status?: string }>;
  userId?: string;
  ownerEmail?: string;
  ownerName?: string;
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

// ── Wallet Category Selection Modal matching Screenshot 3 ──────────────────
interface WalletCategorySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  disabledCategories: string[];
  onChangeDisabled: (newDisabled: string[]) => void;
}

function WalletCategorySelectionModal({
  isOpen,
  onClose,
  disabledCategories,
  onChangeDisabled,
}: WalletCategorySelectionModalProps) {
  const [activeTab, setActiveTab] = useState<"EXPENSE" | "INCOME" | "DEBT">("EXPENSE");
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll when category modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const currentCategories = CATEGORIES_TREE.filter((c) => c.type === activeTab);

  // Flatten all items for current tab (parents and children)
  const allTabItemIds: string[] = [];
  currentCategories.forEach((parent) => {
    allTabItemIds.push(parent.id);
    parent.children.forEach((c) => allTabItemIds.push(c.id));
  });

  const allActiveInTab = allTabItemIds.every((id) => !disabledCategories.includes(id));

  const handleToggleAll = () => {
    if (allActiveInTab) {
      // Inactive all in this tab
      const set = new Set(disabledCategories);
      allTabItemIds.forEach((id) => set.add(id));
      onChangeDisabled(Array.from(set));
    } else {
      // Active all in this tab
      const set = new Set(disabledCategories);
      allTabItemIds.forEach((id) => set.delete(id));
      onChangeDisabled(Array.from(set));
    }
  };

  const toggleParent = (parent: (typeof currentCategories)[number]) => {
    const set = new Set(disabledCategories);
    const isCurrentlyDisabled = set.has(parent.id);

    if (isCurrentlyDisabled) {
      // Activating parent: turn on parent AND all its subcategories
      set.delete(parent.id);
      parent.children.forEach((c) => set.delete(c.id));
    } else {
      // Deactivating parent: turn off parent AND all its subcategories
      set.add(parent.id);
      parent.children.forEach((c) => set.add(c.id));
    }

    onChangeDisabled(Array.from(set));
  };

  const toggleChild = (parentId: string, childId: string) => {
    const set = new Set(disabledCategories);
    const isChildDisabled = set.has(childId);

    if (isChildDisabled) {
      // Turning ON subcategory: activate subcategory
      set.delete(childId);
      // If parent category is inactive, turn parent category ON too
      set.delete(parentId);
    } else {
      // Turning OFF subcategory: deactivate subcategory
      set.add(childId);
    }

    onChangeDisabled(Array.from(set));
  };

  const matchesSearch = (text: string) =>
    text.toLowerCase().includes(search.toLowerCase());

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-[#0c0d10] text-white flex flex-col overscroll-contain">
      <div className="max-w-lg mx-auto w-full h-full flex flex-col">
        {/* Top Bar matching Screenshot 3 */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8 bg-[#14161b]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-white">Category</h2>
        </div>

        <button
          type="button"
          onClick={handleToggleAll}
          className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary-light)] hover:brightness-110 cursor-pointer"
        >
          {allActiveInTab ? "INACTIVE ALL" : "ACTIVE ALL"}
        </button>
      </div>

      {/* Search Input */}
      <div className="p-4 border-b border-white/6 bg-[#111216]">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1c1e26] border border-white/8 rounded-2xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-[var(--color-primary)]"
          />
        </div>
      </div>

      {/* Tabs matching Screenshot 3: EXPENSE | INCOME | DEBT/LOAN */}
      <div className="flex border-b border-white/8 bg-[#14161b] text-xs font-bold tracking-wider">
        <button
          type="button"
          onClick={() => setActiveTab("EXPENSE")}
          className={`flex-1 py-3 text-center transition-colors relative ${
            activeTab === "EXPENSE" ? "text-white" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          EXPENSE
          {activeTab === "EXPENSE" && (
            <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-white rounded-full" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("INCOME")}
          className={`flex-1 py-3 text-center transition-colors relative ${
            activeTab === "INCOME" ? "text-white" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          INCOME
          {activeTab === "INCOME" && (
            <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-white rounded-full" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("DEBT")}
          className={`flex-1 py-3 text-center transition-colors relative ${
            activeTab === "DEBT" ? "text-white" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          DEBT/LOAN
          {activeTab === "DEBT" && (
            <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-white rounded-full" />
          )}
        </button>
      </div>

      {/* Category List with Toggle Switches */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4 pb-8">
        {currentCategories.map((parent) => {
          const isParentDisabled = disabledCategories.includes(parent.id);
          const filteredChildren = parent.children.filter(
            (c) => matchesSearch(parent.name) || matchesSearch(c.name)
          );

          if (search && !matchesSearch(parent.name) && filteredChildren.length === 0) {
            return null;
          }

          return (
            <div key={parent.id} className="space-y-1">
              {/* Parent Category Row */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#171920] border border-white/6">
                <div className="flex items-center gap-3 min-w-0">
                  <CategoryIcon categoryId={parent.id} size="sm" />
                  <span className="text-white text-sm font-semibold truncate">
                    {parent.name}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => toggleParent(parent)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                    !isParentDisabled ? "bg-[var(--color-primary)]" : "bg-slate-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 absolute top-0.5 shadow-md ${
                      !isParentDisabled ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Child Subcategories */}
              {filteredChildren.length > 0 && (
                <div className="pl-6 space-y-1">
                  {filteredChildren.map((child) => {
                    const isChildDisabled = disabledCategories.includes(child.id);

                    return (
                      <div
                        key={child.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-[#14151b] border border-white/4"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CategoryIcon
                            categoryId={parent.id}
                            subCategoryId={child.id}
                            size="sm"
                          />
                          <span className="text-slate-300 text-xs font-medium truncate">
                            {child.name}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleChild(parent.id, child.id)}
                          className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                            !isChildDisabled ? "bg-[var(--color-primary)]" : "bg-slate-700"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 absolute top-0.5 shadow-md ${
                              !isChildDisabled ? "left-[18px]" : "left-0.5"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>,
  document.body
);
}

// ── Edit Wallet Modal matching Screenshot 2 ─────────────────────────────────
interface EditWalletModalProps {
  wallet: Wallet | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedWallet: Wallet) => void;
  currentUserEmail?: string;
  currentUserId?: string;
  currentUserName?: string;
  onLeaveWallet?: (walletId?: string) => void;
}

function EditWalletModal({
  wallet,
  isOpen,
  onClose,
  onSaved,
  currentUserEmail,
  currentUserId,
  currentUserName,
  onLeaveWallet,
}: EditWalletModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [balance, setBalance] = useState("0");
  const [enableNotification, setEnableNotification] = useState(true);
  const [excludeFromTotal, setExcludeFromTotal] = useState(false);
  const [disabledCategories, setDisabledCategories] = useState<string[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);
  const [showAddMemberInput, setShowAddMemberInput] = useState(false);
  const [addMemberInput, setAddMemberInput] = useState("");
  const [invitingMember, setInvitingMember] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

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

  // Determine if current user is the owner of this wallet
  const isOwner = !!(
    (currentUserId && wallet?.userId && String(wallet.userId) === String(currentUserId)) ||
    (currentUserEmail && wallet?.ownerEmail && wallet.ownerEmail.toLowerCase() === currentUserEmail.toLowerCase()) ||
    (!wallet?.userId && !wallet?.ownerEmail)
  );

  // Owner email: if owner, use currentUserEmail; else use wallet.ownerEmail
  const ownerEmail = isOwner
    ? (currentUserEmail || wallet?.ownerEmail || "")
    : (wallet?.ownerEmail || "");

  // Owner username: if owner, use currentUserName; else use wallet.ownerName
  const ownerName = isOwner
    ? (currentUserName || wallet?.ownerName || (ownerEmail ? ownerEmail.split("@")[0] : "Owner"))
    : (wallet?.ownerName || (ownerEmail ? ownerEmail.split("@")[0] : "Owner"));

  useEffect(() => {
    if (wallet && isOpen) {
      setName(wallet.name || "");
      setCurrency(wallet.currency || "IDR");
      setBalance(String(wallet.balance || 0));
      setEnableNotification(wallet.enableNotification ?? true);
      setExcludeFromTotal(wallet.excludeFromTotal ?? wallet.excludeFromReport ?? false);
      setDisabledCategories(wallet.disabledCategories || []);
    }
  }, [wallet, isOpen]);

  // Lock background scroll when EditWalletModal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

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
        if (d.wallet) onSaved(d.wallet);
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
        onSaved(d.wallet);
        toast(isCancel ? "Invitation cancelled" : "Member deleted", "info");
      } else {
        toast(d.error || (isCancel ? "Failed to cancel invitation" : "Failed to delete member"), "error");
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
        onClose();
        onLeaveWallet?.(wallet._id);
      } else {
        toast(d.error || "Failed to leave wallet", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setLeaving(false);
    }
  };

  if (!isOpen || !wallet) return null;

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

  const handleSave = async () => {
    if (!name.trim()) {
      toast("Wallet name cannot be empty", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/finance/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: wallet._id,
          name: name.trim(),
          currency,
          balance: parseFloat(safeEvaluateMath(balance).replace(/,/g, "")) || 0,
          enableNotification,
          excludeFromTotal,
          disabledCategories,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast("Wallet updated successfully", "success");
        onSaved(data.wallet);
        onClose();
      } else {
        toast("Failed to update wallet", "error");
      }
    } catch {
      toast("Error updating wallet", "error");
    } finally {
      setSaving(false);
    }
  };

  const currInfo = CURRENCY_INFO[currency as SupportedCurrency] || {
    name: currency,
    symbol: currency,
    displayCode: currency,
  };

  return (
    <div className={`fixed inset-0 z-[70] bg-[#111216] text-white flex flex-col ${isCategoryModalOpen ? "overflow-hidden" : "overflow-y-auto"}`}>
      <div className="max-w-lg mx-auto w-full min-h-screen flex flex-col p-4 pb-28">
        <div>
          {/* Top Bar matching Screenshot 2 */}
          <div className="flex items-center justify-between py-3 border-b border-white/6 mb-4">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
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

          {/* Wallet Name & Icon matching Screenshot 2 */}
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
                className="w-full bg-transparent text-xl font-bold text-white outline-none placeholder-slate-500"
              />
            </div>
          </div>

          {/* Currency row — compact badge button opens inline floating dropdown */}
          <div className="p-4 bg-[#181920] border border-white/6 rounded-2xl relative z-20 mb-3" ref={currencyDropdownRef}>
            <button
              type="button"
              onClick={() => setIsCurrencyDropdownOpen((v) => !v)}
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
              Enter current balance of this wallet
            </p>
            <div
              className={`py-2 flex items-center gap-3 cursor-text border-b-2 transition-colors duration-200 ${
                isKeypadOpen ? "border-[var(--color-primary-light)]" : "border-[var(--color-primary)]/40"
              }`}
              onClick={() => setIsKeypadOpen(true)}
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
                  onClick={() => setIsKeypadOpen(true)}
                  className="w-full bg-transparent text-2xl font-extrabold text-[#29b6f6] placeholder-[#29b6f6]/40 outline-none tracking-tight cursor-text select-none"
                />
                {isKeypadOpen && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-7 bg-[#29b6f6] animate-pulse rounded-full" />
                )}
              </div>
            </div>
            {!isKeypadOpen && (
              <p className="mt-1 text-[10px] text-slate-500">Tap to edit balance using keypad</p>
            )}
          </div>

          {/* Categories Option matching Screenshot 2 */}
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="w-full p-4 bg-[#181920] border border-white/6 rounded-2xl flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer mb-4"
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

          {/* Members section matching Screenshot 2 */}
          <div className="p-4 bg-[#181920] border border-white/6 rounded-2xl mb-3 space-y-3">
            <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              Members
            </h4>

            {/* Owner row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                  {((ownerName || ownerEmail || "O")[0]).toUpperCase()}
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
                // Non-owners only see ACCEPTED members
                if (!isOwner) return m.status === "ACCEPTED";
                // Owner sees ACCEPTED and PENDING (and legacy entries without status)
                return m.status === "ACCEPTED" || m.status === "PENDING" || !m.status;
              })
              .map((m) => {
                const isPending = m.status === "PENDING" || !m.status;
                const displayName = m.name || m.email.split("@")[0];
                return (
                  <div key={m.email} className="flex items-center justify-between pt-2.5 border-t border-white/5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {((displayName || m.email || "?")[0]).toUpperCase()}
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
                      {/* Pending label */}
                      {isPending && (
                        <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-md font-semibold tracking-wide">
                          Pending
                        </span>
                      )}

                      {/* Cancel button - owner only, for pending members */}
                      {isOwner && isPending && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.email, true)}
                          className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-all cursor-pointer flex items-center gap-1"
                          title="Cancel invitation"
                        >
                          <X className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                      )}

                      {/* Delete member button - owner only, for accepted members */}
                      {isOwner && !isPending && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.email, false)}
                          className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-all cursor-pointer flex items-center gap-1"
                          title="Delete member"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      )}

                      {/* Leave button - non-owner member sees this for their own row */}
                      {!isOwner && m.email.toLowerCase() === (currentUserEmail || "").toLowerCase() && (
                        <button
                          type="button"
                          onClick={() => setLeaveConfirmOpen(true)}
                          disabled={leaving}
                          className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-all cursor-pointer flex items-center gap-1 active:scale-95 disabled:opacity-50"
                          title="Leave wallet"
                        >
                          <LogOut className="w-3 h-3" />
                          <span>{leaving ? "Leaving…" : "Leave"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* Add Member — owner only */}
            {isOwner && (
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
                  {/* Inline error */}
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

          {/* Toggle Switches matching Screenshot 2 */}
          <div className="p-4 bg-[#181920] border border-white/6 rounded-2xl space-y-4">
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

          {/* Bottom margin / padding spacer for comfortable scrolling */}
          <div className="h-16" />
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
                  className="flex-1 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLeaveWallet}
                  disabled={leaving}
                  className="flex-1 py-2.5 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm transition-colors disabled:opacity-50"
                >
                  {leaving ? "Leaving…" : "Leave"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Draggable Wallet Item for Drag & Drop Reordering ────────────────────────
function DraggableWalletItem({
  wallet,
  currentUserEmail,
  onOpenMenu,
}: {
  wallet: Wallet;
  currentUserEmail: string;
  onOpenMenu: (walletId: string, rect: DOMRect) => void;
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
  const router = useRouter();
  const { toast } = useToast();
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

  // Edit Wallet modal state
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);

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
          if (d.wallets && Array.isArray(d.wallets)) {
            setWallets(d.wallets);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, currentUserId]);

  const syncedWallets = wallets;
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleReorder = (newOrder: Wallet[]) => {
    setActiveMenuWalletId(null);
    setMenuPosition(null);
    setWallets(newOrder);
    onWalletUpdated(newOrder);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch("/api/finance/wallets/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletIds: newOrder.map((w) => w._id) }),
        });
      } catch (err) {
        console.error("Failed to save wallet order", err);
      }
    }, 400);
  };

  const handleCreate = async () => {
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/finance/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          icon: TYPE_DEFAULT_ICONS[type] || "💳",
          balance: parseFloat(balance) || 0,
          currency,
          isDefault: syncedWallets.length === 0,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = [...syncedWallets, data.wallet];
        setWallets(updated);
        setShowAddForm(false);
        setName("");
        setType("CASH");
        setBalance("");
        setCurrency("IDR");
        setIsCreateTypeDropdownOpen(false);
        setIsCreateCurrencyDropdownOpen(false);
        toast(`Wallet "${name}" created`, "success");
        onWalletUpdated(updated);
      } else {
        toast("Failed to create wallet", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    setActiveMenuWalletId(null);
    const res = await fetch("/api/finance/wallets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isDefault: true }),
    });

    if (res.ok) {
      const updated = syncedWallets.map((w) => ({ ...w, isDefault: w._id === id }));
      setWallets(updated);
      const w = syncedWallets.find((w) => w._id === id);
      toast(`"${w?.name}" is now the default wallet`, "success");
      onWalletUpdated(updated);
      window.dispatchEvent(
        new CustomEvent("wallet-default-changed", {
          detail: { wallets: updated, defaultId: id },
        })
      );
    } else {
      toast("Failed to set default wallet", "error");
    }
  };

  const handleToggleArchive = async (w: Wallet) => {
    setActiveMenuWalletId(null);
    const nextArchived = !w.archived;
    const res = await fetch("/api/finance/wallets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: w._id, archived: nextArchived }),
    });

    if (res.ok) {
      const updated = syncedWallets.map((item) =>
        item._id === w._id ? { ...item, archived: nextArchived } : item
      );
      setWallets(updated);
      toast(nextArchived ? `"${w.name}" archived` : `"${w.name}" unarchived`, "info");
      onWalletUpdated(updated);
    }
  };

  const handleDeleteConfirmed = async () => {
    const { walletId, walletName } = confirm;
    setConfirm({ open: false, walletId: "", walletName: "" });

    const res = await fetch(`/api/finance/wallets?id=${walletId}`, { method: "DELETE" });
    if (res.ok) {
      const updated = syncedWallets.filter((w) => w._id !== walletId);
      setWallets(updated);
      toast(`"${walletName}" deleted`, "info");
      onWalletUpdated(updated);
    } else {
      toast("Failed to delete wallet", "error");
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
      const data = await res.json();
      if (res.ok) {
        const updated = syncedWallets.filter((w) => w._id !== walletId);
        setWallets(updated);
        toast(`You left "${walletName}"`, "info");
        onWalletUpdated(updated);
      } else {
        toast(data.error || "Failed to leave wallet", "error");
      }
    } catch {
      toast("Failed to leave wallet", "error");
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-md bg-[#16171b] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/8">
                <div>
                  <h3 className="text-white font-bold text-lg">My Wallets</h3>
                  <p className="text-slate-400 text-xs">Manage cash and accounts</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"
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
                        className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreate}
                        disabled={saving || !name}
                        className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
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
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-bold text-sm transition-opacity hover:opacity-90"
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
              {/* Transparent backdrop overlay: clicking anywhere outside closes the menu */}
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

                  {/* 3. Edit */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuWalletId(null);
                      setMenuPosition(null);
                      setEditingWallet(targetWallet);
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
                      <span>Delete</span>
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

      {/* Edit Wallet Modal */}
      <EditWalletModal
        wallet={editingWallet}
        isOpen={Boolean(editingWallet)}
        onClose={() => setEditingWallet(null)}
        currentUserEmail={currentUserEmail}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onLeaveWallet={(leftId?: string) => {
          const targetId = leftId || editingWallet?._id;
          const list = wallets.filter((w) => w._id !== targetId);
          setWallets(list);
          setEditingWallet(null);
          onWalletUpdated(list);
        }}
        onSaved={(updated) => {
          const list = wallets.map((w) => (w._id === updated._id ? updated : w));
          setWallets(list);
          setEditingWallet(updated);
          onWalletUpdated(list);
        }}
      />

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
                  className="flex-1 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirmed}
                  className="flex-1 py-2.5 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm transition-colors"
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
                  className="flex-1 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeaveConfirmed}
                  className="flex-1 py-2.5 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm transition-colors"
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
