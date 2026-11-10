import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import EventModel from "@/models/Event";
import Transaction from "@/models/Transaction";
import User from "@/models/User";
import { getExchangeRates, convertCurrency } from "@/lib/currency";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  await connectDB();
  const user = (await User.findOne({ email: session.user.email }).select("_id").lean()) as {
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
    return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
  }

  await connectDB();
  const event = await EventModel.findOne({
    _id: id,
    userId: new mongoose.Types.ObjectId(userId),
  })
    .populate({ path: "walletId", select: "name icon currency balance", strictPopulate: false })
    .lean();

  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // Fetch connected transactions and compute spent
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const transactions = await Transaction.find({
    userId: userObjectId,
    eventId: new mongoose.Types.ObjectId(id),
  })
    .sort({ date: -1, createdAt: -1 })
    .lean();

  const usdRates = await getExchangeRates("USD").catch(() => ({}));
  const evCurrency = (event as { currency?: string }).currency || "IDR";
  let spent = 0;

  transactions.forEach((tx) => {
    if (tx.type === "EXPENSE") {
      const txCurrency = tx.currency || "IDR";
      const converted = convertCurrency(tx.amount || 0, txCurrency, evCurrency, usdRates);
      spent += converted;
    }
  });

  const formattedTransactions = transactions.map((tx) => ({
    _id: String(tx._id),
    title: tx.title || tx.category,
    category: tx.category,
    subCategory: tx.subCategory,
    type: tx.type || "EXPENSE",
    amount: tx.amount,
    currency: tx.currency,
    rawAmount: tx.amount,
    rawCurrency: tx.currency,
    date: tx.date,
    walletId: tx.walletId,
  }));

  return NextResponse.json({
    event: {
      ...event,
      spent: Math.round(spent * 100) / 100,
      transactions: formattedTransactions,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
  }

  const body = await req.json();
  const { name, icon, endingDate, currency, walletId, status } = body;

  await connectDB();
  const updates: Record<string, unknown> = {};

  if (name !== undefined) updates.name = String(name).trim().slice(0, 100);
  if (icon !== undefined) updates.icon = String(icon).slice(0, 10);
  if (endingDate !== undefined) updates.endingDate = endingDate ? new Date(endingDate) : null;
  if (currency !== undefined) updates.currency = String(currency).trim().slice(0, 5).toUpperCase();
  if (walletId !== undefined) {
    updates.walletId = walletId && mongoose.Types.ObjectId.isValid(walletId)
      ? new mongoose.Types.ObjectId(walletId)
      : null;
  }
  if (status !== undefined && ["RUNNING", "FINISHED"].includes(status)) {
    updates.status = status;
  }

  const updatedEvent = await EventModel.findOneAndUpdate(
    { _id: id, userId: new mongoose.Types.ObjectId(userId) },
    { $set: updates },
    { new: true }
  ).lean();

  if (!updatedEvent) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Keep connected transactions in sync with new event name and currency
  if (updates.name !== undefined || updates.currency !== undefined) {
    const txUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) txUpdates.eventName = updates.name;
    if (updates.currency !== undefined) txUpdates.eventCurrency = updates.currency;
    await Transaction.updateMany(
      { eventId: new mongoose.Types.ObjectId(id) },
      { $set: txUpdates }
    );
  }

  return NextResponse.json({ success: true, event: updatedEvent });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
  }

  await connectDB();
  const event = await EventModel.findOneAndDelete({
    _id: id,
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Clear eventId from linked transactions
  await Transaction.updateMany(
    { eventId: new mongoose.Types.ObjectId(id) },
    { $unset: { eventId: "", eventName: "", eventCurrency: "" } }
  );

  return NextResponse.json({ success: true, deletedId: id });
}
