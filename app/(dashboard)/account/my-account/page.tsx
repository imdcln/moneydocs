"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ArrowLeft,
  RefreshCw,
  Smartphone,
  Monitor,
  Key,
  Sliders,
  Trash2,
  LogOut,
  X,
  Check,
  AlertTriangle,
  Palette,
  Camera,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Mail,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import ThemeColorModal from "@/components/ThemeColorModal";
import ProfileColorModal, { getProfilePresetByGradient } from "@/components/admin/ProfileColorModal";
import { useTheme } from "@/context/ThemeContext";
import { GoogleIcon } from "@/components/ui/AppIcons";
import PageLoading from "@/components/ui/PageLoading";
import { getClientDeviceId } from "@/lib/clientDevice";

interface Device {
  deviceId: string;
  name: string;
  type: string;
  lastActive: string;
  isCurrent?: boolean;
}

interface OtpBoxesProps {
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
  accentColor: string;
  accentBorder: string;
  accentGlow: string;
}

function OtpBoxes({ value, onChange, disabled, accentColor, accentBorder, accentGlow }: OtpBoxesProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Backspace") {
      if (value[idx]) {
        const next = [...value];
        next[idx] = "";
        onChange(next);
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus();
        const next = [...value];
        next[idx - 1] = "";
        onChange(next);
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && idx > 0) {
      refs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < 5) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) return;
    if (raw.length > 1) {
      const digits = raw.slice(0, 6 - idx).split("");
      const next = [...value];
      digits.forEach((d, i) => {
        if (idx + i < 6) next[idx + i] = d;
      });
      onChange(next);
      const focusIdx = Math.min(idx + digits.length, 5);
      refs.current[focusIdx]?.focus();
      return;
    }
    const next = [...value];
    next[idx] = raw[0];
    onChange(next);
    if (idx < 5) refs.current[idx + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, idx: number) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...value];
    pasted.split("").forEach((d, i) => {
      if (idx + i < 6) next[idx + i] = d;
    });
    onChange(next);
    const focusIdx = Math.min(idx + pasted.length, 5);
    refs.current[focusIdx]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center py-2">
      {value.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => { refs.current[idx] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(e, idx)}
          onKeyDown={(e) => handleKey(e, idx)}
          onPaste={(e) => handlePaste(e, idx)}
          onFocus={(e) => e.target.select()}
          className="w-11 h-13 text-center text-xl font-bold rounded-xl bg-slate-900/70 text-white border transition-all duration-150 outline-none disabled:opacity-40 select-none"
          style={{
            borderColor: digit ? accentColor : "rgba(255,255,255,0.12)",
            boxShadow: digit ? `0 0 0 1px ${accentBorder}, 0 4px 12px ${accentGlow}` : "none",
          }}
        />
      ))}
    </div>
  );
}

export default function MyAccountPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [userName, setUserName] = useState("Declane");
  const [userEmail, setUserEmail] = useState("declanecun@gmail.com");
  const [profileColor, setProfileColor] = useState("from-pink-500 to-rose-400");
  const [userImage, setUserImage] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [emailOtpEnabled, setEmailOtpEnabled] = useState(false);
  const [otpToggleLoading, setOtpToggleLoading] = useState(false);
  const [showOtpConfirmModal, setShowOtpConfirmModal] = useState(false);
  const [otpConfirmAction, setOtpConfirmAction] = useState<"enable" | "disable">("enable");
  const [authProvider, setAuthProvider] = useState<"credentials" | "google">("credentials");
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceCount, setDeviceCount] = useState(1);
  const [maxDevices, setMaxDevices] = useState(5);
  const [refreshingDevices, setRefreshingDevices] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showProfileColorModal, setShowProfileColorModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [removeDeviceConfirm, setRemoveDeviceConfirm] = useState<string | null>(null);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const { currentColor, resetColor } = useTheme();

  // Verification state
  const [verifyDigits, setVerifyDigits] = useState<string[]>(Array(6).fill(""));
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [sendErrorFallback, setSendErrorFallback] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState("");

  // Reset Account Confirmation with 5s countdown & password
  const [resetCountdown, setResetCountdown] = useState(5);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");

  // Delete Account Confirmation with 5s countdown & password
  const [deleteCountdown, setDeleteCountdown] = useState(5);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // Password Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Action Loading
  const [actionLoading, setActionLoading] = useState(false);

  // Cooldown timer for verification resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const fetchUserData = () => {
    // Check localStorage cache first
    if (typeof window !== "undefined") {
      const cachedColor = localStorage.getItem("dclne_profile_color");
      if (cachedColor) setProfileColor(cachedColor);
      const cachedImage = localStorage.getItem("dclne_profile_image");
      if (cachedImage) setUserImage(cachedImage);
    }

    fetch("/api/finance/user")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setUserName(d.user.name || "Declane");
          setUserEmail(d.user.email || "declanecun@gmail.com");
          setIsVerified(Boolean(d.user.isVerified));
          setEmailOtpEnabled(Boolean(d.user.emailOtpEnabled));
          setAuthProvider(d.user.authProvider || "credentials");
          if (d.user.profileColor) {
            setProfileColor(d.user.profileColor);
            if (typeof window !== "undefined") {
              localStorage.setItem("dclne_profile_color", d.user.profileColor);
            }
          }
          if (d.user.image !== undefined) {
            setUserImage(d.user.image);
            if (typeof window !== "undefined") {
              if (d.user.image) {
                localStorage.setItem("dclne_profile_image", d.user.image);
              } else {
                localStorage.removeItem("dclne_profile_image");
              }
            }
          }
        }
      })
      .catch(() => {});
  };

  const fetchDevices = () => {
    setRefreshingDevices(true);
    const clientDeviceId = getClientDeviceId();
    fetch("/api/finance/user/devices", {
      headers: clientDeviceId ? { "x-device-id": clientDeviceId } : {},
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.devices) {
          setDevices(d.devices);
          setDeviceCount(d.count || d.devices.length);
          setMaxDevices(d.maxDevices || 5);
        }
      })
      .catch(() => {})
      .finally(() => setRefreshingDevices(false));
  };

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

    const clientDeviceId = getClientDeviceId();
    Promise.all([
      fetch("/api/finance/user").then((r) => r.json()).catch(() => ({})),
      fetch("/api/finance/user/devices", {
        headers: clientDeviceId ? { "x-device-id": clientDeviceId } : {},
      }).then((r) => r.json()).catch(() => ({})),
    ]).then(([userData, deviceData]) => {
      if (userData.user) {
        setUserName(userData.user.name || "Declane");
        setUserEmail(userData.user.email || "declanecun@gmail.com");
        setIsVerified(Boolean(userData.user.isVerified));
        setEmailOtpEnabled(Boolean(userData.user.emailOtpEnabled));
        setAuthProvider(userData.user.authProvider || "credentials");
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
      if (deviceData.devices) {
        setDevices(deviceData.devices);
        setDeviceCount(deviceData.devices.length);
      }
      setPageLoading(false);
    });

    return () => {
      window.removeEventListener("profile-color-changed", handleColorChange as EventListener);
      window.removeEventListener("profile-image-changed", handleImageChange as EventListener);
    };
  }, []);

  const handleSendVerificationCode = async () => {
    setSendingCode(true);
    setVerifyError("");
    setSendErrorFallback(false);

    try {
      const res = await fetch("/api/finance/user/send-verification", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setCodeSent(true);
        setResendCooldown(60);
        toast(data.message || "Verification code sent to your email.", "success");
      } else {
        setSendErrorFallback(true);
        setVerifyError(data.error || "Unable to send verification code. Email service could not be reached.");
      }
    } catch {
      setSendErrorFallback(true);
      setVerifyError("Network error. Unable to reach the server to send verification code.");
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = verifyDigits.join("");
    if (code.length !== 6) {
      setVerifyError("Please enter the full 6-digit code.");
      return;
    }

    setVerifyLoading(true);
    setVerifyError("");
    setVerifySuccess("");

    try {
      const res = await fetch("/api/finance/user/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setVerifySuccess("Email verified successfully!");
        setIsVerified(true);
        toast("Your account is now verified!", "success");
        setTimeout(() => {
          setShowVerifyModal(false);
          setVerifyDigits(Array(6).fill(""));
          setVerifySuccess("");
          setCodeSent(false);
        }, 1500);
      } else {
        setVerifyError(data.error || "Invalid or expired code.");
      }
    } catch {
      setVerifyError("Network error. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordLoading(true);
    setPasswordError("");
    setPasswordSuccess("");

    try {
      const res = await fetch("/api/finance/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordSuccess("Password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setShowPasswordModal(false), 1500);
      } else {
        setPasswordError(data.error || "Failed to update password.");
      }
    } catch {
      setPasswordError("Network error.");
    } finally {
      setPasswordLoading(false);
    }
  };

  // Countdown timers for Reset & Delete Account
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showResetModal) {
      setResetCountdown(5);
      setResetPassword("");
      setResetError("");
      timer = setInterval(() => {
        setResetCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showResetModal]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showDeleteModal) {
      setDeleteCountdown(5);
      setDeletePassword("");
      setDeleteError("");
      timer = setInterval(() => {
        setDeleteCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showDeleteModal]);

  const handleResetAccount = async () => {
    if (resetCountdown > 0) return;
    if (!resetPassword.trim()) {
      setResetError("Please enter your password to confirm.");
      return;
    }
    setActionLoading(true);
    setResetError("");
    try {
      const res = await fetch("/api/finance/user/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowResetModal(false);
        toast("Account data has been reset.", "success");
        router.push("/");
        router.refresh();
      } else {
        setResetError(data.error || "Failed to reset account.");
        toast(data.error || "Failed to reset account.", "error");
      }
    } catch {
      setResetError("Network error. Please try again.");
      toast("Network error.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteCountdown > 0) return;
    if (!deletePassword.trim()) {
      setDeleteError("Please enter your password to confirm.");
      return;
    }
    setActionLoading(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/finance/user/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (res.ok) {
        resetColor();
        signOut({ callbackUrl: "/auth/signin" });
      } else {
        setDeleteError(data.error || "Failed to delete account.");
        toast(data.error || "Failed to delete account.", "error");
      }
    } catch {
      setDeleteError("Network error. Please try again.");
      toast("Network error.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    setRemoveDeviceConfirm(deviceId);
  };

  const confirmRemoveDevice = async () => {
    if (!removeDeviceConfirm) return;
    const targetId = removeDeviceConfirm;
    setRemoveDeviceConfirm(null);

    // Optimistically remove from UI immediately for snappy UX
    setDevices((prev) => prev.filter((d) => d.deviceId !== targetId));
    setDeviceCount((prev) => Math.max(1, prev - 1));

    try {
      const clientDeviceId = getClientDeviceId();
      const res = await fetch(`/api/finance/user/devices?deviceId=${encodeURIComponent(targetId)}`, {
        method: "DELETE",
        headers: clientDeviceId ? { "x-device-id": clientDeviceId } : {},
      });
      if (res.ok) {
        toast("Device disconnected. Session terminated.", "success");
        fetchDevices();
      } else {
        toast("Failed to disconnect device.", "error");
        fetchDevices();
      }
    } catch {
      toast("Failed to disconnect device.", "error");
      fetchDevices();
    }
  };

  const handleToggleOtp = async (enable: boolean) => {
    setOtpToggleLoading(true);
    try {
      const res = await fetch("/api/finance/user/email-otp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: enable }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEmailOtpEnabled(enable);
        toast(
          enable
            ? "Email OTP login has been enabled."
            : "Email OTP login has been disabled.",
          "success"
        );
      } else {
        toast(data.error || "Failed to update Email OTP setting.", "error");
      }
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setOtpToggleLoading(false);
      setShowOtpConfirmModal(false);
    }
  };

  if (pageLoading) {
    return (
      <PageLoading
        title="Loading Account Details..."
        subtitle="Fetching security & device settings"
      />
    );
  }

  const firstInitial = (userName?.[0] || "D").toUpperCase();
  const profilePreset = getProfilePresetByGradient(profileColor);

  return (
    <div className="text-white px-4 pt-3 pb-nav-safe max-w-lg mx-auto space-y-6">
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between py-1">
          <Link
            href="/account"
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-white text-lg font-bold">My Account</h1>
          <div className="w-9" />
        </div>

        {/* Profile Card with Avatar & Verification Badge */}
        <div className="text-center py-2">
          {/* Avatar with dynamic profile gradient & user picture, click to change */}
          <div className="relative mx-auto w-24 h-24 mb-3 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setShowProfileColorModal(true)}
              className="relative group cursor-pointer focus:outline-none"
              title="Click to customize profile avatar & picture"
            >
              <div
                className={`w-22 h-22 rounded-full bg-gradient-to-tr ${profileColor} flex items-center justify-center text-white text-4xl font-extrabold shadow-xl transition-all duration-300 group-hover:scale-105 group-active:scale-95 overflow-hidden ${
                  userImage ? "p-0.5" : ""
                }`}
                style={{
                  boxShadow: `0 10px 25px -4px ${profilePreset.glow}`,
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
              {/* Palette / Camera edit badge */}
              <div
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#1b1d24] border border-white/20 flex items-center justify-center text-white shadow-lg group-hover:border-[var(--color-primary-light)] group-hover:bg-[var(--color-primary)] transition-all"
                style={{
                  borderColor: profilePreset.accentColor ? `${profilePreset.accentColor}55` : undefined,
                  boxShadow: `0 2px 8px ${profilePreset.glow}`,
                }}
              >
                {userImage ? (
                  <Camera className="w-3.5 h-3.5 transition-colors duration-300" style={{ color: profilePreset.accentColor }} />
                ) : (
                  <Palette className="w-3.5 h-3.5 transition-colors duration-300" style={{ color: profilePreset.accentColor }} />
                )}
              </div>
            </button>
            {/* Decorative Ribbon Wings */}
            <div className="absolute -bottom-1 w-28 h-6 bg-[#262832] rounded-full border border-white/10 -z-10 flex items-center justify-center shadow-md pointer-events-none">
              <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-300">
                ACTIVE
              </span>
            </div>
          </div>

          <h2 className="text-white font-extrabold text-xl mt-3 tracking-tight">
            {userName}
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">{userEmail}</p>

          {/* Account Status Badge: Google Icon or Verified / Unverified */}
          <div className="mt-2.5 flex items-center justify-center">
            {authProvider === "google" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/6 border border-white/10 text-slate-200 text-xs font-medium shadow-sm">
                <GoogleIcon className="w-3.5 h-3.5 flex-shrink-0" />
              </span>
            ) : isVerified ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-medium shadow-sm">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                <span>Verified</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowVerifyModal(true);
                  if (!codeSent && resendCooldown === 0) handleSendVerificationCode();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-400 text-xs font-medium transition-colors cursor-pointer shadow-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>Unverified &bull; Verify Now</span>
              </button>
            )}
          </div>
          {/* <button
            type="button"
            onClick={() => setShowProfileColorModal(true)}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/8 text-[11px] font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <Palette className="w-3 h-3 transition-colors duration-300" style={{ color: profilePreset.accentColor }} />
            <span>Change Profile Color</span>
          </button> */}
        </div>

        {/* Devices Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-slate-400 text-xs font-semibold">
              Devices ({deviceCount}/{maxDevices})
            </span>
            <button
              onClick={fetchDevices}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh devices"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshingDevices ? "animate-spin text-[var(--color-primary-light)]" : ""}`}
              />
            </button>
          </div>

          <div className="bg-[#141519] border border-white/8 rounded-2xl divide-y divide-white/6 overflow-hidden shadow-lg">
            {devices.map((device) => {
              const isCurrent = device.isCurrent === true;
              const lastActiveDate = device.lastActive ? new Date(device.lastActive) : null;
              const now = new Date();
              let lastOnlineLabel = "";
              if (lastActiveDate) {
                const diffMs = now.getTime() - lastActiveDate.getTime();
                const diffMin = Math.floor(diffMs / 60000);
                const diffHr = Math.floor(diffMin / 60);
                const diffDay = Math.floor(diffHr / 24);
                if (isCurrent) lastOnlineLabel = "Active now";
                else if (diffMin < 1) lastOnlineLabel = "Just now";
                else if (diffMin < 60) lastOnlineLabel = `${diffMin}m ago`;
                else if (diffHr < 24) lastOnlineLabel = `${diffHr}h ago`;
                else if (diffDay === 1) lastOnlineLabel = "Yesterday";
                else lastOnlineLabel = lastActiveDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
              }
              return (
                <div
                  key={device.deviceId}
                  className="flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={
                        isCurrent
                          ? {
                              backgroundColor: currentColor.subtle,
                              color: currentColor.primaryLight,
                              border: `1px solid ${currentColor.border}`,
                            }
                          : undefined
                      }
                    >
                      {device.type === "desktop" ? (
                        <Monitor className="w-5 h-5" />
                      ) : (
                        <Smartphone className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{device.name}</p>
                      <p className="text-slate-400 text-xs">
                        {isCurrent ? (
                          <span style={{ color: currentColor.primaryLight }} className="font-medium">
                            This device
                          </span>
                        ) : (
                          "Connected device"
                        )}
                        {lastOnlineLabel && (
                          <span className="text-slate-500 ml-1.5">· {lastOnlineLabel}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {!isCurrent && (
                    <button
                      onClick={() => handleRemoveDevice(device.deviceId)}
                      className="text-red-400 hover:text-red-300 text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Account Management Section */}
        <div className="space-y-2">
          <span className="text-slate-400 text-xs font-semibold px-1 block">Account &amp; Appearance</span>

          <div className="bg-[#141519] border border-white/8 rounded-2xl divide-y divide-white/6 overflow-hidden shadow-lg">
            {/* Primary Theme Color */}
            <button
              onClick={() => setShowThemeModal(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/3 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
                  style={{
                    backgroundColor: currentColor.subtle,
                    color: currentColor.primaryLight,
                    border: `1px solid ${currentColor.border}`,
                  }}
                >
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-white font-medium text-sm">Theme color</span>
                  <p className="text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: currentColor.primary }}
                    />
                    <span>{currentColor.name}</span>
                  </p>
                </div>
              </div>
              <span
                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{
                  backgroundColor: currentColor.subtle,
                  color: currentColor.primaryLight,
                }}
              >
                Change
              </span>
            </button>

            {/* "Verify Account" tab: Shown ONLY for Simple Auth users who are NOT yet verified */}
            {authProvider !== "google" && !isVerified && (
              <button
                onClick={() => {
                  setShowVerifyModal(true);
                  if (!codeSent && resendCooldown === 0) handleSendVerificationCode();
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-amber-500/5 transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-white font-medium text-sm">Verify Account</span>
                    <p className="text-amber-400/80 text-[11px] mt-0.5">
                      Verify your email address with 6-digit code
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 uppercase tracking-wider text-center">
                  Verify Now
                </span>
              </button>
            )}

            {/* Email OTP Toggle — only for verified credentials users */}
            {authProvider !== "google" && isVerified && (
              <div className="w-full flex items-center justify-between p-4 hover:bg-white/3 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${!emailOtpEnabled ? "bg-slate-800" : ""}`}
                    style={
                      emailOtpEnabled
                        ? {
                            backgroundColor: currentColor.subtle,
                            color: currentColor.primaryLight,
                            border: `1px solid ${currentColor.border}`,
                          }
                        : undefined
                    }
                  >
                    <Mail
                      className={`w-4 h-4 ${!emailOtpEnabled ? "text-slate-300" : ""}`}
                      style={emailOtpEnabled ? { color: currentColor.primaryLight } : undefined}
                    />
                  </div>
                  <div>
                    <span className="text-white font-medium text-sm">Email OTP Login</span>
                    <p
                      className="text-[11px] mt-0.5 text-slate-400"
                      style={emailOtpEnabled ? { color: currentColor.primaryLight } : undefined}
                    >
                      {emailOtpEnabled
                        ? "6-digit code required on login"
                        : "No code required on login"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={otpToggleLoading}
                  onClick={() => {
                    setOtpConfirmAction(emailOtpEnabled ? "disable" : "enable");
                    setShowOtpConfirmModal(true);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 disabled:opacity-40 cursor-pointer ${
                    emailOtpEnabled ? "" : "bg-slate-700"
                  }`}
                  style={emailOtpEnabled ? { backgroundColor: currentColor.primary } : undefined}
                  aria-label="Toggle Email OTP"
                  role="switch"
                  aria-checked={emailOtpEnabled}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                      emailOtpEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Change Password */}
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full flex items-center gap-3.5 p-4 hover:bg-white/3 transition-colors text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                <Key className="w-4 h-4" />
              </div>
              <span className="text-white font-medium text-sm">Change password</span>
            </button>

            {/* Reset Account */}
            <button
              onClick={() => setShowResetModal(true)}
              className="w-full flex items-center gap-3.5 p-4 hover:bg-white/3 transition-colors text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                <Sliders className="w-4 h-4" />
              </div>
              <span className="text-white font-medium text-sm">Reset account</span>
            </button>

            {/* Delete Account */}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full flex items-center gap-3.5 p-4 hover:bg-red-500/5 transition-colors text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
                <Trash2 className="w-4 h-4" />
              </div>
              <span className="text-red-400 font-medium text-sm">Delete account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sign Out Button at very bottom of the page */}
      <div className="pt-8">
        <button
          onClick={() => { resetColor(); signOut({ callbackUrl: "/auth/signin" }); }}
          className="w-full py-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-sm border border-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-500/5 active:scale-[0.99]"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* ── Verify Account Modal ────────────────────────────────────── */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#16181e] border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: currentColor.subtle,
                    color: currentColor.primaryLight,
                    border: `1px solid ${currentColor.border}`,
                  }}
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Verify Your Email</h3>
                  <p className="text-[11px] text-slate-400">Secure your account</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowVerifyModal(false);
                  setVerifyError("");
                  setSendErrorFallback(false);
                  setVerifyDigits(Array(6).fill(""));
                }}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-300 text-xs leading-relaxed">
              We send a 6-digit confirmation code directly to{" "}
              <strong className="text-white">{userEmail}</strong>. Please check your inbox or spam folder.
            </p>

            {/* Error Fallback when sending code fails (e.g. missing SMTP .env or backend issue) */}
            {sendErrorFallback && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-amber-300">Email Delivery Issue</p>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      {verifyError || "Unable to send verification email. The email service could not be reached (missing or unconfigured SMTP settings in .env)."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSendVerificationCode}
                    disabled={sendingCode}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    {sendingCode ? "Retrying…" : "Try Again"}
                  </button>
                  <Link
                    href="/account/help/support"
                    onClick={() => setShowVerifyModal(false)}
                    className="text-[11px] text-slate-400 hover:text-white underline underline-offset-2 ml-auto"
                  >
                    Contact Support
                  </Link>
                </div>
              </div>
            )}

            {!codeSent ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSendVerificationCode}
                  disabled={sendingCode}
                  className="w-full py-3 rounded-2xl text-white font-bold text-xs tracking-wide transition-all disabled:opacity-50 cursor-pointer shadow-lg active:scale-98 flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: currentColor.primary,
                    boxShadow: `0 8px 20px -4px ${currentColor.glow}`,
                  }}
                >
                  {sendingCode ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send 6-Digit Code to Email</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyCodeSubmit} className="space-y-4 pt-1">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1.5 font-medium text-center">
                    Enter the 6-digit code from your email
                  </label>
                  <OtpBoxes
                    value={verifyDigits}
                    onChange={(val) => {
                      setVerifyDigits(val);
                      setVerifyError("");
                    }}
                    disabled={verifyLoading}
                    accentColor={currentColor.primary}
                    accentBorder={currentColor.border}
                    accentGlow={currentColor.glow}
                  />
                </div>

                {verifyError && !sendErrorFallback && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                )}

                {verifySuccess && (
                  <div
                    className="p-2.5 rounded-xl text-xs flex items-center gap-2 font-semibold"
                    style={{
                      backgroundColor: currentColor.subtle,
                      border: `1px solid ${currentColor.border}`,
                      color: currentColor.primaryLight,
                    }}
                  >
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>{verifySuccess}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSendVerificationCode}
                    disabled={sendingCode || resendCooldown > 0}
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend Code"}
                  </button>

                  <button
                    type="submit"
                    disabled={verifyLoading || verifyDigits.join("").length !== 6}
                    className="flex-1 py-3 rounded-xl text-white font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg active:scale-98"
                    style={{
                      backgroundColor: currentColor.primary,
                      boxShadow: `0 8px 20px -4px ${currentColor.glow}`,
                    }}
                  >
                    {verifyLoading ? "Verifying…" : "Verify Account"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#16181e] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-base">Change Password</h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-[#20222a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">New Password (min 6 characters)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#20222a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#20222a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  placeholder="Confirm new password"
                />
              </div>

              {passwordError && <p className="text-red-400 text-xs">{passwordError}</p>}
              {passwordSuccess && (
                <p style={{ color: currentColor.primaryLight }} className="text-xs flex items-center gap-1 font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  {passwordSuccess}
                </p>
              )}

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full py-3 rounded-full text-white font-bold text-xs tracking-wide transition-all disabled:opacity-50 cursor-pointer shadow-lg active:scale-98"
                style={{
                  backgroundColor: currentColor.primary,
                  boxShadow: `0 8px 20px -4px ${currentColor.glow}`,
                }}
              >
                {passwordLoading ? "Updating…" : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Reset Account Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#16181e] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-white font-bold text-base">Reset Account Data?</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                This will clear all transactions, budgets, events, and set wallet balances back to 0. This cannot be undone.
              </p>
            </div>

            {/* Password input verification */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] text-slate-400 block font-medium">
                Enter your password to confirm:
              </label>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => {
                  setResetPassword(e.target.value);
                  setResetError("");
                }}
                placeholder="Account password"
                className="w-full bg-[#20222a] border border-white/10 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white outline-none transition-colors"
                autoFocus
              />
              {resetError && <p className="text-red-400 text-[11px] mt-1">{resetError}</p>}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 font-semibold text-xs hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetAccount}
                disabled={resetCountdown > 0 || !resetPassword.trim() || actionLoading}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {actionLoading
                  ? "Resetting…"
                  : resetCountdown > 0
                  ? `Wait (${resetCountdown}s)`
                  : "Yes, Reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#16181e] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-white font-bold text-base">Delete Account?</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                Your account and all associated wallets, transactions, events, and budgets will be permanently deleted.
              </p>
            </div>

            {/* Password input verification */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] text-slate-400 block font-medium">
                Enter your password to confirm:
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  setDeleteError("");
                }}
                placeholder="Account password"
                className="w-full bg-[#20222a] border border-white/10 focus:border-red-500 rounded-xl px-3 py-2 text-xs text-white outline-none transition-colors"
                autoFocus
              />
              {deleteError && <p className="text-red-400 text-[11px] mt-1">{deleteError}</p>}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 font-semibold text-xs hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteCountdown > 0 || !deletePassword.trim() || actionLoading}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {actionLoading
                  ? "Deleting…"
                  : deleteCountdown > 0
                  ? `Wait (${deleteCountdown}s)`
                  : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Device Confirmation Modal */}
      {removeDeviceConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#16181e] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-white font-bold text-base">Disconnect device?</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                This device will be immediately disconnected and signed out from your account.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setRemoveDeviceConfirm(null)}
                className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 font-semibold text-xs hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveDevice}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email OTP Toggle Confirmation Modal */}
      {showOtpConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#16181e] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
              style={{
                backgroundColor: currentColor.subtle,
                border: `1px solid ${currentColor.border}`,
              }}
            >
              <Mail className="w-6 h-6" style={{ color: currentColor.primaryLight }} />
            </div>
            <div className="text-center">
              <h3 className="text-white font-bold text-base">
                {otpConfirmAction === "enable" ? "Enable Email OTP?" : "Disable Email OTP?"}
              </h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                {otpConfirmAction === "enable"
                  ? "A 6-digit code will be sent to your email every time you sign in."
                  : "You will be able to sign in with just your email and password — no code needed."}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowOtpConfirmModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 font-semibold text-xs hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleToggleOtp(otpConfirmAction === "enable")}
                disabled={otpToggleLoading}
                className="flex-1 py-3 rounded-xl text-white font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{
                  backgroundColor: currentColor.primary,
                  boxShadow: `0 8px 20px -4px ${currentColor.glow}`,
                }}
              >
                {otpToggleLoading
                  ? "Saving…"
                  : otpConfirmAction === "enable"
                  ? "Enable"
                  : "Disable"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Theme Color Settings Modal */}
      <ThemeColorModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
      />

      {/* Profile Avatar & Color Settings Modal */}
      <ProfileColorModal
        isOpen={showProfileColorModal}
        onClose={() => setShowProfileColorModal(false)}
        currentColor={profileColor}
        currentImage={userImage}
        userName={userName}
        onColorChange={(newColor) => setProfileColor(newColor)}
        onImageChange={(newImage) => setUserImage(newImage)}
      />
    </div>
  );
}
