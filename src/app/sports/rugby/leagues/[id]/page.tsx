import { notFound } from "next/navigation";
import { RugbyGameList } from "@/components/RugbyGameList";
import { SiteHeader } from "@/components/SiteHeader";
import { getRugbyLeagueGames, getRugbyLeagues } from "@/sports/rugby/provider";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
};

export default async function RugbyLeaguePage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const leagueId = Number(id);
  if (!Number.isInteger(leagueId)) notFound();

  const leagues = await getRugbyLeagues();
  const league = leagues.find((item) => item.id === leagueId);
  if (!league) notFound();

  const currentSeason = league.seasons?.find((season) => season.current)?.season
    ?? league.seasons?.[league.seasons.length - 1]?.season;
  const requestedSeason = query.season ? Number(query.season) : undefined;
  const season = Number.isInteger(requestedSeason) ? requestedSeason : currentSeason;

  const games = await getRugbyLeagueGames(leagueId, season);

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        {league.country?.name ? <p className="eyebrow">{league.country.name}</p> : null}
        <h1 className="pageTitle">{league.name}</h1>
        <p className="muted">{season ? `Season ${season}` : "Current competition schedule"}</p>
        <RugbyGameList games={games} />
      </section>
    </main>
  );
}
