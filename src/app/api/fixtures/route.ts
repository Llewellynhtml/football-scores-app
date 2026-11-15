import { NextResponse } from "next/server";
import { getTodayFixtures } from "@/lib/api-football";
import { FOOTBALL_DATA_MODE } from "@/lib/football-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fixtures = await getTodayFixtures();
    return NextResponse.json(
      { ok: true, date: new Date().toISOString(), count: fixtures.length, fixtures },
      { headers: { "Cache-Control": FOOTBALL_DATA_MODE === "current"
        ? "public, s-maxage=30, stale-while-revalidate=30"
        : "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (error) {
    console.error("Football fixtures unavailable", error);
    return NextResponse.json(
      { ok: false, error: "Football fixtures temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
