import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchList } from "@/components/MatchList";
import { SafeLogo } from "@/components/SafeLogo";
import { SiteHeader } from "@/components/SiteHeader";
import { getCompetition } from "@/config/competitions";
import { getLeagueSnapshot } from "@/lib/football";

type Props = { params: Promise<{ league: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { league } = await params;
  const competition = getCompetition(league);
  if (!competition) return { title: "League not found" };
  return {
    title: `${competition.name} Fixtures, Teams & Standings | Live Sports`,
    description: `${competition.name} fixtures, teams, standings and API-Football coverage for the current season.`,
  };
}

function coverageItems(coverage: NonNullable<Awaited<ReturnType<typeof getLeagueSnapshot>>>["metadata"] extends infer M
  ? M extends { season: { coverage: infer C } } ? C : never
  : never) {
  if (!coverage) return [];
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
  const competition = getCompetition(league);
  if (!competition) notFound();

  const snapshot = await getLeagueSnapshot(league);
  if (!snapshot) notFound();

  const coverage = snapshot.metadata?.season.coverage;

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <div className="leagueHero">
          <SafeLogo
            src={snapshot.metadata?.logo}
            alt={competition.name}
            fallbackText={competition.shortName}
            size={64}
          />
          <div>
            <p className="eyebrow">{competition.country}</p>
            <h1 className="pageTitle">{competition.name}</h1>
            <p className="muted">
              Season {snapshot.season}. League metadata and team lists are cached daily;
              standings and the fixture window are cached for 12 hours.
            </p>
          </div>
        </div>

        <div className="leagueSnapshotStats">
          <div><strong>{snapshot.teams.length}</strong><span>Teams</span></div>
          <div><strong>{snapshot.standings.length}</strong><span>Table rows</span></div>
          <div><strong>{snapshot.fixtures.length}</strong><span>Fixture window</span></div>
          <div><strong>{snapshot.metadata?.season.current ? "Current" : snapshot.season}</strong><span>Season</span></div>
        </div>

        {coverage ? (
          <section className="leagueDataSection">
            <div className="sectionHeading compactScoreHeading">
              <div>
                <p className="eyebrow">API-FOOTBALL COVERAGE</p>
                <h2>Available league data</h2>
              </div>
            </div>
            <div className="coverageGrid">
              {coverageItems(coverage).map(([label, available]) => (
                <span className={available ? "coverageChip available" : "coverageChip"} key={label}>
                  <span aria-hidden="true">{available ? "✓" : "–"}</span>
                  {label}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="leagueDataSection">
          <div className="sectionHeading compactScoreHeading">
            <div>
              <p className="eyebrow">CURRENT SEASON</p>
              <h2>Teams</h2>
            </div>
            <span className="badge">{snapshot.teams.length}</span>
          </div>

          <div className="leagueTeamsGrid">
            {snapshot.teams.map((team) => (
              <Link className="leagueTeamCard" href={`/teams/${team.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`} key={team.id} prefetch={false}>
                <SafeLogo src={team.logo} alt={team.name} fallbackText={team.name} size={34} />
                <span>{team.name}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="leagueDataSection">
          <div className="sectionHeading compactScoreHeading">
            <div>
              <p className="eyebrow">TABLE</p>
              <h2>Top standings</h2>
            </div>
            <Link className="button" href={`/standings/${competition.slug}`}>Full standings</Link>
          </div>

          <div className="miniStandings">
            {snapshot.standings.slice(0, 6).map((row) => (
              <div className="miniStandingRow" key={row.team.id}>
                <strong>{row.rank}</strong>
                <SafeLogo src={row.team.logo} alt={row.team.name} fallbackText={row.team.name} size={24} />
                <span>{row.team.name}</span>
                <b>{row.points} pts</b>
              </div>
            ))}
          </div>
        </section>

        <section className="leagueDataSection">
          <div className="sectionHeading">
            <div>
              <p className="eyebrow">FIXTURES</p>
              <h2>Recent & upcoming</h2>
            </div>
            <span className="badge">{snapshot.fixtures.length} matches</span>
          </div>
          <MatchList fixtures={snapshot.fixtures} />
        </section>
      </section>
    </main>
  );
}
