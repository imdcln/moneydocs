import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { registerOrUpdateDevice } from "@/lib/deviceManager";

/**
 * POST /api/auth/verify-login-otp
 *
 * Validates the 6-digit OTP that was sent to the user's email during
 * the 2-step login flow for verified accounts.
 *
 * On success the client calls NextAuth signIn("credentials", ...) to
 * establish the session — this route only confirms the OTP is correct.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body?.email || !body?.otp) {
      return NextResponse.json(
        { error: "Email and OTP code are required.", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    const cleanEmail = String(body.email).toLowerCase().trim();
    const otp = String(body.otp).trim();

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: "Please enter a valid 6-digit code.", code: "INVALID_FORMAT" },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await User.findOne({ email: cleanEmail }).select(
      "+verificationCode +verificationCodeExpires +password"
    );

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email address.", code: "USER_NOT_FOUND" },
        { status: 401 }
      );
    }

    if (!user.verificationCode || !user.verificationCodeExpires) {
      return NextResponse.json(
        {
          error: "No active login code found. Please restart the login process.",
          code: "NO_ACTIVE_CODE",
        },
        { status: 400 }
      );
    }

    if (new Date() > new Date(user.verificationCodeExpires)) {
      // Clear expired code
      user.verificationCode = undefined;
      user.verificationCodeExpires = undefined;
      await user.save();
      return NextResponse.json(
        {
          error: "Login code has expired. Please sign in again to receive a new code.",
          code: "CODE_EXPIRED",
        },
        { status: 400 }
      );
    }

    if (user.verificationCode !== otp) {
      return NextResponse.json(
        {
          error: "Incorrect code. Please check your email and try again.",
          code: "INVALID_CODE",
        },
        { status: 400 }
      );
    }

    // Clear the OTP so it cannot be reused
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    // Register device and trigger security notification immediately at login!
    const userAgent = req.headers.get("user-agent") || "";
    const cookieDeviceId = req.cookies.get("dclne_device_id")?.value;
    const headerDeviceId = req.headers.get("x-device-id");
    const clientDeviceId = (headerDeviceId || cookieDeviceId || body.deviceId || "").trim();

    try {
      await registerOrUpdateDevice({
        userId: user._id,
        userAgent,
        clientDeviceId,
        sendNotification: true,
      });
    } catch (devErr) {
      console.error("[verify-login-otp] device register error:", devErr);
    }

    return NextResponse.json({
      success: true,
      message: "Code verified. Signing you in…",
    });
  } catch (error) {
    const err = error as Error;
    console.error("[verify-login-otp error]:", err);
    return NextResponse.json(
      { error: err?.message || "An unexpected error occurred.", code: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
