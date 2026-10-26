import { SafeLogo } from "@/components/SafeLogo";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getRugbyLeagues, rugbyConfigured } from "@/sports/rugby/provider";
import type { RugbyLeague } from "@/sports/rugby/types";

export const metadata = {
  title: "Rugby Competitions | Live Sports",
  description: "Browse rugby leagues and cups available through API-Sports.",
};

export default async function RugbyLeaguesPage() {
  let leagues: RugbyLeague[] = [];
  let apiError = false;

  try {
    leagues = await getRugbyLeagues();
  } catch {
    apiError = true;
  }

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <p className="eyebrow">RUGBY</p>
        <h1 className="pageTitle">Competitions</h1>
        <p className="muted">Browse available rugby leagues and cups.</p>

        {!rugbyConfigured() && (
          <div className="notice">
            Add <code>API_RUGBY_KEY</code> in Hostinger to load the competition catalogue.
          </div>
        )}

        {apiError && <div className="notice error">The Rugby competition catalogue could not be loaded.</div>}

        <div className="cardGrid">
          {leagues.slice(0, 60).map((league) => (
            <article className="featureCard" key={league.id}>
              <SafeLogo src={league.logo ?? null} alt={league.name} fallbackText={league.name} size={38} />
              {league.country?.name ? <span className="featureCode">{league.country.name}</span> : null}
              <h2>{league.name}</h2>
              {league.type ? <p>{league.type}</p> : null}
              <div className="cardActions">
                <Link href={`/sports/rugby/leagues/${league.id}`}>Open</Link>
              </div>
            </article>
          ))}
        </div>

        {rugbyConfigured() && leagues.length === 0 && !apiError ? (
          <div className="emptyState"><h3>No competitions returned</h3><p>Check Rugby API coverage or account access.</p></div>
        ) : null}
      </section>
    </main>
  );
}
