import { NextResponse } from "next/server";
import { isGoogleConfigured } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({
    googleConfigured: isGoogleConfigured,
  });
}
