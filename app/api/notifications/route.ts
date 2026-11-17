import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import Notification from "@/models/Notification";
import { cleanNotificationText } from "@/lib/notificationUtils";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email }).select("_id").lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
    const type = searchParams.get("type");

    const query: Record<string, unknown> = { userId: user._id };
    if (type && type !== "ALL") {
      query.type = type.toUpperCase();
    }

    const [rawNotifications, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ userId: user._id, isRead: false }),
    ]);

    const notifications = rawNotifications.map((n) => ({
      ...n,
      title: cleanNotificationText(n.title),
      message: cleanNotificationText(n.message),
    }));

    // Self-heal corrupted notification records in database
    const corruptedIds = rawNotifications
      .filter((n) => /âš|â€|â”/.test(n.title || "") || /âš|â€|â”/.test(n.message || ""))
      .map((n) => n._id);

    if (corruptedIds.length > 0) {
      Promise.all(
        corruptedIds.map((id) => {
          const doc = rawNotifications.find((n) => n._id === id);
          if (!doc) return Promise.resolve();
          return Notification.updateOne(
            { _id: id },
            {
              $set: {
                title: cleanNotificationText(doc.title),
                message: cleanNotificationText(doc.message),
              },
            }
          );
        })
      ).catch((err) => console.error("Self-heal notification error:", err));
    }

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email }).select("_id").lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { id, all } = body;

    if (all) {
      await Notification.updateMany({ userId: user._id, isRead: false }, { isRead: true });
      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    }

    if (id) {
      await Notification.updateOne({ _id: id, userId: user._id }, { isRead: true });
      return NextResponse.json({ success: true, message: "Notification marked as read" });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email }).select("_id").lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const clearAll = searchParams.get("all") === "true";

    if (clearAll) {
      await Notification.deleteMany({ userId: user._id });
      return NextResponse.json({ success: true, message: "All notifications cleared" });
    }

    if (id) {
      await Notification.deleteOne({ _id: id, userId: user._id });
      return NextResponse.json({ success: true, message: "Notification deleted" });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("DELETE /api/notifications error:", error);
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
  }
}
