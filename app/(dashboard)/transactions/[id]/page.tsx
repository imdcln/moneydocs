"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Copy,
  Share2,
  Edit3,
  Trash2,
  Wallet as WalletIcon,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  AlignLeft,
  Users,
  Briefcase,
  Clock,
  Image as ImageIcon,
  Camera,
  ChevronDown,
  Check,
  CreditCard,
  HandCoins,
  Sparkles,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  formatMoney,
  convertCurrency,
  getCurrencyDisplayCode,
  CURRENCY_INFO,
  SupportedCurrency,
} from "@/lib/currency";
import CategoryIcon from "@/components/ui/CategoryIcon";
import {
  getCategoryDisplayName,
  getTransactionIssues,
  checkCategoryStatus,
  isLoanCategory,
  isDebtCategory,
} from "@/lib/categories";
import { useToast } from "@/components/ui/Toast";
import { useWalletContext } from "@/hooks/useWalletContext";
import CategoryPickerModal from "@/components/admin/CategoryPickerModal";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import CustomKeypad, { safeEvaluateMath } from "@/components/admin/CustomKeypad";
import CurrencyFlag from "@/components/admin/CurrencyFlag";
import { CalendarIcon, CustomDatePicker } from "@/components/ui/AppIcons";
import WithPeopleModal from "@/components/admin/WithPeopleModal";
import SelectEventModal, { EventOption } from "@/components/admin/SelectEventModal";
import PageLoading from "@/components/ui/PageLoading";

interface Wallet {
  _id: string;
  name: string;
  currency: string;
  icon?: string;
  isDefault?: boolean;
  balance?: number;
}

interface DebtPayment {
  _id?: string;
  amount: number;
  currency?: string;
  convertedAmountIDR?: number;
  date: string;
  walletId?: string;
  walletName?: string;
  note?: string;
  createdAt?: string;
}

interface Transaction {
  _id: string;
  type: "EXPENSE" | "INCOME" | "DEBT";
  title: string;
  amount: number;
  currency: string;
  category: string;
  subCategory?: string;
  date: string;
  description?: string;
  tags?: string[];
  receiptUrl?: string;
  debtParty?: string;
  debtDueDate?: string;
  debtInterestRate?: number;
  debtRepaidAmount?: number;
  debtStatus?: "UNPAID" | "PARTIAL" | "PAID";
  debtPayments?: DebtPayment[];
  eventId?: string;
  eventName?: string;
  eventCurrency?: string;
  withPeople?: string[];
  walletId?: {
    _id: string;
    name: string;
    currency: string;
    icon?: string;
    balance?: number;
  };
}

export default function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { getPermissionsForWallet } = useWalletContext();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const txWalletId = transaction?.walletId?._id;
  const txPermissions = getPermissionsForWallet(txWalletId);
  const canReadTx = !txWalletId || txPermissions.transactions.read;
  const canUpdateTx = !txWalletId || txPermissions.transactions.update;
  const canDeleteTx = !txWalletId || txPermissions.transactions.delete;
  const canCreateTx = !txWalletId || txPermissions.transactions.create;

  // ── Popups / Overlay states ────────────────────────────────────────────────
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // ── Debt / Loan Payment Modal state ────────────────────────────────────────
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payWalletId, setPayWalletId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState<Date>(new Date());
  const [payNote, setPayNote] = useState("");
  const [isPayWalletDropdownOpen, setIsPayWalletDropdownOpen] = useState(false);
  const [isPayDatePickerOpen, setIsPayDatePickerOpen] = useState(false);
  const [isPayKeypadOpen, setIsPayKeypadOpen] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const payWalletDropdownRef = useRef<HTMLDivElement>(null);

  // Amount popup state
  const [tempAmount, setTempAmount] = useState<string>("0");
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Date popup state
  const [tempDate, setTempDate] = useState<string>("");

  // Duplicate popup state
  const [duplicateDate, setDuplicateDate] = useState<Date>(new Date());
  const [duplicating, setDuplicating] = useState(false);

  // Delete popup state
  const [deleting, setDeleting] = useState(false);

  const [rates, setRates] = useState<Record<string, number>>({});

  // Full Edit popup state (Picture 3)
  const [editWalletId, setEditWalletId] = useState("");
  const [editCurrency, setEditCurrency] = useState("IDR");
  const [editRawAmount, setEditRawAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSubCategory, setEditSubCategory] = useState<string | undefined>(undefined);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isEditDescFocused, setIsEditDescFocused] = useState(false);
  const [allDescriptions, setAllDescriptions] = useState<string[]>([]);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editWithPeople, setEditWithPeople] = useState<string[]>([]);
  const [isWithModalOpen, setIsWithModalOpen] = useState(false);
  const [editEventId, setEditEventId] = useState<string>("");
  const [editEventName, setEditEventName] = useState<string>("");
  const [editEventCurrency, setEditEventCurrency] = useState<string>("");
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editReceiptUrl, setEditReceiptUrl] = useState<string | null>(null);
  const [editDateSelectOpen, setEditDateSelectOpen] = useState(false);
  const [editCategoryPickerOpen, setEditCategoryPickerOpen] = useState(false);
  const [editWalletDropdownOpen, setEditWalletDropdownOpen] = useState(false);
  const editWalletDropdownRef = useRef<HTMLDivElement>(null);
  const keyboardHeight = useKeyboardOffset();
  const [isEditScrolledDown, setIsEditScrolledDown] = useState(false);
  const editScrollContainerRef = useRef<HTMLDivElement>(null);
  const editFocusScrollTopRef = useRef(0);
  const [editIsKeypadOpen, setEditIsKeypadOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [navigatingToEvents, setNavigatingToEvents] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Format raw amount string with thousands commas for display (mirrors AddTransactionModal) */
  const formatEditDisplayAmount = (val: string): string => {
    if (!val) return "0";
    if (/[+\-\u00d7\u00f7*/]/.test(val)) return val;
    const parts = val.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  /** Format pay amount with thousands commas for display */
  const formatPayDisplayAmount = (val: string): string => {
    if (!val) return "0";
    if (/[+\-\u00d7\u00f7*/]/.test(val)) return val;
    // Strip existing commas first
    const clean = val.replace(/,/g, "");
    const parts = clean.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  const fetchTransactionAndWallets = async () => {
    try {
      const [txRes, walletRes, rateRes] = await Promise.all([
        fetch(`/api/finance/transactions/${id}`),
        fetch("/api/finance/wallets"),
        fetch("/api/finance/exchange-rates").catch(() => null),
      ]);

      if (!txRes.ok) {
        setError("Transaction not found");
        return;
      }

      const txData = await txRes.json();
      const walletData = await walletRes.json();

      setTransaction(txData.transaction);
      setWallets(walletData.wallets ?? []);

      if (rateRes && rateRes.ok) {
        const rateData = await rateRes.json();
        if (rateData.rates) setRates(rateData.rates);
      }

      if (txData.transaction?.date) {
        setDuplicateDate(new Date(txData.transaction.date));
        setTempDate(new Date(txData.transaction.date).toISOString().split("T")[0]);
      }
    } catch {
      setError("Failed to load transaction");
    } finally {
      setLoading(false);
    }
  };

  const fetchDescriptions = async () => {
    try {
      const res = await fetch("/api/finance/transactions/descriptions");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.descriptions)) {
          setAllDescriptions(data.descriptions);
        }
      }
    } catch {
      // non-blocking
    }
  };

  useEffect(() => {
    fetchTransactionAndWallets();
    fetchDescriptions();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const tempAmountRef = useRef<string>(tempAmount);
  useEffect(() => {
    tempAmountRef.current = tempAmount;
  }, [tempAmount]);

  const editRawAmountRef = useRef<string>(editRawAmount);
  useEffect(() => {
    editRawAmountRef.current = editRawAmount;
  }, [editRawAmount]);

  // ── Autofocus for Amount Popup (cursor at end, NEVER auto-select) ──────────
  useEffect(() => {
    if (!isAmountModalOpen) return;

    // Autofocus input on open without selecting text so user can immediately type or use keypad
    const timer = setTimeout(() => {
      if (amountInputRef.current) {
        amountInputRef.current.focus();
        const len = amountInputRef.current.value.length;
        amountInputRef.current.setSelectionRange(len, len);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isAmountModalOpen]);

  // ── Keyboard listener for Amount Popup ─────────────────────────────────────
  useEffect(() => {
    if (!isAmountModalOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsAmountModalOpen(false);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handleSaveAmount();
        return;
      }

      // If user typing digits or operators without input focus (or input blurred)
      if (document.activeElement !== amountInputRef.current) {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          setTempAmount((prev) => (prev === "0" ? e.key : prev + e.key));
        } else if (e.key === "." || e.key === ",") {
          e.preventDefault();
          setTempAmount((prev) => {
            if (!prev) return "0.";
            if (prev.includes(".")) return prev;
            return prev + ".";
          });
        } else if (["+", "-", "*", "/"].includes(e.key)) {
          e.preventDefault();
          const op = e.key === "*" ? "×" : e.key === "/" ? "÷" : e.key;
          setTempAmount((prev) => {
            if (!prev) return prev;
            const last = prev[prev.length - 1];
            if (["+", "-", "×", "÷"].includes(last)) return prev.slice(0, -1) + op;
            return prev + op;
          });
        } else if (e.key === "Backspace") {
          e.preventDefault();
          setTempAmount((prev) => prev.slice(0, -1) || "0");
        } else if (e.key === "c" || e.key === "C" || e.key === "Delete") {
          e.preventDefault();
          setTempAmount("0");
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAmountModalOpen]);

  const handleEditAmountEnter = () => {
    if (/[+×÷*/-]/.test(editRawAmount)) {
      setEditRawAmount(safeEvaluateMath(editRawAmount));
    }
    setEditIsKeypadOpen(false);
  };

  const handleEditScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollTop = e.currentTarget.scrollTop;
    if (isEditDescFocused) {
      if (currentScrollTop - editFocusScrollTopRef.current > 30) {
        setIsEditScrolledDown(true);
      } else if (currentScrollTop - editFocusScrollTopRef.current <= 10) {
        setIsEditScrolledDown(false);
      }
    }
  };

  // ── Keyboard listener for Full Edit Modal Keypad ───────────────────────────
  useEffect(() => {
    if (!editIsKeypadOpen) return;

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if ((e.target as HTMLElement).getAttribute("aria-label") !== "Transaction amount") {
          return;
        }
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setEditIsKeypadOpen(false);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handleEditAmountEnter();
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setEditRawAmount((prev) => {
          if (prev === "0") return e.key;
          if (prev.length >= 15) return prev;
          return prev + e.key;
        });
        return;
      }
      if (e.key === "." || e.key === ",") {
        e.preventDefault();
        setEditRawAmount((prev) => {
          if (!prev) return "0.";
          if (prev.includes(".")) return prev;
          return prev + ".";
        });
        return;
      }
      if (["+", "-", "*", "/"].includes(e.key)) {
        e.preventDefault();
        const op = e.key === "*" ? "×" : e.key === "/" ? "÷" : e.key;
        setEditRawAmount((prev) => {
          if (!prev) return prev;
          const last = prev[prev.length - 1];
          if (["+", "-", "×", "÷"].includes(last)) return prev.slice(0, -1) + op;
          return prev + op;
        });
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        setEditRawAmount((prev) => prev.slice(0, -1));
        return;
      }
      if (e.key === "c" || e.key === "C" || e.key === "Delete") {
        e.preventDefault();
        setEditRawAmount("");
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editIsKeypadOpen]);

  // Close wallet dropdown on outside click
  useEffect(() => {
    if (!editWalletDropdownOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        editWalletDropdownRef.current &&
        !editWalletDropdownRef.current.contains(e.target as Node)
      ) {
        setEditWalletDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [editWalletDropdownOpen]);

  // Close pay wallet dropdown on outside click
  useEffect(() => {
    if (!isPayWalletDropdownOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        payWalletDropdownRef.current &&
        !payWalletDropdownRef.current.contains(e.target as Node)
      ) {
        setIsPayWalletDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [isPayWalletDropdownOpen]);

  // Keyboard listener while pay keypad is open
  useEffect(() => {
    if (!isPayKeypadOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") {
        e.preventDefault();
        setIsPayKeypadOpen(false);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (/[+\-×÷*/]/.test(payAmount)) {
          setPayAmount(safeEvaluateMath(payAmount));
        } else {
          handleSavePayment();
        }
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setPayAmount((prev) => {
          const clean = prev.replace(/,/g, "");
          if (clean === "0") return e.key;
          if (clean.length >= 15) return prev;
          return clean + e.key;
        });
        return;
      }
      if (e.key === "." || e.key === ",") {
        e.preventDefault();
        setPayAmount((prev) => {
          const clean = prev.replace(/,/g, "");
          if (!clean) return "0.";
          if (clean.includes(".")) return prev;
          return clean + ".";
        });
        return;
      }
      if (["+", "-", "*", "/"].includes(e.key)) {
        e.preventDefault();
        const op = e.key === "*" ? "×" : e.key === "/" ? "÷" : e.key;
        setPayAmount((prev) => {
          const clean = prev.replace(/,/g, "");
          if (!clean) return prev;
          const last = clean[clean.length - 1];
          if (["+", "-", "×", "÷"].includes(last)) return clean.slice(0, -1) + op;
          return clean + op;
        });
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        setPayAmount((prev) => {
          const clean = prev.replace(/,/g, "");
          return clean.slice(0, -1) || "0";
        });
        return;
      }
      if (e.key === "c" || e.key === "C" || e.key === "Delete") {
        e.preventDefault();
        setPayAmount("");
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPayKeypadOpen, payAmount]);

  // Open Debt / Loan Payment Modal
  const openPaymentModal = () => {
    if (!transaction) return;
    const repaid = Number(transaction.debtRepaidAmount) || 0;
    const remaining = Math.max(0, transaction.amount - repaid);
    setPayAmount(String(remaining > 0 ? remaining : transaction.amount));
    setPayDate(new Date());

    const isLoan = isLoanCategory(transaction.category, transaction.subCategory);
    const party = transaction.debtParty || (transaction.withPeople?.[0]) || "";
    setPayNote(
      isLoan
        ? (party ? `Loan returned to ${party}` : "Loan returned")
        : (party ? `Debt paid to ${party}` : "Debt paid")
    );

    if (transaction.walletId?._id) {
      setPayWalletId(transaction.walletId._id);
    } else if (wallets.length > 0) {
      const def = wallets.find((w) => w.isDefault) || wallets[0];
      setPayWalletId(def._id);
    }
    setIsPayWalletDropdownOpen(false);
    setIsPayKeypadOpen(false);
    setIsPaymentModalOpen(true);
  };

  // Submit Debt / Loan Payment
  const handleSavePayment = async () => {
    if (!transaction) return;
    const num = parseFloat(payAmount.replace(/,/g, ""));
    if (isNaN(num) || num <= 0) {
      toast("Please enter a valid amount greater than 0", "error");
      return;
    }
    if (!payWalletId) {
      toast("Please select a wallet to pay from", "error");
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await fetch(`/api/finance/transactions/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: num,
          walletId: payWalletId,
          date: payDate.toISOString(),
          note: payNote.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTransaction(data.transaction);
        const isLoan = isLoanCategory(transaction.category, transaction.subCategory);
        toast(isLoan ? "Loan return recorded successfully" : "Debt payment recorded successfully", "success");
        setIsPaymentModalOpen(false);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("transaction-added"));
        }
      } else {
        const err = await res.json();
        toast(err.error || "Failed to record payment", "error");
      }
    } catch {
      toast("Network error recording payment", "error");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Delete Debt / Loan Payment (Refunds to wallet)
  const handleDeletePayment = async (paymentId: string) => {
    if (!paymentId) return;
    setDeletingPaymentId(paymentId);
    try {
      const res = await fetch(`/api/finance/transactions/${id}/payments?paymentId=${paymentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        setTransaction(data.transaction);
        toast("Payment removed and balance restored", "info");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("transaction-added"));
        }
      } else {
        const err = await res.json();
        toast(err.error || "Failed to delete payment", "error");
      }
    } catch {
      toast("Error deleting payment", "error");
    } finally {
      setDeletingPaymentId(null);
    }
  };

  // Open Amount Modal
  const openAmountModal = () => {
    if (transaction) {
      setTempAmount(String(transaction.amount || "0"));
      setIsAmountModalOpen(true);
    }
  };

  // Save Amount (Instant PATCH, no page reload)
  const handleSaveAmount = async () => {
    const evaluated = safeEvaluateMath(tempAmountRef.current);
    const num = parseFloat(evaluated);
    if (isNaN(num) || num <= 0) {
      toast("Please enter a valid amount greater than 0", "error");
      return;
    }

    try {
      const res = await fetch(`/api/finance/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num }),
      });

      if (res.ok) {
        const data = await res.json();
        setTransaction(data.transaction);
        toast("Amount updated", "success");
        setIsAmountModalOpen(false);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("transaction-added"));
        }
      } else {
        toast("Failed to update amount", "error");
      }
    } catch {
      toast("Error updating amount", "error");
    }
  };

  // Save Category (Instant PATCH, no page reload)
  const handleSelectCategory = async (catId: string, subCatId?: string) => {
    try {
      const res = await fetch(`/api/finance/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: catId,
          subCategory: subCatId || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTransaction(data.transaction);
        toast("Category updated", "success");
        setIsCategoryModalOpen(false);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("transaction-added"));
        }
      } else {
        toast("Failed to update category", "error");
      }
    } catch {
      toast("Error updating category", "error");
    }
  };

  // Save Date (Instant PATCH, no page reload)
  const handleUpdateDate = async () => {
    if (!tempDate) return;
    try {
      const res = await fetch(`/api/finance/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: new Date(tempDate).toISOString() }),
      });
      if (res.ok) {
        const data = await res.json();
        setTransaction(data.transaction);
        toast("Date updated", "success");
        setIsDatePickerOpen(false);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("transaction-added"));
        }
      } else {
        toast("Failed to update date", "error");
      }
    } catch {
      toast("Error updating date", "error");
    }
  };

  // Open Full Edit Modal (Picture 3)
  const openEditModal = () => {
    if (!transaction) return;
    setEditRawAmount(String(transaction.amount || ""));
    setEditCurrency(transaction.currency || "IDR");
    setEditCategory(transaction.category || "");
    setEditSubCategory(transaction.subCategory || undefined);

    const catNameWithSub = getCategoryDisplayName(transaction.category, transaction.subCategory);
    const catBaseName = getCategoryDisplayName(transaction.category);
    const isCategoryTitle =
      !transaction.title ||
      transaction.title.trim().toLowerCase() === catNameWithSub.trim().toLowerCase() ||
      transaction.title.trim().toLowerCase() === catBaseName.trim().toLowerCase() ||
      transaction.title.trim().toLowerCase() === transaction.category.trim().toLowerCase();

    // If description/title was not custom-entered, leave note/description empty
    const initialNote = !isCategoryTitle
      ? transaction.title
      : (transaction.description || "");

    setEditTitle(initialNote);
    setEditDescription(initialNote);
    setEditDate(new Date(transaction.date));
    const initialPeople = transaction.withPeople && transaction.withPeople.length > 0
      ? transaction.withPeople
      : transaction.debtParty
      ? [transaction.debtParty]
      : [];
    setEditWithPeople(initialPeople);
    setEditEventId(transaction.eventId || "");
    setEditEventName(transaction.eventName || (transaction.tags?.[0] || ""));
    setEditEventCurrency(transaction.eventCurrency || "");
    setEditReceiptUrl(transaction.receiptUrl || null);
    if (transaction.walletId?._id) {
      setEditWalletId(transaction.walletId._id);
    } else if (wallets.length > 0) {
      const def = wallets.find((w) => w.isDefault) || wallets[0];
      setEditWalletId(def._id);
    }
    setEditWalletDropdownOpen(false);
    setIsEditModalOpen(true);
  };

  // Navigate to event management — close SelectEvent overlay, show loading, close edit modal, navigate
  const handleManageEvents = () => {
    setIsEventModalOpen(false);
    setNavigatingToEvents(true);
    setTimeout(() => {
      setIsEditModalOpen(false);
      router.push("/events");
    }, 320);
  };

  // Save Full Edit (Instant PATCH, no page reload)
  const handleSaveFullEdit = async () => {
    setEditIsKeypadOpen(false);
    setEditWalletDropdownOpen(false);
    const evaluated = safeEvaluateMath(editRawAmountRef.current);
    const num = parseFloat(evaluated.replace(/,/g, ""));
    if (isNaN(num) || num <= 0) {
      toast("Please enter a valid amount greater than 0", "error");
      return;
    }
    if (!editCategory) {
      toast("Please select a category", "error");
      return;
    }

    setSavingEdit(true);
    try {
      const trimmedDesc = editDescription.trim();
      const payload = {
        amount: num,
        currency: editCurrency,
        category: editCategory,
        subCategory: editSubCategory || null,
        title: trimmedDesc || getCategoryDisplayName(editCategory, editSubCategory),
        description: trimmedDesc || null,
        walletId: editWalletId || null,
        date: editDate.toISOString(),
        withPeople: editWithPeople,
        debtParty: editWithPeople.length > 0 ? editWithPeople.join(", ") : null,
        eventId: editEventId || null,
        eventName: editEventName || null,
        eventCurrency: editEventCurrency || null,
        tags: editEventName ? [editEventName] : [],
        receiptUrl: editReceiptUrl || null,
      };

      const res = await fetch(`/api/finance/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setTransaction(data.transaction);
        toast("Transaction updated", "success");
        setIsEditModalOpen(false);
        fetchDescriptions();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("transaction-added"));
        }
      } else {
        const err = await res.json();
        toast(err.error || "Failed to update transaction", "error");
      }
    } catch {
      toast("Error updating transaction", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  // Duplicate Transaction
  const handleConfirmDuplicate = async () => {
    if (!transaction) return;
    setDuplicating(true);
    try {
      const payload = {
        type: transaction.type,
        title: transaction.title,
        amount: transaction.amount,
        currency: transaction.currency,
        category: transaction.category,
        subCategory: transaction.subCategory,
        walletId: transaction.walletId?._id || undefined,
        date: duplicateDate.toISOString(),
        description: transaction.description,
        tags: transaction.tags,
        debtParty: transaction.debtParty,
      };

      const res = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast("Transaction duplicated successfully", "success");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("transaction-added"));
        }
        setIsDuplicateOpen(false);
        router.push("/transactions");
        router.refresh();
      } else {
        const errData = await res.json();
        toast(errData.error || "Failed to duplicate transaction", "error");
      }
    } catch {
      toast("Error duplicating transaction", "error");
    } finally {
      setDuplicating(false);
    }
  };

  // Delete Transaction
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/finance/transactions/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast("Transaction deleted", "info");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("transaction-added"));
        }
        router.push("/transactions");
        router.refresh();
      } else {
        toast("Failed to delete transaction", "error");
      }
    } catch {
      toast("Error deleting transaction", "error");
    } finally {
      setDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  const handleDateShiftDuplicate = (days: number) => {
    const next = new Date(duplicateDate);
    next.setDate(next.getDate() + days);
    setDuplicateDate(next);
  };

  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <PageLoading
        title="Loading Transaction..."
        subtitle="Fetching transaction details"
      />
    );
  }

  if (error || !transaction) {
    return (
      <div className="py-20 text-white p-6 flex flex-col items-center justify-center text-center">
        <p className="text-red-400 font-semibold mb-4">{error || "Not found"}</p>
        <button
          onClick={() => router.push("/transactions")}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-bold"
        >
          Back to transactions
        </button>
      </div>
    );
  }

  if (transaction && !canReadTx) {
    return (
      <div className="py-20 text-white p-6 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-400 mb-6">
          You do not have permission to view this transaction.
        </p>
        <button
          onClick={() => router.push("/transactions")}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold transition-colors"
        >
          Back to transactions
        </button>
      </div>
    );
  }

  const filteredEditDescriptions = editDescription.trim()
    ? allDescriptions.filter((d) =>
        d.toLowerCase().includes(editDescription.trim().toLowerCase())
      )
    : allDescriptions;

  const isExpense = transaction.type === "EXPENSE";
  const isIncome = transaction.type === "INCOME";
  const isDebtOrLoan = transaction.type === "DEBT";
  const isLoan = isDebtOrLoan && isLoanCategory(transaction.category, transaction.subCategory);
  const isDebt = isDebtOrLoan && !isLoan;

  const repaidAmount = Number(transaction.debtRepaidAmount) || 0;
  const remainingDebt = Math.max(0, transaction.amount - repaidAmount);
  const isFullyPaid = isDebtOrLoan && (repaidAmount >= transaction.amount || transaction.debtStatus === "PAID");
  const progressPercent = transaction.amount > 0 ? Math.min(100, Math.round((repaidAmount / transaction.amount) * 100)) : 0;

  const partyName = transaction.debtParty || (transaction.withPeople?.[0]) || (isLoan ? "Lender" : "Creditor");
  const partyInitial = (partyName.trim()[0] || "S").toUpperCase();

  return (
    <div className="text-white max-w-lg mx-auto">
      <div>
        {/* ── Top Header matching Picture 2 ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Back"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            {/* 1. Duplicate button */}
            {canCreateTx && (
              <button
                onClick={() => setIsDuplicateOpen(true)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                title="Duplicate transaction"
              >
                <Copy className="w-5 h-5" />
              </button>
            )}

            {/* 2. Share button (ignored per user request) */}
            <button
              onClick={() => toast("Share link copied to clipboard", "info")}
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              title="Share"
            >
              <Share2 className="w-5 h-5" />
            </button>

            {/* 3. Edit button -> opens Edit overlay (Picture 3) */}
            {canUpdateTx && (
              <button
                onClick={openEditModal}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                title="Edit transaction"
              >
                <Edit3 className="w-5 h-5" />
              </button>
            )}

            {/* 4. Delete button with popup confirmation */}
            {canDeleteTx && (
              <button
                onClick={() => setIsDeleteOpen(true)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-white/5 transition-colors"
                title="Delete transaction"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Transaction Details Body matching Picture 2 ───────────────────── */}
        <div className="px-6 pt-4 space-y-6">
          {(() => {
            const issues = transaction ? getTransactionIssues(transaction, wallets) : [];
            const hasCategoryIssue = issues.some((i) => i.type === "category" || i.type === "subcategory");
            const hasWalletIssue = issues.some((i) => i.type === "wallet");

            return (
              <>
                {issues.length > 0 && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2.5 animate-fade-in">
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <p className="text-xs font-bold">This transaction needs attention</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {issues.map((issue) => (
                        <span
                          key={issue.label}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            issue.severity === "error"
                              ? "bg-red-500/15 text-red-300 border border-red-500/30"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
                          <span>{issue.label}</span>
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {issues[0]?.message || "Some details are missing or invalid. Tap below to fix."}
                    </p>
                    <div className="pt-1 flex items-center gap-2 flex-wrap">
                      {hasCategoryIssue && (
                        <button
                          type="button"
                          onClick={() => setIsCategoryModalOpen(true)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors cursor-pointer shadow-sm"
                        >
                          Choose Category
                        </button>
                      )}
                      {hasWalletIssue && canUpdateTx && (
                        <button
                          type="button"
                          onClick={openEditModal}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Assign Wallet
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Row 1: Category — clickable -> opens category popup */}
                <div
                  onClick={canUpdateTx ? () => setIsCategoryModalOpen(true) : undefined}
                  className={`flex items-center gap-4 py-2 ${canUpdateTx ? "cursor-pointer group hover:opacity-90 transition-opacity" : "cursor-default"}`}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#1d1f27] border border-white/5 flex-shrink-0 group-hover:border-[var(--color-primary)]/40 transition-colors">
                    <CategoryIcon
                      categoryId={transaction.category}
                      subCategoryId={transaction.subCategory}
                      size="md"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-white text-xl font-medium tracking-tight group-hover:text-[var(--color-primary-light)] transition-colors">
                        {getCategoryDisplayName(transaction.category, transaction.subCategory)}
                      </h2>
                      {hasCategoryIssue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          Category doesn't exist — Tap to fix
                        </span>
                      )}
                      {transaction.eventName && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <span>✈️</span>
                          <span>{transaction.eventName}</span>
                        </span>
                      )}
                    </div>
                    {transaction.title &&
                      transaction.title !==
                        getCategoryDisplayName(transaction.category, transaction.subCategory) && (
                        <p className="text-slate-400 text-xs mt-0.5">{transaction.title}</p>
                      )}
                  </div>
                </div>

                {/* Row 2: Amount — clickable -> opens amount popup with autofocus */}
                <div onClick={canUpdateTx ? openAmountModal : undefined} className={`py-1 ${canUpdateTx ? "cursor-pointer group" : "cursor-default"}`}>
                  <div
                    className={`text-2xl font-normal tracking-tight group-hover:opacity-80 transition-opacity flex items-center gap-3 flex-wrap ${
                      isFullyPaid
                        ? "line-through text-slate-500 opacity-75"
                        : isIncome
                        ? "text-sky-400"
                        : isExpense
                        ? "text-[#ff5252]"
                        : "text-amber-400"
                    }`}
                  >
                    <span>{formatMoney(transaction.amount, transaction.currency)}</span>
                    {isFullyPaid && (
                      <span className="no-underline inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Check className="w-3.5 h-3.5" />
                        <span>{isLoan ? "Fully Returned" : "Fully Paid"}</span>
                      </span>
                    )}
                  </div>
                  {/* If event currency is not the same with wallet currency, show both */}
                  {transaction.eventCurrency &&
                    transaction.eventCurrency !== transaction.currency && (
                      <p className="text-xs text-slate-400 mt-1 font-medium">
                        ≈ {formatMoney(convertCurrency(transaction.amount, transaction.currency, transaction.eventCurrency, rates), transaction.eventCurrency)} ({transaction.eventCurrency})
                      </p>
                    )}
                </div>

                {/* Row 3: Date — clickable -> popup calendar select */}
                <div
                  onClick={canUpdateTx ? () => setIsDatePickerOpen(true) : undefined}
                  className={`flex items-center gap-4 py-2 ${canUpdateTx ? "cursor-pointer group hover:opacity-80 transition-opacity" : "cursor-default"}`}
                >
                  <div className="w-7 h-7 flex items-center justify-center text-slate-300">
                    <CalendarIcon size={20} color="#cbd5e1" />
                  </div>
                  <span className="text-slate-200 text-sm font-normal">
                    {getDateLabel(transaction.date)}
                  </span>
                </div>

                {/* Row 4: Cash / Wallet Type */}
                <div
                  onClick={hasWalletIssue ? openEditModal : undefined}
                  className={`flex items-center gap-4 py-2 ${
                    hasWalletIssue ? "cursor-pointer group hover:opacity-90" : "select-none cursor-default"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-md ${
                      hasWalletIssue
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-[#e65100]/20 text-[#ff9800]"
                    } flex items-center justify-center`}
                  >
                    <WalletIcon className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200 text-sm font-normal">
                      {transaction.walletId?.name || "No wallet assigned"}
                    </span>
                    {hasWalletIssue && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Tap to assign
                      </span>
                    )}
                  </div>
                </div>
              </>
            );
          })()}

          {/* Event Detail Row (if assigned) */}
          {transaction.eventName && (
            <div className="flex items-center gap-4 py-2">
              <div className="w-7 h-7 rounded-md bg-[var(--color-primary-subtle)] border border-[var(--color-primary-border)] flex items-center justify-center text-[var(--color-primary-light)]">
                <Briefcase className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-200 text-sm font-semibold">
                  {transaction.eventName}
                </span>
                {transaction.eventCurrency && (
                  <span className="text-[10px] bg-white/6 text-slate-400 px-2 py-0.5 rounded-full font-bold">
                    {transaction.eventCurrency}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* With People Detail Row (if assigned) */}
          {((transaction.withPeople && transaction.withPeople.length > 0) || transaction.debtParty) && (
            <div className="flex items-center gap-4 py-2">
              <div className="w-7 h-7 rounded-md bg-purple-500/15 flex items-center justify-center text-purple-400">
                <Users className="w-4 h-4" />
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-slate-400 text-xs mr-1">With:</span>
                {(transaction.withPeople && transaction.withPeople.length > 0
                  ? transaction.withPeople
                  : [transaction.debtParty!]
                ).map((p) => (
                  <span
                    key={p}
                    className="px-2.5 py-0.5 rounded-full bg-white/10 text-white text-xs font-medium"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Optional Note / Description */}
          {transaction.description && (
            <div className="pt-2 text-xs text-slate-400 border-t border-white/6">
              <p className="font-semibold text-slate-300 mb-1">Note:</p>
              <p className="whitespace-pre-wrap">{transaction.description}</p>
            </div>
          )}

          {/* ── Debt / Loan Progress Bar & Action Button ─────────────────────── */}
          {isDebtOrLoan && (
            <div className="pt-2 pb-1 space-y-3 border-t border-white/6">
              {/* Progress Card */}
              <div className="bg-[#17181f] border border-white/8 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-300">
                    <span>{isLoan ? "Loan Return Progress" : "Debt Repayment Progress"}</span>
                    {isFullyPaid && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Check className="w-3 h-3" />
                        <span>{isLoan ? "Fully Returned" : "Fully Paid"}</span>
                      </span>
                    )}
                  </div>
                  <span className="font-extrabold text-[var(--color-primary-light)]">
                    {progressPercent}%
                  </span>
                </div>

                {/* Progress Track */}
                <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                      isFullyPaid
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                        : isLoan
                        ? "bg-gradient-to-r from-amber-500 to-emerald-400"
                        : "bg-gradient-to-r from-emerald-500 to-[var(--color-primary)]"
                    }`}
                  />
                </div>

                {/* Stats Below Bar */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <span>
                    {isLoan ? "Returned: " : "Paid: "}
                    <strong className="text-white font-semibold">
                      {formatMoney(repaidAmount, transaction.currency)}
                    </strong>
                  </span>
                  <span>
                    Remaining:{" "}
                    <strong
                      className={
                        remainingDebt > 0
                          ? "text-amber-400 font-semibold"
                          : "text-emerald-400 font-semibold"
                      }
                    >
                      {formatMoney(remainingDebt, transaction.currency)}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Action Button: "Pay Debt" or "Return Money" */}
              {canUpdateTx && (
              <button
                type="button"
                onClick={openPaymentModal}
                className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-[0.99] ${
                  isFullyPaid
                    ? "bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10"
                    : isLoan
                    ? "bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-white shadow-amber-900/30"
                    : "bg-[var(--color-primary)] hover:brightness-110 text-white shadow-[var(--color-primary-glow)]"
                }`}
              >
                {isLoan ? (
                  <>
                    <HandCoins className="w-4 h-4" />
                    <span>{isFullyPaid ? "Return More Money" : "Return Money"}</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>{isFullyPaid ? "Pay More Debt" : "Pay Debt"}</span>
                  </>
                )}
              </button>
              )}
            </div>
          )}

          {/* ── Payment History Section ───────────────────────────────────────── */}
          {isDebtOrLoan && (
            <div className="pt-1 pb-4 space-y-3">
              <div className="flex items-center justify-between border-t border-white/6 pt-4">
                <h3 className="text-white text-sm font-bold flex items-center gap-2">
                  <span>{isLoan ? "Loan Return History" : "Payment History"}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-slate-400">
                    {(transaction.debtPayments || []).length}
                  </span>
                </h3>
              </div>

              {!transaction.debtPayments || transaction.debtPayments.length === 0 ? (
                <div className="p-4 rounded-2xl bg-[#141519] border border-white/6 text-center text-xs text-slate-500">
                  No payments recorded yet. Tap &ldquo;{isLoan ? "Return Money" : "Pay Debt"}&rdquo; above to log your payment.
                </div>
              ) : (
                <div className="space-y-2">
                  {transaction.debtPayments.map((payment, idx) => {
                    const isDeleting = deletingPaymentId === String(payment._id);
                    const pDate = new Date(payment.date);
                    const formattedDate = pDate.toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });
                    return (
                      <div
                        key={String(payment._id || idx)}
                        className="p-3.5 bg-[#16171d] border border-white/6 rounded-2xl flex items-center justify-between gap-3 group hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                            <Check className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-semibold truncate">
                              {payment.note || (isLoan ? "Loan return" : "Debt payment")}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                              <span>{formattedDate}</span>
                              {payment.walletName && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-300">from {payment.walletName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-sm font-extrabold text-emerald-400">
                            +{formatMoney(payment.amount, payment.currency || transaction.currency)}
                          </span>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDeletePayment(String(payment._id))}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors disabled:opacity-50"
                            title="Remove this payment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Category Picker Modal (Full-page popup overlay) ────────────────── */}
      <CategoryPickerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        type={transaction.type}
        selectedCategory={transaction.category}
        selectedSubCategory={transaction.subCategory}
        onSelect={handleSelectCategory}
      />

      {/* ── Amount Edit Modal (Full-page popup with AUTOFOCUS) ─────────────── */}
      <AnimatePresence>
        {isAmountModalOpen && (
          <div className="fixed inset-0 z-[80] flex flex-col justify-between bg-[#0e0f12] text-white">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="flex-1 max-w-lg mx-auto w-full flex flex-col justify-between p-4"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between py-2 border-b border-white/6 pb-3">
                  <button
                    onClick={() => setIsAmountModalOpen(false)}
                    className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <h2 className="text-white text-base font-bold">Edit Amount</h2>
                  <button
                    onClick={handleSaveAmount}
                    className="text-white text-sm font-bold tracking-wider hover:text-[var(--color-primary-light)] active:scale-95 transition-all cursor-pointer"
                  >
                    SAVE
                  </button>
                </div>

                {/* Amount Input with AUTOFOCUS */}
                <div className="mt-6 p-6 bg-[#141519] border border-white/8 rounded-3xl">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-slate-300">
                    {getCurrencyDisplayCode(transaction.currency)}
                  </span>

                  <div className="py-4">
                    <input
                      ref={amountInputRef}
                      type="text"
                      inputMode="none"
                      readOnly
                      value={tempAmount}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveAmount();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setIsAmountModalOpen(false);
                        }
                      }}
                      className={`w-full bg-transparent text-4xl font-extrabold outline-none tracking-tight ${
                        isIncome
                          ? "text-sky-400"
                          : isExpense
                          ? "text-[#ff5252]"
                          : "text-amber-400"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Calculator Keypad */}
              <div className="pb-4">
                <CustomKeypad
                  value={tempAmount}
                  onChange={(val) => setTempAmount(val)}
                  onSubmit={handleSaveAmount}
                  showQuickChips={false}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Full Edit Transaction Modal (Picture 3 Overlay) ────────────────── */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div ref={editScrollContainerRef} onScroll={handleEditScroll} className="fixed inset-0 z-[80] bg-[#111216] text-white overflow-y-auto">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="max-w-lg mx-auto min-h-screen flex flex-col justify-between pb-8"
            >
              <div>
                {/* Top Bar matching Picture 3 */}
                <div className="flex items-center gap-4 px-5 pt-4 pb-3 border-b border-white/6">
                  <button
                    onClick={() => { setIsEditModalOpen(false); setEditIsKeypadOpen(false); }}
                    disabled={savingEdit}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <h2 className="text-white text-lg font-bold">Edit transaction</h2>
                </div>

                {/* Form Rows matching Picture 3 */}
                <div className="px-5 pt-3 space-y-5">
                  {/* Row 1: Wallet Selector */}
                  <div className="flex items-center justify-between py-2 border-b border-white/6">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 flex items-center justify-center text-slate-300">
                        <WalletIcon className="w-5 h-5" />
                      </div>
                      <span className="text-white text-base font-normal">
                        {wallets.find((w) => w._id === editWalletId)?.name || "Cash"}
                      </span>
                    </div>

                    <div className="relative" ref={editWalletDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setEditWalletDropdownOpen((v) => !v)}
                        className="flex items-center gap-1 text-[var(--color-primary-light)] hover:text-white text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <span>Change</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            editWalletDropdownOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {editWalletDropdownOpen && (
                        <div className="absolute right-0 top-[calc(100%+8px)] z-[85] w-64 bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
                          <div className="max-h-64 overflow-y-auto">
                            {wallets.map((w) => {
                              const isActive = editWalletId === w._id;
                              const meta = CURRENCY_INFO[w.currency as SupportedCurrency];
                              return (
                                <button
                                  key={w._id}
                                  type="button"
                                  onClick={() => {
                                    setEditWalletId(w._id);
                                    if (w.currency) setEditCurrency(w.currency);
                                    setEditWalletDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                                    isActive
                                      ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]"
                                      : "text-slate-300 hover:bg-white/5"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <CurrencyFlag
                                      flag={meta?.flag ?? "💳"}
                                      code={w.currency}
                                      className="text-base"
                                    />
                                    <div className="text-left min-w-0">
                                      <p className="font-semibold text-sm truncate">{w.name}</p>
                                      <p className="text-[11px] text-slate-400">
                                        {getCurrencyDisplayCode(w.currency)}
                                        {w.isDefault && (
                                          <span className="ml-1.5 text-[var(--color-primary-light)] font-bold">
                                            · Default
                                          </span>
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
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Currency Badge & Amount — tap to open custom keypad */}
                  <div
                    className={`py-3 border-b-2 cursor-text transition-colors duration-200 ${editIsKeypadOpen ? "border-red-400" : "border-red-500/60"}`}
                    onClick={() => setEditIsKeypadOpen(true)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded-lg bg-white/10 text-slate-300 text-xs font-bold flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {getCurrencyDisplayCode(editCurrency)}
                      </span>
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          inputMode="none"
                          readOnly
                          placeholder="0"
                          value={formatEditDisplayAmount(editRawAmount)}
                          onFocus={() => setEditIsKeypadOpen(true)}
                          className="w-full bg-transparent text-3xl font-normal text-[#ff5252] placeholder-[#ff5252]/40 outline-none cursor-text select-none"
                        />
                        {editIsKeypadOpen && (
                          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-7 bg-red-400 animate-pulse rounded-full" />
                        )}
                      </div>
                    </div>
                    {!editIsKeypadOpen && <p className="mt-1 text-[10px] text-slate-600 pl-1">Tap to enter amount</p>}
                  </div>

                  {/* Row 3: Category Picker */}
                  <div
                    onClick={() => { setEditIsKeypadOpen(false); setEditCategoryPickerOpen(true); }}
                    className="flex items-center gap-4 py-2 cursor-pointer group hover:opacity-90"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#1d1f27] border border-white/5 flex-shrink-0">
                      <CategoryIcon
                        categoryId={editCategory}
                        subCategoryId={editSubCategory}
                        size="md"
                      />
                    </div>
                    <span className="text-white text-lg font-normal flex-1">
                      {getCategoryDisplayName(editCategory, editSubCategory) || "Select Category"}
                    </span>
                  </div>

                  {/* Row 4: Description with Smart Options */}
                  <div className="py-2 border-b border-white/6">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 flex items-center justify-center text-slate-400 flex-shrink-0">
                        <AlignLeft className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        value={editDescription}
                        enterKeyHint="done"
                        onChange={(e) => setEditDescription(e.target.value)}
                        onFocus={() => {
                          setEditIsKeypadOpen(false);
                          setIsEditDescFocused(true);
                          setIsEditScrolledDown(false);
                          editFocusScrollTopRef.current = editScrollContainerRef.current?.scrollTop || 0;
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setIsEditDescFocused(false);
                            setIsEditScrolledDown(false);
                          }, 200);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        placeholder="Write description"
                        className="flex-1 bg-transparent text-slate-200 text-sm outline-none placeholder-slate-500"
                      />
                      {editDescription && (
                        <button
                          type="button"
                          onClick={() => setEditDescription("")}
                          className="text-slate-500 hover:text-white p-1"
                          aria-label="Clear description"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Smart description options when focused */}
                    <AnimatePresence>
                      {isEditDescFocused && filteredEditDescriptions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden pt-2.5"
                        >
                          <div className="p-2.5 rounded-2xl bg-[#181920] border border-white/8 space-y-2">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-[var(--color-primary-light)]" />
                                Previous descriptions
                              </span>
                              <span className="text-[10px] text-slate-500">Tap to select</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                              {filteredEditDescriptions.map((desc) => (
                                <button
                                  key={desc}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => setEditDescription(desc)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                                    editDescription.trim().toLowerCase() === desc.trim().toLowerCase()
                                      ? "bg-[var(--color-primary)] text-white shadow-sm ring-1 ring-white/20"
                                      : "bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/6"
                                  }`}
                                >
                                  {desc}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Row 5: Date — full-width pill matching AddTransactionModal */}
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-8 h-8 flex items-center justify-center text-slate-400 flex-shrink-0">
                      <CalendarIcon size={20} color="#94a3b8" />
                    </div>
                    <div className="flex-1 flex items-center justify-between bg-[#191a20] rounded-2xl px-3 py-2 border border-white/6">
                      <button
                        type="button"
                        onClick={() => {
                          const n = new Date(editDate);
                          n.setDate(n.getDate() - 1);
                          setEditDate(n);
                        }}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--color-primary-light)] hover:bg-white/5"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditIsKeypadOpen(false); setEditDateSelectOpen(true); }}
                        className="text-xs font-semibold text-[var(--color-primary-light)] flex-1 text-center"
                      >
                        {editDate.toLocaleDateString("en-GB", {
                          weekday: "long",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const n = new Date(editDate);
                          n.setDate(n.getDate() + 1);
                          setEditDate(n);
                        }}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--color-primary-light)] hover:bg-white/5"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Row 6: With & Select Event Card */}
                  <div className="bg-[#181920] border border-white/6 rounded-2xl p-4 space-y-4">
                    {/* With Section */}
                    <div
                      onClick={() => {
                        setEditIsKeypadOpen(false);
                        setIsWithModalOpen(true);
                      }}
                      className="flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-slate-400 flex-shrink-0 group-hover:text-white transition-colors">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {editWithPeople.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {editWithPeople.map((p) => (
                                <span
                                  key={p}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)] border border-[var(--color-primary-border)] text-xs font-semibold"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">With</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>

                    <div className="border-t border-white/5" />

                    {/* Select Event Section */}
                    <div
                      onClick={() => {
                        setEditIsKeypadOpen(false);
                        setIsEventModalOpen(true);
                      }}
                      className="flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-slate-400 flex-shrink-0 group-hover:text-white transition-colors">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {editEventName ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)] border border-[var(--color-primary-border)] text-xs font-bold">
                              <span>✈️</span>
                              <span>{editEventName}</span>
                              {editEventCurrency && (
                                <span className="text-slate-400 font-normal">
                                  ({editEventCurrency})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-sm">Select event</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  {/* Row 9: Receipt Image */}
                  <div className="bg-[#181920] border border-white/6 rounded-2xl p-4 flex items-center justify-around">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setEditReceiptUrl(ev.target?.result as string);
                            toast("Receipt attached", "success");
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-medium py-1 px-3 rounded-xl hover:bg-white/5"
                    >
                      <ImageIcon className="w-5 h-5 text-slate-300" />
                      <span>{editReceiptUrl ? "Change receipt" : "Add receipt"}</span>
                    </button>
                    <div className="w-px h-6 bg-white/10" />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-medium py-1 px-3 rounded-xl hover:bg-white/5"
                    >
                      <Camera className="w-5 h-5 text-slate-300" />
                      <span>Camera</span>
                    </button>
                  </div>
                </div>
              </div>

                            {/* Floating Save Footer for Edit Transaction */}
              <AnimatePresence>
                {isEditDescFocused && !isEditScrolledDown && (
                  <motion.div
                    key="edit-floating-save-bar"
                    initial={{ opacity: 0, y: 25, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                    transition={{ type: "spring", damping: 26, stiffness: 360 }}
                    style={{
                      bottom: keyboardHeight > 0 ? `${keyboardHeight + 12}px` : "16px",
                    }}
                    className="fixed left-4 right-4 max-w-lg mx-auto z-[85] bg-[#1a1c24]/95 backdrop-blur-xl border border-white/12 shadow-[0_16px_40px_rgba(0,0,0,0.65)] rounded-2xl p-2.5 flex items-center gap-2.5"
                  >
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleSaveFullEdit}
                      disabled={savingEdit}
                      className="w-full py-3.5 px-4 rounded-xl bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-bold text-sm tracking-wide transition-all shadow-md active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                      style={{ boxShadow: "0 4px 14px var(--color-primary-glow)" }}
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>{savingEdit ? "Saving…" : "Save"}</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom Green Save Button — sticks back when scrolled */}
              <div
                className={`px-5 pt-6 transition-opacity duration-200 ${
                  isEditDescFocused && !isEditScrolledDown ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
              >
                <button
                  type="button"
                  onClick={handleSaveFullEdit}
                  disabled={savingEdit}
                  className="w-full py-4 rounded-full bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-bold text-base shadow-xl active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                  style={{ boxShadow: "0 8px 24px -4px var(--color-primary-glow)" }}
                >
                  {savingEdit ? "Saving…" : "Save"}
                </button>
              </div>

              {/* Nested Category Picker for Edit Modal */}
              <CategoryPickerModal
                isOpen={editCategoryPickerOpen}
                onClose={() => setEditCategoryPickerOpen(false)}
                type={transaction.type}
                selectedCategory={editCategory}
                selectedSubCategory={editSubCategory}
                onSelect={(cat, sub) => {
                  setEditCategory(cat);
                  setEditSubCategory(sub);
                  setEditCategoryPickerOpen(false);
                }}
              />

              {/* Nested With People Modal for Edit Modal */}
              <WithPeopleModal
                isOpen={isWithModalOpen}
                onClose={() => setIsWithModalOpen(false)}
                selectedPeople={editWithPeople}
                onSave={(people) => {
                  setEditWithPeople(people);
                  setIsWithModalOpen(false);
                }}
              />

              {/* Nested Select Event Modal for Edit Modal */}
              <SelectEventModal
                isOpen={isEventModalOpen}
                onClose={() => setIsEventModalOpen(false)}
                selectedEventId={editEventId}
                onSelect={(ev) => {
                  if (ev) {
                    setEditEventId(ev._id);
                    setEditEventName(ev.name);
                    setEditEventCurrency(ev.currency);
                  } else {
                    setEditEventId("");
                    setEditEventName("");
                    setEditEventCurrency("");
                  }
                  setIsEventModalOpen(false);
                }}
                onManage={handleManageEvents}
                navigating={navigatingToEvents}
              />

              {/* Nested Date Picker for Edit Modal */}
              {editDateSelectOpen && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <div className="bg-[#1c1d25] border border-white/10 rounded-3xl p-6 w-full max-w-xs space-y-4">
                    <h3 className="text-white text-sm font-bold">Select Date</h3>
                    <div className="w-full bg-[#121318] border border-white/10 rounded-xl px-4 py-3">
                      <CustomDatePicker
                        value={editDate.toISOString().split("T")[0]}
                        onChange={(v) => {
                          if (v) {
                            setEditDate(new Date(v));
                            setEditDateSelectOpen(false);
                          }
                        }}
                        placeholder="Select date"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditDateSelectOpen(false)}
                      className="w-full py-2.5 rounded-xl bg-white/10 text-white text-xs font-bold"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* Floating Custom Keypad for Edit Modal */}
              <AnimatePresence>
                {editIsKeypadOpen && (
                  <>
                    <motion.div
                      key="edit-keypad-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => setEditIsKeypadOpen(false)}
                      className="fixed inset-0 z-[95] bg-black/40"
                    />
                    <motion.div
                      key="edit-keypad-panel"
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 30, stiffness: 350 }}
                      className="fixed bottom-0 left-0 right-0 z-[96] w-full max-w-lg mx-auto bg-[#18191f] border-t border-white/10 rounded-t-3xl shadow-2xl px-4 pt-3"
                    >
                      <div className="flex justify-center mb-3">
                        <div className="w-10 h-1 rounded-full bg-white/20" />
                      </div>
                      <div className="flex items-center justify-between px-2 pb-3 border-b border-white/6 mb-2">
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Amount</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 bg-white/6 px-2 py-0.5 rounded-lg">{getCurrencyDisplayCode(editCurrency)}</span>
                          <span className="text-2xl font-extrabold text-[#ff5252] tracking-tight">{formatEditDisplayAmount(editRawAmount)}</span>
                        </div>
                      </div>
                      <CustomKeypad
                        value={editRawAmount}
                        onChange={(val) => setEditRawAmount(val)}
                        onSubmit={handleEditAmountEnter}
                        showQuickChips={true}
                      />
                      <div className="flex items-center gap-3 px-2 pt-3 pb-5 border-t border-white/8 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (/[+×÷*/-]/.test(editRawAmount)) {
                              setEditRawAmount(safeEvaluateMath(editRawAmount));
                            }
                            setEditIsKeypadOpen(false);
                            handleSaveFullEdit();
                          }}
                          disabled={savingEdit}
                          className="flex-1 py-3.5 rounded-full bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-bold text-sm transition-all shadow-md active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                          style={{ boxShadow: "0 4px 14px var(--color-primary-glow)" }}
                        >
                          {savingEdit ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ── Date Picker Popup for Detail Screen ────────────────────────────── */}
      <AnimatePresence>
        {isDatePickerOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDatePickerOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-sm bg-[#1a1c24] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <h3 className="text-white text-sm font-bold">Select Date</h3>
                <button
                  onClick={() => setIsDatePickerOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <div className="w-full bg-[#121318] border border-white/10 rounded-xl px-4 py-3 focus-within:border-[var(--color-primary)]">
                  <CustomDatePicker
                    value={tempDate}
                    onChange={setTempDate}
                    placeholder="Select date"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateDate}
                  className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white text-xs font-bold transition-all shadow-md"
                  style={{ boxShadow: "0 4px 12px var(--color-primary-glow)" }}
                >
                  Save Date
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Duplicate Bottom Sheet Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {isDuplicateOpen && (
          <div className="fixed inset-0 z-[70] flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDuplicateOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative z-10 w-full max-w-lg mx-auto bg-[#181920] border-t border-white/10 rounded-t-3xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <h3 className="text-white text-base font-bold">Duplicate transaction</h3>
                <button
                  onClick={() => setIsDuplicateOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Duplicate Details Summary */}
              <div className="p-4 rounded-2xl bg-[#121318] border border-white/6 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Category</span>
                  <span className="text-white font-semibold">
                    {getCategoryDisplayName(transaction.category, transaction.subCategory)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Amount</span>
                  <span
                    className={`font-bold ${
                      isIncome ? "text-sky-400" : isExpense ? "text-red-400" : "text-amber-400"
                    }`}
                  >
                    {formatMoney(transaction.amount, transaction.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Wallet</span>
                  <span className="text-white font-semibold">
                    {transaction.walletId?.name || "Cash"}
                  </span>
                </div>
              </div>

              {/* Date with Left/Right Date Change */}
              <div>
                <p className="text-xs text-slate-400 mb-2 font-medium">Select Duplicate Date</p>
                <div className="flex items-center justify-between bg-[#1f2029] rounded-2xl p-2.5 border border-white/8">
                  <button
                    onClick={() => handleDateShiftDuplicate(-1)}
                    className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <span className="text-[var(--color-primary-light)] font-semibold text-sm">
                    {duplicateDate.toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>

                  <button
                    onClick={() => handleDateShiftDuplicate(1)}
                    className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDuplicateOpen(false)}
                  className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDuplicate}
                  disabled={duplicating}
                  className="w-full py-3 rounded-2xl bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white text-sm font-bold transition-all shadow-lg disabled:opacity-50"
                  style={{ boxShadow: "0 4px 14px var(--color-primary-glow)" }}
                >
                  {duplicating ? "Duplicating…" : "Confirm Duplicate"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {isDeleteOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-sm bg-[#1a1c24] border border-white/10 rounded-3xl p-6 shadow-2xl text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white text-base font-bold">Delete transaction?</h3>
                <p className="text-slate-400 text-xs mt-1">
                  This transaction will be permanently removed and your wallet balance will be
                  rolled back.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shadow-lg shadow-red-600/30 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Debt / Loan Payment Modal (Consistent with web UI) ──────────────── */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-[85] bg-[#0f1015] text-white overflow-y-auto">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="max-w-lg mx-auto min-h-screen flex flex-col justify-between pb-8"
            >
              <div>
                {/* Top Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/6">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPaymentModalOpen(false)}
                      disabled={submittingPayment}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                    <h2 className="text-white text-lg font-bold">
                      {isLoan ? "Return Money" : "Pay Debt"}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleSavePayment}
                    disabled={submittingPayment}
                    className="text-sm font-bold text-[var(--color-primary-light)] hover:text-white active:scale-95 transition-all disabled:opacity-50 cursor-pointer px-3 py-1.5 rounded-xl bg-[var(--color-primary-subtle)] border border-[var(--color-primary-border)]"
                  >
                    {submittingPayment ? "SAVING…" : "SAVE"}
                  </button>
                </div>

                <div className="px-5 pt-4 space-y-5">
                  {/* Party & Remaining Info Card */}
                  <div className="p-4 bg-[#161720] border border-white/8 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-lg flex-shrink-0">
                        {partyInitial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm truncate">{partyName}</p>
                        <p className="text-[11px] text-slate-400">
                          {isLoan ? "Lender" : "Creditor"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 pl-2">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Remaining
                      </p>
                      <p className="text-white font-extrabold text-base tracking-tight">
                        {formatMoney(remainingDebt, transaction.currency)}
                      </p>
                    </div>
                  </div>

                  {/* PAID FROM / RETURN FROM section */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      {isLoan ? "Return From" : "Paid From"}
                    </p>

                    <div className="relative" ref={payWalletDropdownRef}>
                      {(() => {
                        const curWallet = wallets.find((w) => w._id === payWalletId) || wallets[0];
                        const meta = curWallet
                          ? CURRENCY_INFO[curWallet.currency as SupportedCurrency]
                          : null;
                        return (
                          <div className="bg-[#161720] border border-white/8 rounded-2xl p-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/20 text-orange-400 flex items-center justify-center flex-shrink-0">
                                <WalletIcon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {meta && (
                                    <CurrencyFlag
                                      flag={meta.flag}
                                      code={curWallet?.currency}
                                      className="text-xs"
                                    />
                                  )}
                                  <p className="text-white font-semibold text-sm truncate">
                                    {curWallet?.name || "Select wallet"}
                                  </p>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  {curWallet?.currency || "IDR"}
                                  {curWallet?.balance !== undefined && (
                                    <span className="ml-1 text-slate-300">
                                      • Balance: {formatMoney(curWallet.balance, curWallet.currency)}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setIsPayWalletDropdownOpen((v) => !v)}
                              className="flex items-center gap-1 text-[var(--color-primary-light)] hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                            >
                              <span>Change</span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  isPayWalletDropdownOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })()}

                      {/* Dropdown Options */}
                      {isPayWalletDropdownOpen && (
                        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[95] bg-[#1c1d27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in max-h-60 overflow-y-auto">
                          {wallets.map((w) => {
                            const isActive = payWalletId === w._id;
                            const meta = CURRENCY_INFO[w.currency as SupportedCurrency];
                            return (
                              <button
                                key={w._id}
                                type="button"
                                onClick={() => {
                                  setPayWalletId(w._id);
                                  setIsPayWalletDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                                  isActive
                                    ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)]"
                                    : "text-slate-300 hover:bg-white/5"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <CurrencyFlag
                                    flag={meta?.flag ?? "💳"}
                                    code={w.currency}
                                    className="text-base"
                                  />
                                  <div className="text-left min-w-0">
                                    <p className="font-semibold text-sm truncate">{w.name}</p>
                                    <p className="text-[11px] text-slate-400">
                                      {getCurrencyDisplayCode(w.currency)}
                                      {w.balance !== undefined && (
                                        <span className="ml-1 text-slate-300">
                                          • {formatMoney(w.balance, w.currency)}
                                        </span>
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
                  </div>

                  {/* Amount Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Amount
                      </p>
                      {remainingDebt > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPayAmount(String(remainingDebt));
                            setIsPayKeypadOpen(true);
                          }}
                          className="text-[11px] font-bold text-[var(--color-primary-light)] hover:underline"
                        >
                          Pay Full ({formatMoney(remainingDebt, transaction.currency)})
                        </button>
                      )}
                    </div>

                    <div
                      className={`bg-[#161720] border rounded-2xl p-4 flex items-center gap-3 cursor-text transition-colors ${isPayKeypadOpen ? "border-[var(--color-primary-light)]" : "border-white/8"}`}
                      onClick={() => setIsPayKeypadOpen(true)}
                    >
                      <span className="px-2.5 py-1 rounded-lg bg-white/10 text-slate-300 text-xs font-bold flex-shrink-0">
                        {getCurrencyDisplayCode(transaction.currency)}
                      </span>
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          inputMode="none"
                          readOnly
                          value={formatPayDisplayAmount(payAmount)}
                          placeholder="0"
                          onClick={() => setIsPayKeypadOpen(true)}
                          className="w-full bg-transparent text-2xl font-bold text-white outline-none placeholder-slate-600 cursor-text select-none"
                        />
                        {isPayKeypadOpen && (
                          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-7 bg-[var(--color-primary-light)] animate-pulse rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Note / Description */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      Note
                    </p>
                    <div className="bg-[#161720] border border-white/8 rounded-2xl p-3.5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 flex-shrink-0">
                        <AlignLeft className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={payNote}
                        enterKeyHint="done"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        onChange={(e) => setPayNote(e.target.value)}
                        placeholder={isLoan ? "Loan return note" : "Debt payment note"}
                        className="flex-1 bg-transparent text-sm text-white outline-none placeholder-slate-500"
                      />
                    </div>
                  </div>

                  {/* Date Selector */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      Date
                    </p>
                    <div className="bg-[#161720] border border-white/8 rounded-2xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 flex-shrink-0">
                          <CalendarIcon size={18} color="#94a3b8" />
                        </div>
                        <span className="text-white text-sm font-medium">
                          {payDate.toLocaleDateString("en-US", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsPayDatePickerOpen((v) => !v)}
                        className="text-xs font-semibold text-[var(--color-primary-light)] hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        Change Date
                      </button>
                    </div>

                    {/* Nested Date Picker */}
                    {isPayDatePickerOpen && (
                      <div className="p-4 bg-[#1c1d27] border border-white/10 rounded-2xl space-y-3 animate-fade-in">
                        <CustomDatePicker
                          value={payDate.toISOString().split("T")[0]}
                          onChange={(v) => {
                            if (v) {
                              setPayDate(new Date(v));
                              setIsPayDatePickerOpen(false);
                            }
                          }}
                          placeholder="Select date"
                        />
                        <button
                          type="button"
                          onClick={() => setIsPayDatePickerOpen(false)}
                          className="w-full py-2 rounded-xl bg-white/10 text-xs text-white font-semibold"
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Informational footer note */}
                  <p className="text-[11px] text-slate-500 text-center pt-2">
                    This payment will be deducted from your chosen wallet and recorded under this{" "}
                    {isLoan ? "loan" : "debt"}.
                  </p>
                </div>
              </div>

              {/* Bottom Confirm Button */}
              <div className="px-5 pt-6">
                <button
                  type="button"
                  onClick={handleSavePayment}
                  disabled={submittingPayment}
                  className={`w-full py-4 rounded-full font-bold text-base shadow-xl active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer text-white ${
                    isLoan
                      ? "bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110"
                      : "bg-[var(--color-primary)] hover:brightness-110"
                  }`}
                  style={{
                    boxShadow: isLoan
                      ? "0 8px 24px -4px rgba(245, 158, 11, 0.4)"
                      : "0 8px 24px -4px var(--color-primary-glow)",
                  }}
                >
                  {submittingPayment
                    ? "Recording…"
                    : `Confirm ${isLoan ? "Return" : "Payment"} (${formatMoney(
                        parseFloat(payAmount.replace(/,/g, "") || "0") || 0,
                        transaction.currency
                      )})`}
                </button>
              </div>

              {/* Floating Pay Keypad — slides up from bottom when amount tapped */}
              <AnimatePresence>
                {isPayKeypadOpen && (
                  <>
                    <motion.div
                      key="pay-keypad-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => setIsPayKeypadOpen(false)}
                      className="fixed inset-0 z-[95] bg-black/40"
                    />
                    <motion.div
                      key="pay-keypad-panel"
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 30, stiffness: 350 }}
                      className="fixed bottom-0 left-0 right-0 z-[100] w-full max-w-lg mx-auto bg-[#18191f] border-t border-white/10 rounded-t-3xl shadow-2xl px-4 pt-3 pb-safe"
                    >
                      <div className="flex justify-center mb-3">
                        <div className="w-10 h-1 rounded-full bg-white/20" />
                      </div>
                      <div className="flex items-center justify-between px-2 pb-3 border-b border-white/6 mb-2">
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Amount</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 bg-white/6 px-2 py-0.5 rounded-lg">
                            {getCurrencyDisplayCode(transaction.currency)}
                          </span>
                          <span className="text-2xl font-extrabold text-[var(--color-primary-light)] tracking-tight">
                            {formatPayDisplayAmount(payAmount) || "0"}
                          </span>
                        </div>
                      </div>
                      <CustomKeypad
                        value={payAmount.replace(/,/g, "")}
                        onChange={(val) => setPayAmount(val)}
                        onSubmit={() => {
                          if (/[+\-×÷*/]/.test(payAmount)) {
                            setPayAmount(safeEvaluateMath(payAmount.replace(/,/g, "")));
                          } else {
                            setIsPayKeypadOpen(false);
                            handleSavePayment();
                          }
                        }}
                        showQuickChips={false}
                      />
                      <div className="flex items-center gap-3 px-2 pt-3 pb-5 border-t border-white/8 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (/[+\-×÷*/]/.test(payAmount)) {
                              setPayAmount(safeEvaluateMath(payAmount.replace(/,/g, "")));
                            } else {
                              setIsPayKeypadOpen(false);
                              handleSavePayment();
                            }
                          }}
                          disabled={submittingPayment}
                          className="flex-1 py-3.5 rounded-full bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-bold text-sm tracking-wide transition-all shadow-md active:scale-[0.99] disabled:opacity-50 text-center cursor-pointer"
                          style={{ boxShadow: "0 6px 16px var(--color-primary-glow)" }}
                        >
                          {submittingPayment ? "Recording…" : `Confirm ${isLoan ? "Return" : "Payment"}`}
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
