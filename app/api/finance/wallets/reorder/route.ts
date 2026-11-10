import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { walletIds } = body;

    if (!Array.isArray(walletIds)) {
      return NextResponse.json({ error: "walletIds must be an array" }, { status: 400 });
    }

    const validObjectIds = walletIds
      .filter((id) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    await connectDB();
    await User.findOneAndUpdate(
      { email: session.user.email.toLowerCase() },
      { $set: { walletOrder: validObjectIds } }
    );

    return NextResponse.json({ success: true, walletOrder: walletIds });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
