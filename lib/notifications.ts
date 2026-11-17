import webpush from "web-push";
import mongoose from "mongoose";
import Notification, { NotificationType } from "@/models/Notification";
import User from "@/models/User";
import { connectDB } from "@/lib/mongoose";
import { cleanNotificationText } from "@/lib/notificationUtils";

// Setup VAPID keys from environment variables
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@moneydocs.app";

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.warn("Failed to set VAPID details:", err);
  }
} else {
  console.warn("VAPID keys not configured in environment variables. Web push notifications will be skipped.");
}

export interface SendNotificationOptions {
  userId: string | mongoose.Types.ObjectId;
  type?: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  icon?: string;
}

/**
 * Creates an in-app notification in MongoDB and triggers a Web Push notification
 * to all registered devices for the user.
 */
export async function createAndSendNotification({
  userId,
  type = "GENERAL",
  title,
  message,
  link = "/notifications",
  metadata = {},
  icon = "/assets/icons/favicon2.png",
}: SendNotificationOptions) {
  try {
    await connectDB();
    const userObjectId =
      typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

    const cleanTitle = cleanNotificationText(title);
    const cleanMessage = cleanNotificationText(message);

    // 1. Create DB notification record
    const notif = await Notification.create({
      userId: userObjectId,
      type,
      title: cleanTitle,
      message: cleanMessage,
      link,
      metadata,
      isRead: false,
    });

    // 2. Fetch user's registered push subscriptions
    const user = await User.findById(userObjectId).select("pushSubscriptions").lean();
    if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
      return notif;
    }

    // 3. Payload for native device notification
    if (!vapidPublicKey || !vapidPrivateKey) {
      return notif;
    }
    const pushPayload = JSON.stringify({
      title: cleanTitle,
      body: cleanMessage,
      icon,
      badge: "/assets/icons/favicon2.png",
      url: link,
      tag: `${type.toLowerCase()}-${Date.now()}`,
      data: {
        id: String(notif._id),
        url: link,
        type,
      },
    });

    // 4. Send push to each subscription
    const expiredEndpoints: string[] = [];

    await Promise.all(
      user.pushSubscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth,
              },
            },
            pushPayload
          );
        } catch (err: unknown) {
          const pushErr = err as { statusCode?: number };
          // 404 or 410 means subscription is expired or cancelled by browser
          if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
            expiredEndpoints.push(sub.endpoint);
          } else {
            console.error("Error sending web push:", err);
          }
        }
      })
    );

    // 5. Clean up expired subscriptions if any
    if (expiredEndpoints.length > 0) {
      await User.updateOne(
        { _id: userObjectId },
        {
          $pull: {
            pushSubscriptions: { endpoint: { $in: expiredEndpoints } },
          },
        }
      );
    }

    return notif;
  } catch (error) {
    console.error("createAndSendNotification error:", error);
    return null;
  }
}

/**
 * Broadcast a notification to all active users (e.g. for Vercel deployment / new version)
 */
export async function broadcastNotification({
  type = "SYSTEM",
  title,
  message,
  link = "/notifications",
  metadata = {},
}: Omit<SendNotificationOptions, "userId">) {
  try {
    await connectDB();
    const users = await User.find({}).select("_id").lean();

    const promises = users.map((u) =>
      createAndSendNotification({
        userId: u._id as mongoose.Types.ObjectId,
        type,
        title,
        message,
        link,
        metadata,
      })
    );

    await Promise.all(promises);
    return { success: true, count: users.length };
  } catch (error) {
    console.error("broadcastNotification error:", error);
    return { success: false, error };
  }
}
