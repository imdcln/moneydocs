import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import Account from "@/models/Account";
import { createAndSendNotification } from "@/lib/notifications";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const user = await User.findOne({ email: session.user.email }).select("+password +passwordHash");
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // STRICT LOCKOUT PREVENTION: User cannot unlink Google if passwordHash is null
  const hasPassword = Boolean(user.passwordHash || user.password);
  if (!hasPassword) {
    return NextResponse.json(
      {
        error: "Lockout prevention: You cannot unlink your Google account because no password is set. Please set a password first.",
      },
      { status: 400 }
    );
  }

  // Delete Account record for Google
  await Account.deleteMany({ userId: user._id, provider: "google" });

  user.googleId = undefined;
  if (user.authProvider === "google") {
    user.authProvider = "credentials";
  }
  await user.save();

  createAndSendNotification({
    userId: user._id,
    type: "SECURITY",
    title: "Google Account Unlinked ⚠️",
    message: "Your Google account was unlinked. You can continue signing in with your email and password.",
    link: "/account/my-account",
  }).catch((e) => console.error("[unlink-google] notification error:", e));

  return NextResponse.json({
    success: true,
    message: "Google account unlinked successfully.",
  });
}
