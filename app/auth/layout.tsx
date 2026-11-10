import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Authentication",
  description: "Sign in or create an account for Money Docs",
  icons: {
    icon: "/assets/icons/favicon.png",
    shortcut: "/assets/icons/favicon.png",
    apple: "/assets/icons/favicon2.png",
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <link rel="icon" href="/assets/icons/favicon.png" />
      <link rel="shortcut icon" href="/assets/icons/favicon.png" />
      <link rel="apple-touch-icon" href="/assets/icons/favicon2.png" />
      {children}
    </ToastProvider>
  );
}