import Link from "next/link";
import { LeagueCatalog, type LeagueCatalogRow } from "@/components/LeagueCatalog";
import { SiteHeader } from "@/components/SiteHeader";
import { FEATURED_COMPETITIONS } from "@/config/competitions";
import { getFootballLeagueCatalog } from "@/lib/football";

export const metadata = {
  title: "Football Leagues & Cups | Live Sports",
  description: "Browse featured competitions and all current-season football leagues and cups available from API-Football.",
};

export default async function LeaguesPage() {
  let catalogue = [];
  let apiError = false;

  try {
    catalogue = await getFootballLeagueCatalog();
  } catch {
    apiError = true;
  }

  const featuredIds = new Set(FEATURED_COMPETITIONS.map((competition) => competition.id));
  const allRows: LeagueCatalogRow[] = catalogue
    .filter((league) => !featuredIds.has(league.id))
    .map((league) => ({
      id: league.id,
      name: league.name,
      type: league.type,
      logo: league.logo,
      country: league.country.name,
      routeKey: league.routeKey,
      standings: league.season.coverage.standings,
    }));

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <p className="eyebrow">FEATURED COMPETITIONS</p>
        <h1 className="pageTitle">Leagues</h1>
        <p className="muted">
          Featured competitions are pinned for quick access. The complete current-season
          catalogue below is fetched once and cached for 24 hours to protect the free API quota.
        </p>

        <div className="cardGrid">
          {FEATURED_COMPETITIONS.map((competition) => (
            <article className="featureCard" key={competition.id}>
              <span className="featureCode">{competition.shortName}</span>
              <h2>{competition.name}</h2>
              <p>{competition.country}</p>
              <div className="cardActions">
                <Link href={`/leagues/${competition.slug}`}>Fixtures</Link>
                <Link href={`/standings/${competition.slug}`}>Standings</Link>
              </div>
            </article>
          ))}
        </div>

        {apiError ? (
          <div className="notice error allLeaguesNotice">
            The full API-Football league catalogue could not be loaded right now. Featured leagues remain available.
          </div>
        ) : allRows.length ? (
          <LeagueCatalog leagues={allRows} />
        ) : (
          <div className="notice allLeaguesNotice">
            The full catalogue will appear when the API-Football key is available and the current season has competitions.
          </div>
        )}
      </section>
    </main>
  );
}
