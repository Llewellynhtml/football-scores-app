import { NextRequest, NextResponse } from "next/server";
import { FEATURED_COMPETITIONS, getCompetition } from "@/config/competitions";
import { dateInSouthAfrica } from "@/lib/dates";
import { getApiUsage } from "@/lib/api-usage";
import { getFixturesByDate, getLeagueSnapshot, getStandings } from "@/lib/football";

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

  if (mode === "standings") {
    const warmed: Record<string, number> = {};
    for (const competition of FEATURED_COMPETITIONS) {
      const table = await getStandings(competition.slug);
      warmed[competition.slug] = table.length;
    }
    return NextResponse.json({ ok: true, mode, warmed, usage: getApiUsage() });
  }

  if (mode === "league") {
    const slug = request.nextUrl.searchParams.get("league") ?? "";
    const competition = getCompetition(slug);
    if (!competition) {
      return NextResponse.json({ ok: false, error: "Unknown featured league" }, { status: 400 });
    }

    const snapshot = await getLeagueSnapshot(slug);
    return NextResponse.json({
      ok: true,
      mode,
      league: slug,
      warmed: snapshot ? {
        teams: snapshot.teams.length,
        standings: snapshot.standings.length,
        fixtures: snapshot.fixtures.length,
        coverage: Boolean(snapshot.metadata),
      } : null,
      usage: getApiUsage(),
    });
  }

  if (mode === "featured-leagues") {
    const warmed: Record<string, { teams: number; standings: number; fixtures: number }> = {};
    for (const competition of FEATURED_COMPETITIONS) {
      const snapshot = await getLeagueSnapshot(competition.slug);
      if (snapshot) {
        warmed[competition.slug] = {
          teams: snapshot.teams.length,
          standings: snapshot.standings.length,
          fixtures: snapshot.fixtures.length,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      mode,
      note: "Cold cache can use up to four provider calls per featured league. Run this sparingly on the free plan.",
      warmed,
      usage: getApiUsage(),
    });
  }

  return NextResponse.json({ ok: false, error: "Unsupported mode" }, { status: 400 });
}
