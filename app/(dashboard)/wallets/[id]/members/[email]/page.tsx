"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Wallet as WalletIcon,
  Sliders,
  UserPlus,
  Users,
  Eye,
  Plus,
  Edit3,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import PageLoading from "@/components/ui/PageLoading";
import {
  IWalletPermissions,
  DEFAULT_EDITOR_PERMISSIONS,
  DEFAULT_VIEWER_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  normalizePermissions,
} from "@/lib/walletPermissions";

interface MemberData {
  email: string;
  name?: string;
  role: string;
  roleName?: string;
  permissions?: IWalletPermissions;
  status?: string;
  image?: string;
  profileColor?: string;
}

interface WalletData {
  _id: string;
  name: string;
  currency: string;
  icon?: string;
  userId?: string;
  ownerEmail?: string;
  ownerName?: string;
  sharedWith?: MemberData[];
}

const ROLE_PRESETS = [
  { label: "Editor", role: "EDITOR", permissions: DEFAULT_EDITOR_PERMISSIONS },
  { label: "Viewer", role: "VIEWER", permissions: DEFAULT_VIEWER_PERMISSIONS },
  { label: "Manager", role: "MANAGER", permissions: DEFAULT_MANAGER_PERMISSIONS },
  { label: "Accountant", role: "EDITOR", permissions: DEFAULT_EDITOR_PERMISSIONS },
];

export default function EditMemberPermissionsPage({
  params,
}: {
  params: Promise<{ id: string; email: string }>;
}) {
  const { id: walletId, email: rawEmail } = use(params);
  const memberEmail = decodeURIComponent(rawEmail);
  const router = useRouter();
  const { toast } = useToast();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [member, setMember] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [roleName, setRoleName] = useState("Editor");
  const [permissions, setPermissions] = useState<IWalletPermissions>(DEFAULT_EDITOR_PERMISSIONS);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/finance/wallets?id=${walletId}`);
        if (!res.ok) {
          throw new Error("Failed to load wallet");
        }
        const data = await res.json();
        const w: WalletData = data.wallet;
        if (!isMounted) return;

        setWallet(w);

        const target = (w.sharedWith || []).find(
          (m) => m.email.toLowerCase() === memberEmail.toLowerCase()
        );

        if (target) {
          setMember(target);
          const rName = target.roleName || (target.role === "VIEWER" ? "Viewer" : "Editor");
          setRoleName(rName);

          const currentPerms = normalizePermissions(target.permissions, target.role);
          setPermissions(currentPerms);
        }
      } catch {
        toast("Unable to load member permissions", "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [walletId, memberEmail, toast]);

  const toggleGeneral = (key: "editWallet" | "editBalance" | "inviteMember" | "manageMembers") => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleTx = (key: keyof IWalletPermissions["transactions"]) => {
    setPermissions((prev) => ({
      ...prev,
      transactions: {
        ...prev.transactions,
        [key]: !prev.transactions[key],
      },
    }));
  };

  const toggleBudget = (key: keyof IWalletPermissions["budgets"]) => {
    setPermissions((prev) => ({
      ...prev,
      budgets: {
        ...prev.budgets,
        [key]: !prev.budgets[key],
      },
    }));
  };

  const handleApplyPreset = (preset: typeof ROLE_PRESETS[0]) => {
    setRoleName(preset.label);
    setPermissions(JSON.parse(JSON.stringify(preset.permissions)));
    toast(`Applied "${preset.label}" preset`, "info");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const trimmedRoleName = roleName.trim() || (permissions.transactions.update ? "Editor" : "Viewer");
      const res = await fetch("/api/finance/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: walletId,
          updateMemberEmail: memberEmail,
          roleName: trimmedRoleName,
          role: permissions.transactions.update ? "EDITOR" : "VIEWER",
          permissions,
        }),
      });

      if (res.ok) {
        toast("Member permissions saved successfully", "success");
        router.back();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to save permissions", "error");
      }
    } catch {
      toast("Error saving permissions", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoading title="Loading Permissions..." subtitle="Fetching member access rights" />;
  }

  if (!wallet || !member) {
    return (
      <div className="min-h-screen bg-[#0e1014] text-white flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-400 font-bold mb-4">Member not found in this wallet.</p>
        <button
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const displayName = member.name || member.email.split("@")[0];
  const initial = (displayName[0] || "U").toUpperCase();

  const renderToggle = (checked: boolean, onToggle: () => void) => (
    <button
      type="button"
      onClick={onToggle}
      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
        checked ? "bg-[var(--color-primary)]" : "bg-white/10"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );

  return (
    <div className="min-h-screen bg-[#111216] text-white flex flex-col pb-24">
      <div className="max-w-lg mx-auto w-full px-4 pt-3">
        {/* Top Header matching Edit Wallet */}
        <div className="flex items-center justify-between py-3 border-b border-white/6 mb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-white text-base font-bold">Edit Permissions</h2>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-white text-sm font-bold tracking-wider hover:text-[var(--color-primary-light)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? "SAVING…" : "SAVE"}
          </button>
        </div>

        {/* Member Profile Summary Card */}
        <div className="p-4 bg-[#181920] border border-white/6 rounded-2xl flex items-center gap-3.5 mb-4 shadow-sm">
          {member.image ? (
            <img
              src={member.image}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover border border-white/10 flex-shrink-0"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-base font-extrabold text-white flex-shrink-0 shadow-sm"
              style={{
                backgroundColor: member.profileColor || "#3b82f6",
              }}
            >
              {initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base truncate">{displayName}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300 border border-white/10">
                {roleName || "Member"}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate mt-0.5">{member.email}</p>
          </div>
        </div>

        {/* Role Name Input & Quick Presets */}
        <div className="p-4 bg-[#181920] border border-white/6 rounded-2xl mb-4 space-y-2.5 shadow-sm">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Role Name
          </label>
          <input
            type="text"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g. Editor, Accountant, Viewer"
            className="w-full bg-[#121318] border border-white/8 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white outline-none focus:border-[var(--color-primary)] transition-colors placeholder-slate-600"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ROLE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  roleName === preset.label
                    ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)] border border-[var(--color-primary-border)]"
                    : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Section 1: Wallet Permissions ───────────────────────────────── */}
        <div className="mb-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">
            Wallet
          </h4>
          <div className="bg-[#181920] border border-white/6 rounded-2xl overflow-hidden divide-y divide-white/4 shadow-sm">
            <div className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
                  <WalletIcon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-200">Edit wallet details</span>
              </div>
              {renderToggle(permissions.editWallet, () => toggleGeneral("editWallet"))}
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
                  <Sliders className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-200">Edit balance</span>
              </div>
              {renderToggle(permissions.editBalance, () => toggleGeneral("editBalance"))}
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
                  <UserPlus className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-200">Invite members</span>
              </div>
              {renderToggle(permissions.inviteMember, () => toggleGeneral("inviteMember"))}
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-200">Manage members</span>
              </div>
              {renderToggle(permissions.manageMembers, () => toggleGeneral("manageMembers"))}
            </div>
          </div>
        </div>

        {/* ── Section 2: Transactions Permissions ─────────────────────────── */}
        <div className="mb-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">
            Transactions
          </h4>
          <div className="bg-[#181920] border border-white/6 rounded-2xl overflow-hidden divide-y divide-white/4 shadow-sm">
            <div className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
                  <Eye className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-200">View transactions</span>
              </div>
              {renderToggle(permissions.transactions.read, () => toggleTx("read"))}
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-200">Add transactions</span>
              </div>
              {renderToggle(permissions.transactions.create, () => toggleTx("create"))}
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
                  <Edit3 className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-200">Edit transactions</span>
              </div>
              {renderToggle(permissions.transactions.update, () => toggleTx("update"))}
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
                  <Trash2 className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-200">Delete transactions</span>
              </div>
              {renderToggle(permissions.transactions.delete, () => toggleTx("delete"))}
            </div>
          </div>
        </div>

        {/* ── Section 3: Budgets Permissions ──────────────────────────────── */}
        <div className="mb-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">
            Budgets
          </h4>
          <div className="bg-[#181920] border border-white/6 rounded-2xl overflow-hidden divide-y divide-white/4 shadow-sm">
            <div className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
                  <Eye className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-200">View budgets</span>
              </div>
              {renderToggle(permissions.budgets.read, () => toggleBudget("read"))}
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-200">Create budgets</span>
              </div>
              {renderToggle(permissions.budgets.create, () => toggleBudget("create"))}
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
                  <Edit3 className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-200">Edit budgets</span>
              </div>
              {renderToggle(permissions.budgets.update, () => toggleBudget("update"))}
            </div>

            <div className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300">
                  <Trash2 className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-200">Delete budgets</span>
              </div>
              {renderToggle(permissions.budgets.delete, () => toggleBudget("delete"))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
