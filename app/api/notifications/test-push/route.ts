import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { createAndSendNotification } from "@/lib/notifications";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email }).select("_id pushSubscriptions").lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const notif = await createAndSendNotification({
      userId: user._id,
      type: "SYSTEM",
      title: "Device Notifications Active! 🔔",
      message: "Push notifications are working properly on this device.",
      link: "/notifications",
      metadata: { isTest: true },
    });

    const activeSubscriptions = user.pushSubscriptions?.length || 0;

    return NextResponse.json({
      success: true,
      message: "Test notification sent",
      activeDevices: activeSubscriptions,
      notification: notif,
    });
  } catch (error) {
    console.error("POST /api/notifications/test-push error:", error);
    return NextResponse.json({ error: "Failed to send test push" }, { status: 500 });
  }
}
