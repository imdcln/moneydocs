import { NextResponse } from "next/server";
import { getExchangeRates } from "@/lib/currency";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const base = (searchParams.get("base") || "USD").toUpperCase();
    const refresh = searchParams.get("refresh") === "true";
    const rates = await getExchangeRates(base, refresh);
    return NextResponse.json({
      base,
      rates,
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch exchange rates" },
      { status: 503 }
    );
  }
}
