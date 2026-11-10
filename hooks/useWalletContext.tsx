"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import {
  IWalletPermissions,
  getUserWalletPermissions,
  DEFAULT_OWNER_PERMISSIONS,
  DEFAULT_VIEWER_PERMISSIONS,
} from "@/lib/walletPermissions";

export interface WalletMemberSummary {
  email: string;
  name?: string;
  role: string;
  roleName?: string;
  status?: string;
  permissions?: IWalletPermissions;
  image?: string;
  profileColor?: string;
}

export interface WalletSummary {
  _id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  icon?: string;
  isDefault?: boolean;
  excludeFromTotal?: boolean;
  enableNotification?: boolean;
  userId?: string;
  ownerEmail?: string;
  ownerName?: string;
  ownerImage?: string;
  ownerProfileColor?: string;
  sharedWith?: WalletMemberSummary[];
}

export interface CurrentUserSummary {
  id: string;
  email: string;
}

interface WalletContextType {
  /** The currently-selected wallet ID across all pages, or "ALL" for global view. */
  selectedWalletId: string;
  setSelectedWalletId: (id: string) => void;
  /** Master wallet list (refreshed from the API). */
  wallets: WalletSummary[];
  setWallets: (wallets: WalletSummary[]) => void;
  /** Force a fresh fetch from the server. */
  refreshWallets: () => void;
  /** Logged-in user info (id & email) */
  currentUser: CurrentUserSummary | null;
  /** Resolved permissions for the currently-selected wallet */
  activeWalletPermissions: IWalletPermissions;
  /** Get permissions for any specific wallet */
  getPermissionsForWallet: (walletId?: string) => IWalletPermissions;
}

const WalletContext = createContext<WalletContextType | null>(null);

const STORAGE_KEY = "selected_wallet_id";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWalletsState] = useState<WalletSummary[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUserSummary | null>(null);

  // "ALL" = global/aggregated view; any wallet._id = that specific wallet is active.
  const [selectedWalletId, setSelectedWalletIdState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    }
    return "ALL";
  });

  const setSelectedWalletId = useCallback((id: string) => {
    setSelectedWalletIdState(id);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {}
      window.dispatchEvent(
        new CustomEvent("wallet-selected-changed", { detail: { walletId: id } })
      );
    }
  }, []);

  const fetchWallets = useCallback(() => {
    fetch("/api/finance/wallets")
      .then((r) => r.json())
      .then((d) => {
        const list: WalletSummary[] = d.wallets ?? [];
        setWalletsState(list);
        if (d.currentUser) {
          setCurrentUser(d.currentUser);
        }

        if (typeof window !== "undefined") {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved === "ALL") {
            setSelectedWalletIdState("ALL");
          } else if (saved && list.some((w) => w._id === saved)) {
            setSelectedWalletIdState(saved);
          } else if (list.length > 0) {
            const def = list.find((w) => w.isDefault) ?? list[0];
            setSelectedWalletIdState(def._id);
            try {
              localStorage.setItem(STORAGE_KEY, def._id);
            } catch {}
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch once on mount.
  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  // Sync across tabs or window events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setSelectedWalletIdState(e.newValue);
      }
    };
    const handleSelectedChange = (e: Event) => {
      const detail = (e as CustomEvent<{ walletId?: string }>).detail;
      if (detail?.walletId && detail.walletId !== selectedWalletId) {
        setSelectedWalletIdState(detail.walletId);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("wallet-selected-changed", handleSelectedChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("wallet-selected-changed", handleSelectedChange);
    };
  }, [selectedWalletId]);

  // When WalletManagerModal changes the default wallet, re-select it globally.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ wallets?: WalletSummary[]; defaultId?: string }>).detail;
      if (detail?.wallets) {
        setWalletsState(detail.wallets);
        if (detail.defaultId) {
          setSelectedWalletId(detail.defaultId);
        }
      } else {
        fetchWallets();
      }
    };
    window.addEventListener("wallet-default-changed", handler);
    return () => window.removeEventListener("wallet-default-changed", handler);
  }, [fetchWallets, setSelectedWalletId]);

  const setWallets = useCallback((list: WalletSummary[]) => {
    setWalletsState(list);
  }, []);

  const getPermissionsForWallet = useCallback(
    (walletId?: string): IWalletPermissions => {
      if (!walletId || walletId === "ALL") {
        // If "ALL" is selected, user has permissions if they have them on at least one wallet
        if (wallets.length === 0) return DEFAULT_OWNER_PERMISSIONS;
        const canCreateAny = wallets.some(
          (w) =>
            getUserWalletPermissions(w, currentUser?.email, currentUser?.id)
              .transactions.create
        );
        const canReadAny = wallets.some(
          (w) =>
            getUserWalletPermissions(w, currentUser?.email, currentUser?.id)
              .transactions.read
        );
        const canBudgetAny = wallets.some(
          (w) =>
            getUserWalletPermissions(w, currentUser?.email, currentUser?.id)
              .budgets.create
        );
        return {
          ...DEFAULT_OWNER_PERMISSIONS,
          transactions: {
            ...DEFAULT_OWNER_PERMISSIONS.transactions,
            create: canCreateAny,
            read: canReadAny,
          },
          budgets: {
            ...DEFAULT_OWNER_PERMISSIONS.budgets,
            create: canBudgetAny,
          },
        };
      }

      const target = wallets.find((w) => String(w._id) === String(walletId));
      if (!target) return DEFAULT_VIEWER_PERMISSIONS;

      return getUserWalletPermissions(target, currentUser?.email, currentUser?.id);
    },
    [wallets, currentUser]
  );

  const activeWalletPermissions = useMemo(() => {
    return getPermissionsForWallet(selectedWalletId);
  }, [getPermissionsForWallet, selectedWalletId]);

  return (
    <WalletContext.Provider
      value={{
        selectedWalletId,
        setSelectedWalletId,
        wallets,
        setWallets,
        refreshWallets: fetchWallets,
        currentUser,
        activeWalletPermissions,
        getPermissionsForWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWalletContext must be used within WalletProvider");
  return ctx;
}
