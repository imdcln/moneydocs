import { NextResponse } from "next/server";
import { getExchangeRates } from "@/lib/currency";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const base = (searchParams.get("base") || "USD").toUpperCase();
    const refresh = searchParams.get("refresh") === "true";
    const rates = await getExchangeRates(base, refresh);
    const res = NextResponse.json({
      base,
      rates,
      provider: "fawazahmed0/exchange-api",
      timestamp: Date.now(),
    });
    // Exchange rates update at most once a day — cache on the client for 1 hour,
    // allow serving a stale copy for up to 30 more minutes while revalidating.
    res.headers.set(
      "Cache-Control",
      "private, max-age=3600, stale-while-revalidate=1800"
    );
    return res;
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch exchange rates" },
      { status: 503 }
    );
  }
}
