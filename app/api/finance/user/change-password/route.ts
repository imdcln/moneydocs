import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import Account from "@/models/Account";
import { createAndSendNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { currentPassword, newPassword } = body;

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    return NextResponse.json(
      { error: "New password must be at least 6 characters long." },
      { status: 400 }
    );
  }

  await connectDB();
  const user = await User.findOne({ email: session.user.email }).select("+password +passwordHash");
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existingPassword = user.passwordHash || user.password;
  const hasExistingPassword = Boolean(existingPassword);

  // If user already has a password, verify currentPassword
  if (hasExistingPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required to change password." }, { status: 400 });
    }
    const isMatch = await bcrypt.compare(currentPassword, existingPassword!);
    if (!isMatch) {
      return NextResponse.json({ error: "Incorrect current password." }, { status: 400 });
    }
  }

  // Hash new password and save to both password and passwordHash
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  user.password = hashedPassword;
  user.passwordHash = hashedPassword;
  await user.save();

  // Ensure Account record for credentials exists
  await Account.findOneAndUpdate(
    { userId: user._id, provider: "credentials" },
    {
      userId: user._id,
      provider: "credentials",
      providerAccountId: user.email.toLowerCase().trim(),
      emailVerified: user.isVerified || false,
      type: "credentials",
    },
    { upsert: true, new: true }
  ).catch((e) => console.error("[change-password:Account] upsert error:", e));

  // Send security push notification to device
  createAndSendNotification({
    userId: user._id,
    type: "SECURITY",
    title: hasExistingPassword ? "Password Changed 🔐" : "Password Set 🔐",
    message: hasExistingPassword
      ? "Your account password was successfully changed. If this wasn't you, review your devices immediately."
      : "A password has been successfully set for your account.",
    link: "/account/my-account",
  }).catch((err) => console.error("Notification error:", err));

  return NextResponse.json({
    success: true,
    message: hasExistingPassword ? "Password updated successfully." : "Password created successfully.",
  });
}
