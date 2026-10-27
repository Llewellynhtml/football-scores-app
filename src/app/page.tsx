import { CompetitionFilter } from "@/components/CompetitionFilter";
import { FootballSidebar } from "@/components/FootballSidebar";
import { MatchList } from "@/components/MatchList";
import { LocalDateTime } from "@/components/LocalDateTime";
import { SiteHeader } from "@/components/SiteHeader";
import { StatusFilter } from "@/components/StatusFilter";
import { competitionsFromFixtures, getFixturesByDate, type Fixture } from "@/lib/football";
import { footballDataContext, footballQueryDate } from "@/lib/football-config";
import { slugify } from "@/lib/slug";

type PageProps = {
  searchParams: Promise<{ league?: string; status?: string }>;
};

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"]);
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const SCHEDULED_STATUSES = new Set(["NS", "TBD"]);

export default async function Home({ searchParams }: PageProps) {
  const query = await searchParams;
  const date = footballQueryDate();
  const dataContext = footballDataContext();
  const status = ["live", "finished", "scheduled"].includes(query.status ?? "")
    ? query.status!
    : "all";

  let dayFixtures: Fixture[] = [];
  let apiError: string | null = null;

  try {
    dayFixtures = await getFixturesByDate(date);
  } catch (error) {
    apiError = error instanceof Error ? error.message : "Football data request failed";
    console.error("Unable to load football fixtures", error);
  }

  const competitions = competitionsFromFixtures(dayFixtures);
  const selectedCompetition = query.league
    ? competitions.find(
        (competition) =>
          competition.routeKey === query.league || slugify(competition.name) === query.league,
      )
    : undefined;

  let fixtures = selectedCompetition
    ? dayFixtures.filter((fixture) => fixture.league.id === selectedCompetition.id)
    : dayFixtures;

  if (status === "live") {
    fixtures = fixtures.filter((fixture) => LIVE_STATUSES.has(fixture.status));
  } else if (status === "finished") {
    fixtures = fixtures.filter((fixture) => FINISHED_STATUSES.has(fixture.status));
  } else if (status === "scheduled") {
    fixtures = fixtures.filter((fixture) => SCHEDULED_STATUSES.has(fixture.status));
  }

  return (
    <main>
      <SiteHeader />

      <div className="scoreboardShell">
        <FootballSidebar />

        <div className="scoreMain">
          <section className="scoreboardIntro">
            <div>
              <p className="eyebrow">FOOTBALL</p>
              <h1>Scores & fixtures</h1>
              <p><LocalDateTime value={date} mode="date" /> · Your local time</p>
            </div>
            <div className="scoreboardMetric">
              <span>{apiError ? "—" : fixtures.length}</span>
              <small>matches</small>
            </div>
          </section>

          <section className="scorePanel">
            {dataContext.isHistoricalDevelopmentData ? (
              <div className="notice">
                Free-plan development mode is using season {dataContext.freeSeason} data. Visitor times are shown in each viewer&apos;s local timezone.
              </div>
            ) : null}

            {!process.env.API_FOOTBALL_KEY && !process.env.API_SPORTS_KEY ? (
              <div className="notice">
                API integration is ready. Add the API-Sports key in Hostinger environment variables to load football data.
              </div>
            ) : apiError ? (
              <div className="notice error">
                API-Football could not return the current fixture data. This is usually caused by a temporary rate limit, daily quota, or provider availability issue.
              </div>
            ) : (
              <>
                <StatusFilter league={selectedCompetition?.routeKey} selected={status} />
                <CompetitionFilter
                  competitions={competitions}
                  selected={selectedCompetition?.routeKey}
                  status={status}
                />

                <div className="sectionHeading compactScoreHeading">
                  <div>
                    {selectedCompetition?.country ? <p className="eyebrow">{selectedCompetition.country}</p> : null}
                    <h2>{selectedCompetition?.name ?? "All competitions"}</h2>
                  </div>
                  <span className="badge">{fixtures.length} fixtures</span>
                </div>

                <MatchList fixtures={fixtures} />
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
