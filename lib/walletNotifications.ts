import mongoose from "mongoose";
import Wallet from "@/models/Wallet";
import User from "@/models/User";
import { createAndSendNotification } from "@/lib/notifications";

interface NotifyWalletActivityParams {
  walletId: string | mongoose.Types.ObjectId;
  actorUserId: string | mongoose.Types.ObjectId;
  action: "CREATED" | "UPDATED" | "DELETED";
  transaction: {
    _id?: unknown;
    type?: string;
    title?: string;
    amount?: number;
    currency?: string;
  };
}

/**
 * Dispatches a notification to all members and the owner of a wallet
 * who have `enableNotification` active for this wallet (excluding the actor).
 */
export async function notifyWalletTransactionActivity({
  walletId,
  actorUserId,
  action,
  transaction,
}: NotifyWalletActivityParams) {
  try {
    const wallet = await Wallet.findById(walletId).lean();
    if (!wallet) return;

    const actor = (await User.findById(actorUserId).select("name email").lean()) as {
      name?: string;
      email?: string;
    } | null;
    const actorName = actor?.name || actor?.email?.split("@")[0] || "A collaborator";

    const formattedAmount = transaction.amount
      ? `${transaction.currency || wallet.currency || "IDR"} ${Number(transaction.amount).toLocaleString()}`
      : "";

    let title = "Wallet Update";
    let message = "";

    const txTitle = transaction.title ? `"${transaction.title}"` : "a transaction";

    if (action === "CREATED") {
      title = `Transaction Added · ${wallet.name}`;
      message = `${actorName} added ${transaction.type ? transaction.type.toLowerCase() : ""} ${txTitle}${formattedAmount ? ` (${formattedAmount})` : ""} in ${wallet.name}`;
    } else if (action === "UPDATED") {
      title = `Transaction Updated · ${wallet.name}`;
      message = `${actorName} updated ${txTitle}${formattedAmount ? ` (${formattedAmount})` : ""} in ${wallet.name}`;
    } else if (action === "DELETED") {
      title = `Transaction Deleted · ${wallet.name}`;
      message = `${actorName} deleted ${txTitle} in ${wallet.name}`;
    }

    // 1. Notify Owner if actor is not the owner and owner has notifications enabled
    const ownerIdStr = String(wallet.userId);
    const actorIdStr = String(actorUserId);

    if (ownerIdStr !== actorIdStr) {
      const ownerNotificationsEnabled = wallet.enableNotification !== false;
      if (ownerNotificationsEnabled) {
        await createAndSendNotification({
          userId: wallet.userId,
          type: "GENERAL",
          title,
          message,
          link: "/transactions",
          metadata: {
            walletId: String(wallet._id),
            walletName: wallet.name,
            action,
            transactionId: String(transaction._id || ""),
          },
        });
      }
    }

    // 2. Notify Members in sharedWith if they have notifications enabled
    if (wallet.sharedWith && Array.isArray(wallet.sharedWith)) {
      const memberEmails = wallet.sharedWith
        .filter((m) => m.status === "ACCEPTED" && m.enableNotification !== false)
        .map((m) => m.email.toLowerCase());

      if (memberEmails.length > 0) {
        const memberUsers = (await User.find({ email: { $in: memberEmails } })
          .select("_id email")
          .lean()) as Array<{ _id: mongoose.Types.ObjectId; email: string }>;

        for (const u of memberUsers) {
          if (String(u._id) === actorIdStr) continue; // Skip actor
          await createAndSendNotification({
            userId: u._id,
            type: "GENERAL",
            title,
            message,
            link: "/transactions",
            metadata: {
              walletId: String(wallet._id),
              walletName: wallet.name,
              action,
              transactionId: String(transaction._id || ""),
            },
          });
        }
      }
    }
  } catch (err) {
    console.error("notifyWalletTransactionActivity error:", err);
  }
}
