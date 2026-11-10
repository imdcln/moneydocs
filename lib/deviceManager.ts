import { createHash } from "crypto";
import mongoose from "mongoose";
import User, { IUser, IUserDevice } from "@/models/User";
import { createAndSendNotification } from "@/lib/notifications";

export const MAX_DEVICES = 5;

/** Build a user-friendly device name and type from User-Agent */
export function parseDeviceName(ua: string): { name: string; type: "mobile" | "tablet" | "desktop" } {
  let os = "Unknown Device";
  let type: "mobile" | "tablet" | "desktop" = "desktop";

  if (/Android/i.test(ua)) {
    type = /Mobile/i.test(ua) ? "mobile" : "tablet";
    const modelMatch = ua.match(/Android[^;]+;\s*([^;\)]+)/i);
    const model = modelMatch ? modelMatch[1].trim() : "";
    if (model && model.length > 1 && model !== "K") {
      os = `Android (${model})`;
    } else {
      os = type === "tablet" ? "Android Tablet" : "Android Phone";
    }
  } else if (/iPhone/i.test(ua)) {
    type = "mobile";
    os = "iPhone";
  } else if (/iPad/i.test(ua)) {
    type = "tablet";
    os = "iPad";
  } else if (/Windows/i.test(ua)) {
    type = "desktop";
    os = "Windows PC";
  } else if (/Macintosh/i.test(ua)) {
    type = "desktop";
    os = "Mac";
  } else if (/Linux/i.test(ua)) {
    type = "desktop";
    os = "Linux PC";
  } else if (/CrOS/i.test(ua)) {
    type = "desktop";
    os = "Chromebook";
  }

  // Detect browser
  let browser = "Browser";
  if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";

  return { name: `${os} • ${browser}`, type };
}

/** Fallback stable hash when clientDeviceId is not supplied */
export function generateDeviceHash(ua: string, ip?: string): string {
  return "dev_ua_" + createHash("sha256").update(`${ua}-${ip || ""}`).digest("hex").slice(0, 20);
}

interface RegisterDeviceOptions {
  userId: string | mongoose.Types.ObjectId;
  userAgent: string;
  clientDeviceId?: string;
  ip?: string;
  sendNotification?: boolean;
}

/**
 * Registers a device for a user immediately, enforcing MAX_DEVICES = 5.
 * If this is a new device, a security notification is dispatched right away (no delay).
 */
export async function registerOrUpdateDevice({
  userId,
  userAgent,
  clientDeviceId,
  ip,
  sendNotification = true,
}: RegisterDeviceOptions): Promise<{ deviceId: string; isNew: boolean; device: IUserDevice }> {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const effectiveDeviceId =
    clientDeviceId && clientDeviceId.trim().length > 3
      ? clientDeviceId.trim()
      : generateDeviceHash(userAgent, ip);

  const { name: parsedName, type: parsedType } = parseDeviceName(userAgent);

  let devices: IUserDevice[] = Array.isArray(user.devices) ? [...user.devices] : [];
  const existingIdx = devices.findIndex((d) => d.deviceId === effectiveDeviceId);

  if (existingIdx >= 0) {
    // Existing device — update activity and name
    devices[existingIdx].lastActive = new Date();
    devices[existingIdx].name = parsedName;
    devices[existingIdx].type = parsedType;

    user.devices = devices;
    await user.save();
    return { deviceId: effectiveDeviceId, isNew: false, device: devices[existingIdx] };
  }

  // New device — enforce strictly MAX_DEVICES (5)
  // If at or above limit, evict the oldest device(s)
  while (devices.length >= MAX_DEVICES) {
    devices.sort((a, b) => new Date(a.lastActive).getTime() - new Date(b.lastActive).getTime());
    const evicted = devices.shift();
    if (evicted) {
      console.log(`[deviceManager] Evicting oldest device ${evicted.deviceId} (${evicted.name}) due to max 5 devices limit.`);
      // Clean up push subscriptions for evicted device
      if (user.pushSubscriptions) {
        user.pushSubscriptions = user.pushSubscriptions.filter((s) => s.deviceId !== evicted.deviceId);
      }
    }
  }

  const newDevice: IUserDevice = {
    deviceId: effectiveDeviceId,
    name: parsedName,
    type: parsedType,
    lastActive: new Date(),
    isCurrent: true,
  };

  devices.push(newDevice);
  user.devices = devices;
  await user.save();

  // Instant notification right at the second of login!
  if (sendNotification) {
    createAndSendNotification({
      userId: user._id,
      type: "SECURITY",
      title: "New Device Signed In 📱",
      message: `A new sign-in was detected on "${parsedName}". If this wasn't you, disconnect this device immediately.`,
      link: "/account/my-account",
      metadata: { deviceName: parsedName, deviceType: parsedType, deviceId: effectiveDeviceId },
    }).catch((err) => console.error("[deviceManager notification error]:", err));
  }

  return { deviceId: effectiveDeviceId, isNew: true, device: newDevice };
}
