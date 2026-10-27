import Link from "next/link";
import { RugbyGameList } from "@/components/RugbyGameList";
import { LocalDateTime } from "@/components/LocalDateTime";
import { SiteHeader } from "@/components/SiteHeader";
import { dateInUtc } from "@/lib/dates";
import { getRugbyGamesByDate, rugbyConfigured } from "@/sports/rugby/provider";
import type { RugbyGame } from "@/sports/rugby/types";

export const metadata = {
  title: "Rugby Scores & Fixtures | Live Sports",
  description: "Rugby fixtures, results and live scores from competitions around the world.",
};

export default async function RugbyPage() {
  const date = dateInUtc();

  let games: RugbyGame[] = [];
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
        <div className="rugbyActions">
          <Link className="button secondary" href="/sports/rugby/leagues">Browse competitions</Link>
        </div>

        <div className="sectionHeading">
          <div>
            <p className="eyebrow">MATCH DAY</p>
            <h2><LocalDateTime value={date} mode="date" /></h2>
          </div>
          <span className="badge">{apiError ? "—" : games.length} games</span>
        </div>

        {!rugbyConfigured() && (
          <div className="notice">
            Rugby is implemented but not consuming API requests yet. Add <code>API_RUGBY_KEY</code> in Hostinger to activate live data.
          </div>
        )}

        {apiError ? (
          <div className="notice error">
            API-Sports could not return Rugby data right now. This is usually caused by a temporary rate limit, daily quota, or provider availability issue.
          </div>
        ) : (
          <RugbyGameList games={games} />
        )}
      </section>
    </main>
  );
}
