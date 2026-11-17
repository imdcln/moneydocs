"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  Key,
  Check,
  X,
  AlertTriangle,
  Mail,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { GoogleIcon } from "@/components/ui/AppIcons";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/components/ui/Toast";
import {
  unlinkGoogleAction,
  setOrChangePasswordAction,
} from "@/app/actions/security";

export interface SecurityUser {
  id: string;
  name: string;
  email: string;
  hasPassword?: boolean;
  isGoogleLinked?: boolean;
  googleId?: string | null;
  authProvider?: string;
  canUnlinkGoogle?: boolean;
  isVerified?: boolean;
  emailOtpEnabled?: boolean;
}

interface LoginAndSecuritySectionProps {
  user: SecurityUser;
  onRefresh?: () => void;
  onTriggerOtpToggle?: () => void;
  otpToggleLoading?: boolean;
  /** Called when user wants to open the email-verification flow */
  onVerifyEmail?: () => void;
}

export default function LoginAndSecuritySection({
  user,
  onRefresh,
  onTriggerOtpToggle,
  otpToggleLoading = false,
  onVerifyEmail,
}: LoginAndSecuritySectionProps) {
  const { currentColor } = useTheme();
  const { toast } = useToast();

  const hasPassword = Boolean(user.hasPassword);
  const isGoogleLinked = Boolean(
    user.isGoogleLinked || user.googleId || user.authProvider === "google"
  );
  const emailOtpEnabled = Boolean(user.emailOtpEnabled);
  const isVerified = Boolean(user.isVerified);
  const authProvider = user.authProvider || (isGoogleLinked ? "google" : "credentials");
  const isGooglePrimary = authProvider === "google";

  // ── Derived badge: how is the account verified? ───────────────────────────
  // "google"        → primary Google sign-in account (always verified)
  // "google-linked" → credentials user who has also connected Google
  // "email"         → verified via 6-digit email code
  // "unverified"    → not yet verified
  type VerifiedVia = "google" | "google-linked" | "email" | "unverified";
  const emailVerifiedVia: VerifiedVia = isGooglePrimary
    ? "google"
    : isGoogleLinked
    ? "google-linked"
    : isVerified
    ? "email"
    : "unverified";

  // Modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);

  // Form states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const [unlinkError, setUnlinkError] = useState("");

  const handleOpenPasswordModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (hasPassword && !currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await setOrChangePasswordAction({
        currentPassword: hasPassword ? currentPassword : undefined,
        newPassword,
        confirmPassword,
      });

      if (!res.success) {
        setPasswordError(res.error || "Failed to update password.");
        setPasswordLoading(false);
        return;
      }

      setPasswordSuccess(res.message || "Password updated successfully!");
      toast(res.message || "Password updated successfully!", "success");
      setTimeout(() => {
        setShowPasswordModal(false);
        onRefresh?.();
      }, 1200);
    } catch {
      setPasswordError("An unexpected error occurred. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!hasPassword) {
      toast("Set a password before unlinking your Google account.", "error");
      return;
    }

    setUnlinkLoading(true);
    setUnlinkError("");
    try {
      const res = await unlinkGoogleAction();
      if (!res.success) {
        setUnlinkError(res.error || "Failed to unlink Google account.");
        toast(res.error || "Failed to unlink Google account.", "error");
        setUnlinkLoading(false);
        return;
      }

      toast("Google account unlinked successfully.", "success");
      setShowUnlinkModal(false);
      onRefresh?.();
    } catch {
      setUnlinkError("Network error while unlinking Google.");
    } finally {
      setUnlinkLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-slate-400 text-xs font-semibold px-1 block">
        Login &amp; Security
      </span>

      <div className="bg-[#141519] border border-white/8 rounded-2xl divide-y divide-white/6 overflow-hidden shadow-lg">
      
        {/* ── Google Authentication Row ─────────────────────────── */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
              <GoogleIcon className="w-4 h-4 flex-shrink-0" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium text-sm">Google</span>
                {isGoogleLinked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Check className="w-3 h-3" />
                    <span>Linked</span>
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                {isGoogleLinked ? user.email : "Connect your Google account"}
              </p>
            </div>
          </div>

          <div>
            {isGoogleLinked ? (
              <button
                type="button"
                disabled={!hasPassword}
                onClick={() => setShowUnlinkModal(true)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                  hasPassword
                    ? "text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 cursor-pointer"
                    : "text-slate-600 bg-white/5 cursor-not-allowed opacity-50"
                }`}
                title={!hasPassword ? "Set a password before disconnecting Google" : undefined}
              >
                Unlink
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  signIn("google", {
                    callbackUrl: "/account/my-account?linked=google",
                  })
                }
                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider transition-all cursor-pointer"
                style={{
                  backgroundColor: currentColor.subtle,
                  color: currentColor.primaryLight,
                }}
              >
                Connect
              </button>
            )}
          </div>
        </div>

        {/* ── Password Authentication Row ───────────────────────── */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 flex-shrink-0">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <span className="text-white font-medium text-sm">Password</span>
              {!hasPassword && (
                <p className="text-slate-400 text-xs mt-0.5">No password set</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={handleOpenPasswordModal}
              className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider transition-all cursor-pointer"
              style={{
                backgroundColor: currentColor.subtle,
                color: currentColor.primaryLight,
              }}
            >
              {hasPassword ? "Change" : "Set Password"}
            </button>
          </div>
        </div>

        {/* ── Email OTP Login Row ───────────────────────────────── */}
        {authProvider !== "google" && isVerified && onTriggerOtpToggle && (
          <div className="w-full flex items-center justify-between p-4 hover:bg-white/3 transition-colors">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  !emailOtpEnabled ? "bg-slate-800" : ""
                }`}
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
              onClick={onTriggerOtpToggle}
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
      </div>

      {/* ── Set / Change Password Modal ───────────────────────────────── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#16181e] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-base">
                {hasPassword ? "Change Password" : "Set Password"}
              </h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              {hasPassword && (
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full bg-[#20222a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                    placeholder="Enter current password"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  New Password (min 6 characters)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-[#20222a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-[#20222a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                  placeholder="Confirm new password"
                />
              </div>

              {passwordError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>{passwordSuccess}</span>
                </div>
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
                {passwordLoading
                  ? "Saving..."
                  : hasPassword
                  ? "Update Password"
                  : "Set Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Unlink Google Confirmation Modal ──────────────────────────── */}
      {showUnlinkModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#16181e] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-white font-bold text-base">Unlink Google Account?</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                You will no longer be able to sign in with Google. You will use your email and password to log in.
              </p>
            </div>

            {unlinkError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {unlinkError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUnlinkModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={unlinkLoading}
                onClick={handleUnlinkGoogle}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                {unlinkLoading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Unlink Google</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
