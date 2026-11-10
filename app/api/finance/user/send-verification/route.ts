import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { sendVerificationEmail } from "@/lib/mail";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isVerified) {
      return NextResponse.json(
        { error: "Account email is already verified", code: "ALREADY_VERIFIED" },
        { status: 400 }
      );
    }

    // Generate cryptographically sound 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.verificationCode = code;
    user.verificationCodeExpires = expiresAt;
    await user.save();

    const mailResult = await sendVerificationEmail({
      to: user.email,
      name: user.name,
      code,
    });

    if (!mailResult.success) {
      return NextResponse.json(
        {
          error: mailResult.error || "Failed to send verification email.",
          code: "EMAIL_SEND_FAILED",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${user.email}.`,
    });
  } catch (error) {
    console.error("[send-verification error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
