import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Money Docs — Authentication",
  description: "Sign in or create an account for Money Docs",
  icons: {
    icon: [
      { url: "/assets/icons/favicon2.png" },
      { url: "/assets/favicon2.png" },
    ],
    shortcut: "/assets/icons/favicon2.png",
    apple: "/assets/icons/favicon2.png",
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="icon" href="/assets/icons/favicon2.png" />
      <link rel="shortcut icon" href="/assets/icons/favicon2.png" />
      <link rel="apple-touch-icon" href="/assets/icons/favicon2.png" />
      {children}
    </>
  );
}
