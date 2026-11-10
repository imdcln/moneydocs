"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MoneyConverterCalculator from "@/components/admin/MoneyConverterCalculator";

export default function ConverterPage() {
  const [userBaseCurrency, setUserBaseCurrency] = useState("IDR");

  useEffect(() => {
    let ignore = false;
    fetch("/api/finance/user")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data?.user?.baseCurrency) {
          setUserBaseCurrency(data.user.baseCurrency);
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="px-4 pt-3 pb-nav-safe max-w-lg mx-auto space-y-4">
      {/* ── Top Bar with Back Arrow & Title ────────────────────────────── */}
      <div className="flex items-center justify-between py-1">
        <Link
          href="/account"
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Back to Account"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-white text-lg font-bold tracking-tight">Money Converter</h1>
        <div className="w-9" />
      </div>

      {/* ── Money Converter Calculator Component ────────────────────────── */}
      <MoneyConverterCalculator
        defaultFrom="TWD"
        defaultTo={userBaseCurrency || "IDR"}
        userBaseCurrency={userBaseCurrency}
      />
    </div>
  );
}
