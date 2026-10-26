import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "football-scores-app",
    apiConfigured: Boolean(process.env.API_FOOTBALL_KEY),
    timestamp: new Date().toISOString(),
  });
}
