import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import BottomNav from "@/components/admin/BottomNav";
import AddTransactionModal from "@/components/admin/AddTransactionModal";
import { AdminModalProvider } from "@/hooks/useAdminModal";
import { ToastProvider } from "@/components/ui/Toast";
import { WalletProvider } from "@/hooks/useWalletContext";
import SessionDeviceWatcher from "@/components/admin/SessionDeviceWatcher";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  // Fast server-side check: If this device was disconnected by another session while offline,
  // abort dashboard rendering immediately and redirect straight to sign-in.
  const cookieStore = await cookies();
  const headerList = await headers();
  const cookieDeviceId = cookieStore.get("dclne_device_id")?.value;
  const headerDeviceId = headerList.get("x-device-id");
  const deviceId = (headerDeviceId || cookieDeviceId || "").trim();

  if (deviceId && session.user.email) {
    try {
      await connectDB();
      const userDoc = (await User.findOne({ email: session.user.email.toLowerCase().trim() })
        .select("devices")
        .lean()) as { devices?: Array<{ deviceId: string }> } | null;

      if (userDoc && Array.isArray(userDoc.devices) && userDoc.devices.length > 0) {
        const isDeviceActive = userDoc.devices.some((d) => d.deviceId === deviceId);
        if (!isDeviceActive) {
          redirect("/auth/signin?disconnected=1");
        }
      }
    } catch (err: unknown) {
      // In Next.js, redirect() throws an internal NEXT_REDIRECT error that MUST be rethrown!
      if (err && typeof err === "object" && "digest" in err && String((err as any).digest).startsWith("NEXT_REDIRECT")) {
        throw err;
      }
      // On genuine DB glitch, allow layout to proceed and let SessionDeviceWatcher verify on client
    }
  }

  return (
    <WalletProvider>
      <AdminModalProvider>
        <ToastProvider>
          <div className="min-h-screen bg-[#0c0d10] text-slate-100">
            {/* Real-time active session watcher: kicks out disconnected devices immediately */}
            <SessionDeviceWatcher />

            {/* Dedicated route-level favicon enforcement */}
            <link rel="icon" href="/assets/icons/favicon2.png" />
            <link rel="shortcut icon" href="/assets/icons/favicon2.png" />
            <link rel="apple-touch-icon" href="/assets/icons/favicon2.png" />

            {/* Main content container */}
            <main className="w-full">{children}</main>

            {/* Floating Add Transaction Modal (controlled by BottomNav FAB) */}
            <AddTransactionModal />

            {/* Persistent Bottom Navigation */}
            <BottomNav />
          </div>
        </ToastProvider>
      </AdminModalProvider>
    </WalletProvider>
  );
}
