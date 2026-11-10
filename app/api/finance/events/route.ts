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

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const events = await EventModel.find({ userId: userObjectId })
    .populate({ path: "walletId", select: "name icon currency balance", strictPopulate: false })
    .sort({ createdAt: -1 })
    .lean();

  // Compute spent amount per event from connected transactions
  const eventIds = events.map((e) => e._id);
  const transactions = await Transaction.find({
    userId: userObjectId,
    eventId: { $in: eventIds },
    type: "EXPENSE",
  })
    .select("eventId amount currency")
    .lean();

  const usdRates = await getExchangeRates("USD").catch(() => ({}));
  const spentMap: Record<string, number> = {};
  transactions.forEach((tx) => {
    if (tx.eventId) {
      const eid = String(tx.eventId);
      const ev = events.find((e) => String(e._id) === eid);
      const evCurrency = ev?.currency || "IDR";
      const txCurrency = tx.currency || "IDR";
      const converted = convertCurrency(tx.amount || 0, txCurrency, evCurrency, usdRates);
      spentMap[eid] = (spentMap[eid] || 0) + converted;
    }
  });

  const enrichedEvents = events.map((e) => ({
    ...e,
    spent: spentMap[String(e._id)] || 0,
  }));

  return NextResponse.json({ events: enrichedEvents });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, icon, endingDate, currency, walletId } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Event name is required" }, { status: 400 });
  }

  await connectDB();

  let validWalletId: mongoose.Types.ObjectId | undefined = undefined;
  if (walletId && mongoose.Types.ObjectId.isValid(walletId)) {
    validWalletId = new mongoose.Types.ObjectId(walletId);
  }

  const newEvent = await EventModel.create({
    userId: new mongoose.Types.ObjectId(userId),
    name: name.trim().slice(0, 100),
    icon: icon ? String(icon).slice(0, 10) : "✈️",
    endingDate: endingDate ? new Date(endingDate) : undefined,
    currency: currency ? String(currency).trim().slice(0, 5).toUpperCase() : "IDR",
    walletId: validWalletId,
    status: "RUNNING",
  });

  return NextResponse.json({ success: true, event: newEvent }, { status: 201 });
}
