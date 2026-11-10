import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User, { IUserDevice } from "@/models/User";
import { MAX_DEVICES, parseDeviceName } from "@/lib/deviceManager";

async function getUser(req?: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return null;
  await connectDB();
  return User.findOne({ email: session.user.email.toLowerCase().trim() });
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userAgent = req.headers.get("user-agent") || "";
  const headerDeviceId = req.headers.get("x-device-id");
  const cookieDeviceId = req.cookies.get("dclne_device_id")?.value;
  const currentDeviceId = (headerDeviceId || cookieDeviceId || "").trim();

  let devices: IUserDevice[] = user.devices ?? [];

  // Match current device by unique deviceId first; fallback to UA match if needed
  let currentIdx = -1;
  if (currentDeviceId) {
    currentIdx = devices.findIndex((d) => d.deviceId === currentDeviceId);
  }

  if (currentIdx >= 0) {
    devices[currentIdx].lastActive = new Date();
    devices[currentIdx].isCurrent = true;
    devices.forEach((d, i) => {
      if (i !== currentIdx) d.isCurrent = false;
    });
    user.devices = devices;
    await user.save();
  } else if (currentDeviceId) {
    // Current device is not registered yet — register it
    const { name, type } = parseDeviceName(userAgent);
    // Enforce max 5 devices
    while (devices.length >= MAX_DEVICES) {
      devices.sort((a, b) => new Date(a.lastActive).getTime() - new Date(b.lastActive).getTime());
      devices.shift();
    }
    devices.forEach((d) => { d.isCurrent = false; });
    devices.push({
      deviceId: currentDeviceId,
      name,
      type,
      lastActive: new Date(),
      isCurrent: true,
    });
    user.devices = devices;
    await user.save();
  }

  return NextResponse.json({
    devices,
    maxDevices: MAX_DEVICES,
    count: devices.length,
    currentDeviceId,
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("deviceId");

  if (!deviceId) return NextResponse.json({ error: "deviceId is required" }, { status: 400 });

  user.devices = (user.devices ?? []).filter((d) => d.deviceId !== deviceId);
  if (user.pushSubscriptions) {
    user.pushSubscriptions = user.pushSubscriptions.filter((s) => s.deviceId !== deviceId);
  }
  await user.save();

  return NextResponse.json({ success: true, devices: user.devices });
}
