"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  ChevronLeft,
} from "lucide-react";
import { getThemeColorConfig } from "@/lib/theme";
import { GoogleIcon } from "@/components/ui/AppIcons";
import PageLoading from "@/components/ui/PageLoading";
import { useTheme } from "@/context/ThemeContext";
import { getClientDeviceId } from "@/lib/clientDevice";
import { useToast } from "@/components/ui/Toast";

//  OTP Input 

interface OtpInputProps {
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
  accentColor: string;
  accentBorder: string;
  accentGlow: string;
}

function OtpInput({ value, onChange, disabled, accentColor, accentBorder, accentGlow }: OtpInputProps) {
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
    // Handle paste of multiple digits
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

  // Auto-focus first input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      refs.current[0]?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex gap-2 justify-center">
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
          className="w-11 h-13 text-center text-xl font-bold rounded-xl bg-slate-900/60 text-white border transition-all duration-150 outline-none disabled:opacity-40 caret-transparent select-none focus:border-current"
          style={{
            borderColor: digit ? accentColor : "rgba(255,255,255,0.12)",
            boxShadow: digit ? `0 0 0 1px ${accentBorder}, 0 4px 12px ${accentGlow}` : undefined,
          }}
          aria-label={`Digit ${idx + 1}`}
        />
      ))}
    </div>
  );
}

//  Main Form 

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentColor, isThemeLoaded } = useTheme();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // "signin" | "register" | "otp"
  const [mode, setMode] = useState<"signin" | "register" | "otp">("signin");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);

  // OTP states
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Status states
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Catch OAuth callback errors in URL
  useEffect(() => {
    const disconnectedParam = searchParams.get("disconnected");
    if (disconnectedParam) {
      setError("This device was disconnected from another session. Please sign in again.");
      try {
        localStorage.removeItem("dclne_device_id");
        document.cookie = "dclne_device_id=; path=/; max-age=0; SameSite=Lax";
      } catch {}
    }

    const errorParam = searchParams.get("error");
    if (errorParam) {
      if (errorParam === "Configuration") {
        setError("Google OAuth is not configured properly yet. Please verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.");
      } else if (errorParam === "AccessDenied") {
        setError("Google Sign-In was cancelled or access was denied.");
      } else if (errorParam === "OAuthCallback" || errorParam === "OAuthSignin") {
        setError("Failed to sign in with Google. Please check your credentials and try again.");
      } else {
        setError(`Sign-in error: ${errorParam}`);
      }
    }
  }, [searchParams]);


  // Detect when the user returned to this page after starting (but not completing) Google sign-in.
  // Covers:
  //   1. Full-reload on back: useEffect runs on initial mount.
  //   2. bfcache restore (browser unfreezes page, React state preserved):
  //      "pageshow" fires with event.persisted === true.
  //   3. Tab focus / visibility return: "visibilitychange".
  useEffect(() => {
    const handleGoogleCancelled = (e?: PageTransitionEvent) => {
      try {
        const pending = sessionStorage.getItem("google_signin_pending");
        if (pending) {
          const timestamp = parseInt(pending, 10);
          const elapsed = Date.now() - timestamp;
          // If within 1 second and not a bfcache restore event, don't trigger yet (just clicked)
          if (!isNaN(timestamp) && elapsed < 1200 && !e?.persisted) {
            return;
          }

          sessionStorage.removeItem("google_signin_pending");
          setGoogleLoading(false);
          const msg = "Failed to sign in with Google. The sign-in process was cancelled.";
          setError(msg);
          toast(msg, "error");
        } else if (e?.persisted) {
          // If restored from bfcache without a pending flag, still ensure loading spinner is undone
          setGoogleLoading(false);
        }
      } catch {}
    };

    // Case 1: mount (page reload upon pressing back)
    handleGoogleCancelled();

    // Case 2: bfcache restore
    window.addEventListener("pageshow", handleGoogleCancelled);

    // Case 3: visibility change (returning to tab / standalone PWA window)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleGoogleCancelled();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pageshow", handleGoogleCancelled);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup resend timer on unmount
  useEffect(() => {
    return () => { if (resendTimer.current) clearInterval(resendTimer.current); };
  }, []);

  const startResendCooldown = (seconds = 60) => {
    setResendCooldown(seconds);
    if (resendTimer.current) clearInterval(resendTimer.current);
    resendTimer.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(resendTimer.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  if (!mounted || !isThemeLoaded) {
    return (
      <PageLoading
        title="Loading Sign In..."
        subtitle="Preparing sign in & theme"
      />
    );
  }

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const res = await fetch("/api/auth/status").catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};

      if (data && data.googleConfigured === false) {
        const cfgMsg = "Google OAuth is not yet configured on this server. Please add your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET into .env.local.";
        setError(cfgMsg);
        toast(cfgMsg, "error");
        setGoogleLoading(false);
        return;
      }

      // Record timestamp so we know an OAuth redirect was initiated.
      // Do NOT remove this flag immediately after signIn() because signIn()
      // initiates the redirect asynchronously and resolving does NOT mean navigation is finished.
      try {
        sessionStorage.setItem("google_signin_pending", Date.now().toString());
      } catch {}

      await signIn("google", { callbackUrl: "/" });
    } catch (err: unknown) {
      console.error("[google sign-in error]:", err);
      const message = err instanceof Error ? err.message : "Failed to initiate Google sign-in";
      setError(message);
      toast(message, "error");
      setGoogleLoading(false);
      try {
        sessionStorage.removeItem("google_signin_pending");
      } catch {}
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "register") {
        // 1. Call Register API
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const codeStr = data.code ? ` [${res.status}: ${data.code}]` : ` [HTTP ${res.status}]`;
          setError(`${data.error || "Failed to create account."}${codeStr}`);
          setLoading(false);
          return;
        }

        setSuccess("Account created successfully! Signing you in...");

        // 2. Automatically sign in with the new credentials
        const signInRes = await signIn("credentials", {
          email,
          password,
          stayLoggedIn: stayLoggedIn ? "1" : "0",
          redirect: false,
        });

        if (signInRes?.error) {
          setError(`Account created, but sign-in failed [${signInRes.error}]. Please log in manually.`);
          setMode("signin");
          setLoading(false);
          return;
        }

        router.push("/");
        router.refresh();
      } else {
        // 1. Verify credentials via dedicated login route for accurate HTTP status & error codes
        const clientDeviceId = getClientDeviceId();
        const verifyRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(clientDeviceId ? { "x-device-id": clientDeviceId } : {}),
          },
          body: JSON.stringify({ email, password, deviceId: clientDeviceId }),
        });

        const verifyData = await verifyRes.json().catch(() => ({}));

        if (!verifyRes.ok) {
          const codeStr = verifyData.code
            ? ` [${verifyRes.status}: ${verifyData.code}]`
            : ` [HTTP ${verifyRes.status}]`;
          setError(`${verifyData.error || "Failed to log in."}${codeStr}`);
          setLoading(false);
          return;
        }

        // 2a. If account has email OTP enabled  request OTP and switch to OTP step
        if (verifyData.isVerified && verifyData.emailOtpEnabled) {
          const otpRes = await fetch("/api/auth/send-login-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const otpData = await otpRes.json().catch(() => ({}));

          if (!otpRes.ok) {
            const codeStr = otpData.code
              ? ` [${otpRes.status}: ${otpData.code}]`
              : ` [HTTP ${otpRes.status}]`;
            setError(`${otpData.error || "Failed to send login code."}${codeStr}`);
            setLoading(false);
            return;
          }

          // Switch to OTP view
          // In dev mode, auto-fill the OTP from the response if SMTP is unavailable
          if (otpData.devOtp) {
            // Dev: SMTP failed but server returned the OTP directly  auto-fill for convenience
            setOtpDigits(String(otpData.devOtp).split(""));
            setSuccess("[DEV] SMTP offline  OTP auto-filled. Check terminal for the code.");
          } else {
            setOtpDigits(Array(6).fill(""));
          }
          setError(null);
          setMode("otp");
          startResendCooldown(60);
          setLoading(false);
          return;
        }

        // 2b. Unverified accounts  sign in directly (no OTP)
        const res = await signIn("credentials", {
          email,
          password,
          stayLoggedIn: stayLoggedIn ? "1" : "0",
          redirect: false,
        });

        if (res?.error) {
          setError(`Session error [${res.error}]. Please try again.`);
          setLoading(false);
          return;
        }

        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      console.error("[auth error]:", err);
      const message = err instanceof Error ? err.message : "Please check your connection.";
      setError(`Network error: ${message} [CLIENT_FETCH_ERROR]`);
      setLoading(false);
    }
  };

  //  OTP submit 

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length !== 6) {
      setError("Please enter all 6 digits.");
      return;
    }
    setError(null);
    setOtpLoading(true);

    try {
      // 1. Verify OTP
      const clientDeviceId = getClientDeviceId();
      const verifyRes = await fetch("/api/auth/verify-login-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientDeviceId ? { "x-device-id": clientDeviceId } : {}),
        },
        body: JSON.stringify({ email, otp: code, deviceId: clientDeviceId }),
      });
      const verifyData = await verifyRes.json().catch(() => ({}));

      if (!verifyRes.ok) {
        const codeStr = verifyData.code
          ? ` [${verifyRes.status}: ${verifyData.code}]`
          : ` [HTTP ${verifyRes.status}]`;
        setError(`${verifyData.error || "Invalid code."}${codeStr}`);
        setOtpLoading(false);
        return;
      }

      // 2. Establish NextAuth session
      setSuccess("Code verified! Signing you in");
      const res = await signIn("credentials", {
        email,
        password,
        stayLoggedIn: stayLoggedIn ? "1" : "0",
        redirect: false,
      });

      if (res?.error) {
        setError(`Session error [${res.error}]. Please try again.`);
        setOtpLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      console.error("[otp error]:", err);
      const message = err instanceof Error ? err.message : "Please check your connection.";
      setError(`Network error: ${message} [CLIENT_FETCH_ERROR]`);
      setOtpLoading(false);
    }
  };

  //  Resend OTP 

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setOtpDigits(Array(6).fill(""));

    try {
      const res = await fetch("/api/auth/send-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Failed to resend code. Please try again.");
        return;
      }

      setSuccess("A new code has been sent to your email.");
      startResendCooldown(60);
    } catch {
      setError("Network error. Please check your connection.");
    }
  };

  // 
  // Render
  // 

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-12 relative overflow-hidden"
      data-theme-color="green"
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl animate-pulse transition-all duration-700"
          style={{ backgroundColor: currentColor.primary, opacity: 0.18 }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl animate-pulse transition-all duration-700"
          style={{ backgroundColor: currentColor.primaryLight, opacity: 0.12 }}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* Main Card */}
        <div className="backdrop-blur-2xl bg-white/[0.04] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">

          {/*  OTP step  */}
          {mode === "otp" ? (
            <>
              {/* Header */}
              <div className="flex flex-col items-center mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-3 transition-all"
                  style={{
                    backgroundColor: currentColor.subtle,
                    border: `1px solid ${currentColor.border}`,
                    boxShadow: `0 10px 25px -4px ${currentColor.glow}`,
                  }}
                >
                  <ShieldCheck
                    className="w-8 h-8"
                    style={{ color: currentColor.primaryLight }}
                  />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Verify It&#39;s You
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 text-center">
                  We sent a 6-digit code to{" "}
                  <span className="text-slate-200 font-medium">{email}</span>
                </p>
              </div>

              {/* Error / Success banners */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 mb-4 text-xs text-red-300 flex items-start gap-2.5">
                  <span className="text-base leading-none mt-0.5"></span>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-red-200 leading-snug">
                      {error.split(" [")[0]}
                    </p>
                    {error.includes(" [") && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/80 border border-red-500/40 text-[11px] font-mono text-red-400">
                        <span className="font-semibold text-red-300">CODE:</span>
                        <span>[{error.split(" [")[1]}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {success && (
                <div
                  className="rounded-xl p-3 mb-4 text-xs flex items-start gap-2 font-medium"
                  style={{
                    backgroundColor: currentColor.subtle,
                    border: `1px solid ${currentColor.border}`,
                    color: currentColor.primaryLight,
                  }}
                >
                  <span className="text-sm"></span>
                  <span>{success}</span>
                </div>
              )}

              {/* OTP form */}
              <form onSubmit={handleOtpSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-3 text-center">
                    Enter your 6-digit code
                  </label>
                  <OtpInput
                    value={otpDigits}
                    onChange={setOtpDigits}
                    disabled={otpLoading}
                    accentColor={currentColor.primary}
                    accentBorder={currentColor.border}
                    accentGlow={currentColor.glow}
                  />
                </div>

                <button
                  type="submit"
                  disabled={otpLoading || otpDigits.join("").length < 6}
                  className="w-full flex items-center justify-center gap-2 active:scale-[0.98] text-white font-semibold py-3 px-5 rounded-2xl shadow-lg transition-all duration-150 disabled:opacity-50 cursor-pointer"
                  style={{
                    backgroundColor: currentColor.primary,
                    boxShadow: `0 10px 25px -4px ${currentColor.glow}`,
                  }}
                >
                  {otpLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Verify & Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Resend & back */}
              <div className="mt-5 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || otpLoading}
                  className="flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer"
                  style={{ color: resendCooldown > 0 ? undefined : currentColor.primaryLight }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Resend code"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setSuccess(null);
                    setOtpDigits(Array(6).fill(""));
                    if (resendTimer.current) clearInterval(resendTimer.current);
                    setResendCooldown(0);
                  }}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back to sign in
                </button>
              </div>

              {/* Footer */}
              <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-center gap-2 text-slate-500 text-xs text-center">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: currentColor.primaryLight }} />
                <span>Code expires in 10 minutes</span>
              </div>
            </>
          ) : (
            <>
              {/*  Sign in / Register step  */}

              {/* Logo & Header */}
              <div className="flex flex-col items-center mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-3 p-2.5 transition-all overflow-hidden"
                  style={{
                    backgroundColor: currentColor.subtle,
                    border: `1px solid ${currentColor.border}`,
                    boxShadow: `0 10px 25px -4px ${currentColor.glow}`,
                  }}
                >
                  <Image
                    src="/assets/favicon.png"
                    alt="Money Docs Logo"
                    width={52}
                    height={52}
                    className="w-full h-full object-contain"
                    priority
                  />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Money Docs
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Personal money & debt management
                </p>
              </div>

              {/* Mode Tabs */}
              <div className="flex p-1 bg-slate-800/80 border border-white/10 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setSuccess(null);
                    setStayLoggedIn(false);
                  }}
                  className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
                    mode === "signin"
                      ? "text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                  style={
                    mode === "signin"
                      ? {
                          backgroundColor: currentColor.primary,
                          boxShadow: `0 4px 14px ${currentColor.glow}`,
                        }
                      : undefined
                  }
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                    setSuccess(null);
                    setStayLoggedIn(false);
                  }}
                  className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
                    mode === "register"
                      ? "text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                  style={
                    mode === "register"
                      ? {
                          backgroundColor: currentColor.primary,
                          boxShadow: `0 4px 14px ${currentColor.glow}`,
                        }
                      : undefined
                  }
                >
                  Create Account
                </button>
              </div>

              {/* Error / Success Banners */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 mb-4 text-xs text-red-300 flex items-start gap-2.5">
                  <span className="text-base leading-none mt-0.5"></span>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-red-200 leading-snug">
                      {error.split(" [")[0]}
                    </p>
                    {error.includes(" [") && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/80 border border-red-500/40 text-[11px] font-mono text-red-400">
                        <span className="font-semibold text-red-300">CODE:</span>
                        <span>[{error.split(" [")[1]}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {success && (
                <div
                  className="rounded-xl p-3 mb-4 text-xs flex items-start gap-2 font-medium"
                  style={{
                    backgroundColor: currentColor.subtle,
                    border: `1px solid ${currentColor.border}`,
                    color: currentColor.primaryLight,
                  }}
                >
                  <span className="text-sm"></span>
                  <span>{success}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "register" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        placeholder="Your Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder={mode === "register" ? "Minimum 6 characters" : "Enter your password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Stay logged in */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <div className="relative flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={stayLoggedIn}
                      onChange={(e) => setStayLoggedIn(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className="w-4 h-4 rounded border border-white/20 bg-slate-900/60 peer-checked:border-transparent transition-all flex items-center justify-center"
                      style={stayLoggedIn ? { backgroundColor: currentColor.primary } : undefined}
                    >
                      {stayLoggedIn && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">
                      Stay logged in
                    </span>
                    {!stayLoggedIn && (
                      <span className="ml-1.5 text-[11px] text-slate-500">
                        (session expires after 1 day)
                      </span>
                    )}
                  </div>
                </label>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full mt-2 flex items-center justify-center gap-2 active:scale-[0.98] text-white font-semibold py-3 px-5 rounded-2xl shadow-lg transition-all duration-150 disabled:opacity-50 cursor-pointer"
                  style={{
                    backgroundColor: currentColor.primary,
                    boxShadow: `0 10px 25px -4px ${currentColor.glow}`,
                  }}
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{mode === "signin" ? "Sign In" : "Create Account"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                  <span className="bg-[#12141c] px-3 text-slate-400 font-medium rounded-full">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Google Auth Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading || googleLoading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 hover:border-white/20 text-white font-semibold text-sm transition-all duration-200 shadow-md cursor-pointer disabled:opacity-50"
              >
                {googleLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <GoogleIcon className="w-4 h-4 flex-shrink-0" />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Quick Notice */}
              <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-center gap-2 text-slate-500 text-xs text-center">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: currentColor.primaryLight }} />
                <span>Secure authentication &amp; encrypted sessions</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
          Loading authentication...
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
