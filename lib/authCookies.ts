import { NextResponse } from "next/server";

export const AUTH_COOKIE_NAMES = [
  "authjs.session-token",
  "authjs.session-token.0",
  "authjs.session-token.1",
  "__Secure-authjs.session-token",
  "__Secure-authjs.session-token.0",
  "__Secure-authjs.session-token.1",
  "next-auth.session-token",
  "next-auth.session-token.0",
  "next-auth.session-token.1",
  "__Secure-next-auth.session-token",
  "__Secure-next-auth.session-token.0",
  "__Secure-next-auth.session-token.1",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "next-auth.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
  "dclne_device_id",
];

export function clearAllAuthCookies(res: NextResponse) {
  const isProd = process.env.NODE_ENV === "production";
  for (const name of AUTH_COOKIE_NAMES) {
    res.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: name.includes("token") || name.includes("callback"),
      sameSite: "lax",
      secure: isProd,
    });
  }
}
