"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  HelpCircle,
  ChevronRight,
  Wallet as WalletIcon,
  Briefcase,
  Globe2,
  LogOut,
  Palette,
  Camera,
  CheckCircle2,
  AlertCircle,
  Calculator,
} from "lucide-react";
import GlobalCurrencyModal from "@/components/admin/GlobalCurrencyModal";
import WalletManagerModal from "@/components/admin/WalletManagerModal";
import ThemeColorModal from "@/components/ThemeColorModal";
import ProfileColorModal, { getProfilePresetByGradient } from "@/components/admin/ProfileColorModal";
import { CURRENCY_INFO, SupportedCurrency } from "@/lib/currency";
import CurrencyFlag from "@/components/admin/CurrencyFlag";
import { useTheme } from "@/context/ThemeContext";
import { GoogleIcon } from "@/components/ui/AppIcons";
import PageLoading from "@/components/ui/PageLoading";

interface Wallet {
  _id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  isDefault?: boolean;
}

export default function AccountPage() {
  const [userName, setUserName] = useState("Declane");
  const [userEmail, setUserEmail] = useState("declane.docs@gmail.com");
  const [baseCurrency, setBaseCurrency] = useState("IDR");
  const [profileColor, setProfileColor] = useState("from-pink-500 to-rose-400");
  const [userImage, setUserImage] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [authProvider, setAuthProvider] = useState<"credentials" | "google">("credentials");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isProfileColorModalOpen, setIsProfileColorModalOpen] = useState(false);
  const { currentColor, resetColor } = useTheme();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cachedColor = localStorage.getItem("dclne_profile_color");
      if (cachedColor) setProfileColor(cachedColor);
      const cachedImage = localStorage.getItem("dclne_profile_image");
      if (cachedImage) setUserImage(cachedImage);
    }

    const handleColorChange = (e: CustomEvent<string>) => {
      if (e.detail) setProfileColor(e.detail);
    };
    const handleImageChange = (e: CustomEvent<string | null>) => {
      setUserImage(e.detail);
    };

    window.addEventListener("profile-color-changed", handleColorChange as EventListener);
    window.addEventListener("profile-image-changed", handleImageChange as EventListener);

    Promise.all([
      fetch("/api/finance/user").then((r) => r.json()).catch(() => ({})),
      fetch("/api/finance/wallets").then((r) => r.json()).catch(() => ({})),
    ]).then(([userData, walletData]) => {
      if (userData.user) {
        setUserName(userData.user.name || "Declane");
        setUserEmail(userData.user.email || "declane.docs@gmail.com");
        setIsVerified(Boolean(userData.user.isVerified));
        setAuthProvider(userData.user.authProvider || "credentials");
        if (userData.user.baseCurrency) setBaseCurrency(userData.user.baseCurrency);
        if (userData.user.profileColor) {
          setProfileColor(userData.user.profileColor);
          if (typeof window !== "undefined") {
            localStorage.setItem("dclne_profile_color", userData.user.profileColor);
          }
        }
        if (userData.user.image !== undefined) {
          setUserImage(userData.user.image);
          if (typeof window !== "undefined") {
            if (userData.user.image) {
              localStorage.setItem("dclne_profile_image", userData.user.image);
            } else {
              localStorage.removeItem("dclne_profile_image");
            }
          }
        }
      }
      setWallets(walletData.wallets ?? []);
      setLoading(false);
    });

    return () => {
      window.removeEventListener("profile-color-changed", handleColorChange as EventListener);
      window.removeEventListener("profile-image-changed", handleImageChange as EventListener);
    };
  }, []);

  if (loading) {
    return (
      <PageLoading
        title="Loading Account..."
        subtitle="Fetching your profile & settings"
      />
    );
  }

  const firstInitial = (userName?.[0] || "D").toUpperCase();
  const profilePreset = getProfilePresetByGradient(profileColor);
  const currencyMeta = CURRENCY_INFO[baseCurrency as SupportedCurrency] || {
    symbol: baseCurrency,
    flag: "🌐",
    name: baseCurrency,
  };

  return (
    <div className="px-4 pt-3 pb-nav-safe max-w-lg mx-auto space-y-5">
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between py-1">
        <h1 className="text-white text-2xl font-bold tracking-tight">Account &amp; Settings</h1>
        <Link
          href="/account/help"
          className="flex items-center gap-1.5 text-slate-400 hover:text-white cursor-pointer transition-colors"
        >
          <span className="text-xs font-semibold">Support</span>
          <HelpCircle className="w-4 h-4" />
        </Link>
      </div>

      {/* ── User Profile Card (Clickable to My Account page) ───────────────────────── */}
      <div className="block money-card p-6 bg-[#141519] border border-white/8 hover:border-white/15 rounded-3xl text-center relative overflow-hidden shadow-xl transition-all group">
        {/* Dynamic circular avatar with picture / letter and change profile trigger */}
        <div className="relative mx-auto w-20 h-20 mb-3 flex items-center justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsProfileColorModalOpen(true);
            }}
            className="relative cursor-pointer group/avatar focus:outline-none"
            title="Click to customize profile avatar & picture"
          >
            <div
              className={`w-20 h-20 rounded-full bg-gradient-to-tr ${profileColor} flex items-center justify-center text-white text-3xl font-extrabold shadow-lg transition-transform group-hover/avatar:scale-105 overflow-hidden ${
                userImage ? "p-0.5" : ""
              }`}
              style={{
                boxShadow: `0 8px 22px -2px ${profilePreset.glow}`,
              }}
            >
              {userImage ? (
                <img
                  src={userImage}
                  alt={userName}
                  className="w-full h-full rounded-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setUserImage(null)}
                />
              ) : (
                <span>{firstInitial}</span>
              )}
            </div>
            <div
              className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#1b1d24] border border-white/20 flex items-center justify-center text-white shadow-md group-hover/avatar:border-white transition-all"
              style={{
                borderColor: profilePreset.accentColor ? `${profilePreset.accentColor}55` : undefined,
                boxShadow: `0 2px 8px ${profilePreset.glow}`,
              }}
            >
              {userImage ? (
                <Camera className="w-3 h-3 transition-colors duration-300" style={{ color: profilePreset.accentColor }} />
              ) : (
                <Palette className="w-3 h-3 transition-colors duration-300" style={{ color: profilePreset.accentColor }} />
              )}
            </div>
          </button>
        </div>

        {/* User Name & Email */}
        <Link href="/account/my-account" className="block cursor-pointer">
          <h2 className="text-white font-extrabold text-lg tracking-tight hover:text-[var(--color-primary-light)] transition-colors">
            {userName}
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">{userEmail}</p>

          {/* Account Status Badge: Google Icon or Verified / Unverified */}
          <div className="mt-2 flex items-center justify-center">
            {authProvider === "google" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-200 text-[11px] font-medium shadow-sm">
                <GoogleIcon className="w-3.5 h-3.5 flex-shrink-0" />
              </span>
            ) : isVerified ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-medium shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                <span>Verified</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px] font-medium shadow-sm">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                <span>Unverified</span>
              </span>
            )}
          </div>

          <div className="mt-3.5 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 text-[11px] font-semibold text-slate-300 hover:bg-white/10 transition-colors">
            <span>Manage Account</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>

      {/* ── Menu List Items ─────────────────────────────────────────────── */}
      <div className="money-card bg-[#141519] border border-white/8 rounded-3xl divide-y divide-white/5 overflow-hidden shadow-lg">
        {/* Primary Theme Color Menu */}
        <button
          onClick={() => setIsThemeModalOpen(true)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/3 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-sm"
              style={{
                backgroundColor: currentColor.subtle,
                color: currentColor.primaryLight,
                border: `1px solid ${currentColor.border}`,
              }}
            >
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-white font-semibold text-sm">Theme Color</p>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                  style={{
                    backgroundColor: currentColor.subtle,
                    color: currentColor.primaryLight,
                    border: `1px solid ${currentColor.border}`,
                  }}
                >
                  {currentColor.name}
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: currentColor.primary }}
                />
                <span>{currentColor.description}</span>
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </button>

        {/* My Wallets */}
        <button
          onClick={() => setIsWalletModalOpen(true)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/3 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
              <WalletIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">My Wallets</p>
              <p className="text-slate-400 text-xs">
                {wallets.length} {wallets.length === 1 ? "wallet" : "wallets"} connected
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </button>

        {/* Global Currency Selector */}
        <button
          onClick={() => setIsCurrencyModalOpen(true)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/3 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{
                backgroundColor: currentColor.subtle,
                color: currentColor.primaryLight,
              }}
            >
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Global Currency</p>
              <p className="text-slate-400 text-xs flex items-center gap-1.5 mt-0.5">
                <CurrencyFlag flag={currencyMeta.flag} code={baseCurrency} className="text-sm" />
                <span>{baseCurrency} ({currencyMeta.symbol})</span>
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </button>

        {/* Money Converter Calculator */}
        <Link
          href="/account/converter"
          className="flex items-center justify-between p-4 hover:bg-white/3 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{
                backgroundColor: currentColor.subtle,
                color: currentColor.primaryLight,
              }}
            >
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Money Converter</p>
              <p className="text-slate-400 text-xs">Live exchange rates &amp; calculator</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </Link>

        {/* Events & Travels */}
        <Link
          href="/events"
          className="flex items-center justify-between p-4 hover:bg-white/3 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="text-white font-semibold text-sm">Events &amp; Travels</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </Link>

        {/* Support */}
        <Link
          href="/account/help"
          className="flex items-center justify-between p-4 hover:bg-white/3 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
              <HelpCircle className="w-5 h-5" />
            </div>
            <span className="text-white font-semibold text-sm">Support</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </Link>

        {/* Sign Out */}
        <button
          onClick={() => { resetColor(); signOut({ callbackUrl: "/auth/signin" }); }}
          className="w-full flex items-center justify-between p-4 hover:bg-red-500/5 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <LogOut className="w-5 h-5" />
            </div>
            <span className="text-red-400 font-semibold text-sm">Sign out</span>
          </div>
          <ChevronRight className="w-5 h-5 text-red-400/50" />
        </button>
      </div>

      {/* Global Currency Modal */}
      <GlobalCurrencyModal
        isOpen={isCurrencyModalOpen}
        onClose={() => setIsCurrencyModalOpen(false)}
        currentCurrency={baseCurrency}
        onCurrencyChanged={(c) => setBaseCurrency(c)}
      />

      {/* Wallet Manager Modal */}
      <WalletManagerModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        wallets={wallets}
        onWalletUpdated={() => {
          fetch("/api/finance/wallets")
            .then((r) => r.json())
            .then((d) => setWallets(d.wallets ?? []));
        }}
      />

      {/* Theme Color Settings Modal */}
      <ThemeColorModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />

      {/* Profile Avatar & Color Settings Modal */}
      <ProfileColorModal
        isOpen={isProfileColorModalOpen}
        onClose={() => setIsProfileColorModalOpen(false)}
        currentColor={profileColor}
        currentImage={userImage}
        userName={userName}
        onColorChange={(newColor) => setProfileColor(newColor)}
        onImageChange={(newImage) => setUserImage(newImage)}
      />
    </div>
  );
}
