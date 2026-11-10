"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Search,
  Bell,
  HelpCircle,
  Plus,
  Target,
} from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { WalletGraphic } from "@/components/ui/AppIcons";
import CategoryIcon from "@/components/ui/CategoryIcon";
import BudgetCategoryIcons from "@/components/admin/budget/BudgetCategoryIcons";
import { getBudgetCategoryIcons, getBudgetDisplayName } from "@/lib/budgetUtils";
import { getCategoryDisplayName } from "@/lib/categories";
import MonthlySpendingReportChart from "@/components/admin/MonthlySpendingReportChart";
import GlobalCurrencyModal from "@/components/admin/GlobalCurrencyModal";
import WalletManagerModal from "@/components/admin/WalletManagerModal";
import { useAdminModal } from "@/hooks/useAdminModal";
import { useTheme } from "@/context/ThemeContext";
import PageLoading from "@/components/ui/PageLoading";

interface Wallet {
  _id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  isDefault?: boolean;
  ownerEmail?: string;
  ownerName?: string;
  userId?: string;
}

interface Transaction {
  _id: string;
  type: string;
  title: string;
  amount: number;
  currency: string;
  convertedAmount?: number;
  convertedAmountIDR?: number;
  convertedToGlobal?: number;
  category: string;
  subCategory?: string;
  date: string;
}

interface Budget {
  _id: string;
  name?: string;
  category: string;
  subCategory?: string;
  categories?: string[];
  order?: number;
  amountLimit: number;
  currency?: string;
  spent: number;
  percentUsed: number;
}

interface HomeDashboardProps {
  user: {
    name: string;
    email: string;
    baseCurrency: string;
    hasCompletedOnboarding?: boolean;
  };
  wallets: Wallet[];
  recentTransactions: Transaction[];
  currentMonthTransactions: Transaction[];
  previousMonthTransactions: Transaction[];
  budgets: Budget[];
  totalBalanceConverted: number;
  totalIncomeConverted: number;
  totalExpenseConverted: number;
  monthYear: string;
}

export default function HomeDashboard({
  user,
  wallets,
  recentTransactions,
  currentMonthTransactions,
  previousMonthTransactions,
  budgets,
  totalBalanceConverted,
  totalIncomeConverted,
  totalExpenseConverted,
  monthYear,
}: HomeDashboardProps) {
  const [walletList, setWalletList] = useState<Wallet[]>(wallets);
  const [hideBalance, setHideBalance] = useState(false);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(
    user.hasCompletedOnboarding === false
  );
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const { openModal } = useAdminModal();
  const { currentColor, isThemeLoaded } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setWalletList(wallets);
  }, [wallets]);

  useEffect(() => {
    setMounted(true);
    // Fetch unread notification count for the bell badge
    fetch("/api/notifications?limit=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.unreadCount !== undefined) setUnreadCount(d.unreadCount);
      })
      .catch(() => {});
  }, []);

  if (!mounted || !isThemeLoaded) {
    return (
      <PageLoading
        title="Loading Dashboard..."
        subtitle="Setting up your dashboard & theme"
      />
    );
  }

  const globalCurrency = user.baseCurrency || "IDR";
  const displayedWallets = walletList.slice(0, 3);

  return (
    <div className="px-4 pt-4 pb-nav-safe max-w-lg mx-auto space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────────── */}
      <div className="pt-2">
        <div className="flex items-center justify-between">
          {/* Total balance display with eye icon */}
          <div className="flex items-center gap-2.5">
            <span className="text-white font-extrabold text-2xl sm:text-3xl tracking-tight">
              ≈ {hideBalance ? "••••••" : formatMoney(totalBalanceConverted, globalCurrency)}
            </span>
            <button
              onClick={() => setHideBalance((h) => !h)}
              className="p-1 rounded-full text-slate-400 hover:text-white transition-colors"
              aria-label={hideBalance ? "Show balance" : "Hide balance"}
            >
              {hideBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Right action icons */}
          <div className="flex items-center gap-2">
            <Link
              href="/transactions"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
              aria-label="Search transactions"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>

            {/* Bell → Notifications page with unread badge */}
            <Link
              href="/notifications"
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#0f1013]" />
              )}
            </Link>
          </div>
        </div>

        {/* Subtitle with info tooltip */}
        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
          <span>Total balance · {globalCurrency}</span>
          <button
            onClick={() => setShowTooltip((t) => !t)}
            className="hover:text-slate-200 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>

        {showTooltip && (
          <div className="mt-2 p-3 rounded-2xl bg-[#1a1c22] border border-white/10 text-xs text-slate-300 animate-fade-in shadow-xl">
            {`Total balance reflects the sum of all your wallets converted into your global currency (${globalCurrency}). Change your global currency anytime in Account Settings.`}
          </div>
        )}
      </div>

      {/* ── My Wallets Card (shows max of 3 wallets) ────────────────────── */}
      <div className="money-card p-5 bg-[#141519] border border-white/8 rounded-3xl shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-base font-bold tracking-tight">My Wallets</h2>
          <button
            onClick={() => setIsWalletModalOpen(true)}
            className="text-xs font-semibold tracking-wide transition-colors cursor-pointer"
            style={{ color: currentColor.primaryLight }}
          >
            See all
          </button>
        </div>

        {displayedWallets.length > 0 ? (
          <div className="space-y-2.5">
            {displayedWallets.map((wallet) => {
              const isShared = Boolean(
                wallet.ownerEmail &&
                  user.email &&
                  wallet.ownerEmail.toLowerCase() !== user.email.toLowerCase()
              );
              const ownerDisplayName =
                wallet.ownerName ||
                (wallet.ownerEmail ? wallet.ownerEmail.split("@")[0] : "Owner");

              return (
                <div
                  key={wallet._id}
                  onClick={() => setIsWalletModalOpen(true)}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-[#1b1c22] border border-white/5 hover:border-white/12 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <WalletGraphic size={44} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-bold text-sm tracking-wide transition-colors truncate">
                          {wallet.name}
                        </p>
                        {isShared && (
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-medium">
                            {ownerDisplayName}&apos;s wallet
                          </span>
                        )}
                      </div>
                      {wallet.isDefault && (
                        <p className="text-slate-400 text-xs">Default wallet</p>
                      )}
                    </div>
                  </div>

                  <p className="text-white font-extrabold text-base tracking-tight flex-shrink-0">
                    {formatMoney(wallet.balance, wallet.currency)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty Wallet State UX */
          <div className="text-center py-6 px-4 rounded-2xl bg-[#1b1c22] border border-dashed border-white/10">
            <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400">
              <Plus className="w-6 h-6" />
            </div>
            <p className="text-white text-sm font-semibold">No wallets yet</p>
            <p className="text-slate-400 text-xs mt-1 mb-3">
              Add your Cash wallet to start tracking your daily expenses
            </p>
            <button
              onClick={() => setIsWalletModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-bold text-xs transition-colors shadow-md cursor-pointer"
              style={{
                backgroundColor: currentColor.primary,
                boxShadow: `0 4px 14px ${currentColor.glow}`,
              }}
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Create Cash Wallet
            </button>
          </div>
        )}
      </div>

      {/* ── Report This Month Card & Line Chart matching Screenshot 1 ───── */}
      <MonthlySpendingReportChart
        currentTransactions={currentMonthTransactions}
        previousTransactions={previousMonthTransactions}
        totalIncome={totalIncomeConverted}
        totalExpense={totalExpenseConverted}
        globalCurrency={globalCurrency}
        monthYear={monthYear}
      />

      {/* ── Budgets Overview on Home Page ─────────────────────────────────── */}
      <div className="money-card p-5 bg-[#141519] border border-white/8 rounded-3xl shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" style={{ color: currentColor.primaryLight }} />
            <h3 className="text-white text-base font-bold tracking-tight">Budgets Report</h3>
          </div>
          <Link
            href="/budgets"
            className="text-xs font-semibold tracking-wide transition-colors"
            style={{ color: currentColor.primaryLight }}
          >
            See all
          </Link>
        </div>

        {budgets.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-400">
            <p>No active budgets set for this month</p>
            <Link
              href="/budgets"
              className="mt-2 inline-block hover:underline font-semibold"
              style={{ color: currentColor.primaryLight }}
            >
              + Create a category budget
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {budgets.slice(0, 5).map((b) => (
              <Link
                key={b._id}
                href={`/budgets/${b._id}`}
                className="block p-3 rounded-2xl bg-[#1b1c22] border border-white/5 hover:border-white/12 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <BudgetCategoryIcons icons={getBudgetCategoryIcons(b)} size="sm" />
                    <span className="text-white font-semibold truncate">
                      {getBudgetDisplayName(b)}
                    </span>
                  </div>
                  <span className="text-slate-400 font-medium flex-shrink-0">
                    {formatMoney(b.spent, b.currency || globalCurrency)} / {formatMoney(b.amountLimit, b.currency || globalCurrency)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${b.percentUsed}%`,
                      backgroundColor:
                        b.percentUsed > 90 ? "#ef4444" : b.percentUsed > 70 ? "#f59e0b" : currentColor.primary,
                    }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Activity ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-white text-base font-bold tracking-tight">Recent Activity</h3>
          <Link
            href="/transactions"
            className="text-xs font-semibold tracking-wide transition-colors"
            style={{ color: currentColor.primaryLight }}
          >
            See all
          </Link>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-8 money-card rounded-3xl bg-[#141519] border border-white/8 text-slate-500 text-sm">
            <p>No transactions yet</p>
            <button
              onClick={openModal}
              className="mt-2 inline-flex items-center gap-1 hover:underline text-xs font-semibold cursor-pointer"
              style={{ color: currentColor.primaryLight }}
            >
              <Plus className="w-3.5 h-3.5" /> Add your first transaction
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((tx) => {
              const isExpense = tx.type === "EXPENSE";
              const isIncome = tx.type === "INCOME";
              const displayAmt = tx.convertedAmount !== undefined ? tx.convertedAmount : tx.amount;
              const showOriginal = tx.currency !== globalCurrency;

              return (
                <Link
                  key={tx._id}
                  href={`/transactions/${tx._id}`}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-[#16171b] border border-white/6 hover:border-white/15 hover:bg-white/5 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon categoryId={tx.category} subCategoryId={tx.subCategory} size="md" />
                    <div>
                      <p className="text-white font-semibold text-sm truncate max-w-[180px] transition-colors">
                        {tx.title || getCategoryDisplayName(tx.category, tx.subCategory)}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {new Date(tx.date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={`font-extrabold text-sm ${
                        isIncome ? "text-emerald-400" : isExpense ? "text-red-400" : "text-amber-400"
                      }`}
                    >
                      {isIncome ? "+" : isExpense ? "-" : ""}
                      {formatMoney(displayAmt, globalCurrency)}
                    </p>
                    {showOriginal && (
                      <p className="text-[10px] text-slate-500 font-medium">
                        {isIncome ? "+" : isExpense ? "-" : ""}
                        {formatMoney(tx.amount, tx.currency)}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Global Currency Modal */}
      <GlobalCurrencyModal
        isOpen={isCurrencyModalOpen}
        onClose={() => setIsCurrencyModalOpen(false)}
        currentCurrency={globalCurrency}
        isOnboarding={user.hasCompletedOnboarding === false}
      />

      {/* Wallet Manager Modal */}
      <WalletManagerModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        wallets={walletList}
        onWalletUpdated={(updated) => {
          if (updated && Array.isArray(updated)) {
            setWalletList(updated);
          }
        }}
      />
    </div>
  );
}
