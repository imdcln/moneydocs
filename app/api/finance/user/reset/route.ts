import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import Transaction from "@/models/Transaction";
import Budget from "@/models/Budget";
import Wallet from "@/models/Wallet";
import EventModel from "@/models/Event";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { password } = body;

  await connectDB();
  const user = await User.findOne({ email: session.user.email }).select("+password");
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Require and verify password if user has one
  if (user.password) {
    if (!password) {
      return NextResponse.json({ error: "Password is required to confirm." }, { status: 400 });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Incorrect password. Please try again." }, { status: 400 });
    }
  }

  const userId = user._id;

  // Clear all transactions, budgets, events, and reset wallet balances to 0
  await Promise.all([
    Transaction.deleteMany({ userId }),
    Budget.deleteMany({ userId }),
    EventModel.deleteMany({ userId }),
    Wallet.updateMany({ userId }, { $set: { balance: 0 } }),
  ]);

  return NextResponse.json({ success: true, message: "Account data has been reset." });
}
