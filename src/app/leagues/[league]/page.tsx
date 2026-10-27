import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchList } from "@/components/MatchList";
import { SafeLogo } from "@/components/SafeLogo";
import { SiteHeader } from "@/components/SiteHeader";
import { prettyDate } from "@/lib/dates";
import { getLeagueFixtures, resolveLeague, type Fixture, type LeagueCatalogItem } from "@/lib/football";
import { footballDataContext } from "@/lib/football-config";

type Props = { params: Promise<{ league: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { league } = await params;

  try {
    const competition = await resolveLeague(league);
    if (!competition) return { title: "League not found" };

    return {
      title: `${competition.name} Fixtures & Results | Live Sports`,
      description: `${competition.name} fixtures and results for season ${competition.season.year}.`,
    };
  } catch (error) {
    console.error("League metadata API error", { league, error });
    return {
      title: "League fixtures | Live Sports",
      description: "Football league fixtures and results.",
    };
  }
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
    ["Top assists", coverage.top_assists],
    ["Top cards", coverage.top_cards],
    ["Injuries", coverage.injuries],
    ["Predictions", coverage.predictions],
    ["Odds", coverage.odds],
  ] as const;
}

export default async function LeaguePage({ params }: Props) {
  const { league } = await params;
  const dataContext = footballDataContext();
  let competition: LeagueCatalogItem | null = null;
  let fixtures: Fixture[] = [];
  let apiError = false;

  try {
    competition = await resolveLeague(league);
  } catch (error) {
    apiError = true;
    console.error("Unable to resolve API-Football league", { league, error });
  }

  if (!competition && !apiError) notFound();

  if (competition) {
    try {
      fixtures = await getLeagueFixtures(competition.routeKey);
    } catch (error) {
      apiError = true;
      console.error("Unable to load API-Football league fixtures", {
        league: competition.routeKey,
        error,
      });
    }
  }

  if (!competition) {
    return (
      <main>
        <SiteHeader />
        <section className="content pageTop">
          <div className="notice error">
            League data could not be loaded from API-Football right now. Please try again later.
          </div>
          <div className="cardActions leaguePageActions">
            <Link href="/leagues">All leagues</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <div className="leagueHero">
          <SafeLogo src={competition.logo} alt={competition.name} fallbackText={competition.name} size={64} />
          <div>
            <div className="leagueCountryMeta">
              {competition.country.flag ? (
                <SafeLogo
                  src={competition.country.flag}
                  alt={competition.country.name}
                  fallbackText={competition.country.name}
                  size={18}
                />
              ) : null}
              <p className="eyebrow">
                {competition.country.name}
                {competition.country.code ? ` · ${competition.country.code}` : ""}
                {" · "}{competition.type}
              </p>
            </div>
            <h1 className="pageTitle">{competition.name}</h1>
            <p className="muted">
              Season {competition.season.year}. Competition identity, season and coverage are supplied by API-Football.
            </p>
          </div>
        </div>

        <div className="leagueSeasonFacts">
          <div>
            <span>Season</span>
            <strong>{competition.season.year}</strong>
          </div>
          <div>
            <span>Starts</span>
            <strong>{competition.season.start ? prettyDate(competition.season.start) : "—"}</strong>
          </div>
          <div>
            <span>Ends</span>
            <strong>{competition.season.end ? prettyDate(competition.season.end) : "—"}</strong>
          </div>
          <div>
            <span>Current season</span>
            <strong className={competition.season.current ? "seasonState current" : "seasonState"}>
              {competition.season.current ? "Yes" : "No"}
            </strong>
          </div>
        </div>

        {dataContext.isHistoricalDevelopmentData ? (
          <div className="notice">
            Free-plan development mode is showing API-Football season {competition.season.year}. Switch <code>API_FOOTBALL_DATA_MODE</code> to <code>current</code> after upgrading the API plan.
          </div>
        ) : null}

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

        {apiError ? (
          <div className="notice error">
            API-Football could not return fixtures for this competition right now. The page remains available instead of failing.
          </div>
        ) : (
          <MatchList fixtures={fixtures} />
        )}
      </section>
    </main>
  );
}
