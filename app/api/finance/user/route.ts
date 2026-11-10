import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email }).lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const authProvider = user.authProvider || (user.googleId ? "google" : "credentials");
    // Google accounts are inherently verified; simple auth accounts check isVerified flag
    const isVerified = authProvider === "google" ? true : Boolean(user.isVerified);

    return NextResponse.json({
      user: {
        id: String((user as { _id: unknown })._id),
        name: user.name,
        email: user.email,
        image: user.image,
        authProvider,
        isVerified,
        emailOtpEnabled: Boolean(user.emailOtpEnabled),
        baseCurrency: user.baseCurrency || "IDR",
        hasCompletedOnboarding: Boolean(user.hasCompletedOnboarding),
        profileColor: user.profileColor || "from-pink-500 to-rose-400",
      },
    });
  } catch (error) {
    console.error("[user GET error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { baseCurrency, hasCompletedOnboarding, name, profileColor, image } = await req.json();

    await connectDB();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (baseCurrency) user.baseCurrency = baseCurrency;
    if (typeof hasCompletedOnboarding === "boolean") {
      user.hasCompletedOnboarding = hasCompletedOnboarding;
    }
    if (name) user.name = name;
    if (profileColor) user.profileColor = profileColor;

    // Handle profile picture update or removal with clean cybersecurity checks
    if (image !== undefined) {
      if (image === null || image === "") {
        user.image = undefined;
      } else if (typeof image === "string") {
        // 1. Max size constraint: limit payload to 2.5MB to prevent DoS / storage abuse
        if (image.length > 2.5 * 1024 * 1024) {
          return NextResponse.json(
            { error: "Image payload exceeds maximum allowed size (2.5MB)." },
            { status: 400 }
          );
        }

        // 2. Strict format validation: only allow safe image MIME types (JPEG, PNG, WebP) or trusted HTTPS URLs
        const isDataUrl = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image);
        const isSafeHttpsUrl = /^https:\/\/[a-zA-Z0-9_.-]+/.test(image);

        if (!isDataUrl && !isSafeHttpsUrl) {
          return NextResponse.json(
            { error: "Invalid image format. Only JPEG, PNG, or WebP images are allowed." },
            { status: 400 }
          );
        }

        // 3. Magic bytes validation for base64 data to block disguised executables / polyglots
        if (isDataUrl) {
          const base64Data = image.split(",")[1];
          if (!base64Data) {
            return NextResponse.json({ error: "Malformed image data." }, { status: 400 });
          }

          const headerChunk = Buffer.from(base64Data.slice(0, 32), "base64");
          const isJpeg = headerChunk[0] === 0xff && headerChunk[1] === 0xd8 && headerChunk[2] === 0xff;
          const isPng = headerChunk[0] === 0x89 && headerChunk[1] === 0x50 && headerChunk[2] === 0x4e && headerChunk[3] === 0x47;
          const isWebp =
            headerChunk.toString("ascii", 0, 4) === "RIFF" &&
            headerChunk.toString("ascii", 8, 12) === "WEBP";

          if (!isJpeg && !isPng && !isWebp) {
            return NextResponse.json(
              { error: "File signature verification failed. Please upload a valid image." },
              { status: 400 }
            );
          }
        }

        user.image = image;
      }
    }

    await user.save();

    const authProvider = user.authProvider || (user.googleId ? "google" : "credentials");
    const isVerified = authProvider === "google" ? true : Boolean(user.isVerified);

    return NextResponse.json({
      success: true,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        image: user.image || null,
        authProvider,
        isVerified,
        baseCurrency: user.baseCurrency,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        profileColor: user.profileColor,
      },
    });
  } catch (error) {
    console.error("[user PATCH error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
