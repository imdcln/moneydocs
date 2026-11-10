import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import BottomNav from "@/components/admin/BottomNav";
import AddTransactionModal from "@/components/admin/AddTransactionModal";
import { AdminModalProvider } from "@/hooks/useAdminModal";
import { ToastProvider } from "@/components/ui/Toast";
import { WalletProvider } from "@/hooks/useWalletContext";
import SessionDeviceWatcher from "@/components/admin/SessionDeviceWatcher";

export const metadata: Metadata = {
  title: {
    default: "Money Docs",
    template: "%s | Money Docs",
  },
  description: "Money Docs — Personal finance & debt dashboard",
  icons: {
    icon: [
      { url: "/assets/icons/favicon2.png" },
      { url: "/assets/favicon2.png" },
    ],
    shortcut: "/assets/icons/favicon2.png",
    apple: "/assets/icons/favicon2.png",
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
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
