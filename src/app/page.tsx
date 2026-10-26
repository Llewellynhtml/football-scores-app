import { CompetitionFilter } from "@/components/CompetitionFilter";
import { DateNav } from "@/components/DateNav";
import { MatchList } from "@/components/MatchList";
import { SiteHeader } from "@/components/SiteHeader";
import { getCompetition } from "@/config/competitions";
import { dateInSouthAfrica, isISODate, prettyDate } from "@/lib/dates";
import { getFixturesByDate, type Fixture } from "@/lib/football";

type PageProps = {
  searchParams: Promise<{ date?: string; league?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  const query = await searchParams;
  const date = isISODate(query.date) ? query.date : dateInSouthAfrica();
  const selectedCompetition = query.league ? getCompetition(query.league) : undefined;

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

  return (
    <main>
      <SiteHeader />

      <section className="hero">
        <p className="eyebrow">MATCH CENTRE</p>
        <h1>Football scores built for speed.</h1>
        <p>
          Browse fixtures and results by date, then drill into leagues, standings,
          teams and individual matches.
        </p>
      </section>

      <section className="content">
        <DateNav date={date} league={selectedCompetition?.slug} />
        <CompetitionFilter date={date} selected={selectedCompetition?.slug} />

        <div className="sectionHeading">
          <div>
            <p className="eyebrow">{selectedCompetition?.name ?? "ALL COMPETITIONS"}</p>
            <h2>{prettyDate(date)}</h2>
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
    </main>
  );
}
