import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { valid: false, reason: "UNAUTHENTICATED" },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const { searchParams } = new URL(req.url);
    const headerDeviceId = req.headers.get("x-device-id");
    const cookieDeviceId = req.cookies.get("dclne_device_id")?.value;
    const deviceId = (searchParams.get("deviceId") || headerDeviceId || cookieDeviceId || "").trim();

    await connectDB();
    const user = await User.findOne({ email: session.user.email.toLowerCase().trim() });
    if (!user) {
      return NextResponse.json(
        { valid: false, reason: "USER_NOT_FOUND" },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    // If client supplied a deviceId, check whether it is in user's active devices
    if (deviceId) {
      const activeDevices = user.devices ?? [];

      // If user has zero active devices recorded (e.g. legacy account or migration),
      // auto-register current device rather than erroneously kicking them out.
      if (activeDevices.length === 0) {
        const ua = req.headers.get("user-agent") || "";
        const { registerOrUpdateDevice } = await import("@/lib/deviceManager");
        await registerOrUpdateDevice({
          userId: user._id,
          userAgent: ua,
          clientDeviceId: deviceId,
          sendNotification: false,
        });
        return NextResponse.json({ valid: true, deviceId }, { headers: NO_CACHE_HEADERS });
      }

      const match = activeDevices.find((d) => d.deviceId === deviceId);

      if (!match) {
        // Device was disconnected by another session or evicted!
        return NextResponse.json(
          {
            valid: false,
            reason: "DEVICE_DISCONNECTED",
            error: "This device was disconnected from another session.",
          },
          { status: 401, headers: NO_CACHE_HEADERS }
        );
      }

      // Update last active if older than 2 minutes
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
      if (!match.lastActive || new Date(match.lastActive).getTime() < twoMinutesAgo) {
        match.lastActive = new Date();
        await user.save();
      }
    }

    return NextResponse.json({
      valid: true,
      deviceId,
    }, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    console.error("[session-check error]:", err);
    return NextResponse.json({ valid: true }, { headers: NO_CACHE_HEADERS }); // fail open on unexpected server error to avoid spurious logouts
  }
}
