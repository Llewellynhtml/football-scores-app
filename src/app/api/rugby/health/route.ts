import { NextResponse } from "next/server";
import { rugbyConfigured } from "@/sports/rugby/provider";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    sport: "rugby",
    configured: rugbyConfigured(),
    baseUrl: process.env.API_RUGBY_BASE_URL ?? "https://v1.rugby.api-sports.io",
    timestamp: new Date().toISOString(),
  });
}
