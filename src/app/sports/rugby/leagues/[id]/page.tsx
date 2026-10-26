import Link from "next/link";
import { notFound } from "next/navigation";
import { RugbyGameList } from "@/components/RugbyGameList";
import { SiteHeader } from "@/components/SiteHeader";
import { getRugbyLeagueGames, getRugbyLeagues } from "@/sports/rugby/provider";
import type { RugbyGame, RugbyLeague } from "@/sports/rugby/types";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
};

export default async function RugbyLeaguePage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const leagueId = Number(id);
  if (!Number.isInteger(leagueId)) notFound();

  let leagues: RugbyLeague[] = [];
  let league: RugbyLeague | undefined;
  let games: RugbyGame[] = [];
  let apiError = false;

  try {
    leagues = await getRugbyLeagues();
    league = leagues.find((item) => item.id === leagueId);
  } catch (error) {
    apiError = true;
    console.error("Unable to load API-Rugby league catalogue", { leagueId, error });
  }

  if (!league && !apiError) notFound();

  if (!league) {
    return (
      <main>
        <SiteHeader />
        <section className="content pageTop">
          <div className="notice error">
            Rugby competition data could not be loaded from API-Sports right now. Please try again later.
          </div>
          <Link className="button secondary" href="/sports/rugby/leagues">All rugby competitions</Link>
        </section>
      </main>
    );
  }

  const currentSeason = league.seasons?.find((season) => season.current)?.season
    ?? league.seasons?.[league.seasons.length - 1]?.season;
  const requestedSeason = query.season ? Number(query.season) : undefined;
  const season = Number.isInteger(requestedSeason) ? requestedSeason : currentSeason;

  try {
    games = await getRugbyLeagueGames(leagueId, season);
  } catch (error) {
    apiError = true;
    console.error("Unable to load API-Rugby league fixtures", { leagueId, season, error });
  }

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        {league.country?.name ? <p className="eyebrow">{league.country.name}</p> : null}
        <h1 className="pageTitle">{league.name}</h1>
        {season ? <p className="muted">Season {season}</p> : null}

        {apiError ? (
          <div className="notice error">
            API-Sports could not return fixtures for this rugby competition right now. The page remains available.
          </div>
        ) : (
          <RugbyGameList games={games} />
        )}
      </section>
    </main>
  );
}
