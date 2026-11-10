"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, Plus, Layers, User, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useAdminModal } from "@/hooks/useAdminModal";
import { useWalletContext } from "@/hooks/useWalletContext";
import { useToast } from "@/components/ui/Toast";

export default function BottomNav() {
  const pathname = usePathname();
  const { openModal } = useAdminModal();
  const { activeWalletPermissions, selectedWalletId } = useWalletContext();
  const { toast } = useToast();

  const isHome = pathname === "/";
  const isTransactions = pathname === "/transactions";
  const isBudgets = pathname.startsWith("/budgets");
  const isAccount = pathname.startsWith("/account");

  const canCreate = activeWalletPermissions.transactions.create;

  const handleFabClick = () => {
    if (!canCreate) {
      toast("You do not have permission to add transactions to this wallet", "error");
      return;
    }
    openModal();
  };

  // Hide BottomNav on transaction and budget detail/transactions subpages
  if (
    (pathname.startsWith("/transactions/") &&
      pathname !== "/transactions/report") ||
    pathname.startsWith("/budgets/")
  ) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#101115]/95 backdrop-blur-xl border-t border-white/8 pb-safe shadow-2xl">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-1.5 relative">
        {/* Tab 1: Home */}
        <Link href="/" className="flex-1">
          <div
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors ${
              isHome ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Home className="w-5 h-5" strokeWidth={isHome ? 2.5 : 2} />
            <span
              className={`text-[10px] tracking-wide mt-1 font-semibold ${
                isHome ? "text-white" : "text-slate-500"
              }`}
            >
              Home
            </span>
          </div>
        </Link>

        {/* Tab 2: Transactions */}
        <Link href="/transactions" className="flex-1">
          <div
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors ${
              isTransactions ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Wallet className="w-5 h-5" strokeWidth={isTransactions ? 2.5 : 2} />
            <span
              className={`text-[10px] tracking-wide mt-1 font-semibold ${
                isTransactions ? "text-white" : "text-slate-500"
              }`}
            >
              Transactions
            </span>
          </div>
        </Link>

        {/* Center Floating Action Button (+) */}
        <div className="flex-1 flex justify-center -mt-6">
          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            onClick={handleFabClick}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl border-4 border-[#0c0d10] active:scale-95 transition-all cursor-pointer relative ${
              !canCreate ? "opacity-85" : ""
            }`}
            style={{
              backgroundColor: canCreate ? "var(--color-primary)" : "#222530",
              boxShadow: canCreate
                ? "0 10px 25px -4px var(--color-primary-glow)"
                : "0 6px 18px -4px rgba(0, 0, 0, 0.6)",
            }}
            aria-label={canCreate ? "Add transaction" : "Transaction creation locked"}
            title={canCreate ? "Add transaction" : "Creation locked for this wallet"}
          >
            {canCreate ? (
              <Plus className="w-7 h-7 text-white stroke-[2.5]" />
            ) : (
              <div className="relative flex items-center justify-center">
                <Plus className="w-6 h-6 text-slate-500 stroke-[2] opacity-40" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shadow-md">
                    <Lock className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />
                  </div>
                </div>
              </div>
            )}
          </motion.button>
        </div>

        {/* Tab 3: Budgets */}
        <Link href="/budgets" className="flex-1">
          <div
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors ${
              isBudgets ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Layers className="w-5 h-5" strokeWidth={isBudgets ? 2.5 : 2} />
            <span
              className={`text-[10px] tracking-wide mt-1 font-semibold ${
                isBudgets ? "text-white" : "text-slate-500"
              }`}
            >
              Budgets
            </span>
          </div>
        </Link>

        {/* Tab 4: Account */}
        <Link href="/account" className="flex-1">
          <div
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors ${
              isAccount ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <User className="w-5 h-5" strokeWidth={isAccount ? 2.5 : 2} />
            <span
              className={`text-[10px] tracking-wide mt-1 font-semibold ${
                isAccount ? "text-white" : "text-slate-500"
              }`}
            >
              Account
            </span>
          </div>
        </Link>
      </div>
    </nav>
  );
}
