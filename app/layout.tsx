import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Money Docs",
    template: "%s | Money Docs",
  },
  description: "Money Docs — Personal finance & debt dashboard",
  icons: {
    icon: "/assets/icons/favicon.png",
    shortcut: "/assets/icons/favicon.png",
    apple: "/assets/icons/favicon2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-theme-color="green" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Money Docs" />
        <link rel="apple-touch-icon" href="/assets/icons/favicon2.png" />
        <script
          id="dclne-theme-preinit"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('dclne_theme_color') || 'green';
                  document.documentElement.setAttribute('data-theme-color', saved);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${plusJakartaSans.variable} font-sans bg-[#0c0d0f] text-slate-100 antialiased min-h-screen selection:bg-[var(--color-primary-subtle)] selection:text-[var(--color-primary-light)]`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
