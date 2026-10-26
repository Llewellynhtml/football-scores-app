import { CompetitionFilter } from "@/components/CompetitionFilter";
import { DateNav } from "@/components/DateNav";
import { FootballSidebar } from "@/components/FootballSidebar";
import { MatchList } from "@/components/MatchList";
import { SiteHeader } from "@/components/SiteHeader";
import { StatusFilter } from "@/components/StatusFilter";
import { getCompetition } from "@/config/competitions";
import { dateInSouthAfrica, isISODate, prettyDate } from "@/lib/dates";
import { getFixturesByDate, type Fixture } from "@/lib/football";

type PageProps = {
  searchParams: Promise<{ date?: string; league?: string; status?: string }>;
};

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"]);
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const SCHEDULED_STATUSES = new Set(["NS", "TBD"]);

export default async function Home({ searchParams }: PageProps) {
  const query = await searchParams;
  const date = isISODate(query.date) ? query.date : dateInSouthAfrica();
  const selectedCompetition = query.league ? getCompetition(query.league) : undefined;
  const status = ["live", "finished", "scheduled"].includes(query.status ?? "")
    ? query.status!
    : "all";

  let fixtures: Fixture[] = [];
  let apiError = false;

  try {
    fixtures = await getFixturesByDate(date);
  } catch {
    apiError = true;
  }

  if (selectedCompetition) {
    fixtures = fixtures.filter((fixture) => fixture.league.id === selectedCompetition.id);
  }

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
              <p>{prettyDate(date)} · South Africa time</p>
            </div>
            <div className="scoreboardMetric">
              <span>{fixtures.length}</span>
              <small>matches</small>
            </div>
          </section>

          <section className="scorePanel">
            <DateNav date={date} league={selectedCompetition?.slug} />
            <StatusFilter date={date} league={selectedCompetition?.slug} selected={status} />
            <CompetitionFilter date={date} selected={selectedCompetition?.slug} />

            <div className="sectionHeading compactScoreHeading">
              <div>
                <p className="eyebrow">{selectedCompetition?.country ?? "WORLD"}</p>
                <h2>{selectedCompetition?.name ?? "All competitions"}</h2>
              </div>
              <span className="badge">{fixtures.length} fixtures</span>
            </div>

            {!process.env.API_FOOTBALL_KEY && (
              <div className="notice">
                API integration is ready. Add <code>API_FOOTBALL_KEY</code> in Hostinger environment variables to load football data.
              </div>
            )}

            {apiError && (
              <div className="notice error">
                Football data could not be loaded right now. The application itself is still online.
              </div>
            )}

            <MatchList fixtures={fixtures} />
          </section>
        </div>
      </div>
    </main>
  );
}
