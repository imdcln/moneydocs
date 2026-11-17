import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const now = Math.floor(Date.now() / 1000);
      const sessionExpiry = (auth as { sessionExpiry?: number })?.sessionExpiry;
      const stayLoggedIn = (auth as { stayLoggedIn?: boolean })?.stayLoggedIn;
      const isExpired =
        stayLoggedIn === false &&
        typeof sessionExpiry === "number" &&
        now > sessionExpiry;

      const isLoggedIn = !!auth?.user && !isExpired;
      const isOnAuth = nextUrl.pathname.startsWith("/auth");
      const isPublic =
        nextUrl.pathname.startsWith("/api") ||
        nextUrl.pathname.startsWith("/_next") ||
        nextUrl.pathname.startsWith("/assets") ||
        nextUrl.pathname === "/sw.js" ||
        nextUrl.pathname === "/manifest.json" ||
        nextUrl.pathname.includes(".");

      if (isOnAuth) {
        // If device was disconnected or an auth error occurred, do NOT bounce back to dashboard!
        if (
          nextUrl.searchParams.has("disconnected") ||
          nextUrl.searchParams.has("error")
        ) {
          return true;
        }
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      if (!isLoggedIn && !isPublic) {
        return false;
      }
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
