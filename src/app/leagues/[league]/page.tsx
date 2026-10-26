import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchList } from "@/components/MatchList";
import { SafeLogo } from "@/components/SafeLogo";
import { SiteHeader } from "@/components/SiteHeader";
import { getLeagueFixtures, resolveLeague } from "@/lib/football";

type Props = { params: Promise<{ league: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { league } = await params;
  const competition = await resolveLeague(league);
  if (!competition) return { title: "League not found" };

  return {
    title: `${competition.name} Fixtures & Results | Live Sports`,
    description: `${competition.name} fixtures and results for season ${competition.season.year}.`,
  };
}

function coverageItems(coverage: NonNullable<Awaited<ReturnType<typeof resolveLeague>>>["season"]["coverage"]) {
  return [
    ["Events", coverage.fixtures.events],
    ["Lineups", coverage.fixtures.lineups],
    ["Match stats", coverage.fixtures.statistics_fixtures],
    ["Player stats", coverage.fixtures.statistics_players],
    ["Standings", coverage.standings],
    ["Players", coverage.players],
    ["Top scorers", coverage.top_scorers],
    ["Injuries", coverage.injuries],
    ["Predictions", coverage.predictions],
  ] as const;
}

export default async function LeaguePage({ params }: Props) {
  const { league } = await params;
  const competition = await resolveLeague(league);
  if (!competition) notFound();

  const fixtures = await getLeagueFixtures(league);

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <div className="leagueHero">
          <SafeLogo src={competition.logo} alt={competition.name} fallbackText={competition.name} size={64} />
          <div>
            <p className="eyebrow">{competition.country.name} · {competition.type}</p>
            <h1 className="pageTitle">{competition.name}</h1>
            <p className="muted">
              Season {competition.season.year}. Competition identity, season and coverage are supplied by API-Football.
            </p>
          </div>
        </div>

        <div className="coverageGrid leagueCoverageCompact">
          {coverageItems(competition.season.coverage).map(([label, available]) => (
            <span className={available ? "coverageChip available" : "coverageChip"} key={label}>
              <span aria-hidden="true">{available ? "✓" : "–"}</span>
              {label}
            </span>
          ))}
        </div>

        <div className="sectionHeading">
          <div>
            <p className="eyebrow">FIXTURES</p>
            <h2>Recent & upcoming</h2>
          </div>
          <div className="cardActions leaguePageActions">
            {competition.season.coverage.standings ? (
              <Link href={`/standings/${competition.routeKey}`}>Standings</Link>
            ) : null}
            <Link href="/leagues">All leagues</Link>
          </div>
        </div>

        <MatchList fixtures={fixtures} />
      </section>
    </main>
  );
}
