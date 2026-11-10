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

    const { subscription, deviceId, userAgent } = await req.json();
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if endpoint already exists for user
    const existingIndex = (user.pushSubscriptions || []).findIndex(
      (sub) => sub.endpoint === subscription.endpoint
    );

    if (existingIndex >= 0) {
      // Update existing
      user.pushSubscriptions![existingIndex] = {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        deviceId: deviceId || user.pushSubscriptions![existingIndex].deviceId,
        userAgent: userAgent || user.pushSubscriptions![existingIndex].userAgent,
        createdAt: new Date(),
      };
    } else {
      // Add new
      if (!user.pushSubscriptions) user.pushSubscriptions = [];
      user.pushSubscriptions.push({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        deviceId,
        userAgent,
        createdAt: new Date(),
      });
    }

    await user.save();

    return NextResponse.json({
      success: true,
      message: "Push notifications subscribed successfully",
    });
  } catch (error) {
    console.error("POST /api/notifications/push-subscribe error:", error);
    return NextResponse.json({ error: "Failed to save push subscription" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { endpoint } = await req.json();
    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint required" }, { status: 400 });
    }

    await connectDB();
    await User.updateOne(
      { email: session.user.email },
      {
        $pull: { pushSubscriptions: { endpoint } },
      }
    );

    return NextResponse.json({ success: true, message: "Unsubscribed successfully" });
  } catch (error) {
    console.error("DELETE /api/notifications/push-subscribe error:", error);
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}
