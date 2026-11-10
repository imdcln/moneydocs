import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Wallet from "@/models/Wallet";
import Transaction from "@/models/Transaction";
import Budget from "@/models/Budget";
import User from "@/models/User";
import Notification from "@/models/Notification";
import { createAndSendNotification } from "@/lib/notifications";
import { getUserWalletPermissions, normalizePermissions } from "@/lib/walletPermissions";

async function getUserInfo(req?: NextRequest): Promise<{ id: string; email: string } | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  await connectDB();
  const user = (await User.findOne({ email: session.user.email }).lean()) as {
    _id: { toString(): string };
    email: string;
  } | null;
  return user ? { id: String(user._id), email: user.email.toLowerCase() } : null;
}

export async function GET(req: NextRequest) {
  const userInfo = await getUserInfo(req);
  if (!userInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const userObjectId = new mongoose.Types.ObjectId(userInfo.id);

  const { searchParams } = new URL(req.url);
  const singleId = searchParams.get("id");

  // Single wallet lookup
  if (singleId && mongoose.Types.ObjectId.isValid(singleId)) {
    const w = await Wallet.findOne({
      _id: singleId,
      $or: [
        { userId: userObjectId },
        { sharedWith: { $elemMatch: { email: userInfo.email } } },
      ],
    }).lean();

    if (!w) {
      return NextResponse.json({ error: "Wallet not found or permission denied" }, { status: 404 });
    }

    const owner = (await User.findById(w.userId)
      .select("_id email name image profileColor")
      .lean()) as { _id: mongoose.Types.ObjectId; email: string; name: string; image?: string; profileColor?: string } | null;

    const allMemberEmails = (w.sharedWith || []).map((m) => m.email.toLowerCase());
    const memberUsers = (await User.find({ email: { $in: allMemberEmails } })
      .select("email name image profileColor")
      .lean()) as Array<{ email: string; name: string; image?: string; profileColor?: string }>;
    const memberUserMap = new Map(memberUsers.map((u) => [u.email.toLowerCase(), u]));

    const isOwner = w.userId.toString() === userInfo.id;
    const memberEntry = (w.sharedWith || []).find(
      (m) => m.email.toLowerCase() === userInfo.email.toLowerCase()
    );

    const currentUserDoc = (await User.findById(userInfo.id).select("defaultWalletId").lean()) as {
      defaultWalletId?: mongoose.Types.ObjectId;
    } | null;
    const userDefaultWalletIdStr = currentUserDoc?.defaultWalletId
      ? String(currentUserDoc.defaultWalletId)
      : null;

    let resolvedIsDefault = false;
    if (userDefaultWalletIdStr) {
      resolvedIsDefault = String(w._id) === userDefaultWalletIdStr;
    } else if (isOwner) {
      resolvedIsDefault = Boolean(w.isDefault);
    } else if (memberEntry) {
      resolvedIsDefault = Boolean(memberEntry.isDefault);
    }

    const resolvedExcludeFromTotal = isOwner
      ? Boolean(w.excludeFromTotal)
      : Boolean(memberEntry?.excludeFromTotal);

    const resolvedEnableNotification = isOwner
      ? w.enableNotification !== false
      : memberEntry?.enableNotification !== undefined
      ? Boolean(memberEntry.enableNotification)
      : true;

    const resolvedSingleWallet = {
      ...w,
      isDefault: resolvedIsDefault,
      excludeFromTotal: resolvedExcludeFromTotal,
      enableNotification: resolvedEnableNotification,
      ownerEmail: owner?.email ?? "",
      ownerName: owner?.name ?? "",
      ownerImage: owner?.image ?? "",
      ownerProfileColor: owner?.profileColor ?? "",
      sharedWith: (w.sharedWith || []).map((m) => {
        const u = memberUserMap.get(m.email.toLowerCase());
        return {
          ...m,
          name: m.name || u?.name || "",
          image: u?.image || m.image || "",
          profileColor: u?.profileColor || m.profileColor || "",
          roleName: m.roleName || (m.role === "VIEWER" ? "Viewer" : "Editor"),
          permissions: normalizePermissions(m.permissions, m.role || m.roleName),
        };
      }),
    };

    return NextResponse.json({ wallet: resolvedSingleWallet, currentUser: { id: userInfo.id, email: userInfo.email } });
  }

  // Return owned wallets + wallets where this user has ACCEPTED the invite
  const walletsRaw = await Wallet.find({
    $or: [
      { userId: userObjectId },
      { sharedWith: { $elemMatch: { email: userInfo.email, status: "ACCEPTED" } } },
    ],
  })
    .sort({ isDefault: -1, createdAt: 1 })
    .lean();

  // Attach owner info (email + name + image + profileColor) to each wallet
  const ownerIds = [...new Set(walletsRaw.map((w) => w.userId.toString()))];
  const owners = (await User.find({ _id: { $in: ownerIds } })
    .select("_id email name image profileColor")
    .lean()) as Array<{ _id: mongoose.Types.ObjectId; email: string; name: string; image?: string; profileColor?: string }>;
  const ownerMap = new Map(
    owners.map((o) => [
      o._id.toString(),
      {
        email: o.email,
        name: o.name,
        image: o.image || "",
        profileColor: o.profileColor || "",
      },
    ])
  );

  // Also collect all member emails to populate member names, images, profileColors
  const allMemberEmails = [
    ...new Set(walletsRaw.flatMap((w) => (w.sharedWith || []).map((m) => m.email.toLowerCase()))),
  ];
  const memberUsers = (await User.find({ email: { $in: allMemberEmails } })
    .select("email name image profileColor")
    .lean()) as Array<{ email: string; name: string; image?: string; profileColor?: string }>;
  const memberUserMap = new Map(memberUsers.map((u) => [u.email.toLowerCase(), u]));

  // Fetch calling user's defaultWalletId and custom walletOrder
  const currentUserDoc = (await User.findById(userInfo.id).select("defaultWalletId walletOrder").lean()) as {
    defaultWalletId?: mongoose.Types.ObjectId;
    walletOrder?: Array<mongoose.Types.ObjectId | string>;
  } | null;
  const userDefaultWalletIdStr = currentUserDoc?.defaultWalletId
    ? String(currentUserDoc.defaultWalletId)
    : null;

  const wallets = walletsRaw.map((w) => {
    const isOwner = w.userId.toString() === userInfo.id;
    const memberEntry = (w.sharedWith || []).find(
      (m) => m.email.toLowerCase() === userInfo.email.toLowerCase()
    );

    // Resolve isDefault per user (never allows multiple defaults for the user)
    let resolvedIsDefault = false;
    if (userDefaultWalletIdStr) {
      resolvedIsDefault = String(w._id) === userDefaultWalletIdStr;
    } else if (isOwner) {
      resolvedIsDefault = Boolean(w.isDefault);
    } else if (memberEntry) {
      resolvedIsDefault = Boolean(memberEntry.isDefault);
    }

    // Resolve excludeFromTotal per user
    const resolvedExcludeFromTotal = isOwner
      ? Boolean(w.excludeFromTotal)
      : Boolean(memberEntry?.excludeFromTotal);

    // Resolve enableNotification per user
    const resolvedEnableNotification = isOwner
      ? w.enableNotification !== false
      : memberEntry?.enableNotification !== undefined
      ? Boolean(memberEntry.enableNotification)
      : true;

    return {
      ...w,
      isDefault: resolvedIsDefault,
      excludeFromTotal: resolvedExcludeFromTotal,
      enableNotification: resolvedEnableNotification,
      ownerEmail: ownerMap.get(w.userId.toString())?.email ?? "",
      ownerName: ownerMap.get(w.userId.toString())?.name ?? "",
      ownerImage: ownerMap.get(w.userId.toString())?.image ?? "",
      ownerProfileColor: ownerMap.get(w.userId.toString())?.profileColor ?? "",
      sharedWith: (w.sharedWith || []).map((m) => {
        const u = memberUserMap.get(m.email.toLowerCase());
        return {
          ...m,
          name: m.name || u?.name || "",
          image: u?.image || m.image || "",
          profileColor: u?.profileColor || m.profileColor || "",
          roleName: m.roleName || (m.role === "VIEWER" ? "Viewer" : "Editor"),
          permissions: normalizePermissions(m.permissions, m.role || m.roleName),
        };
      }),
    };
  });

  // Apply custom wallet ordering if set by user
  if (currentUserDoc?.walletOrder && currentUserDoc.walletOrder.length > 0) {
    const orderMap = new Map(
      currentUserDoc.walletOrder.map((id, index) => [id.toString(), index])
    );
    wallets.sort((a, b) => {
      const aId = String(a._id);
      const bId = String(b._id);
      const aIdx = orderMap.has(aId) ? orderMap.get(aId)! : 999999;
      const bIdx = orderMap.has(bId) ? orderMap.get(bId)! : 999999;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0);
    });
  }

  const walletsRes = NextResponse.json({ wallets, currentUser: { id: userInfo.id, email: userInfo.email } });
  // Wallet data is per-user; cache for 10 s, serve stale for 20 s while revalidating
  walletsRes.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=20");
  return walletsRes;
}

export async function POST(req: NextRequest) {
  const userInfo = await getUserInfo(req);
  if (!userInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, icon, type, balance, currency, isDefault } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "A valid name is required" }, { status: 400 });
  }

  // Security: Sanitize name
  const sanitizedName = name.trim().slice(0, 50).replace(/[<>]/g, "");

  const numBalance = typeof balance === "number" && isFinite(balance) ? balance : 0;

  await connectDB();

  // If setting as default, unset existing default for this user
  if (isDefault) {
    await Wallet.updateMany({ userId: userInfo.id }, { isDefault: false });
    await Wallet.updateMany(
      { "sharedWith.email": userInfo.email },
      { $set: { "sharedWith.$[elem].isDefault": false } },
      { arrayFilters: [{ "elem.email": userInfo.email }] }
    );
  }

  const wallet = await Wallet.create({
    userId: userInfo.id,
    name: sanitizedName,
    icon: (icon && typeof icon === "string") ? icon.slice(0, 10) : "💳",
    type: type || "CASH",
    balance: numBalance,
    currency: (currency && typeof currency === "string") ? currency.slice(0, 5).toUpperCase() : "IDR",
    isDefault: Boolean(isDefault),
  });

  if (isDefault) {
    await User.findByIdAndUpdate(userInfo.id, { defaultWalletId: wallet._id });
  }

  return NextResponse.json({ wallet }, { status: 201 });
}

/** PATCH /api/finance/wallets â€” Update wallet (balance, default, sharing, permissions, metadata) */
export async function PATCH(req: NextRequest) {
  const userInfo = await getUserInfo(req);
  if (!userInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    id,
    isDefault,
    balance,
    excludeFromReport,
    excludeFromTotal,
    archived,
    enableNotification,
    disabledCategories,
    name,
    icon,
    currency,
    description,
    shareEmail,
    removeShareEmail,
    leaveWallet,
    updateMemberEmail,
    roleName,
    role,
    permissions,
  } = body;

  if (!id || typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Valid wallet id is required" }, { status: 400 });
  }

  await connectDB();

  // Check ownership or member access
  const wallet = await Wallet.findOne({
    _id: id,
    $or: [
      { userId: userInfo.id },
      { sharedWith: { $elemMatch: { email: userInfo.email } } },
    ],
  });

  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found or permission denied" }, { status: 404 });
  }

  const isOwner = wallet.userId.toString() === userInfo.id;
  const callerPerms = getUserWalletPermissions(wallet, userInfo.email, userInfo.id);

  // â”€â”€ Leave wallet (member action) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (leaveWallet) {
    if (isOwner) {
      return NextResponse.json(
        { error: "Owner cannot leave their own wallet. You can delete it instead." },
        { status: 400 }
      );
    }

    // Pull member from sharedWith
    await Wallet.findByIdAndUpdate(id, {
      $pull: { sharedWith: { email: userInfo.email } },
    });

    // Notify owner
    const leavingUser = (await User.findById(userInfo.id).select("name email").lean()) as {
      name?: string;
      email?: string;
    } | null;
    const leavingDisplayName = leavingUser?.name || userInfo.email;

    await createAndSendNotification({
      userId: wallet.userId,
      type: "GENERAL",
      title: "Member Left Wallet",
      message: `${leavingDisplayName} has left your wallet "${wallet.name}"`,
      link: "/account",
      metadata: {
        walletId: wallet._id.toString(),
        walletName: wallet.name,
        memberEmail: userInfo.email,
        memberName: leavingDisplayName,
      },
    });

    return NextResponse.json({ ok: true, left: true, walletId: id });
  }

  // â”€â”€ Update Member Role & Permissions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (updateMemberEmail && typeof updateMemberEmail === "string") {
    if (!isOwner && !callerPerms.manageMembers) {
      return NextResponse.json(
        { error: "Only wallet owners or managers can edit member permissions" },
        { status: 403 }
      );
    }
    const cleanTargetEmail = updateMemberEmail.trim().toLowerCase();
    const existingMember = (wallet.sharedWith || []).find(
      (m) => m.email.toLowerCase() === cleanTargetEmail
    );
    if (!existingMember) {
      return NextResponse.json({ error: "Member not found in this wallet" }, { status: 404 });
    }

    const updatedRole = role || existingMember.role || "EDITOR";
    const updatedRoleName =
      roleName && typeof roleName === "string" && roleName.trim()
        ? roleName.trim().slice(0, 30)
        : existingMember.roleName || (updatedRole === "VIEWER" ? "Viewer" : "Editor");
    const updatedPermissions = normalizePermissions(permissions, updatedRole);

    await Wallet.updateOne(
      { _id: id, "sharedWith.email": cleanTargetEmail },
      {
        $set: {
          "sharedWith.$.role": updatedRole,
          "sharedWith.$.roleName": updatedRoleName,
          "sharedWith.$.permissions": updatedPermissions,
        },
      }
    );
  }

  // For other updates, non-owners must be ACCEPTED members
  if (!isOwner) {
    const memberEntry = wallet.sharedWith?.find(
      (m) => m.email.toLowerCase() === userInfo.email.toLowerCase()
    );
    if (!memberEntry || memberEntry.status !== "ACCEPTED") {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }
  }

  const updateFields: Record<string, unknown> = {};

  if (isDefault !== undefined) {
    if (isDefault) {
      await User.findByIdAndUpdate(userInfo.id, { defaultWalletId: id });
      await Wallet.updateMany({ userId: userInfo.id }, { isDefault: false });
      await Wallet.updateMany(
        { "sharedWith.email": userInfo.email },
        { $set: { "sharedWith.$[elem].isDefault": false } },
        { arrayFilters: [{ "elem.email": userInfo.email }] }
      );
      if (isOwner) {
        updateFields.isDefault = true;
      } else {
        await Wallet.updateOne(
          { _id: id, "sharedWith.email": userInfo.email },
          { $set: { "sharedWith.$.isDefault": true } }
        );
      }
    } else {
      await User.findByIdAndUpdate(userInfo.id, { $unset: { defaultWalletId: 1 } });
      if (isOwner) {
        updateFields.isDefault = false;
      } else {
        await Wallet.updateOne(
          { _id: id, "sharedWith.email": userInfo.email },
          { $set: { "sharedWith.$.isDefault": false } }
        );
      }
    }
  }

  // Adjust Balance
  if (balance !== undefined) {
    if (!isOwner && !callerPerms.editBalance) {
      return NextResponse.json(
        { error: "You do not have permission to edit the balance of this wallet" },
        { status: 403 }
      );
    }

    const num = Number(balance);
    if (!isNaN(num) && isFinite(num) && Math.abs(num) < 1e14) {
      const oldBalance = wallet.balance || 0;
      updateFields.balance = num;

      // If excludeFromReport is explicitly false (or toggled off):
      // create Adjust Balance transaction
      const isExcluded = excludeFromReport !== undefined ? Boolean(excludeFromReport) : Boolean(wallet.excludeFromReport);
      if (!isExcluded) {
        const diff = num - oldBalance;
        if (Math.abs(diff) > 0.0001) {
          const isIncome = diff > 0;
          const absDiff = Math.abs(diff);
          const walletCurr = wallet.currency || "IDR";
          
          await Transaction.create({
            userId: userInfo.id,
            type: isIncome ? "INCOME" : "EXPENSE",
            category: isIncome ? "adjust_balance_income" : "adjust_balance",
            title: description ? String(description).trim().slice(0, 100) : "Adjust Balance",
            description: description ? String(description).trim().slice(0, 500) : "Adjust Balance",
            amount: absDiff,
            currency: walletCurr,
            convertedAmountIDR: absDiff,
            walletId: wallet._id,
            date: new Date(),
          });
        }
      }
    } else {
      return NextResponse.json({ error: "Invalid balance value" }, { status: 400 });
    }
  }

  if (excludeFromReport !== undefined) {
    if (!isOwner && !callerPerms.editWallet) {
      return NextResponse.json({ error: "Permission denied to edit wallet settings" }, { status: 403 });
    }
    updateFields.excludeFromReport = Boolean(excludeFromReport);
  }

  if (excludeFromTotal !== undefined) {
    if (isOwner) {
      updateFields.excludeFromTotal = Boolean(excludeFromTotal);
    } else {
      await Wallet.updateOne(
        { _id: id, "sharedWith.email": userInfo.email },
        { $set: { "sharedWith.$.excludeFromTotal": Boolean(excludeFromTotal) } }
      );
    }
  }

  if (archived !== undefined) {
    if (!isOwner && !callerPerms.editWallet) {
      return NextResponse.json({ error: "Permission denied to edit wallet settings" }, { status: 403 });
    }
    updateFields.archived = Boolean(archived);
  }

  if (enableNotification !== undefined) {
    if (isOwner) {
      updateFields.enableNotification = Boolean(enableNotification);
    } else {
      await Wallet.updateOne(
        { _id: id, "sharedWith.email": userInfo.email },
        { $set: { "sharedWith.$.enableNotification": Boolean(enableNotification) } }
      );
    }
  }

  if (disabledCategories !== undefined && Array.isArray(disabledCategories)) {
    if (!isOwner && !callerPerms.editWallet) {
      return NextResponse.json({ error: "Permission denied to edit wallet settings" }, { status: 403 });
    }
    updateFields.disabledCategories = disabledCategories.map((c) => String(c).trim());
  }

  if (name && typeof name === "string") {
    if (!isOwner && !callerPerms.editWallet) {
      return NextResponse.json({ error: "Permission denied to edit wallet settings" }, { status: 403 });
    }
    updateFields.name = name.trim().slice(0, 50).replace(/[<>]/g, "");
  }

  if (icon && typeof icon === "string") {
    if (!isOwner && !callerPerms.editWallet) {
      return NextResponse.json({ error: "Permission denied to edit wallet settings" }, { status: 403 });
    }
    updateFields.icon = icon.slice(0, 10);
  }

  if (currency && typeof currency === "string") {
    if (!isOwner && !callerPerms.editWallet) {
      return NextResponse.json({ error: "Permission denied to edit wallet settings" }, { status: 403 });
    }
    updateFields.currency = currency.slice(0, 5).toUpperCase();
  }

  // â”€â”€ Invite a new member â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (shareEmail && typeof shareEmail === "string") {
    if (!isOwner && !callerPerms.inviteMember) {
      return NextResponse.json({ error: "You do not have permission to invite members." }, { status: 403 });
    }

    const cleanInput = shareEmail.trim();
    if (!cleanInput) {
      return NextResponse.json({ error: "Please enter a user email or username." }, { status: 400 });
    }

    // Escape regex special chars for username matching
    const escaped = cleanInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Check if user exists by email or by username
    const invitedUser = (await User.findOne({
      $or: [
        { email: cleanInput.toLowerCase() },
        { name: { $regex: new RegExp(`^${escaped}$`, "i") } },
      ],
    })
      .select("_id email name image profileColor")
      .lean()) as { _id: mongoose.Types.ObjectId; email: string; name: string; image?: string; profileColor?: string } | null;

    if (!invitedUser) {
      return NextResponse.json({ error: "User does not exist" }, { status: 404 });
    }

    // Cannot invite yourself
    if (
      invitedUser._id.toString() === userInfo.id ||
      invitedUser.email.toLowerCase() === userInfo.email.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "You cannot invite yourself to your own wallet." },
        { status: 400 }
      );
    }

    // Check not already a member (any status)
    const cleanEmail = invitedUser.email.toLowerCase();
    const existingMember = wallet.sharedWith?.find(
      (m) => m.email.toLowerCase() === cleanEmail
    );
    if (existingMember) {
      if (existingMember.status === "ACCEPTED") {
        return NextResponse.json(
          { error: "This user is already a member of this wallet." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "This user already has a pending invitation." },
        { status: 409 }
      );
    }

    // Add as PENDING with default Editor permissions
    await Wallet.findByIdAndUpdate(id, {
      $pull: { sharedWith: { email: cleanEmail } },
    });
    await Wallet.findByIdAndUpdate(id, {
      $push: {
        sharedWith: {
          email: cleanEmail,
          name: invitedUser.name || "",
          role: "EDITOR",
          roleName: "Editor",
          permissions: normalizePermissions(null, "EDITOR"),
          status: "PENDING",
          addedAt: new Date(),
        },
      },
    });

    // Get inviter's display name
    const inviterUser = (await User.findById(userInfo.id).select("name email").lean()) as {
      name?: string;
      email?: string;
    } | null;
    const inviterDisplayName = inviterUser?.name || userInfo.email;

    // Send notification to invited user
    await createAndSendNotification({
      userId: invitedUser._id,
      type: "WALLET_INVITE",
      title: "Wallet Invitation",
      message: `${inviterDisplayName} invited you to collaborate on "${wallet.name}"`,
      link: "/notifications",
      metadata: {
        walletId: wallet._id.toString(),
        walletName: wallet.name,
        inviterEmail: userInfo.email,
        inviterName: inviterDisplayName,
      },
    });
  }

  // â”€â”€ Remove a member or cancel invitation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (removeShareEmail && typeof removeShareEmail === "string") {
    if (!isOwner && !callerPerms.manageMembers) {
      return NextResponse.json({ error: "You do not have permission to remove members." }, { status: 403 });
    }
    const cleanRemoveEmail = removeShareEmail.trim().toLowerCase();
    await Wallet.findByIdAndUpdate(id, {
      $pull: { sharedWith: { email: cleanRemoveEmail } },
    });

    // Clean up any pending invitation notifications for that user for this wallet
    const removedUser = (await User.findOne({ email: cleanRemoveEmail })
      .select("_id")
      .lean()) as { _id: mongoose.Types.ObjectId } | null;
    if (removedUser) {
      await Notification.deleteMany({
        userId: removedUser._id,
        type: "WALLET_INVITE",
        "metadata.walletId": wallet._id.toString(),
      });
    }
  }

  if (Object.keys(updateFields).length > 0) {
    await Wallet.findByIdAndUpdate(id, updateFields);
  }

  const updatedWalletRaw = await Wallet.findById(id).lean();
  if (!updatedWalletRaw) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  const owner = (await User.findById(updatedWalletRaw.userId).select("email name image profileColor").lean()) as {
    email?: string;
    name?: string;
    image?: string;
    profileColor?: string;
  } | null;

  const memberEmails = (updatedWalletRaw.sharedWith || []).map((m) => m.email.toLowerCase());
  const memberUsers = (await User.find({ email: { $in: memberEmails } })
    .select("email name image profileColor")
    .lean()) as Array<{ email: string; name: string; image?: string; profileColor?: string }>;
  const memberUserMap = new Map(memberUsers.map((u) => [u.email.toLowerCase(), u]));

  const currentUserDoc = (await User.findById(userInfo.id).select("defaultWalletId").lean()) as {
    defaultWalletId?: mongoose.Types.ObjectId;
  } | null;
  const userDefaultWalletIdStr = currentUserDoc?.defaultWalletId
    ? String(currentUserDoc.defaultWalletId)
    : null;

  const isOwnerNow = updatedWalletRaw.userId.toString() === userInfo.id;
  const memberNow = (updatedWalletRaw.sharedWith || []).find(
    (m) => m.email.toLowerCase() === userInfo.email.toLowerCase()
  );

  let resolvedDefault = false;
  if (userDefaultWalletIdStr) {
    resolvedDefault = String(updatedWalletRaw._id) === userDefaultWalletIdStr;
  } else if (isOwnerNow) {
    resolvedDefault = Boolean(updatedWalletRaw.isDefault);
  } else if (memberNow) {
    resolvedDefault = Boolean(memberNow.isDefault);
  }

  const resolvedExclude = isOwnerNow
    ? Boolean(updatedWalletRaw.excludeFromTotal)
    : Boolean(memberNow?.excludeFromTotal);

  const resolvedNotification = isOwnerNow
    ? updatedWalletRaw.enableNotification !== false
    : memberNow?.enableNotification !== undefined
    ? Boolean(memberNow.enableNotification)
    : true;

  const updatedWallet = {
    ...updatedWalletRaw,
    isDefault: resolvedDefault,
    excludeFromTotal: resolvedExclude,
    enableNotification: resolvedNotification,
    ownerEmail: owner?.email ?? "",
    ownerName: owner?.name ?? "",
    ownerImage: owner?.image ?? "",
    ownerProfileColor: owner?.profileColor ?? "",
    sharedWith: (updatedWalletRaw.sharedWith || []).map((m) => {
      const u = memberUserMap.get(m.email.toLowerCase());
      return {
        ...m,
        name: m.name || u?.name || "",
        image: u?.image || m.image || "",
        profileColor: u?.profileColor || m.profileColor || "",
        roleName: m.roleName || (m.role === "VIEWER" ? "Viewer" : "Editor"),
        permissions: normalizePermissions(m.permissions, m.role || m.roleName),
      };
    }),
  };

  return NextResponse.json({ ok: true, wallet: updatedWallet });
}

/** DELETE /api/finance/wallets?id=<walletId> â€” Cascade delete wallet and all its transactions & budgets */
export async function DELETE(req: NextRequest) {
  const userInfo = await getUserInfo(req);
  if (!userInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Valid id query param is required" }, { status: 400 });
  }

  await connectDB();

  // Find wallet ensuring user owns it
  const wallet = await Wallet.findOne({ _id: id, userId: userInfo.id });
  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found or unauthorized" }, { status: 404 });
  }

  // CASCADE DELETE: Delete child transactions and budgets associated with this wallet
  const walletObjectId = new mongoose.Types.ObjectId(id);
  const [deletedTransactions, deletedBudgets] = await Promise.all([
    Transaction.deleteMany({ walletId: walletObjectId }),
    Budget.deleteMany({ walletId: walletObjectId }),
    Wallet.findByIdAndDelete(id),
  ]);

  return NextResponse.json({
    ok: true,
    deletedWalletId: id,
    cascadeDeleted: {
      transactions: deletedTransactions.deletedCount,
      budgets: deletedBudgets.deletedCount,
    },
  });
}
