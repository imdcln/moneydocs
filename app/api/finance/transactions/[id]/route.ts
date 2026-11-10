import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Transaction from "@/models/Transaction";
import Wallet from "@/models/Wallet";
import User from "@/models/User";
import EventModel from "@/models/Event";
import { getExchangeRates, convertCurrency, convertToIDR } from "@/lib/currency";
import { isLoanCategory } from "@/lib/categories";
import { notifyWalletTransactionActivity } from "@/lib/walletNotifications";
import { getUserWalletPermissions } from "@/lib/walletPermissions";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  await connectDB();
  const user = (await User.findOne({ email: session.user.email }).lean()) as {
    _id: { toString(): string };
  } | null;
  return user ? String(user._id) : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 });
  }

  await connectDB();
  const tx = await Transaction.findById(id)
    .populate({ path: "walletId", select: "name icon currency balance sharedWith userId ownerEmail", strictPopulate: false })
    .populate({ path: "eventId", select: "name icon currency status", strictPopulate: false })
    .lean();

  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase();
  const isOwnerOfTx = String((tx as any).userId) === String(userId);

  if (!isOwnerOfTx) {
    if (!tx.walletId) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    const walletObj = typeof tx.walletId === "object" ? tx.walletId : await Wallet.findById(tx.walletId).lean();
    const perms = getUserWalletPermissions(walletObj as any, userEmail, userId);
    if (!perms.transactions.read) {
      return NextResponse.json({ error: "You do not have permission to view this transaction" }, { status: 403 });
    }
  }

  return NextResponse.json({ transaction: tx });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Request body is required" }, { status: 400 });
  }

  await connectDB();
  const oldTx = await Transaction.findById(id);
  if (!oldTx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase();
  const isOwnerOfTx = String(oldTx.userId) === String(userId);

  if (!isOwnerOfTx) {
    if (!oldTx.walletId) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    const oldWallet = await Wallet.findById(oldTx.walletId).lean();
    const perms = getUserWalletPermissions(oldWallet as any, userEmail, userId);
    if (!perms.transactions.update) {
      return NextResponse.json({ error: "You do not have permission to edit this transaction" }, { status: 403 });
    }
  }

  const usdRates = await getExchangeRates("USD");
  const updates: Record<string, unknown> = {};

  // Check which fields are being changed
  const newType = body.type !== undefined ? body.type : oldTx.type;
  const newAmount = body.amount !== undefined ? Number(body.amount) : oldTx.amount;
  const newCurrency = body.currency !== undefined ? String(body.currency).toUpperCase() : oldTx.currency;
  
  let newWalletId = oldTx.walletId ? String(oldTx.walletId) : undefined;
  if (body.walletId !== undefined) {
    if (body.walletId && body.walletId !== "ALL" && mongoose.Types.ObjectId.isValid(body.walletId)) {
      newWalletId = String(body.walletId);
    } else if (body.walletId === null || body.walletId === "" || body.walletId === "ALL") {
      newWalletId = undefined;
    }
  }

  // If amount, type, currency, or wallet changed, adjust wallet balances
  const amountChanged =
    body.amount !== undefined && newAmount !== oldTx.amount;
  const typeChanged = body.type !== undefined && newType !== oldTx.type;
  const currencyChanged = body.currency !== undefined && newCurrency !== oldTx.currency;
  const walletChanged =
    body.walletId !== undefined && newWalletId !== (oldTx.walletId ? String(oldTx.walletId) : undefined);

  if (amountChanged || typeChanged || currencyChanged || walletChanged) {
    if (isNaN(newAmount) || !isFinite(newAmount) || newAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount value" }, { status: 400 });
    }

    // 1. Revert old delta from old wallet
    if (oldTx.walletId) {
      const oldWallet = await Wallet.findById(oldTx.walletId).select("currency").lean();
      if (oldWallet) {
        const oldWalletCurrency = (oldWallet as { currency?: string }).currency || "IDR";
        const oldAmtInWalletCurr = convertCurrency(
          oldTx.amount,
          oldTx.currency || "IDR",
          oldWalletCurrency,
          usdRates
        );
        const oldIsLoan = isLoanCategory(oldTx.category, oldTx.subCategory);
        const rollbackDelta =
          oldTx.type === "EXPENSE" ? oldAmtInWalletCurr :
          (oldTx.type === "INCOME" || (oldTx.type === "DEBT" && oldIsLoan)) ? -oldAmtInWalletCurr : 0;
        if (rollbackDelta !== 0) {
          await Wallet.findByIdAndUpdate(oldTx.walletId, { $inc: { balance: rollbackDelta } });
        }
      }
    }

    // 2. Apply new delta to new wallet
    if (newWalletId) {
      const newWallet = await Wallet.findById(newWalletId).select("currency").lean();
      if (newWallet) {
        const newWalletCurrency = (newWallet as { currency?: string }).currency || "IDR";
        const newAmtInWalletCurr = convertCurrency(
          newAmount,
          newCurrency,
          newWalletCurrency,
          usdRates
        );
        const nextCategory = body.category !== undefined ? body.category : oldTx.category;
        const nextSubCategory = body.subCategory !== undefined ? body.subCategory : oldTx.subCategory;
        const newIsLoan = isLoanCategory(nextCategory, nextSubCategory);
        const applyDelta =
          newType === "INCOME" || (newType === "DEBT" && newIsLoan) ? newAmtInWalletCurr :
          newType === "EXPENSE" ? -newAmtInWalletCurr : 0;
        if (applyDelta !== 0) {
          await Wallet.findByIdAndUpdate(newWalletId, { $inc: { balance: applyDelta } });
        }
      }
    }

    updates.amount = newAmount;
    updates.type = newType;
    updates.currency = newCurrency;
    updates.walletId = newWalletId ? new mongoose.Types.ObjectId(newWalletId) : null;

    // Recompute convertedAmountIDR
    let convertedAmountIDR = newAmount;
    if (newCurrency !== "IDR") {
      const idrRates = await getExchangeRates("IDR");
      convertedAmountIDR = convertToIDR(newAmount, newCurrency, idrRates);
    }
    updates.convertedAmountIDR = convertedAmountIDR;
  }

  if (body.title !== undefined) {
    updates.title = String(body.title).trim().slice(0, 100).replace(/[<>]/g, "");
  }
  if (body.category !== undefined) {
    updates.category = String(body.category).trim().slice(0, 50).replace(/[<>]/g, "");
  }
  if (body.subCategory !== undefined) {
    updates.subCategory = body.subCategory
      ? String(body.subCategory).trim().slice(0, 50).replace(/[<>]/g, "")
      : null;
  }
  if (body.date !== undefined) {
    updates.date = new Date(body.date);
  }
  if (body.description !== undefined) {
    updates.description = body.description
      ? String(body.description).trim().slice(0, 500).replace(/[<>]/g, "")
      : null;
  }
  if (body.debtParty !== undefined) {
    updates.debtParty = body.debtParty
      ? String(body.debtParty).trim().slice(0, 100).replace(/[<>]/g, "")
      : null;
  }
  if (body.debtDueDate !== undefined) {
    updates.debtDueDate = body.debtDueDate ? new Date(body.debtDueDate) : null;
  }
  if (body.debtInterestRate !== undefined) {
    updates.debtInterestRate = body.debtInterestRate ? Number(body.debtInterestRate) : null;
  }
  if (body.debtStatus !== undefined) {
    updates.debtStatus = body.debtStatus;
  }
  if (body.tags !== undefined && Array.isArray(body.tags)) {
    updates.tags = body.tags.map((t: unknown) => String(t).slice(0, 30).replace(/[<>]/g, ""));
  }
  if (body.receiptUrl !== undefined) {
    updates.receiptUrl = body.receiptUrl;
  }
  if (body.eventId !== undefined) {
    updates.eventId = body.eventId && mongoose.Types.ObjectId.isValid(body.eventId)
      ? new mongoose.Types.ObjectId(body.eventId)
      : null;
  }
  if (body.eventName !== undefined) {
    updates.eventName = body.eventName ? String(body.eventName).trim().slice(0, 100) : null;
  }
  if (body.eventCurrency !== undefined) {
    updates.eventCurrency = body.eventCurrency ? String(body.eventCurrency).trim().slice(0, 5).toUpperCase() : null;
  }
  if (body.withPeople !== undefined) {
    updates.withPeople = Array.isArray(body.withPeople)
      ? body.withPeople.map((p: unknown) => String(p).trim().slice(0, 50)).filter(Boolean)
      : [];
  }

  const updatedTx = await Transaction.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true }
  )
    .populate({ path: "walletId", select: "name icon currency", strictPopulate: false })
    .lean();

  // Notify wallet collaborators (fire-and-forget)
  const notifyWalletId = newWalletId || (oldTx.walletId ? String(oldTx.walletId) : null);
  if (notifyWalletId && updatedTx) {
    notifyWalletTransactionActivity({
      walletId: notifyWalletId,
      actorUserId: userId,
      action: "UPDATED",
      transaction: {
        _id: (updatedTx as { _id: unknown })._id,
        type: (updatedTx as { type?: string }).type,
        title: (updatedTx as { title?: string }).title,
        amount: (updatedTx as { amount?: number }).amount,
        currency: (updatedTx as { currency?: string }).currency,
      },
    }).catch(console.error);
  }

  return NextResponse.json({ success: true, transaction: updatedTx });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 });
  }

  await connectDB();
  const tx = await Transaction.findById(id);
  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const delSession = await auth();
  const delUserEmail = delSession?.user?.email?.toLowerCase();
  const isOwnerOfTx = String(tx.userId) === String(userId);

  if (!isOwnerOfTx) {
    if (!tx.walletId) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    const wallet = await Wallet.findById(tx.walletId).lean();
    const perms = getUserWalletPermissions(wallet as any, delUserEmail, userId);
    if (!perms.transactions.delete) {
      return NextResponse.json({ error: "You do not have permission to delete this transaction" }, { status: 403 });
    }
  }

  const usdRates = await getExchangeRates("USD");

  if (tx.walletId) {
    const wallet = await Wallet.findById(tx.walletId).select("currency").lean();
    if (wallet) {
      const walletCurrency = (wallet as { currency?: string }).currency || "IDR";
      const amountInWalletCurrency = convertCurrency(
        tx.amount,
        tx.currency || "IDR",
        walletCurrency,
        usdRates
      );
      const isLoan = isLoanCategory(tx.category, tx.subCategory);
      const rollbackDelta =
        tx.type === "EXPENSE" ? amountInWalletCurrency :
        (tx.type === "INCOME" || (tx.type === "DEBT" && isLoan)) ? -amountInWalletCurrency : 0;
      if (rollbackDelta !== 0) {
        await Wallet.findByIdAndUpdate(tx.walletId, { $inc: { balance: rollbackDelta } });
      }
    }
  }

  // Refund any payments made from wallets for this debt/loan
  if (tx.debtPayments && Array.isArray(tx.debtPayments)) {
    for (const p of tx.debtPayments) {
      if (p.walletId && p.amount > 0) {
        const pWallet = await Wallet.findById(p.walletId).select("currency").lean();
        if (pWallet) {
          const pWalletCurrency = (pWallet as { currency?: string }).currency || "IDR";
          const pAmt = convertCurrency(p.amount, p.currency || tx.currency || "IDR", pWalletCurrency, usdRates);
          await Wallet.findByIdAndUpdate(p.walletId, { $inc: { balance: pAmt } });
        }
      }
    }
  }

  await Transaction.deleteOne({ _id: id });

  // Notify wallet collaborators (fire-and-forget)
  if (tx.walletId) {
    notifyWalletTransactionActivity({
      walletId: String(tx.walletId),
      actorUserId: userId,
      action: "DELETED",
      transaction: {
        _id: tx._id,
        type: tx.type,
        title: tx.title,
        amount: tx.amount,
        currency: tx.currency,
      },
    }).catch(console.error);
  }

  return NextResponse.json({ success: true });
}
