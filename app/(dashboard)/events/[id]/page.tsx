"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Trash2,
  SquarePen,
  AlertTriangle,
  Wallet as WalletIcon,
  CheckCircle2,
  RotateCcw,
  ListFilter,
} from "lucide-react";
import { CalendarIcon } from "@/components/ui/AppIcons";
import { formatMoney, getCurrencyDisplayCode } from "@/lib/currency";
import { useToast } from "@/components/ui/Toast";
import EventModal, { EventData } from "@/components/admin/EventModal";
import PageLoading from "@/components/ui/PageLoading";

interface EventDetailItem {
  _id: string;
  name: string;
  icon?: string;
  endingDate?: string;
  currency: string;
  walletId?: {
    _id: string;
    name: string;
    currency: string;
  };
  status: "RUNNING" | "FINISHED";
  spent: number;
  transactions?: {
    _id: string;
    title: string;
    category: string;
    subCategory?: string;
    type?: string;
    amount: number;
    currency?: string;
    rawAmount?: number;
    rawCurrency?: string;
    date: string | Date;
  }[];
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [event, setEvent] = useState<EventDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchEvent = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/events/${id}`);
      if (res.ok) {
        const data = await res.json();
        setEvent(data.event ?? null);
      } else {
        setEvent(null);
      }
    } catch {
      setEvent(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleToggleStatus = async () => {
    if (!event || updatingStatus) return;
    const nextStatus = event.status === "RUNNING" ? "FINISHED" : "RUNNING";
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/finance/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        toast(nextStatus === "FINISHED" ? "Event finished" : "Event reopened", "success");
        setEvent((prev) => (prev ? { ...prev, status: nextStatus } : null));
      } else {
        toast("Failed to update event status", "error");
      }
    } catch {
      toast("Error updating event status", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    setShowDeleteConfirm(false);
    try {
      const res = await fetch(`/api/finance/events/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Event deleted", "info");
        router.push("/events");
      } else {
        toast("Failed to delete event", "error");
      }
    } catch {
      toast("Failed to delete event", "error");
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="py-20 p-6 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
        <p className="text-red-400 font-semibold mb-4">Event not found</p>
        <button
          onClick={() => router.push("/events")}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-bold text-white transition-colors cursor-pointer"
        >
          Back to Events
        </button>
      </div>
    );
  }

  const isRunning = event.status === "RUNNING";
  const endingDateObj = event.endingDate ? new Date(event.endingDate) : null;
  const now = new Date();

  let daysRemainingText = "No end date set";
  if (endingDateObj) {
    const diffTime = endingDateObj.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      daysRemainingText = "Ended";
    } else if (diffDays === 0) {
      daysRemainingText = "Ends today";
    } else {
      daysRemainingText = `${diffDays} day${diffDays !== 1 ? "s" : ""} left`;
    }
  }

  const walletName = event.walletId?.name || "All Wallets";
  const txCount = event.transactions?.length || 0;

  return (
    <div className="text-white max-w-lg mx-auto pb-24">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <button
          onClick={() => router.push("/events")}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Back to events"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <h1 className="text-white font-bold text-lg tracking-tight">Event Details</h1>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-[var(--color-primary-light)] active:bg-white/10 transition-colors cursor-pointer"
            title="Edit Event"
          >
            <SquarePen className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-red-400 active:bg-white/10 transition-colors cursor-pointer"
            title="Delete event"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="px-5 space-y-4">
        {/* Header Card */}
        <div className="p-5 bg-[#1b1c21] border border-white/6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shadow-inner">
                {event.icon || "✈️"}
              </div>
              <div>
                <h3 className="text-white font-bold text-xl tracking-tight">
                  {event.name}
                </h3>
                <p className="text-slate-400 text-xs">
                  {event.currency} Currency
                </p>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                isRunning
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                  : "bg-slate-500/15 text-slate-300 border-slate-500/25"
              }`}
            >
              {event.status}
            </span>
          </div>

          {/* Large Spent Info */}
          <div className="pt-2 border-t border-white/6">
            <span className="text-slate-400 block text-xs font-medium">Total Spent</span>
            <span className="text-white font-black text-3xl tracking-tight">
              {formatMoney(event.spent || 0, event.currency)}
            </span>
          </div>

          {/* Ending Date */}
          <div className="pt-2 flex items-start gap-3">
            <CalendarIcon size={20} color="#94a3b8" className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white text-sm font-semibold">
                {endingDateObj
                  ? endingDateObj.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "No ending date"}
              </p>
              <p className="text-slate-400 text-xs">
                {daysRemainingText}
              </p>
            </div>
          </div>

          {/* Wallet */}
          <div className="flex items-center gap-3 pt-1">
            <WalletIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <span className="text-white text-sm font-semibold">
              {walletName} ({getCurrencyDisplayCode(event.currency)})
            </span>
          </div>
        </div>

        {/* ── Action Buttons ────────────────────────────────────────────────── */}
        <div className="space-y-3 pt-2">
          {/* Mark as Finished / Reopen Button */}
          <button
            type="button"
            disabled={updatingStatus}
            onClick={handleToggleStatus}
            className={`w-full py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 ${
              isRunning
                ? "bg-white/10 hover:bg-white/15 text-white border border-white/10"
                : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
            }`}
          >
            {isRunning ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[var(--color-primary-light)]" />
                <span>MARK AS FINISHED</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>REOPEN EVENT</span>
              </>
            )}
          </button>

          {/* Transactions List Button */}
          <button
            type="button"
            onClick={() => router.push(`/events/${id}/transactions`)}
            className="w-full py-3.5 rounded-xl bg-[var(--color-primary)] hover:brightness-110 active:brightness-95 text-white font-black text-xs tracking-wider uppercase shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            style={{ boxShadow: "0 8px 20px -4px var(--color-primary-glow)" }}
          >
            <ListFilter className="w-4 h-4" />
            <span>TRANSACTIONS LIST ({txCount})</span>
          </button>
        </div>
      </div>

      {/* ── Edit Event Modal ──────────────────────────────────────────────── */}
      {showEditModal && (
        <EventModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            fetchEvent();
          }}
          eventToEdit={event as unknown as EventData}
        />
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#16181e] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-white font-bold text-base">Delete event?</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                This event will be permanently removed. Transactions linked to this event will be unlinked.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 font-semibold text-xs hover:bg-white/10 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
