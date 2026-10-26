import { LeagueCatalog, type LeagueCatalogRow } from "@/components/LeagueCatalog";
import { SiteHeader } from "@/components/SiteHeader";
import { getFootballLeagueCatalog, type LeagueCatalogItem } from "@/lib/football";

export const metadata = {
  title: "Football Leagues & Cups | Live Sports",
  description: "Browse the current football leagues and cups returned by API-Football.",
};

export default async function LeaguesPage() {
  let catalogue: LeagueCatalogItem[] = [];
  let apiError = false;

  try {
    catalogue = await getFootballLeagueCatalog();
  } catch {
    apiError = true;
  }

  const rows: LeagueCatalogRow[] = catalogue.map((league) => ({
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
        <p className="eyebrow">API-FOOTBALL CATALOGUE</p>
        <h1 className="pageTitle">Leagues & cups</h1>
        <p className="muted">
          This catalogue is generated from API-Football&apos;s current competitions and cached for 24 hours.
          No league names, IDs, countries or logos are maintained locally.
        </p>

        {apiError ? (
          <div className="notice error allLeaguesNotice">
            The API-Football competition catalogue could not be loaded right now.
          </div>
        ) : rows.length ? (
          <LeagueCatalog leagues={rows} />
        ) : (
          <div className="notice allLeaguesNotice">
            No current competitions were returned by API-Football.
          </div>
        )}
      </section>
    </main>
  );
}
