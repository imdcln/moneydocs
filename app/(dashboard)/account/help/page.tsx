"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  LifeBuoy,
  Globe,
  Mail,
  ExternalLink,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import PageLoading from "@/components/ui/PageLoading";
import { useState, useEffect } from "react";

export default function HelpPage() {
  const { currentColor, isThemeLoaded } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !isThemeLoaded) {
    return <PageLoading title="Loading Help..." subtitle="Preparing support options" />;
  }

  return (
    <div className="px-4 pt-3 pb-nav-safe max-w-lg mx-auto space-y-6">
      {/* ── Top Bar with Left Arrow & 'Help' Title ────────────────────────── */}
      <div className="flex items-center justify-between py-1">
        <Link
          href="/account"
          className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          title="Back to Account"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-white text-lg font-bold tracking-tight">Help</h1>
        <div className="w-9" />
      </div>

      {/* ── Hero / Help Banner ───────────────────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-[#181a20] to-[#121317] border border-white/8 relative overflow-hidden shadow-xl">
        <div className="relative z-10 space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold text-slate-300">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Support &amp; Community</span>
          </div>
          <h2 className="text-white font-extrabold text-lg tracking-tight">
            How can we help you?
          </h2>
          <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
            Need assistance, discovered a bug, or want to explore developer works? Select an option below.
          </p>
        </div>

        {/* Ambient glow */}
        <div
          className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: currentColor.primary }}
        />
      </div>

      {/* ── Two Required Items Menu Card ─────────────────────────────────── */}
      <div className="money-card bg-[#141519] border border-white/8 rounded-3xl divide-y divide-white/5 overflow-hidden shadow-lg">
        {/* Item 1: Get support */}
        <Link
          href="/account/help/support"
          className="flex items-center justify-between p-4 hover:bg-white/3 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3.5">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm"
              style={{
                backgroundColor: currentColor.subtle,
                color: currentColor.primaryLight,
                border: `1px solid ${currentColor.border}`,
              }}
            >
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm group-hover:text-[var(--color-primary-light)] transition-colors">
                Get support
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                Report an issue, request features &amp; view tickets
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        {/* Item 2: Developer page */}
        <a
          href="https://dclnedocs.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-4 hover:bg-white/3 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-white font-semibold text-sm group-hover:text-indigo-300 transition-colors">
                  Developer page
                </p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                  Portfolio
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                Visit developer's personal information
              </p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
        </a>
      </div>

      {/* ── Direct Contact & Mail Option ─────────────────────────────────── */}
      <div className="p-4 rounded-3xl bg-[#141519] border border-white/8 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
            <Mail className="w-4 h-4 text-emerald-400" />
            <span>Direct Developer Email</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Official</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-2xl bg-black/30 border border-white/5">
          <div className="truncate mr-2">
            <p className="text-white font-medium text-xs truncate">
              declane.docs@gmail.com
            </p>
            <p className="text-slate-500 text-[11px]">
              Response within 24–48 hours
            </p>
          </div>
          <a
            href="mailto:declane.docs@gmail.com?subject=Money%20Docs%20Help%20Inquiry"
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors shrink-0"
          >
            Send Mail
          </a>
        </div>
      </div>

      {/* ── Version and System Details ───────────────────────────────────── */}
      <div className="text-center pt-2 pb-4 space-y-1 text-slate-500 text-[11px]">
        <p className="font-semibold text-slate-400">Money Docs • v2.3</p>
        <p>Crafted by Declane with Next.js &amp; Tailwind CSS</p>
      </div>
    </div>
  );
}
