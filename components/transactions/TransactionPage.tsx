"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  HelpCircle,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Plus,
  Filter,
  Download,
  Calendar,
  Wallet,
  TrendingUp,
  TrendingDown,
  Sparkles,
  CheckCircle2,
  Clock,
  MoreVertical,
  Bell,
  ChevronDown,
  Send,
  CreditCard,
  RefreshCw,
  Eye,
  EyeOff,
  SlidersHorizontal,
} from "lucide-react";
import OnboardingSpotlight, {
  SpotlightStep,
} from "./OnboardingSpotlight";
import ConfettiEffect from "./ConfettiEffect";

// Mock transaction data
interface TransactionItem {
  id: string;
  title: string;
  category: "Salary" | "Shopping" | "Food & Dining" | "Freelance" | "Utilities" | "Transfer";
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  date: string;
  time: string;
  status: "Completed" | "Pending" | "Failed";
  recipientOrSender: string;
  wallet: string;
}

const INITIAL_TRANSACTIONS: TransactionItem[] = [
  {
    id: "tx-1",
    title: "Client Retainer - Acme Studio",
    category: "Freelance",
    type: "INCOME",
    amount: 3450.0,
    date: "Today, Nov 11",
    time: "09:30 AM",
    status: "Completed",
    recipientOrSender: "Acme Corp",
    wallet: "Main Checking",
  },
  {
    id: "tx-2",
    title: "Whole Foods Organic Market",
    category: "Food & Dining",
    type: "EXPENSE",
    amount: 142.85,
    date: "Today, Nov 11",
    time: "08:15 AM",
    status: "Completed",
    recipientOrSender: "Whole Foods",
    wallet: "Daily Card",
  },
  {
    id: "tx-3",
    title: "Monthly Figma & GitHub Subscriptions",
    category: "Utilities",
    type: "EXPENSE",
    amount: 56.0,
    date: "Yesterday",
    time: "11:20 PM",
    status: "Completed",
    recipientOrSender: "Vercel / GitHub",
    wallet: "Virtual Vault",
  },
  {
    id: "tx-4",
    title: "Quarterly Performance Bonus",
    category: "Salary",
    type: "INCOME",
    amount: 2800.0,
    date: "Nov 08, 2026",
    time: "02:00 PM",
    status: "Completed",
    recipientOrSender: "TechVentures Inc.",
    wallet: "Savings Stash",
  },
  {
    id: "tx-5",
    title: "Apple Store - Studio Headphones",
    category: "Shopping",
    type: "EXPENSE",
    amount: 399.0,
    date: "Nov 06, 2026",
    time: "04:45 PM",
    status: "Completed",
    recipientOrSender: "Apple Retail",
    wallet: "Main Checking",
  },
  {
    id: "tx-6",
    title: "Transfer to High-Yield Vault",
    category: "Transfer",
    type: "TRANSFER",
    amount: 1200.0,
    date: "Nov 04, 2026",
    time: "10:10 AM",
    status: "Pending",
    recipientOrSender: "Internal Transfer",
    wallet: "High Yield Vault",
  },
];

const ONBOARDING_STEPS: SpotlightStep[] = [
  {
    targetId: "spotlight-balance-card",
    title: "Financial Command Center",
    description:
      "💎 Track your aggregated balance across all accounts in real time. Switch currencies, inspect daily burn rate, and perform 1-click quick actions.",
    preferredPlacement: "bottom",
  },
  {
    targetId: "spotlight-transactions-table",
    title: "Real-time Transaction Feed",
    description:
      "⚡ Your expenses, transfers, and income are automatically synced, categorized, and timestamped. Click any entry to inspect the full receipt log.",
    preferredPlacement: "top",
  },
  {
    targetId: "spotlight-send-form",
    title: "Frictionless Send & Transfer",
    description:
      "💸 Send money or split bills in seconds. Pick a saved payee, enter the amount, and dispatch payments with zero transaction fees.",
    preferredPlacement: "bottom",
  },
  {
    targetId: "spotlight-filters",
    title: "Smart Filters & Export",
    description:
      "🎯 Filter by category, status, or date range dynamically. Export clean CSV or PDF reports in a single click when tax season arrives.",
    preferredPlacement: "bottom",
  },
];

const QUICK_PAYEES = [
  { name: "Sarah Chen", avatar: "👩‍💻", tag: "@sarah" },
  { name: "Marcus Vance", avatar: "👨‍🎨", tag: "@marcus" },
  { name: "Elena Rostova", avatar: "👩‍🔬", tag: "@elena" },
  { name: "David Kim", avatar: "👨‍💼", tag: "@dkim" },
];

export default function TransactionPage() {
  // Onboarding tour state
  const [tourOpen, setTourOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showCelebrationToast, setShowCelebrationToast] = useState(false);

  // Financial UI states
  const [hideBalance, setHideBalance] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");

  // Send Money Form state
  const [selectedPayee, setSelectedPayee] = useState(QUICK_PAYEES[0].name);
  const [transferAmount, setTransferAmount] = useState("250.00");
  const [transferNote, setTransferNote] = useState("Team Lunch Split");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);

  // Tour trigger handlers
  const handleStartTour = () => {
    setCurrentStep(0);
    setTourOpen(true);
  };

  const handleNextStep = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleCompleteTour();
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleCloseTour = () => {
    setTourOpen(false);
  };

  const handleCompleteTour = () => {
    setTourOpen(false);
    // Trigger celebratory confetti & celebration notification
    setShowCelebration(true);
    setShowCelebrationToast(true);

    // Auto dismiss celebratory toast after 4 seconds
    setTimeout(() => {
      setShowCelebrationToast(false);
    }, 4200);
  };

  // Filtered transactions calculation
  const filteredTransactions = useMemo(() => {
    return INITIAL_TRANSACTIONS.filter((tx) => {
      const matchesSearch =
        tx.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.recipientOrSender.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" || tx.category === selectedCategory;

      const matchesStatus =
        selectedStatus === "All" || tx.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [searchQuery, selectedCategory, selectedStatus]);

  // Handle Send Money form submission
  const handleSendMoney = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAmount || isNaN(Number(transferAmount))) return;

    setIsTransferring(true);
    setTimeout(() => {
      setIsTransferring(false);
      setTransferSuccess(true);
      setTimeout(() => setTransferSuccess(false), 2500);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#0c0d10] text-slate-100 font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200 pb-16">
      {/* Celebratory Confetti Canvas */}
      {showCelebration && (
        <ConfettiEffect
          duration={3800}
          particleCount={140}
          onComplete={() => setShowCelebration(false)}
        />
      )}

      {/* Celebratory Toast Banner */}
      {showCelebrationToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/95 border border-emerald-500/40 text-emerald-300 shadow-2xl shadow-emerald-500/20 backdrop-blur-xl animate-in fade-in slide-in-from-top duration-300">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
            🎉
          </div>
          <div>
            <p className="text-xs font-bold text-white tracking-wide">
              You're all set! Onboarding Complete
            </p>
            <p className="text-[11px] text-slate-400">
              Feel free to tap the <span className="text-emerald-300 font-semibold">?</span> icon anytime if you need a refresher.
            </p>
          </div>
        </div>
      )}

      {/* Main Top Header / App Bar */}
      <header className="sticky top-0 z-30 bg-[#0c0d10]/85 backdrop-blur-md border-b border-white/[0.07] px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Branding & Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-black text-lg">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Transactions
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-medium text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Manage, review, and dispatch payments seamlessly
              </p>
            </div>
          </div>

          {/* Right: Actions, Help Question Mark, & Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Interactive "?" Help Tour Trigger Button */}
            <div className="relative">
              <button
                type="button"
                onClick={handleStartTour}
                className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-emerald-400 hover:text-emerald-300 transition-all duration-200 group shadow-sm active:scale-95 cursor-pointer"
                title="Start Interactive Tour"
                aria-label="Start Onboarding Spotlight Tour"
              >
                <HelpCircle className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12" />

                {/* Pulsing beacon radar indicator to invite attention */}
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-[#0c0d10]" />
                </span>
              </button>
            </div>

            {/* Notification Bell */}
            <button
              type="button"
              className="w-10 h-10 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/[0.06] flex items-center justify-center transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>

            {/* User Profile Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/[0.08]">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
                JD
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-white">John Doe</p>
                <p className="text-[10px] text-slate-400 font-mono">Pro Account</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6">
        {/* Row 1: Spotlight Target 1 - Balance Cards & Quick Actions */}
        <section
          id="spotlight-balance-card"
          className="relative rounded-3xl bg-[#17181c] border border-white/[0.08] p-5 sm:p-6 shadow-xl transition-all"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Balance Overview */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  <span>Total Liquid Balance</span>
                </div>
                <button
                  onClick={() => setHideBalance(!hideBalance)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {hideBalance ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Show</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Hide</span>
                    </>
                  )}
                </button>
              </div>

              {/* Amount Display with Trend */}
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-mono">
                  {hideBalance ? "••••••••" : "$42,850.50"}
                </h2>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+14.8% this month</span>
                </div>
              </div>

              {/* Sub-Metrics: Income vs Expenses */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Monthly Income</span>
                  </div>
                  <p className="text-base sm:text-lg font-bold text-white font-mono">
                    {hideBalance ? "••••••" : "+$12,450.00"}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                    <span>Monthly Expenses</span>
                  </div>
                  <p className="text-base sm:text-lg font-bold text-white font-mono">
                    {hideBalance ? "••••••" : "-$3,680.40"}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="lg:col-span-5 flex flex-col justify-center gap-3 bg-gradient-to-br from-white/[0.03] to-transparent p-4 sm:p-5 rounded-2xl border border-white/[0.06]">
              <span className="text-xs font-semibold text-slate-300">
                Quick Actions
              </span>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  type="button"
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 transition-all text-xs font-medium cursor-pointer hover:-translate-y-0.5"
                >
                  <Send className="w-4 h-4 text-emerald-400" />
                  <span>Send</span>
                </button>
                <button
                  type="button"
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/[0.08] text-slate-200 transition-all text-xs font-medium cursor-pointer hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4 text-slate-300" />
                  <span>Deposit</span>
                </button>
                <button
                  type="button"
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/[0.08] text-slate-200 transition-all text-xs font-medium cursor-pointer hover:-translate-y-0.5"
                >
                  <ArrowRightLeft className="w-4 h-4 text-slate-300" />
                  <span>Exchange</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Row 2: Grid containing Send Money Form & Filters/Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Spotlight Target 3 - Send Money Form */}
          <section
            id="spotlight-send-form"
            className="lg:col-span-4 rounded-3xl bg-[#17181c] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Send & Transfer</h3>
                  <p className="text-[11px] text-slate-400">Zero-fee instant transfer</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Free
              </span>
            </div>

            {/* Quick Payee Selectors */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Recent Payees
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {QUICK_PAYEES.map((payee) => (
                  <button
                    key={payee.name}
                    type="button"
                    onClick={() => setSelectedPayee(payee.name)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium whitespace-nowrap transition-all ${
                      selectedPayee === payee.name
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                        : "bg-white/[0.03] border-white/[0.06] text-slate-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span>{payee.avatar}</span>
                    <span>{payee.name.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount & Note Form */}
            <form onSubmit={handleSendMoney} className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Transfer Amount ($ USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black/40 border border-white/[0.1] rounded-xl pl-8 pr-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Memo / Purpose
                </label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="e.g. Project milestone"
                  className="w-full bg-black/40 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40"
                />
              </div>

              <button
                type="submit"
                disabled={isTransferring}
                className={`w-full mt-2 py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                  transferSuccess
                    ? "bg-emerald-500 text-slate-950 font-bold"
                    : "bg-emerald-400 hover:bg-emerald-300 text-slate-950 hover:shadow-emerald-500/25"
                }`}
              >
                {isTransferring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching Transfer...</span>
                  </>
                ) : transferSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Sent Successfully!</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send {selectedPayee.split(" ")[0]} ${transferAmount || "0"}</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Right Column: Filters (Target 4) + Transactions Table (Target 2) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Spotlight Target 4: Filter & Export Controls */}
            <section
              id="spotlight-filters"
              className="rounded-3xl bg-[#17181c] border border-white/[0.08] p-4 sm:p-5 shadow-xl space-y-3"
            >
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Bar Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, payee, or category..."
                    className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Export & Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => alert("Exporting transactions as CSV...")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory("All");
                      setSelectedStatus("All");
                      setSearchQuery("");
                    }}
                    className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-slate-400 hover:text-white transition-colors"
                    title="Reset filters"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Category Pills & Quick Filter Badges */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {["All", "Freelance", "Food & Dining", "Shopping", "Salary", "Utilities"].map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-full border transition-all whitespace-nowrap cursor-pointer text-xs ${
                        selectedCategory === cat
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold"
                          : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
                      }`}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>
            </section>

            {/* Spotlight Target 2: Recent Transactions Table */}
            <section
              id="spotlight-transactions-table"
              className="rounded-3xl bg-[#17181c] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Recent Transactions</h3>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] font-medium text-slate-400 border border-slate-700/60">
                    {filteredTransactions.length} entries
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>November 2026</span>
                </div>
              </div>

              {/* Transaction List Entries */}
              <div className="space-y-2.5">
                {filteredTransactions.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <p className="text-sm">No transactions match your current filters.</p>
                    <button
                      onClick={() => {
                        setSelectedCategory("All");
                        setSearchQuery("");
                      }}
                      className="mt-2 text-xs text-emerald-400 hover:underline"
                    >
                      Reset all filters
                    </button>
                  </div>
                ) : (
                  filteredTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] transition-all gap-3"
                    >
                      {/* Left info: Icon & Title */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            tx.type === "INCOME"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                              : tx.type === "TRANSFER"
                              ? "bg-sky-500/15 text-sky-400 border border-sky-500/20"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {tx.type === "INCOME" ? (
                            <ArrowDownLeft className="w-5 h-5" />
                          ) : tx.type === "TRANSFER" ? (
                            <ArrowRightLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                              {tx.title}
                            </h4>
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                tx.status === "Completed"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-amber-500/10 text-amber-400"
                              }`}
                            >
                              {tx.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>{tx.category}</span>
                            <span>•</span>
                            <span>{tx.recipientOrSender}</span>
                            <span>•</span>
                            <span className="font-mono text-[10px]">{tx.time}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right info: Amount & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pl-13 sm:pl-0">
                        <div className="text-right">
                          <p
                            className={`text-sm sm:text-base font-bold font-mono ${
                              tx.type === "INCOME"
                                ? "text-emerald-400"
                                : tx.type === "TRANSFER"
                                ? "text-sky-300"
                                : "text-slate-100"
                            }`}
                          >
                            {tx.type === "INCOME" ? "+" : tx.type === "TRANSFER" ? "" : "-"}
                            ${tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-slate-500">{tx.wallet}</p>
                        </div>

                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                          title="More options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Interactive Onboarding Spotlight Tour Overlay */}
      <OnboardingSpotlight
        isOpen={tourOpen}
        steps={ONBOARDING_STEPS}
        currentStep={currentStep}
        onNext={handleNextStep}
        onPrev={handlePrevStep}
        onClose={handleCloseTour}
        onComplete={handleCompleteTour}
        padding={10}
      />
    </div>
  );
}
