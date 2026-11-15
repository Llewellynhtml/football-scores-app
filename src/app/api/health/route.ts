import { NextResponse } from "next/server";
import { enabledSports } from "@/sports/registry";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "live-sports-app",
    footballApiConfigured: Boolean(process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY),
    enabledSports: enabledSports().map((sport) => sport.slug),
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
