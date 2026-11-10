import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { registerOrUpdateDevice } from "@/lib/deviceManager";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.email || !body.password) {
      return NextResponse.json(
        {
          error: "Email and password are required.",
          code: "MISSING_CREDENTIALS",
        },
        { status: 400 }
      );
    }

    const { email, password } = body;
    const cleanEmail = String(email).toLowerCase().trim();

    try {
      await connectDB();
    } catch (dbError) {
      const dbErr = dbError as Error;
      console.error("[login API] MongoDB connection failure:", dbErr);
      return NextResponse.json(
        {
          error: "Database connection failed. Please verify your MongoDB configuration.",
          code: "DATABASE_CONNECTION_ERROR",
          details: dbErr?.message || String(dbError),
        },
        { status: 503 }
      );
    }

    const user = await User.findOne({ email: cleanEmail }).select("+password");

    if (!user) {
      return NextResponse.json(
        {
          error: "No account found with this email address.",
          code: "USER_NOT_FOUND",
        },
        { status: 401 }
      );
    }

    if (!user.password) {
      return NextResponse.json(
        {
          error: "This account was registered using Google Sign-In. Please sign in with Google.",
          code: "OAUTH_ACCOUNT_NO_PASSWORD",
        },
        { status: 400 }
      );
    }

    const isPasswordValid = await bcrypt.compare(String(password), user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          error: "Incorrect password. Please verify your credentials.",
          code: "INVALID_PASSWORD",
        },
        { status: 401 }
      );
    }

    // Direct login without OTP — register device & send notification immediately
    // If emailOtpEnabled is true, device will be registered after OTP verification in verify-login-otp
    if (!user.emailOtpEnabled) {
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
        console.error("[login API] device register error:", devErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Credentials verified successfully.",
        // Flag verified accounts that have email OTP enabled so the client can trigger the OTP step
        isVerified: Boolean(user.isVerified),
        emailOtpEnabled: Boolean(user.emailOtpEnabled),
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const err = error as Error & { code?: string };
    console.error("[login API unhandled error]:", err);
    return NextResponse.json(
      {
        error: err?.message || "An unexpected error occurred during authentication.",
        code: err?.code || err?.name || "INTERNAL_SERVER_ERROR",
        details: process.env.NODE_ENV !== "production" ? (err?.stack || String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}
