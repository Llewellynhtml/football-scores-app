import { NextRequest, NextResponse } from "next/server";
import { dateInSouthAfrica } from "@/lib/dates";
import { getApiUsage } from "@/lib/api-usage";
import {
  getFixturesByDate,
  getFootballLeagueCatalog,
  getLeagueSnapshot,
  getStandings,
  resolveLeague,
} from "@/lib/football";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get("mode") ?? "fixtures";

  if (mode === "fixtures") {
    const fixtures = await getFixturesByDate(dateInSouthAfrica());
    return NextResponse.json({ ok: true, mode, warmed: fixtures.length, usage: getApiUsage() });
  }

  if (mode === "catalog") {
    const leagues = await getFootballLeagueCatalog();
    return NextResponse.json({ ok: true, mode, warmed: leagues.length, usage: getApiUsage() });
  }

  if (mode === "standings") {
    const league = request.nextUrl.searchParams.get("league") ?? "";
    const competition = await resolveLeague(league);
    if (!competition) {
      return NextResponse.json({ ok: false, error: "Unknown API-Football competition" }, { status: 400 });
    }

    const table = await getStandings(competition.routeKey);
    return NextResponse.json({
      ok: true,
      mode,
      league: competition.routeKey,
      warmed: table.length,
      usage: getApiUsage(),
    });
  }

  if (mode === "league") {
    const league = request.nextUrl.searchParams.get("league") ?? "";
    const competition = await resolveLeague(league);
    if (!competition) {
      return NextResponse.json({ ok: false, error: "Unknown API-Football competition" }, { status: 400 });
    }

    const snapshot = await getLeagueSnapshot(competition.routeKey);
    return NextResponse.json({
      ok: true,
      mode,
      league: competition.routeKey,
      warmed: snapshot ? {
        teams: snapshot.teams.length,
        standings: snapshot.standings.length,
        fixtures: snapshot.fixtures.length,
        coverage: true,
      } : null,
      usage: getApiUsage(),
    });
  }

  return NextResponse.json({ ok: false, error: "Unsupported mode" }, { status: 400 });
}
