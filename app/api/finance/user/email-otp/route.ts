import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

/**
 * PATCH /api/finance/user/email-otp
 * Toggles the emailOtpEnabled flag for the authenticated verified user.
 * Body: { enabled: boolean }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "Invalid request. 'enabled' must be a boolean." },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only verified credentials-based accounts can use email OTP
    if (!user.isVerified || user.authProvider === "google") {
      return NextResponse.json(
        { error: "Email OTP is only available for verified accounts." },
        { status: 403 }
      );
    }

    user.emailOtpEnabled = body.enabled;
    await user.save();

    return NextResponse.json({
      success: true,
      emailOtpEnabled: user.emailOtpEnabled,
      message: body.enabled
        ? "Email OTP login enabled."
        : "Email OTP login disabled.",
    });
  } catch (error) {
    console.error("[email-otp PATCH error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
