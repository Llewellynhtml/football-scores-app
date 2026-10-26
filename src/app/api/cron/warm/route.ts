import { NextRequest, NextResponse } from "next/server";
import { FEATURED_COMPETITIONS } from "@/config/competitions";
import { dateInSouthAfrica } from "@/lib/dates";
import { getApiUsage } from "@/lib/api-usage";
import { getFixturesByDate, getStandings } from "@/lib/football";

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

  return NextResponse.json({ ok: false, error: "Unsupported mode" }, { status: 400 });
}
