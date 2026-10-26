import Link from "next/link";
import { DateNav } from "@/components/DateNav";
import { RugbyGameList } from "@/components/RugbyGameList";
import { SiteHeader } from "@/components/SiteHeader";
import { dateInSouthAfrica, isISODate, prettyDate } from "@/lib/dates";
import { getRugbyGamesByDate, rugbyConfigured } from "@/sports/rugby/provider";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

export const metadata = {
  title: "Rugby Scores & Fixtures | Live Sports",
  description: "Rugby fixtures, results and live scores from competitions around the world.",
};

export default async function RugbyPage({ searchParams }: Props) {
  const query = await searchParams;
  const date = isISODate(query.date) ? query.date : dateInSouthAfrica();

  let games = [];
  let apiError = false;

  try {
    games = await getRugbyGamesByDate(date);
  } catch {
    apiError = true;
  }

  return (
    <main>
      <SiteHeader />

      <section className="hero compactHero">
        <p className="eyebrow">RUGBY</p>
        <h1>Rugby scores and fixtures.</h1>
        <p>Follow rugby fixtures and results with a quota-safe, server-cached data layer.</p>
      </section>

      <section className="content">
        <DateNav date={date} />

        <div className="rugbyActions">
          <Link className="button secondary" href="/sports/rugby/leagues">Browse competitions</Link>
        </div>

        <div className="sectionHeading">
          <div>
            <p className="eyebrow">MATCH DAY</p>
            <h2>{prettyDate(date)}</h2>
          </div>
          <span className="badge">{games.length} games</span>
        </div>

        {!rugbyConfigured() && (
          <div className="notice">
            Rugby is implemented but not consuming API requests yet. Add <code>API_RUGBY_KEY</code> in Hostinger to activate live data.
          </div>
        )}

        {apiError && (
          <div className="notice error">
            Rugby data could not be loaded right now. The rest of the platform is still available.
          </div>
        )}

        <RugbyGameList games={games} />
      </section>
    </main>
  );
}
