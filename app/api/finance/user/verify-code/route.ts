import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const code = body?.code ? String(body.code).trim() : "";

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: "Please enter a valid 6-digit verification code.", code: "INVALID_FORMAT" },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email }).select(
      "+verificationCode +verificationCodeExpires"
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isVerified) {
      return NextResponse.json({
        success: true,
        message: "Account email is already verified.",
        isVerified: true,
      });
    }

    if (!user.verificationCode || !user.verificationCodeExpires) {
      return NextResponse.json(
        {
          error: "No active verification code found. Please request a new code.",
          code: "NO_ACTIVE_CODE",
        },
        { status: 400 }
      );
    }

    if (new Date() > new Date(user.verificationCodeExpires)) {
      return NextResponse.json(
        {
          error: "Verification code has expired. Please request a new one.",
          code: "CODE_EXPIRED",
        },
        { status: 400 }
      );
    }

    if (user.verificationCode !== code) {
      return NextResponse.json(
        {
          error: "Incorrect verification code. Please check and try again.",
          code: "INVALID_CODE",
        },
        { status: 400 }
      );
    }

    // Success: mark user verified and clear code
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    return NextResponse.json({
      success: true,
      message: "Email successfully verified!",
      isVerified: true,
    });
  } catch (error) {
    console.error("[verify-code error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
