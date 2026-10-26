import { NextResponse } from "next/server";
import { checkAllSportStatuses } from "@/sports/generic/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  const sports = await checkAllSportStatuses();
  return NextResponse.json({
    ok: sports.every((sport) => !sport.configured || sport.reachable),
    note: "API-Sports status requests do not count against the daily quota.",
    sports,
    timestamp: new Date().toISOString(),
  });
}
