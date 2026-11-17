import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import Account from "@/models/Account";
import { createAndSendNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { currentPassword } = body;

  await connectDB();
  const user = await User.findOne({ email: session.user.email }).select("+password +passwordHash");
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // STRICT LOCKOUT PREVENTION: User cannot remove password if no OAuth provider is linked
  const accounts = await Account.find({ userId: user._id }).lean();
  const hasGoogle = Boolean(user.googleId || accounts.some((a) => a.provider === "google"));

  if (!hasGoogle) {
    return NextResponse.json(
      {
        error: "Lockout prevention: Cannot remove password. At least one OAuth provider (e.g. Google) must be linked to prevent account lockout.",
      },
      { status: 400 }
    );
  }

  const existingPassword = user.passwordHash || user.password;
  if (existingPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required to remove password." }, { status: 400 });
    }
    const isMatch = await bcrypt.compare(currentPassword, existingPassword);
    if (!isMatch) {
      return NextResponse.json({ error: "Incorrect current password." }, { status: 400 });
    }
  }

  user.password = null;
  user.passwordHash = null;
  user.authProvider = "google";
  await user.save();

  await Account.deleteMany({ userId: user._id, provider: "credentials" });

  createAndSendNotification({
    userId: user._id,
    type: "SECURITY",
    title: "Password Removed ⚠️",
    message: "Password authentication was removed. You must now sign in using your linked Google account.",
    link: "/account/my-account",
  }).catch((e) => console.error("[remove-password] notification error:", e));

  return NextResponse.json({
    success: true,
    message: "Password removed successfully. Your Google account remains active.",
  });
}
