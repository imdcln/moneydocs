"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, Plus, Layers, User } from "lucide-react";
import { motion } from "framer-motion";
import { useAdminModal } from "@/hooks/useAdminModal";

export default function BottomNav() {
  const pathname = usePathname();
  const { openModal } = useAdminModal();

  const isHome = pathname === "/";
  const isTransactions = pathname === "/transactions";
  const isBudgets = pathname.startsWith("/budgets");
  const isAccount = pathname.startsWith("/account");

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
            onClick={openModal}
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl border-4 border-[#0c0d10] active:scale-95 transition-all cursor-pointer"
            style={{
              backgroundColor: "var(--color-primary)",
              boxShadow: "0 10px 25px -4px var(--color-primary-glow)",
            }}
            aria-label="Add transaction"
          >
            <Plus className="w-7 h-7 text-white stroke-[2.5]" />
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
