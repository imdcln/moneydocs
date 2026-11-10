import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { createAndSendNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    return NextResponse.json(
      { error: "New password must be at least 6 characters long." },
      { status: 400 }
    );
  }

  await connectDB();
  const user = await User.findOne({ email: session.user.email }).select("+password");
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // If user already has a password, verify currentPassword
  if (user.password) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required." }, { status: 400 });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Incorrect current password." }, { status: 400 });
    }
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  user.password = hashedPassword;
  await user.save();

  // Send security push notification to device
  createAndSendNotification({
    userId: user._id,
    type: "SECURITY",
    title: "Password Changed 🔐",
    message: "Your account password was successfully changed. If this wasn't you, review your devices immediately.",
    link: "/account/my-account",
  }).catch((err) => console.error("Notification error:", err));

  return NextResponse.json({ success: true, message: "Password updated successfully." });
}
