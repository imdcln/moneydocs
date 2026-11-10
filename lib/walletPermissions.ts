export interface IWalletCrudPermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export interface IWalletPermissions {
  editWallet: boolean;
  editBalance: boolean;
  transactions: IWalletCrudPermissions;
  budgets: IWalletCrudPermissions;
  inviteMember: boolean;
  manageMembers: boolean;
}

export const DEFAULT_OWNER_PERMISSIONS: IWalletPermissions = {
  editWallet: true,
  editBalance: true,
  transactions: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  budgets: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  inviteMember: true,
  manageMembers: true,
};

export const DEFAULT_EDITOR_PERMISSIONS: IWalletPermissions = {
  editWallet: true,
  editBalance: true,
  transactions: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  budgets: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  inviteMember: true,
  manageMembers: false,
};

export const DEFAULT_VIEWER_PERMISSIONS: IWalletPermissions = {
  editWallet: false,
  editBalance: false,
  transactions: {
    create: false,
    read: true,
    update: false,
    delete: false,
  },
  budgets: {
    create: false,
    read: true,
    update: false,
    delete: false,
  },
  inviteMember: false,
  manageMembers: false,
};

export const DEFAULT_MANAGER_PERMISSIONS: IWalletPermissions = {
  editWallet: true,
  editBalance: true,
  transactions: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  budgets: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  inviteMember: true,
  manageMembers: true,
};

export function normalizePermissions(
  raw?: Partial<IWalletPermissions> | null,
  role?: string
): IWalletPermissions {
  const isViewer = role?.toUpperCase() === "VIEWER";
  const base = isViewer ? DEFAULT_VIEWER_PERMISSIONS : DEFAULT_EDITOR_PERMISSIONS;

  if (!raw) return JSON.parse(JSON.stringify(base));

  return {
    editWallet: raw.editWallet !== undefined ? Boolean(raw.editWallet) : base.editWallet,
    editBalance: raw.editBalance !== undefined ? Boolean(raw.editBalance) : base.editBalance,
    transactions: {
      create:
        raw.transactions?.create !== undefined
          ? Boolean(raw.transactions.create)
          : base.transactions.create,
      read:
        raw.transactions?.read !== undefined
          ? Boolean(raw.transactions.read)
          : base.transactions.read,
      update:
        raw.transactions?.update !== undefined
          ? Boolean(raw.transactions.update)
          : base.transactions.update,
      delete:
        raw.transactions?.delete !== undefined
          ? Boolean(raw.transactions.delete)
          : base.transactions.delete,
    },
    budgets: {
      create:
        raw.budgets?.create !== undefined
          ? Boolean(raw.budgets.create)
          : base.budgets.create,
      read:
        raw.budgets?.read !== undefined
          ? Boolean(raw.budgets.read)
          : base.budgets.read,
      update:
        raw.budgets?.update !== undefined
          ? Boolean(raw.budgets.update)
          : base.budgets.update,
      delete:
        raw.budgets?.delete !== undefined
          ? Boolean(raw.budgets.delete)
          : base.budgets.delete,
    },
    inviteMember:
      raw.inviteMember !== undefined ? Boolean(raw.inviteMember) : base.inviteMember,
    manageMembers:
      raw.manageMembers !== undefined ? Boolean(raw.manageMembers) : base.manageMembers,
  };
}

export interface MinimalWalletUser {
  email: string;
  role?: string;
  roleName?: string;
  status?: string;
  permissions?: Partial<IWalletPermissions>;
  image?: string;
  profileColor?: string;
}

export interface MinimalWallet {
  _id?: string | unknown;
  userId?: string | unknown;
  ownerEmail?: string;
  sharedWith?: MinimalWalletUser[];
}

export function getUserWalletPermissions(
  wallet: MinimalWallet | null | undefined,
  userEmail?: string | null,
  userId?: string | null
): IWalletPermissions {
  if (!wallet) return JSON.parse(JSON.stringify(DEFAULT_VIEWER_PERMISSIONS));

  // If user is owner
  const isOwner = Boolean(
    (userId && wallet.userId && String(wallet.userId) === String(userId)) ||
      (userEmail &&
        wallet.ownerEmail &&
        wallet.ownerEmail.toLowerCase() === userEmail.toLowerCase()) ||
      (!wallet.userId && !wallet.ownerEmail)
  );

  if (isOwner) {
    return JSON.parse(JSON.stringify(DEFAULT_OWNER_PERMISSIONS));
  }

  if (!userEmail) {
    return JSON.parse(JSON.stringify(DEFAULT_VIEWER_PERMISSIONS));
  }

  const member = (wallet.sharedWith || []).find(
    (m) => m.email.toLowerCase() === userEmail.toLowerCase()
  );

  if (!member) {
    return JSON.parse(JSON.stringify(DEFAULT_VIEWER_PERMISSIONS));
  }

  return normalizePermissions(member.permissions, member.role || member.roleName);
}
