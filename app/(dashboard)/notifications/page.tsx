"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCheck,
  Trash2,
  ArrowLeft,
  RefreshCw,
  Smartphone,
  BellRing,
  Users,
  Check,
  X,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";

type NotificationType = "SECURITY" | "BUDGET" | "SYSTEM" | "GENERAL" | "WALLET_INVITE";

interface Notification {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
  metadata?: {
    walletId?: string;
    walletName?: string;
    inviterEmail?: string;
  };
}

const TYPE_FILTERS = ["ALL", "SECURITY", "BUDGET", "SYSTEM", "GENERAL", "WALLET_INVITE"] as const;

function typeIcon(type: NotificationType) {
  if (type === "SECURITY") return <ShieldAlert className="w-4 h-4 text-red-400" />;
  if (type === "BUDGET") return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  if (type === "SYSTEM") return <Info className="w-4 h-4 text-blue-400" />;
  if (type === "WALLET_INVITE") return <Users className="w-4 h-4 text-emerald-400" />;
  return <Bell className="w-4 h-4 text-slate-400" />;
}

function typeBg(type: NotificationType) {
  if (type === "SECURITY") return "bg-red-500/10 border-red-500/20";
  if (type === "BUDGET") return "bg-amber-500/10 border-amber-500/20";
  if (type === "SYSTEM") return "bg-blue-500/10 border-blue-500/20";
  if (type === "WALLET_INVITE") return "bg-emerald-500/10 border-emerald-500/20";
  return "bg-white/5 border-white/8";
}

function typeLabel(type: NotificationType) {
  if (type === "WALLET_INVITE") return "Invite";
  return type.charAt(0) + type.slice(1).toLowerCase();
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function NotificationsPage() {
  const { currentColor } = useTheme();
  const { permission, isSubscribed, isRegistering, subscribe, unsubscribe } =
    usePushNotifications();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<(typeof TYPE_FILTERS)[number]>("ALL");
  const [toast, setToast] = useState<{ msg: string; color?: string } | null>(null);
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);

  const showToast = (msg: string, color = "#22c55e") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        activeFilter === "ALL"
          ? "/api/notifications?limit=50"
          : `/api/notifications?limit=50&type=${activeFilter}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    showToast("All marked as read");
  };

  const markOneRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const deleteOne = async (id: string) => {
    const wasUnread = notifications.find((n) => n._id === id)?.isRead === false;
    await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
  };

  const clearAll = async () => {
    await fetch("/api/notifications?all=true", { method: "DELETE" });
    setNotifications([]);
    setUnreadCount(0);
    showToast("All notifications cleared");
  };

  // Auto-schedule daily recap at 23:00 device local time (1 h before midnight)
  useEffect(() => {
    if (!isSubscribed) return;
    let timerId: ReturnType<typeof setTimeout>;

    const scheduleRecap = () => {
      const now = new Date();
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 0, 0, 0);
      if (target <= now) {
        // 23:00 already passed today — schedule for tomorrow
        target.setDate(target.getDate() + 1);
      }
      const msUntilRecap = target.getTime() - now.getTime();
      timerId = setTimeout(async () => {
        try {
          const res = await fetch("/api/finance/daily-recap", { method: "POST" });
          if (res.ok) {
            fetchNotifications();
          }
        } catch {
          // silently ignore — recap will retry on next page load
        }
        scheduleRecap();
      }, msUntilRecap);
    };

    scheduleRecap();
    return () => clearTimeout(timerId);
  }, [isSubscribed, fetchNotifications]);
  const handleSubscribeToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
      showToast("Device notifications disabled");
    } else {
      const ok = await subscribe();
      if (ok) {
        showToast("Device notifications enabled! 🔔");
      } else if (permission === "denied") {
        showToast("Notifications are blocked. Enable in browser settings.", "#ef4444");
      }
    }
  };

  const handleInviteResponse = async (notif: Notification, action: "ACCEPT" | "DECLINE") => {
    if (!notif.metadata?.walletId) return;
    setRespondingInviteId(notif._id);
    try {
      const res = await fetch("/api/finance/wallets/invite-respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletId: notif.metadata.walletId, action }),
      });

      if (res.ok) {
        // Delete the invite notification automatically after accept/decline
        await fetch(`/api/notifications?id=${notif._id}`, { method: "DELETE" });
        setNotifications((prev) => prev.filter((n) => n._id !== notif._id));
        if (!notif.isRead) setUnreadCount((c) => Math.max(0, c - 1));
        showToast(
          action === "ACCEPT"
            ? `Joined "${notif.metadata?.walletName || "wallet"}"! 🎉`
            : "Invitation declined."
        );
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to respond. Please try again.", "#ef4444");
      }
    } finally {
      setRespondingInviteId(null);
    }
  };

  const filtered =
    activeFilter === "ALL"
      ? notifications
      : notifications.filter((n) => n.type === activeFilter);

  return (
    <div className="px-4 pt-4 pb-nav-safe max-w-lg mx-auto space-y-5">
      {/* ── Header ── */}
      <div className="pt-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-xs text-slate-400">{unreadCount} unread</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition-colors"
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}
          <button
            onClick={fetchNotifications}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Device Push Settings Card ── */}
      <div className="p-4 rounded-2xl bg-[#141519] border border-white/8 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Smartphone className="w-4 h-4" style={{ color: currentColor.primaryLight }} />
          <h2 className="text-white font-semibold text-sm">Device Notifications</h2>
        </div>

        {permission === "unsupported" ? (
          <p className="text-xs text-slate-400">
            Your browser doesn&apos;t support push notifications. Try Chrome or Edge.
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-400">
              {isSubscribed
                ? "Push notifications are active on this device. You'll receive alerts even when the app is closed."
                : "Enable push notifications to receive alerts for security events, budget warnings, and app updates directly on this device."}
            </p>

            {/* Not subscribed: single full-width enable button */}
            {!isSubscribed && (
              <button
                onClick={handleSubscribeToggle}
                disabled={isRegistering}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ backgroundColor: currentColor.primary, color: "#fff" }}
              >
                <BellRing className="w-4 h-4" />
                {isRegistering ? "Requesting permission…" : "Enable Notifications"}
              </button>
            )}

            {/* Subscribed: disable */}
            {isSubscribed && (
              <button
                onClick={handleSubscribeToggle}
                disabled={isRegistering}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#f87171" }}
              >
                <BellOff className="w-4 h-4" />
                {isRegistering ? "Disabling…" : "Disable Notifications"}
              </button>
            )}
            {permission === "denied" && (
              <p className="text-xs text-red-400 mt-1">
                ⚠️ Notifications are blocked in your browser. Go to browser settings → Site Settings → Notifications to allow them.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
            style={
              activeFilter === f
                ? { backgroundColor: currentColor.primary, color: "#fff" }
                : { backgroundColor: "rgba(255,255,255,0.05)", color: "#94a3b8" }
            }
          >
            {f === "ALL" ? "All" : typeLabel(f as NotificationType)}
          </button>
        ))}
      </div>

      {/* ── Notifications List ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-white/5 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <Bell className="w-12 h-12 mx-auto text-slate-600" />
          <p className="text-white font-semibold">No notifications</p>
          <p className="text-slate-400 text-sm">
            {activeFilter === "ALL"
              ? "You're all caught up! Notifications will appear here."
              : `No ${activeFilter === "WALLET_INVITE" ? "wallet invite" : activeFilter.toLowerCase()} notifications yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((notif) => (
            <div
              key={notif._id}
              className={`relative p-4 rounded-2xl border transition-all ${typeBg(notif.type)} ${
                !notif.isRead ? "shadow-md" : "opacity-75"
              }`}
              onClick={() => !notif.isRead && notif.type !== "WALLET_INVITE" && markOneRead(notif._id)}
            >
              {/* Unread indicator */}
              {!notif.isRead && (
                <span
                  className="absolute top-3 right-3 w-2 h-2 rounded-full"
                  style={{ backgroundColor: currentColor.primary }}
                />
              )}

              <div className="flex items-start gap-3 pr-4">
                <div className="mt-0.5 flex-shrink-0">{typeIcon(notif.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-white font-semibold text-sm leading-tight truncate">
                      {notif.title}
                    </p>
                    <span className="text-slate-500 text-[10px] flex-shrink-0">
                      {timeAgo(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">{notif.message}</p>

                  {/* Non-invite link */}
                  {notif.type !== "WALLET_INVITE" && notif.link && notif.link !== "/notifications" && (
                    <Link
                      href={notif.link}
                      className="mt-1.5 inline-flex items-center text-xs font-semibold hover:underline"
                      style={{ color: currentColor.primaryLight }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      View details →
                    </Link>
                  )}

                  {/* Wallet invite action buttons */}
                  {notif.type === "WALLET_INVITE" && notif.metadata?.walletId && notif.title === "Wallet Invitation" && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInviteResponse(notif, "ACCEPT");
                        }}
                        disabled={respondingInviteId === notif._id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {respondingInviteId === notif._id ? (
                          <span className="animate-pulse">…</span>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Accept
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInviteResponse(notif, "DECLINE");
                        }}
                        disabled={respondingInviteId === notif._id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/8 hover:bg-red-500/20 text-slate-300 hover:text-red-400 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {respondingInviteId === notif._id ? (
                          <span className="animate-pulse">…</span>
                        ) : (
                          <>
                            <X className="w-3.5 h-3.5" />
                            Decline
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteOne(notif._id);
                }}
                className="absolute bottom-3 right-3 p-1 rounded-lg text-slate-600 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="w-full py-3 text-xs text-slate-500 hover:text-red-400 transition-colors text-center"
            >
              Clear all notifications
            </button>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-2xl animate-fade-in"
          style={{ backgroundColor: toast.color || "#22c55e" }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
