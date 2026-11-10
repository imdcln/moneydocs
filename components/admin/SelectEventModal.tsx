"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, Check, X } from "lucide-react";
import Link from "next/link";

export interface EventOption {
  _id: string;
  name: string;
  icon?: string;
  currency: string;
  endingDate?: string;
  status: "RUNNING" | "FINISHED";
  spent?: number;
}

interface SelectEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEventId?: string;
  onSelect: (event: EventOption | null) => void;
  /** Called when user taps MANAGE — caller should close all open pages then navigate */
  onManage?: () => void;
  /** When true, shows a full-screen loading spinner (while parent pages are closing/animating out) */
  navigating?: boolean;
}

export default function SelectEventModal({
  isOpen,
  onClose,
  selectedEventId,
  onSelect,
  onManage,
  navigating = false,
}: SelectEventModalProps) {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch("/api/finance/events")
        .then((r) => r.json())
        .then((d) => {
          setEvents(d.events ?? []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const filtered = events.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0.8 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0.8 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="fixed inset-0 z-[95] bg-[#0e1014] text-white flex flex-col"
        >
          {/* Full-screen loading overlay while parent pages animate out */}
          {navigating && (
            <div className="absolute inset-0 z-[10] bg-[#0e1014] flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8 bg-[#14161b]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-base font-bold text-white">Select Event</h2>
            </div>

            {onManage ? (
              <button
                type="button"
                onClick={onManage}
                className="text-xs font-bold text-[var(--color-primary-light)] hover:underline"
              >
                MANAGE
              </button>
            ) : (
              <Link
                href="/events"
                onClick={onClose}
                className="text-xs font-bold text-[var(--color-primary-light)] hover:underline"
              >
                MANAGE
              </Link>
            )}
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-white/6 bg-[#111216]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search event name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1a1c22] border border-white/8 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[var(--color-primary)]"
                autoFocus
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 pb-24">
            {/* None / Clear Option */}
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                onClose();
              }}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-colors text-left ${
                !selectedEventId
                  ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary-border)] text-white"
                  : "bg-[#16181d] border-white/6 text-slate-300 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400">
                  <X className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">No Event</p>
                  <p className="text-xs text-slate-500">Unassign event from this transaction</p>
                </div>
              </div>

              {!selectedEventId && (
                <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </button>

            {loading ? (
              <div className="py-12 text-center text-slate-500 text-sm">Loading events…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                <p>No events found.</p>
                {onManage ? (
                  <button
                    type="button"
                    onClick={onManage}
                    className="mt-2 inline-block text-xs font-bold text-[var(--color-primary-light)] hover:underline"
                  >
                    Create an event in Events &amp; Travels
                  </button>
                ) : (
                  <Link
                    href="/events"
                    onClick={onClose}
                    className="mt-2 inline-block text-xs font-bold text-[var(--color-primary-light)] hover:underline"
                  >
                    Create an event in Events &amp; Travels
                  </Link>
                )}
              </div>
            ) : (
              filtered.map((ev) => {
                const isSelected = selectedEventId === ev._id;

                return (
                  <button
                    key={ev._id}
                    type="button"
                    onClick={() => {
                      onSelect(ev);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-colors text-left ${
                      isSelected
                        ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary-border)] text-white"
                        : "bg-[#16181d] border-white/6 text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl flex-shrink-0">
                        {ev.icon || "✈️"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white truncate">{ev.name}</p>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              ev.status === "RUNNING"
                                ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)] border border-[var(--color-primary-border)]"
                                : "bg-slate-700 text-slate-400"
                            }`}
                          >
                            {ev.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Currency: <span className="font-semibold text-white">{ev.currency}</span>
                          {ev.endingDate && (
                            <span className="text-slate-500 ml-2">
                              · Ends {new Date(ev.endingDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white flex-shrink-0 ml-2">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
