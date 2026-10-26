import { NextRequest, NextResponse } from "next/server";
import { getLeagueSnapshot, resolveLeague } from "@/lib/football";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ league: string }> };

export async function GET(request: NextRequest, { params }: Props) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { league } = await params;
  const competition = await resolveLeague(league);
  if (!competition) {
    return NextResponse.json({ ok: false, error: "Unknown API-Football competition" }, { status: 404 });
  }

  const snapshot = await getLeagueSnapshot(competition.routeKey);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "League snapshot unavailable" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, snapshot });
}
