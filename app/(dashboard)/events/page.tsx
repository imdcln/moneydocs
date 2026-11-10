"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import BottomNav from "@/components/admin/BottomNav";
import { formatMoney } from "@/lib/currency";
import { WalletGraphic } from "@/components/ui/AppIcons";
import { useToast } from "@/components/ui/Toast";
import EventModal, { EventData } from "@/components/admin/EventModal";
import PageLoading from "@/components/ui/PageLoading";

interface EventItem {
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
}

export default function EventsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"RUNNING" | "FINISHED">("RUNNING");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<EventData | null>(null);

  // Delete confirm modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/finance/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const openAddModal = () => {
    setEventToEdit(null);
    setIsEventModalOpen(true);
  };

  const openEditModal = (ev: EventItem) => {
    setEventToEdit(ev);
    setIsEventModalOpen(true);
  };

  const handleToggleStatus = async (ev: EventItem) => {
    const nextStatus = ev.status === "RUNNING" ? "FINISHED" : "RUNNING";
    try {
      const res = await fetch(`/api/finance/events/${ev._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        toast(nextStatus === "FINISHED" ? "Event finished" : "Event reopened", "success");
        fetchEvents();
      }
    } catch {
      toast("Failed to update status", "error");
    }
  };

  const promptDeleteEvent = (id: string) => {
    setPendingDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteEvent = async () => {
    if (!pendingDeleteId) return;
    try {
      const res = await fetch(`/api/finance/events/${pendingDeleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast("Event deleted", "info");
        fetchEvents();
      } else {
        toast("Failed to delete event", "error");
      }
    } catch {
      toast("Failed to delete event", "error");
    } finally {
      setShowDeleteConfirm(false);
      setPendingDeleteId(null);
    }
  };

  const filteredEvents = events.filter((e) => e.status === activeTab);

  if (loading && events.length === 0) {
    return (
      <PageLoading
        title="Loading Events..."
        subtitle="Fetching your events & travel records"
      />
    );
  }

  return (
    <div className="min-h-screen text-white px-4 pt-3 pb-nav-safe max-w-lg mx-auto flex flex-col justify-between">
      <div>
        {/* ── Top Bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <div className="flex items-center gap-3">
            <Link
              href="/account"
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-white text-lg font-bold">Events</h1>
          </div>

          <div className="flex items-center gap-2">
            <WalletGraphic size={32} className="rounded-lg" />
          </div>
        </div>

        {/* ── Tabs: RUNNING | FINISHED ─────────────────────────────────────── */}
        <div className="flex border-b border-white/8 text-xs font-bold tracking-wider mt-1">
          <button
            type="button"
            onClick={() => setActiveTab("RUNNING")}
            className={`flex-1 py-3 text-center transition-colors relative cursor-pointer ${
              activeTab === "RUNNING" ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            RUNNING
            {activeTab === "RUNNING" && (
              <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-white rounded-full" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("FINISHED")}
            className={`flex-1 py-3 text-center transition-colors relative cursor-pointer ${
              activeTab === "FINISHED" ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            FINISHED
            {activeTab === "FINISHED" && (
              <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-white rounded-full" />
            )}
          </button>
        </div>

        {/* ── Circular Add Button under tab ───────────────────────────────── */}
        <div className="pt-4 pb-2">
          <button
            type="button"
            onClick={openAddModal}
            className="w-12 h-12 rounded-full bg-[var(--color-primary)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center shadow-lg cursor-pointer"
            style={{ boxShadow: "0 10px 25px -4px var(--color-primary-glow)" }}
            aria-label="Add event"
          >
            <Plus className="w-6 h-6 text-white stroke-[2.5]" />
          </button>
        </div>

        {/* ── Event List or Empty State ───────────────────────────────────── */}
        <div className="mt-4">
          {loading ? (
            <div className="py-20 flex justify-center text-slate-500 text-sm">
              Loading events…
            </div>
          ) : filteredEvents.length === 0 ? (
            /* Empty State */
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="relative w-36 h-36 mb-4 flex items-center justify-center">
                <svg
                  width="120"
                  height="120"
                  viewBox="0 0 120 120"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="mx-auto"
                >
                  <path
                    d="M 60 20 C 75 10, 85 30, 65 42 C 50 50, 45 65, 55 75"
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    fill="none"
                  />
                  <ellipse cx="60" cy="18" rx="5" ry="3.5" fill="#a7f3d0" />
                  <ellipse cx="56" cy="15" rx="3" ry="4" fill="#6ee7b7" />
                  <ellipse cx="64" cy="15" rx="3" ry="4" fill="#6ee7b7" />
                  <polygon points="60,45 92,60 60,75 28,60" fill="#93c5fd" />
                  <polygon points="28,60 60,75 60,105 28,90" fill="#60a5fa" />
                  <polygon points="92,60 60,75 60,105 92,90" fill="#3b82f6" />
                  <polygon points="28,60 16,48 48,42 60,45" fill="#bfdbfe" />
                  <polygon points="92,60 104,48 72,42 60,45" fill="#bfdbfe" />
                </svg>
              </div>

              <h3 className="text-white font-bold text-lg mb-1">No events</h3>
              <p className="text-slate-400 text-xs mb-5">
                Tap the <span className="font-bold text-white">+</span> button above to add new event
              </p>

              <button
                type="button"
                onClick={openAddModal}
                className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary-light)] hover:underline cursor-pointer"
              >
                EVENT
              </button>
            </div>
          ) : (
            <div className="space-y-3 pb-24">
              {filteredEvents.map((ev) => (
                <div
                  key={ev._id}
                  onClick={() => router.push(`/events/${ev._id}`)}
                  className="p-4 rounded-2xl bg-[#16171b] border border-white/6 hover:border-white/20 transition-all space-y-3 cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                        {ev.icon || "✈️"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-white text-base font-bold group-hover:text-[var(--color-primary-light)] transition-colors">
                            {ev.name}
                          </h4>
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                        </div>
                        <p className="text-slate-400 text-xs">
                          {ev.endingDate
                            ? `Ends: ${new Date(ev.endingDate).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}`
                            : "No end date set"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/5 text-slate-300">
                        {ev.currency}
                      </span>
                      <p className="text-xs text-slate-400 mt-1 font-semibold">
                        Spent:{" "}
                        <span className="text-white">
                          {formatMoney(ev.spent || 0, ev.currency)}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Footer with Wallet info & Quick Actions */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-white/5 text-xs">
                    <span className="text-slate-400">
                      Wallet: <strong className="text-white">{ev.walletId?.name || "All Wallets"}</strong>
                    </span>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEditModal(ev)}
                        className="p-1.5 rounded-lg bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                        title="Edit event"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(ev)}
                        className="p-1.5 rounded-lg bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                        title={ev.status === "RUNNING" ? "Mark Finished" : "Reopen"}
                      >
                        {ev.status === "RUNNING" ? (
                          <CheckCircle2 className="w-4 h-4 text-[var(--color-primary-light)]" />
                        ) : (
                          <RotateCcw className="w-4 h-4 text-amber-400" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => promptDeleteEvent(ev._id)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Delete event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit Event Modal ────────────────────────────────────────── */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSaved={fetchEvents}
        eventToEdit={eventToEdit}
      />

      {/* ── Custom Delete Confirmation Modal ─────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#16181e] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-white font-bold text-base">Delete event?</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                This event will be permanently removed. Connected transactions will no longer be linked to this event.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setPendingDeleteId(null);
                }}
                className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 font-semibold text-xs hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteEvent}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
