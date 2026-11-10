import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import Transaction from "@/models/Transaction";
import Budget from "@/models/Budget";
import Wallet from "@/models/Wallet";
import EventModel from "@/models/Event";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let password = "";
  try {
    const body = await req.json();
    if (body?.password) password = body.password;
  } catch {
    // Body empty, check searchParams
  }
  if (!password) {
    const url = new URL(req.url);
    password = url.searchParams.get("password") || "";
  }

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

  // Cascade delete all user data
  await Promise.all([
    Transaction.deleteMany({ userId }),
    Budget.deleteMany({ userId }),
    Wallet.deleteMany({ userId }),
    EventModel.deleteMany({ userId }),
    User.findByIdAndDelete(userId),
  ]);

  return NextResponse.json({ success: true, message: "Account deleted successfully." });
}
