import { NextResponse } from "next/server";
import { clearAllAuthCookies } from "@/lib/authCookies";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ success: true, message: "Session cookies cleared" });
  clearAllAuthCookies(res);
  return res;
}

export async function GET() {
  const res = NextResponse.json({ success: true, message: "Session cookies cleared" });
  clearAllAuthCookies(res);
  return res;
}
