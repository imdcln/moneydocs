"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Send,
  Mail,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  ExternalLink,
  Laptop,
  Bug,
  Lightbulb,
  Wallet,
  PieChart,
  HelpCircle,
  X,
  FileText,
} from "lucide-react";
import { EmptySupportIllustration } from "@/components/ui/AppIcons";
import { useToast } from "@/components/ui/Toast";
import { useTheme } from "@/context/ThemeContext";
import PageLoading from "@/components/ui/PageLoading";

interface SupportItem {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

const ISSUE_CATEGORIES = [
  { id: "Bug Report", label: "Bug Report", icon: Bug, color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
  { id: "Feature Request", label: "Feature Request", icon: Lightbulb, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { id: "Wallet & Balance", label: "Wallet & Balance", icon: Wallet, color: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
  { id: "Budget & Reports", label: "Budget & Reports", icon: PieChart, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { id: "General Inquiry", label: "General Inquiry", icon: HelpCircle, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
];

const DEVELOPER_EMAIL = "declane.docs@gmail.com";

export default function GetSupportPage() {
  const { toast } = useToast();
  const { currentColor } = useTheme();

  const [requests, setRequests] = useState<SupportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("declane.docs@gmail.com");
  const [userName, setUserName] = useState("Declane");

  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportItem | null>(null);
  const [category, setCategory] = useState("Bug Report");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedTicketInfo, setSubmittedTicketInfo] = useState<{ id: string; subject: string } | null>(null);

  // Fetch initial data
  useEffect(() => {
    // Fetch user
    fetch("/api/finance/user")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          if (d.user.email) {
            setUserEmail(d.user.email);
            setContactEmail(d.user.email);
          }
          if (d.user.name) setUserName(d.user.name);
        }
      })
      .catch(() => {});

    // Fetch existing tickets
    fetch("/api/finance/support")
      .then((r) => r.json())
      .then((d) => {
        if (d.tickets) {
          setRequests(d.tickets);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Get diagnostic / device info
  const getDeviceInfo = () => {
    if (typeof window === "undefined") return { appVersion: "2.3" };
    return {
      platform: navigator.platform || "Unknown",
      userAgent: navigator.userAgent || "Unknown",
      screen: `${window.innerWidth}x${window.innerHeight}`,
      appVersion: "Money Docs v2.3",
    };
  };

  // Submit issue handler
  const handleSendIssue = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!subject.trim()) {
      toast("Please enter a subject for your issue.", "error");
      return;
    }
    if (!message.trim()) {
      toast("Please enter details describing your issue.", "error");
      return;
    }

    setSubmitting(true);
    const deviceInfo = getDeviceInfo();
    const finalContact = contactEmail.trim() || userEmail;

    try {
      const res = await fetch("/api/finance/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          message: message.trim(),
          contactEmail: finalContact,
          deviceInfo,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Construct mailto link to declane.docs@gmail.com
        const mailSubject = encodeURIComponent(`[Money Docs Support] [${category}] ${subject.trim()}`);
        const mailBody = encodeURIComponent(
          `Hi Declane,\n\nI am submitting a support issue from Money Docs:\n\n` +
          `-----------------------------------------\n` +
          `Category: ${category}\n` +
          `Subject: ${subject.trim()}\n` +
          `From: ${userName} (${finalContact})\n` +
          `Date: ${new Date().toLocaleString()}\n` +
          `Device: ${deviceInfo.platform} | Screen: ${deviceInfo.screen}\n` +
          `App Version: Money Docs v2.3\n` +
          `-----------------------------------------\n\n` +
          `Issue Details:\n${message.trim()}\n\n` +
          `Thanks!`
        );

        const mailtoUrl = `mailto:${DEVELOPER_EMAIL}?subject=${mailSubject}&body=${mailBody}`;

        // Add to local state list
        const newTicket: SupportItem = {
          id: data.ticketId || `T-${Date.now()}`,
          category,
          subject: subject.trim(),
          message: message.trim(),
          status: "OPEN",
          createdAt: new Date().toISOString(),
        };

        setRequests((prev) => [newTicket, ...prev]);
        setSubmittedTicketInfo({ id: newTicket.id, subject: newTicket.subject });
        setShowSuccessModal(true);
        setShowCreateForm(false);

        // Reset form
        setSubject("");
        setMessage("");

        // Attempt to launch user's default email client pre-addressed to declane.docs@gmail.com
        try {
          const mailWindow = window.open(mailtoUrl, "_blank");
          if (!mailWindow || mailWindow.closed || typeof mailWindow.closed === "undefined") {
            window.location.href = mailtoUrl;
          }
        } catch {
          // Handled gracefully via modal button
        }

        toast("Issue submitted and sent to declane.docs@gmail.com!", "success");
      } else {
        toast(data.error || "Failed to submit issue.", "error");
      }
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 pt-3 pb-nav-safe max-w-lg mx-auto min-h-screen flex flex-col justify-between">
      <div className="space-y-5">
        {/* ── Top Bar matching 1Money Screenshot ──────────────────────────── */}
        <div className="flex items-center justify-between py-1">
          <Link
            href="/account/help"
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            title="Back to Help"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-white text-lg font-bold tracking-tight">Get support</h1>
          
          {/* Header Action: If requests exist, show "+" button */}
          {requests.length > 0 && !showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition-colors"
              title="Create new issue"
            >
              <Plus className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>

        {/* ── Main Body: Empty State matching Reference Screenshot ────────── */}
        {!loading && requests.length === 0 && !showCreateForm && (
          <div className="pt-24 pb-12 flex flex-col items-center justify-center text-center space-y-6">
            {/* The Reference Illustration */}
            <EmptySupportIllustration className="scale-110" />

            {/* "You have no request" text matching reference image */}
            <p className="text-slate-400 text-base font-normal tracking-wide">
              You have no request
            </p>

            {/* "Create issue" Pill Button matching reference image */}
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-8 py-3 rounded-full bg-[#15271e] hover:bg-[#1a3327] border border-emerald-500/30 text-emerald-400 text-sm font-semibold tracking-wide transition-all shadow-lg hover:shadow-emerald-950/40 active:scale-95 cursor-pointer"
            >
              Create issue
            </button>
          </div>
        )}

        {/* ── Existing Requests List (When user has submitted issues) ─────── */}
        {!loading && requests.length > 0 && !showCreateForm && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Your Support Requests ({requests.length})
              </span>
              <button
                onClick={() => setShowCreateForm(true)}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New issue</span>
              </button>
            </div>

            <div className="money-card bg-[#141519] border border-white/8 rounded-3xl divide-y divide-white/5 overflow-hidden shadow-lg">
              {requests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => setSelectedTicket(req)}
                  className="p-4 hover:bg-white/3 transition-colors cursor-pointer group flex items-center justify-between"
                >
                  <div className="space-y-1.5 min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {req.category}
                      </span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(req.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <p className="text-white text-sm font-semibold truncate group-hover:text-emerald-400 transition-colors">
                      {req.subject}
                    </p>
                    <p className="text-slate-400 text-xs line-clamp-1">
                      {req.message}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </div>
              ))}
            </div>

            {/* Target Email Info Card */}
            <div className="p-3.5 rounded-2xl bg-[#141519] border border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="text-slate-300 font-medium">Forwarded to: </span>
                <span className="text-emerald-400 font-semibold">{DEVELOPER_EMAIL}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Create Issue Form ────────────────────────────────────────────── */}
        {showCreateForm && (
          <form onSubmit={handleSendIssue} className="space-y-5 animate-in fade-in duration-200">
            {/* Header / Subtitle */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-base">New Support Issue</h2>
                <p className="text-slate-400 text-xs">
                  Your issue will be emailed to <span className="text-emerald-400">{DEVELOPER_EMAIL}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {ISSUE_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isSelected
                          ? "bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-sm"
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the issue or idea"
                className="w-full px-4 py-3 rounded-2xl bg-[#141519] border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
                maxLength={100}
                required
              />
            </div>

            {/* Message Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                <span className="text-[11px] text-slate-500">
                  {message.length} characters
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Explain what happened, what device you're on, or what improvement you have in mind..."
                rows={5}
                className="w-full px-4 py-3 rounded-2xl bg-[#141519] border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-colors resize-none leading-relaxed"
                required
              />
            </div>

            {/* Contact Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Your Contact Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-2.5 rounded-2xl bg-[#141519] border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
                required
              />
              <p className="text-[11px] text-slate-500">
                The developer will reply directly to this address.
              </p>
            </div>

            {/* Diagnostic Specs Badge */}
            <div className="p-3 rounded-2xl bg-white/3 border border-white/5 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-slate-400" />
                <span>Diagnostic info auto-attached</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                v2.3
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !subject.trim() || !message.trim()}
                className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                {submitting ? (
                  <span>Sending...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send issue</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Bottom Footer Notes ─────────────────────────────────────────── */}
      <div className="text-center pt-8 pb-4 text-slate-500 text-[11px] space-y-1.5">
        <div>
          <span>Direct support: </span>
          <a
            href={`mailto:${DEVELOPER_EMAIL}`}
            className="text-emerald-400 hover:underline font-semibold"
          >
            {DEVELOPER_EMAIL}
          </a>
        </div>
        <div>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
          >
            <span>Visit Developer Page</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* ── Success Confirmation Modal ────────────────────────────────────── */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-[#16181e] border border-white/10 p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-white text-lg font-bold">Issue Submitted!</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Your report has been recorded and directed to{" "}
                <span className="text-emerald-400 font-semibold">{DEVELOPER_EMAIL}</span>.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-black/40 border border-white/5 text-left text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Reference:</span>
                <span className="font-mono text-slate-200">{submittedTicketInfo?.id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Recipient:</span>
                <span className="text-slate-200">{DEVELOPER_EMAIL}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <a
                href={`mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent(
                  `[Money Docs Support] ${submittedTicketInfo?.subject || "Issue"}`
                )}`}
                className="w-full py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>Open in Email App</span>
              </a>
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ticket Detail Modal ──────────────────────────────────────────── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-[#16181e] border border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {selectedTicket.category}
              </span>
              <button
                onClick={() => setSelectedTicket(null)}
                className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-white text-base font-bold">
                {selectedTicket.subject}
              </h3>
              <p className="text-[11px] text-slate-500">
                Submitted on {new Date(selectedTicket.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 text-slate-300 text-xs max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap">
              {selectedTicket.message}
            </div>

            <div className="p-3 rounded-2xl bg-white/3 border border-white/5 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="text-emerald-400 font-semibold">{selectedTicket.status}</span>
              </div>
              <div className="flex justify-between">
                <span>Assigned Developer:</span>
                <span className="text-slate-300">{DEVELOPER_EMAIL}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedTicket(null)}
              className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition-colors"
            >
              Back to Requests
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
