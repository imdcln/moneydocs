import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { sendVerificationEmail } from "@/lib/mail";

/**
 * POST /api/auth/send-login-otp
 *
 * Called after credentials are validated for a verified account.
 * Generates a 6-digit OTP, stores it on the user doc, and emails it.
 * Returns { requiresOtp: true } on success so the client can show the OTP step.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body?.email || !body?.password) {
      return NextResponse.json(
        { error: "Email and password are required.", code: "MISSING_CREDENTIALS" },
        { status: 400 }
      );
    }

    const { email, password } = body;
    const cleanEmail = String(email).toLowerCase().trim();

    await connectDB();
    const user = await User.findOne({ email: cleanEmail }).select("+password");

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email address.", code: "USER_NOT_FOUND" },
        { status: 401 }
      );
    }

    if (!user.password) {
      return NextResponse.json(
        {
          error: "This account uses Google Sign-In. Please sign in with Google.",
          code: "OAUTH_ACCOUNT_NO_PASSWORD",
        },
        { status: 400 }
      );
    }

    const isPasswordValid = await bcrypt.compare(String(password), user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Incorrect password. Please verify your credentials.", code: "INVALID_PASSWORD" },
        { status: 401 }
      );
    }

    // Generate a 6-digit OTP valid for 10 minutes
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Reuse the verificationCode fields for the login OTP
    user.verificationCode = otp;
    user.verificationCodeExpires = expiresAt;
    await user.save();

    console.log(`\n========================================\n🔑 [LOGIN OTP] Code for ${user.email}: ${otp}\n========================================\n`);

    const mailResult = await sendVerificationEmail({
      to: user.email,
      name: user.name,
      code: otp,
    });

    if (!mailResult.success) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[send-login-otp] DEV MODE: Email failed (${mailResult.error}), fallback OTP available in terminal: ${otp}`);
        return NextResponse.json({
          success: true,
          requiresOtp: true,
          message: `[DEV] SMTP connection failed, but your code is printed in terminal: ${otp}`,
          devOtp: otp,
        });
      }
      return NextResponse.json(
        { error: mailResult.error || "Failed to send verification email.", code: "EMAIL_SEND_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      requiresOtp: true,
      message: `A 6-digit login code has been sent to ${user.email}.`,
    });
  } catch (error) {
    const err = error as Error;
    console.error("[send-login-otp error]:", err);
    return NextResponse.json(
      { error: err?.message || "An unexpected error occurred.", code: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
