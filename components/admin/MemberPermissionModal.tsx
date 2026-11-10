"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Check,
  Wallet,
  Sliders,
  UserPlus,
  Users,
  Eye,
  Plus,
  Edit3,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  IWalletPermissions,
  normalizePermissions,
  DEFAULT_EDITOR_PERMISSIONS,
  DEFAULT_VIEWER_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
} from "@/lib/walletPermissions";

export interface SharedMemberData {
  email: string;
  name?: string;
  role: string;
  roleName?: string;
  status?: string;
  permissions?: IWalletPermissions;
  image?: string;
  profileColor?: string;
}

interface MemberPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletId: string;
  member: SharedMemberData | null;
  onSaved: (updatedPermissions: IWalletPermissions, updatedRoleName: string) => void;
}

const ROLE_PRESETS = [
  { label: "Editor", role: "EDITOR", permissions: DEFAULT_EDITOR_PERMISSIONS },
  { label: "Viewer", role: "VIEWER", permissions: DEFAULT_VIEWER_PERMISSIONS },
  { label: "Manager", role: "MANAGER", permissions: DEFAULT_MANAGER_PERMISSIONS },
  { label: "Accountant", role: "EDITOR", permissions: DEFAULT_EDITOR_PERMISSIONS },
];

export default function MemberPermissionModal({
  isOpen,
  onClose,
  walletId,
  member,
  onSaved,
}: MemberPermissionModalProps) {
  const { toast } = useToast();
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState<IWalletPermissions>(DEFAULT_EDITOR_PERMISSIONS);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (member) {
      setRoleName(member.roleName || (member.role === "VIEWER" ? "Viewer" : "Editor"));
      setPermissions(normalizePermissions(member.permissions, member.role));
    }
  }, [member]);

  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  const walletCount = useMemo(() => {
    let c = 0;
    if (permissions.editWallet) c++;
    if (permissions.editBalance) c++;
    if (permissions.inviteMember) c++;
    if (permissions.manageMembers) c++;
    return c;
  }, [permissions]);

  const txCount = useMemo(() => {
    let c = 0;
    if (permissions.transactions.read) c++;
    if (permissions.transactions.create) c++;
    if (permissions.transactions.update) c++;
    if (permissions.transactions.delete) c++;
    return c;
  }, [permissions]);

  const budgetCount = useMemo(() => {
    let c = 0;
    if (permissions.budgets.read) c++;
    if (permissions.budgets.create) c++;
    if (permissions.budgets.update) c++;
    if (permissions.budgets.delete) c++;
    return c;
  }, [permissions]);

  if (!mounted || !isOpen || !member) return null;

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

  const handleGrantAll = () => {
    setPermissions({
      editWallet: true,
      editBalance: true,
      inviteMember: true,
      manageMembers: true,
      transactions: { read: true, create: true, update: true, delete: true },
      budgets: { read: true, create: true, update: true, delete: true },
    });
    toast("Granted all permissions", "info");
  };

  const handleGrantReadOnly = () => {
    setRoleName("Viewer");
    setPermissions({
      editWallet: false,
      editBalance: false,
      inviteMember: false,
      manageMembers: false,
      transactions: { read: true, create: false, update: false, delete: false },
      budgets: { read: true, create: false, update: false, delete: false },
    });
    toast('Set to "Read Only" access', "info");
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
          updateMemberEmail: member.email,
          roleName: trimmedRoleName,
          role: permissions.transactions.update ? "EDITOR" : "VIEWER",
          permissions,
        }),
      });

      if (res.ok) {
        toast("Member permissions updated", "success");
        onSaved(permissions, trimmedRoleName);
        onClose();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to update permissions", "error");
      }
    } catch {
      toast("Error saving permissions", "error");
    } finally {
      setSaving(false);
    }
  };

  const displayName = member.name || member.email.split("@")[0];
  const initial = (displayName[0] || "U").toUpperCase();

  const renderToggle = (checked: boolean, onToggle: () => void) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
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

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-[#111216] text-white flex flex-col overflow-y-auto overscroll-contain animate-fade-in">
      <div className="max-w-lg mx-auto w-full min-h-screen flex flex-col p-4 pb-36">
        {/* Top Header strictly matching Edit Wallet */}
        <div className="flex items-center justify-between py-3 border-b border-white/6 mb-4">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-white text-base font-bold">Edit permissions</h2>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-white text-sm font-bold tracking-wider hover:text-[var(--color-primary-light)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? "SAVING…" : "SAVE"}
          </button>
        </div>

        {/* Member Profile Summary Card strictly matching Edit Wallet member item */}
        <div className="p-4 bg-[#181920] border border-white/6 rounded-2xl flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-white/10 flex items-center justify-center flex-shrink-0 shadow-md">
              {member.image ? (
                <img
                  src={member.image}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div
                  className={`w-full h-full flex items-center justify-center text-white font-bold text-sm ${
                    member.profileColor?.includes("from-")
                      ? `bg-gradient-to-tr ${member.profileColor}`
                      : "bg-gradient-to-tr from-slate-600 to-slate-700"
                  }`}
                  style={
                    member.profileColor && !member.profileColor.includes("from-")
                      ? { backgroundColor: member.profileColor }
                      : undefined
                  }
                >
                  {initial}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-bold truncate">{displayName}</p>
              <p className="text-slate-400 text-xs truncate">{member.email}</p>
            </div>
          </div>
          <span className="text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/25 px-2.5 py-0.5 rounded-md font-bold flex-shrink-0 ml-2">
            {roleName || (member.role === "VIEWER" ? "Viewer" : "Editor")}
          </span>
        </div>

        {/* Role Name Input & Quick Role Presets matching Edit Wallet theme */}
        <div className="p-4 bg-[#181920] border border-white/6 rounded-2xl mb-3 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block">
              Role Name
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGrantAll}
                className="text-[11px] font-semibold text-[var(--color-primary-light)] hover:underline cursor-pointer"
              >
                Grant All
              </button>
              <span className="text-white/20 text-xs">•</span>
              <button
                type="button"
                onClick={handleGrantReadOnly}
                className="text-[11px] font-semibold text-slate-400 hover:text-white hover:underline cursor-pointer"
              >
                Read Only
              </button>
            </div>
          </div>

          <input
            type="text"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g. Editor, Accountant, Viewer"
            className="w-full bg-[#14151a] border border-white/8 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white outline-none focus:border-[var(--color-primary)] transition-colors placeholder-slate-600"
          />

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {ROLE_PRESETS.map((preset) => {
              const isSelected = roleName.toLowerCase() === preset.label.toLowerCase();
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-light)] border border-[var(--color-primary-border)]"
                      : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent"
                  }`}
                >
                  {preset.label}
                  {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-primary-light)]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Section 1: Wallet Management ───────────────────────────────── */}
        <div className="mb-3">
          <div className="flex items-center justify-between px-1 mb-2">
            <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              Wallet Management
            </h4>
            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
              {walletCount}/4 Active
            </span>
          </div>

          <div className="bg-[#181920] border border-white/6 rounded-2xl overflow-hidden divide-y divide-white/4">
            <div
              onClick={() => toggleGeneral("editWallet")}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300 flex-shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">Edit Wallet Details</p>
                  <p className="text-slate-400 text-xs truncate">Allow editing wallet name, currency, and settings</p>
                </div>
              </div>
              {renderToggle(permissions.editWallet, () => toggleGeneral("editWallet"))}
            </div>

            <div
              onClick={() => toggleGeneral("editBalance")}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300 flex-shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">Edit Balance</p>
                  <p className="text-slate-400 text-xs truncate">Allow manual adjustments to account balance</p>
                </div>
              </div>
              {renderToggle(permissions.editBalance, () => toggleGeneral("editBalance"))}
            </div>

            <div
              onClick={() => toggleGeneral("inviteMember")}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300 flex-shrink-0">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">Invite Members</p>
                  <p className="text-slate-400 text-xs truncate">Allow inviting new collaborators to this wallet</p>
                </div>
              </div>
              {renderToggle(permissions.inviteMember, () => toggleGeneral("inviteMember"))}
            </div>

            <div
              onClick={() => toggleGeneral("manageMembers")}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300 flex-shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">Manage Members</p>
                  <p className="text-slate-400 text-xs truncate">Allow editing roles, permissions, or removing members</p>
                </div>
              </div>
              {renderToggle(permissions.manageMembers, () => toggleGeneral("manageMembers"))}
            </div>
          </div>
        </div>

        {/* ── Section 2: Transaction Permissions ─────────────────────────── */}
        <div className="mb-3">
          <div className="flex items-center justify-between px-1 mb-2">
            <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              Transaction Permissions
            </h4>
            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
              {txCount}/4 Active
            </span>
          </div>

          <div className="bg-[#181920] border border-white/6 rounded-2xl overflow-hidden divide-y divide-white/4">
            <div
              onClick={() => toggleTx("read")}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300 flex-shrink-0">
                  <Eye className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">View Transactions</p>
                  <p className="text-slate-400 text-xs truncate">Allow browsing transactions, receipts, and details</p>
                </div>
              </div>
              {renderToggle(permissions.transactions.read, () => toggleTx("read"))}
            </div>

            <div
              onClick={() => toggleTx("create")}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300 flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">Add Transactions</p>
                  <p className="text-slate-400 text-xs truncate">Allow recording income, expense, and transfer entries</p>
                </div>
              </div>
              {renderToggle(permissions.transactions.create, () => toggleTx("create"))}
            </div>

            <div
              onClick={() => toggleTx("update")}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300 flex-shrink-0">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">Edit Transactions</p>
                  <p className="text-slate-400 text-xs truncate">Allow modifying transaction categories, dates, and amounts</p>
                </div>
              </div>
              {renderToggle(permissions.transactions.update, () => toggleTx("update"))}
            </div>

            <div
              onClick={() => toggleTx("delete")}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">Delete Transactions</p>
                  <p className="text-slate-400 text-xs truncate">Allow permanently deleting transaction records</p>
                </div>
              </div>
              {renderToggle(permissions.transactions.delete, () => toggleTx("delete"))}
            </div>
          </div>
        </div>

        {/* ── Section 3: Budget Permissions ──────────────────────────────── */}
        <div className="mb-3">
          <div className="flex items-center justify-between px-1 mb-2">
            <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              Budget Permissions
            </h4>
            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
              {budgetCount}/4 Active
            </span>
          </div>

          <div className="bg-[#181920] border border-white/6 rounded-2xl overflow-hidden divide-y divide-white/4">
            <div
              onClick={() => toggleBudget("read")}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300 flex-shrink-0">
                  <Eye className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">View Budgets</p>
                  <p className="text-slate-400 text-xs truncate">Allow viewing spending goals and budget progress</p>
                </div>
              </div>
              {renderToggle(permissions.budgets.read, () => toggleBudget("read"))}
            </div>

            <div
              onClick={() => toggleBudget("create")}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300 flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">Create Budgets</p>
                  <p className="text-slate-400 text-xs truncate">Allow creating new budget limits and categories</p>
                </div>
              </div>
              {renderToggle(permissions.budgets.create, () => toggleBudget("create"))}
            </div>

            <div
              onClick={() => toggleBudget("update")}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300 flex-shrink-0">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">Edit Budgets</p>
                  <p className="text-slate-400 text-xs truncate">Allow modifying budget amounts and periods</p>
                </div>
              </div>
              {renderToggle(permissions.budgets.update, () => toggleBudget("update"))}
            </div>

            <div
              onClick={() => toggleBudget("delete")}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">Delete Budgets</p>
                  <p className="text-slate-400 text-xs truncate">Allow removing budgets and spending limits</p>
                </div>
              </div>
              {renderToggle(permissions.budgets.delete, () => toggleBudget("delete"))}
            </div>
          </div>
        </div>

        {/* Generous bottom spacing so content never gets cut off */}
        <div className="h-12 flex-shrink-0" />
      </div>
    </div>,
    document.body
  );
}
