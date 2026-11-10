"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, UserPlus, X, Check, Users, Smartphone, Plus } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface WithPeopleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPeople: string[];
  onSave: (people: string[]) => void;
}

const COMMON_PRESETS = [
  "Family",
  "Friends",
  "Partner",
  "Colleagues",
  "Mom",
  "Dad",
  "Roommate",
  "Client",
];

export default function WithPeopleModal({
  isOpen,
  onClose,
  selectedPeople: initialSelected,
  onSave,
}: WithPeopleModalProps) {
  const { toast } = useToast();
  const [people, setPeople] = useState<string[]>(initialSelected);
  const [inputName, setInputName] = useState("");
  const [contactApiSupported, setContactApiSupported] = useState(false);
  const [showContactConfirmModal, setShowContactConfirmModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPeople(initialSelected);
      setInputName("");
      // Check for Contact Picker API support (Chromium on Android)
      if (typeof window !== "undefined" && "contacts" in navigator && "select" in (navigator as unknown as { contacts: { select: unknown } }).contacts) {
        setContactApiSupported(true);
      }
    }
  }, [isOpen, initialSelected]);

  const handleAddPerson = (nameToAdd?: string) => {
    const val = (nameToAdd || inputName).trim();
    if (!val) return;
    if (people.includes(val)) {
      toast(`${val} is already added`, "info");
      return;
    }
    setPeople((prev) => [...prev, val]);
    if (!nameToAdd) setInputName("");
  };

  const handleRemovePerson = (nameToRemove: string) => {
    setPeople((prev) => prev.filter((p) => p !== nameToRemove));
  };

  const handleImportContacts = () => {
    // If Contact Picker API is available
    const nav = navigator as unknown as { contacts?: { select: (props: string[], opts: { multiple: boolean }) => Promise<Array<{ name?: string[] }>> } };
    if (nav.contacts && typeof nav.contacts.select === "function") {
      setShowContactConfirmModal(true);
    } else {
      // Friendly fallback for non-Android / non-Chrome browsers
      toast("Contact picker is supported on Android Chrome. You can type names below.", "info");
    }
  };

  const executeImportContacts = async () => {
    setShowContactConfirmModal(false);
    const nav = navigator as unknown as { contacts?: { select: (props: string[], opts: { multiple: boolean }) => Promise<Array<{ name?: string[] }>> } };
    if (nav.contacts && typeof nav.contacts.select === "function") {
      try {
        const results = await nav.contacts.select(["name"], { multiple: true });
        if (results && results.length > 0) {
          const names: string[] = [];
          results.forEach((c) => {
            if (c.name && c.name[0]) {
              names.push(c.name[0].trim());
            }
          });
          const set = new Set([...people, ...names]);
          setPeople(Array.from(set));
          toast(`Added ${names.length} contacts`, "success");
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          toast("Unable to access contacts", "error");
        }
      }
    }
  };

  const handleDone = () => {
    onSave(people);
    onClose();
  };

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
              <h2 className="text-base font-bold text-white">With People</h2>
            </div>

            <button
              type="button"
              onClick={handleDone}
              className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary-light)] hover:brightness-110 cursor-pointer px-3 py-1.5 rounded-xl bg-[var(--color-primary-subtle)]"
            >
              DONE
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24">
            {/* Device Contact Import Button */}
            <div className="p-4 rounded-2xl bg-[#161820] border border-white/6 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Device Contacts</h4>
                    <p className="text-xs text-slate-400">
                      {contactApiSupported
                        ? "Import people directly from your phone"
                        : "Connect with contact list"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleImportContacts}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Import
                </button>
              </div>
            </div>

            {/* Manual Person Name Input */}
            <div className="p-4 rounded-2xl bg-[#161820] border border-white/6 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Add Person
              </h4>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <UserPlus className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddPerson();
                      }
                    }}
                    placeholder="Enter name (e.g. John, Alice)..."
                    className="w-full bg-[#111216] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAddPerson()}
                  disabled={!inputName.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[var(--color-primary)] hover:brightness-110 text-white font-bold text-xs disabled:opacity-50 transition-all cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Currently Selected People Labels */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Selected ({people.length})
                </h4>
                {people.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPeople([])}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {people.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#14151b] border border-dashed border-white/8 text-center text-slate-500 text-xs">
                  No people added yet. Type a name or select from presets below.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-[#14151b] border border-white/6">
                  {people.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)] border border-[var(--color-primary-border)] text-xs font-semibold animate-fade-in shadow-sm"
                    >
                      <Users className="w-3 h-3" />
                      <span>{p}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePerson(p)}
                        className="w-4 h-4 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Presets / Tags */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Quick Suggestions
              </h4>
              <div className="flex flex-wrap gap-2">
                {COMMON_PRESETS.map((preset) => {
                  const isSelected = people.includes(preset);
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        isSelected
                          ? handleRemovePerson(preset)
                          : handleAddPerson(preset)
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)] border border-[var(--color-primary-border)] font-bold"
                          : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/6"
                      }`}
                    >
                      {isSelected ? (
                        <Check className="w-3 h-3 stroke-[3]" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      <span>{preset}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Custom Contact Picker Confirmation Modal */}
          {showContactConfirmModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="w-full max-w-sm bg-[#16181e] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)] flex items-center justify-center mx-auto">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <h3 className="text-white font-bold text-base">Access device contacts?</h3>
                  <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                    Allow access to your device contacts to select people to tag in this transaction.
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowContactConfirmModal(false)}
                    className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 font-semibold text-xs hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={executeImportContacts}
                    className="flex-1 py-3 rounded-xl bg-[var(--color-primary)] hover:brightness-110 active:scale-95 text-white font-bold text-xs transition-all"
                  >
                    Allow
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
