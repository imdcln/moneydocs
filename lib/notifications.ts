import webpush from "web-push";
import mongoose from "mongoose";
import Notification, { NotificationType } from "@/models/Notification";
import User from "@/models/User";
import { connectDB } from "@/lib/mongoose";

// Setup VAPID keys
const vapidPublicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BJtjXcn7pd0xvjjnkL1YCKz4jIB_ja4a5_dX0pa4Jpi9SdWU0xdIV4WARYRETbGA7bUxgxxxGjQe4tayLgprUCc";
const vapidPrivateKey =
  process.env.VAPID_PRIVATE_KEY || "eTya7Uz7WMyoLMM7MhamTXTH_Gk1brvfhqG7hujdsac";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@dclne.com";

try {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} catch (err) {
  console.warn("Failed to set VAPID details:", err);
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

    // 1. Create DB notification record
    const notif = await Notification.create({
      userId: userObjectId,
      type,
      title,
      message,
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
    const pushPayload = JSON.stringify({
      title,
      body: message,
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
