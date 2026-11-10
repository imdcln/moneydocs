import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16: middleware.ts is deprecated → renamed to proxy.ts
// Next.js AST static analysis requires a direct `proxy` identifier or `default` export
const { auth } = NextAuth(authConfig);

export const proxy = auth;
export default auth;

export const config = {
  // Protect dashboard routes, allow public assets / sw / manifest
  matcher: ["/((?!api|_next/static|_next/image|assets|favicon.ico|manifest.json|sw.js).*)"],
};
