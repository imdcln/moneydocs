import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import Account from "@/models/Account";
import { verifyCollisionToken } from "@/lib/tokenUtils";
import { registerOrUpdateDevice } from "@/lib/deviceManager";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.email || !body.password || !body.token) {
      return NextResponse.json(
        { error: "Email, password, and security token are required." },
        { status: 400 }
      );
    }

    const { email, password, token } = body;
    const cleanEmail = String(email).toLowerCase().trim();

    // Verify cryptographic collision token
    const tokenPayload = verifyCollisionToken(token);
    if (!tokenPayload) {
      return NextResponse.json(
        {
          error: "Verification session expired or invalid. Please sign in with Google again.",
          code: "TOKEN_EXPIRED",
        },
        { status: 400 }
      );
    }

    if (tokenPayload.email.toLowerCase().trim() !== cleanEmail) {
      return NextResponse.json(
        { error: "Token mismatch. Please restart Google sign-in." },
        { status: 403 }
      );
    }

    await connectDB();
    const user = await User.findOne({ email: cleanEmail }).select("+password +passwordHash");
    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email." },
        { status: 404 }
      );
    }

    const currentPassword = user.passwordHash || user.password;
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Account does not have an active password." },
        { status: 400 }
      );
    }

    // Verify existing account password
    const isPasswordValid = await bcrypt.compare(String(password), currentPassword);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Incorrect password. Please enter the current password for this account." },
        { status: 401 }
      );
    }

    // Ownership confirmed! Link Google and mark account as verified
    user.isVerified = true;
    user.googleId = tokenPayload.providerAccountId;
    if (tokenPayload.image && !user.image) {
      user.image = tokenPayload.image;
    }
    await user.save();

    // Link Google in Account model
    await Account.findOneAndUpdate(
      { provider: "google", providerAccountId: tokenPayload.providerAccountId },
      {
        userId: user._id,
        provider: "google",
        providerAccountId: tokenPayload.providerAccountId,
        emailVerified: true,
        type: "oauth",
      },
      { upsert: true, new: true }
    );

    // Ensure credentials Account record exists
    await Account.findOneAndUpdate(
      { provider: "credentials", providerAccountId: cleanEmail },
      {
        userId: user._id,
        provider: "credentials",
        providerAccountId: cleanEmail,
        emailVerified: true,
        type: "credentials",
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    // Register device
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
      console.error("[link-collision] device register error:", devErr);
    }

    return NextResponse.json({
      success: true,
      message: "Ownership verified! Google account has been linked successfully.",
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("[link-collision error]:", error);
    return NextResponse.json(
      { error: "Internal server error during account linking." },
      { status: 500 }
    );
  }
}
